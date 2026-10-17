'use client';
import {useMemo,useState,useId} from 'react';
import {Area,CartesianGrid,ComposedChart,Line,ReferenceArea,ReferenceLine,ResponsiveContainer,Tooltip,XAxis,YAxis} from 'recharts';
import type {Series} from '../lib/analytics';
import {moveComparison,pressureZones} from '../lib/move-comparison';
import {useDateRange} from './date-range';
export default function LongCycle({series:s,from,to}:{series:Record<string,Series>;from?:string;to?:string}){
 const [threshold,setThreshold]=useState(120),[percent,setPercent]=useState(80),[pressureMode,setPressureMode]=useState('raw'),[hover,setHover]=useState<number|null>(null);
 const syncId=useId();
 const full=useMemo(()=>moveComparison(s.SPX?.points||[],s.MOVE?.points||[]),[s.SPX,s.MOVE]);
 const dates=useDateRange(full.map(p=>p.date),0);
 const filtered=from!==undefined||to!==undefined?full.filter(p=>(!from||p.date>=from)&&(!to||p.date<=to)):dates.filter(full);
 const span=filtered.length?filtered.at(-1)!.time-filtered[0].time:0;
 const frequency=span>25*365.25*86400000?'monthly':span>10*365.25*86400000?'weekly':'daily';
 const grouped=new Map<string,typeof full[number]>();for(const p of filtered)grouped.set(frequency==='monthly'?p.date.slice(0,7):frequency==='weekly'?String(Math.floor(p.time/(7*86400000))):p.date,p);
 const rows=[...grouped.values()];if(rows.length&&rows[0].date!==filtered[0].date)rows.unshift(filtered[0]);
 const high=(p:typeof full[number])=>pressureMode==='raw'?p.move>threshold:p.percentile!=null&&p.percentile>percent;
 const zones=pressureZones(filtered,high);
 const active=rows.find(p=>p.time===hover)||rows.at(-1);
 const domain:[number,number]=filtered.length?[filtered[0].time-43200000,filtered.at(-1)!.time+43200000]:[0,1];
 const minimum=Math.min(-.1,...rows.map(p=>p.drawdown))*1.08;
 const onMove=(state:any)=>{const value=Number(state?.activeLabel);if(Number.isFinite(value)&&rows.some(p=>p.time===value))setHover(value);};
 return <section className="panel long-cycle"><div className="panel-head"><div><h3>MOVE × 标普回撤 · 同期压力与背离</h3><p className="muted">上栏债市波动，下栏股市回撤 · 独立纵轴，共用日期 · {frequency==='daily'?'日度':frequency==='weekly'?'每周最后':'每月最后'}观测</p></div></div>{from===undefined&&to===undefined&&dates.controls}
 <div className="compare-toolbar"><label>高压阴影规则 <select value={pressureMode} onChange={e=>setPressureMode(e.target.value)}><option value="raw">MOVE 原值</option><option value="percentile">过去 1 年历史分位</option></select></label>{pressureMode==='raw'?<label>原值 &gt; <input aria-label="MOVE 高压原值阈值" type="number" min="1" max="500" value={threshold} onChange={e=>setThreshold(Math.min(500,Math.max(1,Number(e.target.value))))}/></label>:<label>分位 &gt; <input aria-label="MOVE 高压分位阈值" type="number" min="1" max="99" value={percent} onChange={e=>setPercent(Math.min(99,Math.max(1,Number(e.target.value))))}/>%</label>}</div>
 <div className="notice" style={{minHeight:76}} aria-live="off">{active?<><strong>{hover===active.time?'所指日期':'区间最新共同观测'}：{active.date}</strong><div>MOVE {active.move.toFixed(2)} · 1 年分位 {active.percentile==null?'窗口不足':active.percentile.toFixed(1)+'%'} · 标普回撤 {active.drawdown.toFixed(2)}%</div><div>{high(active)?active.drawdown>=-2?'背离观察：债市高压，标普仍距此前高点不足或等于 2%':'债市高压，标普回撤超过 2%':pressureMode==='percentile'&&active.percentile==null?'分位历史不足，无法判定高压':'未满足当前高压规则'}</div></>:'所选区间无共同观测'}</div>
 {rows.length?(['move','drawdown'] as const).map((key,index)=><div key={key}><h4>{index===0?'MOVE 原始指数点位 · 越高表示债市波动越大':'标普 500 距此前历史高点回撤（%）· 0 在上，负值向下'}</h4><div style={{height:index===0?220:240}}><ResponsiveContainer width="100%" height="100%"><ComposedChart data={rows} syncId={syncId} syncMethod="value" onMouseMove={onMove} onMouseLeave={()=>setHover(null)} margin={{top:8,right:18,left:0,bottom:0}}><CartesianGrid vertical={false} stroke="#26313f" strokeDasharray="3 5"/><XAxis dataKey="time" type="number" domain={domain} scale="time" allowDataOverflow tickFormatter={v=>new Date(v).toISOString().slice(0,10)} minTickGap={65} tick={{fill:'#8392a8',fontSize:12}}/><YAxis width={65} domain={index===1?[minimum,0]:['auto','auto']} tickFormatter={v=>Number(v).toFixed(index===1?1:0)+(index===1?'%':'')} tick={{fill:'#8392a8',fontSize:12}}/>{zones.map((z,i)=><ReferenceArea key={i} x1={z.start} x2={z.end} fill="#fa667b" fillOpacity={.14} strokeOpacity={0}/>)}<Tooltip content={()=>null} cursor={false}/>{hover!=null&&rows.some(p=>p.time===hover)&&<ReferenceLine x={hover} stroke="#dde8f6" strokeDasharray="3 3"/>}{index===1?<><ReferenceLine y={0} stroke="#7b8ea5"/><Area type="linear" dataKey={key} baseValue={0} stroke="#79b9ff" fill="#79b9ff" fillOpacity={.25} isAnimationActive={false}/></>:<><Line type="linear" dataKey={key} stroke="#f8b45a" dot={rows.length===1} connectNulls={false} isAnimationActive={false}/>{pressureMode==='raw'&&<ReferenceLine y={threshold} ifOverflow="hidden" stroke="#fa667b" strokeDasharray="4 4"/>}</>}</ComposedChart></ResponsiveContainer></div></div>):<div className="empty">所选区间无共同观测</div>}
 <p className="fine">浅红阴影：{pressureMode==='raw'?`MOVE 原值 > ${threshold}`:`MOVE 过去 1 年分位 > ${percent}%`}，以原始日度观测判定；色带边界取相邻观测日期中点，不表示盘中触发时间。分位含当日、不含未来，完整一年窗口不足时留空。超过 10 年按周、超过 25 年按月取最后观测，阴影仍保留日度触发。</p><p className="fine">回撤高点使用此前全部可用标普历史，不在所选起点重置。两栏独立缩放，振幅不可直接相比。背离观察仅描述同日状态，不代表股市随后一定下跌；顶部总览采用固定 MOVE &gt; 120、回撤 ≥ −2% 规则。共同历史 {filtered[0]?.date||'—'} 至 {filtered.at(-1)?.date||'—'}。</p></section>;
}
