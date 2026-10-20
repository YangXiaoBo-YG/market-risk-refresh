'use client';
import {useState} from 'react';
export function useDateRange(dates:string[],initial=0){
 const [months,setMonths]=useState(initial),[customStart,setStart]=useState(''),[customEnd,setEnd]=useState('');
 const sorted=[...dates].sort(),first=sorted[0]||'',last=sorted.at(-1)||'';
 let start=first;
 if(months>0&&last){const d=new Date(last+'T00:00:00Z'),day=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()-months);const endOfMonth=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();d.setUTCDate(Math.min(day,endOfMonth));start=d.toISOString().slice(0,10);}
 const from=months===-1?customStart:start,to=months===-1?customEnd:last,invalid=!!(from&&to&&from>to);
 function filter<T extends {date:string}>(points:T[]=[]):T[]{return invalid?[]:points.filter(p=>(!from||p.date>=from)&&(!to||p.date<=to));}
 const controls=<div className="date-controls"><div className="range">{[[1,'1个月'],[3,'3个月'],[6,'6个月'],[12,'1年'],[24,'2年'],[36,'3年'],[48,'4年'],[60,'5年'],[120,'10年'],[0,'全部']].map(([n,label])=><button key={n} className={months===n?'selected':''} onClick={()=>setMonths(Number(n))}>{label}</button>)}</div><div className="date-inputs"><label>开始<input aria-label="开始日期" type="date" value={from} onChange={e=>{setStart(e.target.value);setEnd(to);setMonths(-1)}}/></label><span>—</span><label>结束<input aria-label="结束日期" type="date" value={to} onChange={e=>{setStart(from);setEnd(e.target.value);setMonths(-1)}}/></label></div>{invalid&&<span role="alert" className="amber">开始日期不能晚于结束日期</span>}<span className="fine">可用历史 {first||'—'} 至 {last||'—'}；区间内无观测则留空</span></div>;
 return {filter,controls,from,to,invalid};
}
