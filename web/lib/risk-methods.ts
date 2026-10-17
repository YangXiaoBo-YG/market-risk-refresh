import type {Point,Series} from './analytics';
export function rollingZ(points:Point[],years=1){
 const out:(Point&{raw:number;mean:number;std:number})[]=[];let left=0;
 for(let i=0;i<points.length;i++){
  const cutoff=new Date(points[i].date+'T00:00:00Z');cutoff.setUTCFullYear(cutoff.getUTCFullYear()-years);const date=cutoff.toISOString().slice(0,10);
  while(left<i&&points[left].date<date)left++;
  if(points[0].date>date||i-left<1)continue;
  const w=points.slice(left,i+1),mean=w.reduce((v,p)=>v+p.value,0)/w.length,std=Math.sqrt(w.reduce((v,p)=>v+(p.value-mean)**2,0)/w.length);
  if(std>0)out.push({...points[i],raw:points[i].value,value:(points[i].value-mean)/std,mean,std});
 }
 return out;
}
export function breadth(equal?:Series,weighted?:Series){
 const wm=new Map(weighted?.points.map(p=>[p.date,p.value]));const rows=(equal?.points||[]).filter(p=>(wm.get(p.date)||0)>0).map(p=>({date:p.date,value:p.value/wm.get(p.date)!}));
 let sum=0,streak=0;return rows.map((p,i)=>{sum+=p.value;if(i>=50)sum-=rows[i-50].value;const ma=i>=49?sum/50:null;streak=ma!=null&&p.value<ma?streak+1:0;return {...p,ma,streak};});
}
export function allTimeDrawdown(points:Point[]){let high=-Infinity;return points.map(p=>{high=Math.max(high,p.value);return {date:p.date,value:(p.value/high-1)*100};});}
export type SignalRow={date:string;value:number|null;display:string;hit:boolean;near:boolean};
export function summarizeSignal(title:string,rule:string,rows:SignalRow[]){
 const last=rows.at(-1);let i=rows.length-1;
 if(last?.hit)while(i>0&&rows[i-1].hit)i--;
 return {title,rule,...last,status:last?.value==null?'数据不足':last.hit?'已触发':last.near?'接近阈值':'未触发',since:last?.hit?rows[i].date:null,duration:last?.hit?rows.length-i:0,triggerValue:last?.hit?rows[i].display:null};
}
export function riskSignals(s:Record<string,Series>,dd=5,pct=80,jump=20){
 const row=(date:string,value:number|null,unit:string,hit:boolean,near:boolean):SignalRow=>({date,value,display:value==null?'—':value.toFixed(2)+unit,hit,near});
 const ddRows=(s.IXG?.points||[]).map((p,i,a)=>{const w=a.slice(Math.max(0,i-19),i+1),v=i>=19&&w.every(q=>q.adjusted!=null)?(p.adjusted!/Math.max(...w.map(q=>q.adjusted!))-1)*100:null;return row(p.date,v,'%',v!=null&&v< -dd,v!=null&&v<=-dd*.9);});
 const rank=(id:string)=> (s[id]?.points||[]).map((p,i,a)=>{const w=a.slice(Math.max(0,i-251),i+1),v=w.length===252?w.filter(q=>q.value<=p.value).length/252*100:null;return row(p.date,v,' 分位',v!=null&&v>pct,v!=null&&v>=pct*.9);});
 const jumpRows=(s.MOVE?.points||[]).map((p,i,a)=>{const v=i>=5?(p.value/a[i-5].value-1)*100:null;return row(p.date,v,'%',v!=null&&v>jump,v!=null&&v>=jump*.9);});
 const mm=new Map(s.MOVE?.points.map(p=>[p.date,p.value]));const joint=(s.IXG?.points||[]).filter(p=>mm.has(p.date));
 const jointRows=joint.map((p,i)=>{const old=joint[i-5];const x=old?.adjusted&&p.adjusted?(p.adjusted/old.adjusted-1)*100:null,y=old?(mm.get(p.date)!/mm.get(old.date)!-1)*100:null;return {date:p.date,value:x,display:x==null||y==null?'—':`IXG ${x.toFixed(2)}% / MOVE ${y.toFixed(2)}%`,hit:x!=null&&y!=null&&x<0&&y>0,near:false};});
 const equityDrawdowns=allTimeDrawdown(s.SPX?.points||[]);
 const divergence=equityDrawdowns.filter(p=>mm.has(p.date)).map(p=>({date:p.date,value:p.value,display:`MOVE ${mm.get(p.date)!.toFixed(2)} / 标普回撤 ${p.value.toFixed(2)}%`,hit:mm.get(p.date)!>120&&p.value>=-2,near:mm.get(p.date)!>=110&&mm.get(p.date)!<=120&&p.value>=-2}));
 const br=(e:string,w:string)=>breadth(s[e],s[w]).map(p=>row(p.date,p.ma==null?null:p.streak,' 个交易日',p.streak>=10,p.streak>0&&p.streak<10));
 return [summarizeSignal('金融股 × 债市联动','5 个共同交易日内：IXG 复权收益 < 0 且 MOVE 涨幅 > 0',jointRows),summarizeSignal('债股背离观察','MOVE > 120 且标普距此前历史高点回撤 ≥ −2%；仅描述同日状态，不预测随后下跌',divergence),summarizeSignal('金融股回撤',`IXG 较近 20 日高点回撤 > ${dd}%`,ddRows),summarizeSignal('债市高波动',`MOVE 252 日分位 > ${pct}`,rank('MOVE')),summarizeSignal('波动加速',`MOVE 5 日涨幅 > ${jump}%`,jumpRows),summarizeSignal('权益高波动',`VIX 252 日分位 > ${pct}`,rank('VIX')),summarizeSignal('标普广度走弱','等权/加权比值低于 50 日均线 ≥ 10 个交易日',br('SPXEW','SPX')),summarizeSignal('纳指广度走弱','等权/加权比值低于 50 日均线 ≥ 10 个交易日',br('NDXE','NDX'))];
}
