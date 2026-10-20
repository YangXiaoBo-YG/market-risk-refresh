'use client';
import {useMemo,useState} from 'react';
import {CartesianGrid,ComposedChart,Line,ResponsiveContainer,Tooltip,XAxis,YAxis} from 'recharts';
import type {NebiusSpot} from '../lib/analytics';
import {useDateRange} from './date-range';
import {downloadCsv} from '../lib/csv';
const colors=['#55d9bd','#79b9ff','#f8b45a','#c6a0ff','#fa86a0','#d9d969'];
const fmt=(value:number)=>value.toLocaleString('en-US',{maximumFractionDigits:4});
const utc=(value?:string)=>value?value.slice(0,19).replace('T',' ')+' UTC':'—';
export default function NebiusSpotPanel({data}:{data?:NebiusSpot}){
 const [gpu,setGpu]=useState('H200'),[region,setRegion]=useState('all'),[chosen,setChosen]=useState<string[]|null>(null),[frequency,setFrequency]=useState('hour');
 const current=data?.current||[],series=data?.series||[];
 const gpus=[...new Set([...current,...series].map(s=>s.gpu))].sort();
 const regions=[...new Set([...current,...series].filter(s=>gpu==='all'||s.gpu===gpu).map(s=>s.region))].sort();
 const available=series.filter(s=>(gpu==='all'||s.gpu===gpu)&&(region==='all'||s.region===region));
 const selected=chosen??available.slice(0,6).map(s=>s.id),lines=available.filter(s=>selected.includes(s.id));
 const range=useDateRange(lines.flatMap(s=>s.points.map(p=>p.timestamp.slice(0,10))));
 const filtered=lines.map(s=>({...s,points:range.filter(s.points.map(p=>({...p,date:p.timestamp.slice(0,10)})))}));
 const fullDates=series.flatMap(s=>s.points.map(p=>p.timestamp)).sort(),totalPoints=fullDates.length;
 const multiYear=!!(range.from&&range.to&&range.from.slice(0,4)!==range.to.slice(0,4));
 function exportHours(){downloadCsv('nebius-spot-all-hourly.csv',['gpu','region','sku_id','platform','timestamp_utc','usd_per_gpu_hour'],series.flatMap(s=>s.points.map(p=>[s.gpu,s.region,s.skuId,s.platform,p.timestamp,p.value])));}
 const daily=frequency==='day'||filtered.some(s=>s.points.length>5000);
 const rows=useMemo(()=>{
  const map=new Map<string,Record<string,string|number|null>>();
  for(const s of filtered){const points=daily?[...new Map(s.points.map(p=>[p.date,p])).values()]:s.points;let previous:number|undefined;
   for(const p of points){const timestamp=daily?p.date+'T00:00:00.000Z':p.timestamp,time=Date.parse(timestamp),step=daily?86400000:3600000;
    if(previous!=null&&time-previous>step){const gap=previous+step,key=new Date(gap).toISOString();const row=map.get(key)||{time:gap};row[s.id]=null;map.set(key,row);}
    const row=map.get(timestamp)||{time};row[s.id]=p.value;map.set(timestamp,row);previous=time;
   }
  }
  return [...map.values()].sort((a,b)=>Number(a.time)-Number(b.time));
 },[data,gpu,region,chosen,range.from,range.to,daily]);
 const items=current.filter(s=>(gpu==='all'||s.gpu===gpu)&&(region==='all'||s.region===region)).sort((a,b)=>a.gpu.localeCompare(b.gpu)||a.region.localeCompare(b.region));
 const stale=!!data?.snapshotTime&&Date.now()-Date.parse(data.snapshotTime)>6*3600000;
 return <article className="panel"><h3>Nebius Spot · 分地区动态租金</h3><p className="notice">Nebius 官方公开接口 · 美元／GPU·小时。可抢占实例可能被回收；这是该平台的公开 Spot 价格，不是全市场成交指数，也不保证有可用容量。与按需挂牌价、from 起价分开显示。</p>
 {!data&&<p className="notice">等待首次云端采集；未接入前不展示模拟价格。</p>}
 {(data?.error||data?.historyError||stale)&&<p className="notice">{data?.error?'当前报价读取失败：'+data.error+'；保留上次成功报价。 ':''}{data?.historyError?'历史读取失败：'+data.historyError+'；保留已存历史。 ':''}{stale?'官方快照距现在超过 6 小时，请核对来源状态。':''}</p>}
 <p className="fine">检查：{utc(data?.checkedAt)} · 官方报价快照：{utc(data?.snapshotTime)} · 历史最后成功检查：{utc(data?.historyLastSuccess)}</p>
 <div className="compare-toolbar"><label>GPU <select value={gpu} onChange={e=>{setGpu(e.target.value);setRegion('all');setChosen(null)}}><option value="all">全部 GPU</option>{gpus.map(g=><option key={g}>{g}</option>)}</select></label><label>地区 <select value={region} onChange={e=>{setRegion(e.target.value);setChosen(null)}}><option value="all">全部地区</option>{regions.map(r=><option key={r}>{r}</option>)}</select></label><label>采样 <select value={frequency} onChange={e=>setFrequency(e.target.value)}><option value="hour">每小时末价</option><option value="day">每日最后观测值</option></select></label></div>
 <p className="notice">长期历史：{fullDates[0]?.slice(0,10)||'—'} 至 {fullDates.at(-1)?.slice(0,10)||'—'} · {totalPoints.toLocaleString()} 条小时观测。保留全部已采集历史，不设 2／3／4／5 年删除期限；随着采集持续，可选择多年或全部区间。</p><div className="compare-toolbar"><button disabled={!totalPoints} onClick={exportHours}>导出全部小时历史 CSV</button><a href="data/nebius-spot/index.json" target="_blank" rel="noreferrer">月度原始归档索引 ↗</a></div><h4>价格历史 · 最多 6 条</h4><div className="compare-picker">{available.map(s=><label key={s.id} className={selected.includes(s.id)?'picked':''}><input type="checkbox" checked={selected.includes(s.id)} disabled={!selected.includes(s.id)&&selected.length>=6} onChange={()=>setChosen(selected.includes(s.id)?selected.filter(id=>id!==s.id):[...selected,s.id])}/><span>{s.gpu} · {s.region}<small>{current.some(c=>c.id===s.id)?s.platform:'当前列表未列出，保留历史'}</small></span></label>)}</div>
 {range.controls}<div className="legend">{lines.map((s,i)=><span key={s.id} style={{color:colors[i]}}>● {s.gpu} · {s.region}</span>)}</div>
 {rows.length?<div style={{height:330,width:'100%'}}><ResponsiveContainer width="100%" height="100%"><ComposedChart data={rows} margin={{top:18,right:18,left:0,bottom:8}}><CartesianGrid vertical={false} stroke="#26313f" strokeDasharray="3 5"/><XAxis dataKey="time" type="number" scale="time" domain={['dataMin','dataMax']} minTickGap={65} tickFormatter={v=>new Date(v).toISOString().slice(multiYear?0:5,daily?10:16).replace('T',' ')} tick={{fill:'#8392a8',fontSize:12}}/><YAxis domain={[0,'auto']} width={65} tickFormatter={v=>'$'+fmt(v)} tick={{fill:'#8392a8',fontSize:12}}/><Tooltip contentStyle={{background:'#142130',border:'1px solid #354458',color:'#e8f0fa'}} labelFormatter={v=>daily?new Date(Number(v)).toISOString().slice(0,10)+' UTC · 当日最后观测':utc(new Date(Number(v)).toISOString())} formatter={(v:any,id:any)=>['$'+fmt(Number(v))+' / GPU·h',lines.find(s=>s.id===id)?.gpu+' · '+lines.find(s=>s.id===id)?.region]}/>{lines.map((s,i)=><Line key={s.id} dataKey={s.id} type="linear" stroke={colors[i]} strokeWidth={2} connectNulls={false} dot={rows.length<35?{r:3}:false} isAnimationActive={false}/>)}</ComposedChart></ResponsiveContainer></div>:<div className="empty" style={{height:150}}>所选区间暂无小时观测；请选择 GPU、地区和曲线，不填补缺失值。</div>}
 <p className="fine">{daily?'当前为每日最后一个已存小时观测；当天数据可能尚未完整。':'每点为官方 METHOD_LAST_PRICE 小时采样，不是小时均价，也不包含小时内全部变动。'}首次回补官网可用的近 7 天，此后每两小时检查、重读重叠窗口并按 SKU＋地区＋时间去重保存，不随窗口滚动删除旧历史。缺失采样断线，不回填报价。长区间单条超过 5,000 点时自动按日展示，原始小时数据保留。</p>
 <h4>当前公开报价</h4><div className="table-wrap"><table><thead><tr><th>GPU／地区</th><th>美元／GPU·小时</th><th>价格生效时间</th><th>规格</th></tr></thead><tbody>{items.map(s=><tr key={s.id}><td>{s.gpu}<small>{s.region}</small></td><td><strong>${fmt(s.value)}</strong></td><td>{utc(s.effectiveTime)}</td><td>{s.platform}</td></tr>)}</tbody></table></div><p className="fine">生效时间表示该价格开始适用的时间，长期未变不等于断更；采集是否成功请看快照及检查时间。不同地区、平台配置和供应条件不能忽略。页面读取的是最近云端快照，并非浏览器实时行情。</p><a href="https://nebius.com/spot-prices" target="_blank" rel="noreferrer">Nebius 官方动态价格与供应说明 ↗</a>
 </article>;
}
