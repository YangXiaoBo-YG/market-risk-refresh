import type {Point} from './analytics';
import {allTimeDrawdown} from './risk-methods';
export function moveComparison(equity:Point[],moves:Point[]){
 const dd=new Map(allTimeDrawdown(equity).map(p=>[p.date,p.value]));let left=0;
 return moves.flatMap((p,i)=>{
  const cutoff=new Date(p.date+'T00:00:00Z');cutoff.setUTCFullYear(cutoff.getUTCFullYear()-1);const key=cutoff.toISOString().slice(0,10);
  while(left<i&&moves[left].date<key)left++;
  const window=moves.slice(left,i+1),percentile=moves[0].date<=key?100*window.filter(q=>q.value<=p.value).length/window.length:null;
  return dd.has(p.date)?[{date:p.date,time:Date.parse(p.date),move:p.value,drawdown:dd.get(p.date)!,percentile}]:[];
 });
}
export type MoveRow=ReturnType<typeof moveComparison>[number];
export function pressureZones(rows:MoveRow[],hit:(p:MoveRow)=>boolean){
 const zones:{start:number;end:number}[]=[];
 rows.forEach((p,i)=>{if(!hit(p))return;const start=i?(rows[i-1].time+p.time)/2:p.time-43200000,end=i<rows.length-1?(p.time+rows[i+1].time)/2:p.time+43200000;const last=zones.at(-1);if(last&&last.end===start)last.end=end;else zones.push({start,end});});
 return zones;
}
