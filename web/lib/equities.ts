import type {Point} from './analytics';
export function compareIndices(a:Point[]=[],b:Point[]=[]){
 const second=new Map(b.map(p=>[p.date,p.value]));
 const common=a.filter(p=>p.value>0&&(second.get(p.date)||0)>0);
 if(!common.length)return [];
 const baseA=common[0].value,baseB=second.get(common[0].date)!;
 return common.map(p=>({date:p.date,weighted:p.value/baseA*100,equal:second.get(p.date)!/baseB*100}));
}
// Reduce only the displayed line to weekly/monthly final observations; storage stays daily.
export function chartRows<T extends {date:string}>(points:T[]):T[]{
 if(points.length<=1200)return points;
 const groups=new Map<string,T>();
 for(const p of points){const key=points.length>6000?p.date.slice(0,7):String(Math.floor(Date.parse(p.date)/(7*86400000)));groups.set(key,p);}
 const out=[...groups.values()];if(out[0]?.date!==points[0].date)out.unshift(points[0]);return out;
}
