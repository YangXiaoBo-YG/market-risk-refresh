import {correlations,spread,type Snapshot,type Point} from './analytics';
import {chartRows} from './equities';
import {rollingZ,breadth} from './risk-methods';
export type CompareSeries={id:string;name:string;unit:string;points:Point[];sparse?:boolean;url?:string};
export function comparisonCatalog(data:Snapshot):CompareSeries[]{
 const list:CompareSeries[]=Object.values(data.series).map(s=>({id:s.id,name:s.name,unit:s.unit,points:s.points,url:s.url}));
 for(const [id,e,w,name] of [['SP_BREADTH','SPXEW','SPX','标普等权/加权比值'],['ND_BREADTH','NDXE','NDX','纳指等权/加权比值']])list.push({id,name,unit:'比值',points:breadth(data.series[e],data.series[w])});
 list.push({id:'CURVE',name:'10Y − 2Y 利差',unit:'bp',points:spread(data.series.DGS10,data.series.DGS2).map(p=>({...p,value:p.value*100}))});
 list.push({id:'CORR',name:'IXG × MOVE · 60日相关性',unit:'相关系数',points:correlations(data.series.IXG,data.series.MOVE)});
 return list;
}
export function buildComparison(series:CompareSeries[],mode:boolean|string,years=1,from='',to=''){
 const normalized=mode===true||mode==='normalized',standardized=mode==='zscore';
 const stats:Record<string,{mean:number;std:number;count:number}>={};
 const rows=new Map<string,Record<string,string|number>>(),bases:Record<string,{date:string;value:number}>={},excluded:string[]=[],reasons:Record<string,string>={};
 const visible=(p:Point)=>(!from||p.date>=from)&&(!to||p.date<=to);
 for(const s of series.slice(0,6)){
  if(s.sparse&&(normalized||standardized)){excluded.push(s.id);reasons[s.id]='财报／ARR 为稀疏披露，仅支持原始散点';continue;}
  const points=standardized?rollingZ(s.points,years).filter(visible):s.points.filter(visible);
  const first=points[0];if(!first){if(standardized){excluded.push(s.id);reasons[s.id]='完整滚动窗口不足或方差为零';}continue;}
  if(normalized&&first.value<=0){excluded.push(s.id);reasons[s.id]='起始值非正，不能归一化';continue;}
  if(standardized){const last=points.at(-1)! as ReturnType<typeof rollingZ>[number];stats[s.id]={mean:last.mean,std:last.std,count:points.length};}
  bases[s.id]={date:first.date,value:first.value};
  for(const p of chartRows(points)){
   const row=rows.get(p.date)||{date:p.date,time:Date.parse(p.date)};
   row[s.id]=normalized?p.value/first.value*100:p.value;row['raw_'+s.id]='raw' in p?Number(p.raw):p.value;rows.set(p.date,row);
  }
 }
 return {rows:[...rows.values()].sort((a,b)=>String(a.date).localeCompare(String(b.date))),bases,excluded,stats,reasons};
}
