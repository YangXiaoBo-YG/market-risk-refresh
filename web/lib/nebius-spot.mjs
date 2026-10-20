export const NEBIUS_SPOT_PAGE='https://nebius.com/spot-prices';
export const NEBIUS_SPOT_API='https://api.nebius.cloud/billing/v1alpha1/spot-price';
const iso=v=>{if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}T/.test(v)||!Number.isFinite(Date.parse(v)))throw Error('Invalid official timestamp');return new Date(v).toISOString();};
const positive=v=>{if(!['string','number'].includes(typeof v)||String(v).trim()===''||!Number.isFinite(Number(v))||Number(v)<=0)throw Error('Invalid Spot price');return Number(v);};
function unit(currency,title){if(String(currency).toLowerCase()!=='usd'||title!=='GPU hour')throw Error('Spot currency or per-GPU-hour unit changed');}
function identity(item){
 if(!item||typeof item.skuId!=='string'||!/^sku-[a-z0-9]+$/i.test(item.skuId)||typeof item.region!=='string'||!/[a-z]/.test(item.region)||typeof item.productTitle!=='string')throw Error('Invalid Spot SKU metadata');
 const gpu=item.productTitle.replace(/^(Preemptible\s+)?NVIDIA®?\s*/i,'').replace(/\s+(NVLink|PCIe|SXM)$/i,'').trim();
 if(!gpu||!item.computeInstance?.platform)throw Error('Spot GPU platform missing');
 return {id:item.skuId+':'+item.region,skuId:item.skuId,gpu,region:item.region,platform:item.computeInstance.platform};
}
export function parseSpotCurrent(data){
 if(!Array.isArray(data?.items)||!data.items.length)throw Error('Official current Spot list is empty or changed');
 const items=data.items.map(item=>{const meta=identity(item);unit(item.price?.currency,item.price?.unitTitle);return {...meta,value:positive(item.price.value),effectiveTime:iso(item.effectiveTime)};});
 if(new Set(items.map(i=>i.id)).size!==items.length)throw Error('Duplicate Spot SKU/region');
 return {snapshotTime:iso(data.snapshotTime),items};
}
export function parseSpotSeries(data){
 if(!Array.isArray(data?.items)||!data.items.length)throw Error('Official Spot history is empty or changed');
 const series=data.items.map(item=>{const meta=identity(item);unit(item.currency,item.unitTitle);if(!Array.isArray(item.points))throw Error('Spot points missing');
 const points=item.points.map(p=>({timestamp:iso(p.timestamp),value:positive(p.value)}));
 if(points.some(p=>Date.parse(p.timestamp)%3600000!==0))throw Error('Spot hourly granularity changed');
 return {...meta,points};});
 if(!series.some(s=>s.points.length))throw Error('No official hourly Spot observations');
 if(new Set(series.map(s=>s.id)).size!==series.length)throw Error('Duplicate Spot history SKU/region');
 return {snapshotTime:iso(data.snapshotTime),series};
}
export function mergeSpotSeries(previous=[],incoming=[]){
 const map=new Map(previous.map(s=>[s.id,structuredClone(s)]));
 for(const series of incoming){const old=map.get(series.id);const points=new Map((old?.points||[]).map(p=>[p.timestamp,p]));for(const p of series.points)points.set(p.timestamp,p);map.set(series.id,{...series,points:[...points.values()].sort((a,b)=>a.timestamp.localeCompare(b.timestamp))});}
 return [...map.values()].sort((a,b)=>a.id.localeCompare(b.id));
}
async function readPages(url,fetcher){
 let next=url;const pages=[],tokens=new Set();
 for(let n=0;n<20;n++){
  const response=await fetcher(next,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(25000)});if(!response.ok)throw Error('Nebius Spot HTTP '+response.status);
  const data=await response.json();if(!Array.isArray(data.items))throw Error('Spot response items missing');pages.push(data);
  if(!data.nextPageToken)return {...data,items:pages.flatMap(p=>p.items)};
  if(tokens.has(data.nextPageToken))throw Error('Repeated Spot page token');tokens.add(data.nextPageToken);
  const page=new URL(url);page.searchParams.set('pageToken',data.nextPageToken);next=page.href;
 }
 throw Error('Spot pagination exceeded safety limit');
}
export async function collectNebiusSpot(previous,fetcher=fetch,at=new Date().toISOString()){
 const next=structuredClone(previous||{current:[],series:[]});next.checkedAt=at;next.source=NEBIUS_SPOT_PAGE;next.unit='USD/GPU-hour';next.granularity='hourly-last-price';
 next.error=null;next.historyError=null;
 try{
  const current=parseSpotCurrent(await readPages(NEBIUS_SPOT_API+'?pageSize=100',fetcher));
  if(Date.parse(current.snapshotTime)>Date.parse(at)+3600000)throw Error('Current snapshot time is in the future');
  if(next.snapshotTime&&current.snapshotTime<next.snapshotTime)throw Error('Official snapshot regressed; previous current list retained');
  next.current=current.items;next.snapshotTime=current.snapshotTime;next.lastSuccess=at;
 }catch(e){next.error=e.message;return next;}
 try{
  // Match the official 7-day chart: one-hour LAST_PRICE samples, never the advertised "from" floor.
  const start=new Date(900000*Math.ceil((Date.parse(at)-7*86400000+900000)/900000)).toISOString();
  const ids=[...new Set(next.current.map(i=>i.skuId))],incoming=[];let historySnapshotTime; 
  for(let i=0;i<ids.length;i+=25){
   const q=new URLSearchParams({'filters.startTime':start,'aggregation.granularity':'GRANULARITY_HOUR_1','aggregation.method':'METHOD_LAST_PRICE',pageSize:'100'});
   for(const id of ids.slice(i,i+25))q.append('filters.skuIds',id);
   const history=parseSpotSeries(await readPages(NEBIUS_SPOT_API+'/list-series?'+q,fetcher));
   const expected=new Set(next.current.map(x=>x.id));
   if(history.series.some(s=>!expected.has(s.id)||s.points.some(p=>Date.parse(p.timestamp)>Date.parse(at)+3600000)))throw Error('Unexpected Spot history SKU or future point');
   incoming.push(...history.series);historySnapshotTime=history.snapshotTime;
  }
  next.series=mergeSpotSeries(next.series,incoming);next.historySnapshotTime=historySnapshotTime;next.historyLastSuccess=at;
 }catch(e){next.historyError=e.message;}
 return next;
}
