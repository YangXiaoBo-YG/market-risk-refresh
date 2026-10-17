export type Point={date:string;value:number;adjusted?:number};
export type Series={id:string;name:string;unit:string;source:string;url:string;kind:string;points:Point[];checkedAt:string;lastSuccess?:string;error?:string|null};
export type RevenuePoint={company:string;date:string;reportDate:string;value:number;type:string;sourceType:string;sources:string[];notes:string};
export type Revenue={checkedAt:string;lastSuccess:string;error:string|null;points:RevenuePoint[]};
export type TokenPrices={models:{id:string;name:string;url:string;hasTiers:boolean}[];history:{date:string;checkedAt:string;prices:Record<string,{input:number;output:number}>}[];basket?:{ids:string[];baseDate:string;basePrices:Record<string,number>};checkedAt:string;lastSuccess?:string;error?:string|null};
export type CspPoint={date:string;start:string;filed:string;period:string;expense:number;revenue:number|null;burden:number|null;tag:string;url:string};
export type CspData={checkedAt:string;companies:{id:string;name:string;cik:string;points:CspPoint[];checkedAt:string;lastSuccess?:string;error?:string|null;filings?:{date:string;form:string;url:string}[];filingsCheckedAt?:string;filingsError?:string|null}[];sofr:{points:Point[];checkedAt:string;lastSuccess?:string;error?:string|null}};
export type Snapshot={csp?:CspData;tokenPrices?:TokenPrices;updates?:{at:string;errors:string[]}[];revenue?:Revenue;cloudUpdatedAt?:string;checkedAt:string;series:Record<string,Series>;errors:string[]};
export const last=(s?:Series)=>s?.points.at(-1);
export function change(s?:Series,n=1){const p=s?.points||[];return p.length>n?(p.at(-1)!.value/p.at(-1-n)!.value-1)*100:null;}
export function drawdown(s?:Series){const p=(s?.points||[]).slice(-20);if(p.length<20||p.some(x=>x.adjusted==null))return null;return (p.at(-1)!.adjusted!/Math.max(...p.map(x=>x.adjusted!))-1)*100;}
export function percentile(s?:Series){const p=(s?.points||[]).slice(-252);if(p.length<252)return null;return p.filter(x=>x.value<=p.at(-1)!.value).length/p.length*100;}
export function correlations(a?:Series,b?:Series){
 if(!a||!b)return [];
 const deltas=new Map(b.points.slice(1).map((p,i)=>[p.date,{previous:b.points[i].date,value:p.value-b.points[i].value}]));
 const changes=a.points.slice(1).flatMap((p,i)=>{const old=a.points[i],d=deltas.get(p.date);if(!d||d.previous!==old.date||p.adjusted==null||old.adjusted==null)return [];return [{date:p.date,x:p.adjusted/old.adjusted-1,y:d.value}];});
 return changes.slice(59).flatMap((p,i)=>{const w=changes.slice(i,i+60),mx=w.reduce((s,p)=>s+p.x,0)/60,my=w.reduce((s,p)=>s+p.y,0)/60,num=w.reduce((s,p)=>s+(p.x-mx)*(p.y-my),0),den=Math.sqrt(w.reduce((s,p)=>s+(p.x-mx)**2,0)*w.reduce((s,p)=>s+(p.y-my)**2,0));return den?[{date:p.date,value:num/den}]:[];});
}
export function spread(a?:Series,b?:Series){const m=new Map(b?.points.map(p=>[p.date,p.value]));return (a?.points||[]).filter(p=>m.has(p.date)).map(p=>({date:p.date,value:p.value-m.get(p.date)!}));}
function observed(y:number,m:number,d:number){const x=new Date(Date.UTC(y,m,d));if(x.getUTCDay()===6)x.setUTCDate(d-1);if(x.getUTCDay()===0)x.setUTCDate(d+1);return x.toISOString().slice(0,10);}
function nth(y:number,m:number,w:number,n:number){const d=new Date(Date.UTC(y,m,1));return new Date(Date.UTC(y,m,1+(w-d.getUTCDay()+7)%7+7*(n-1))).toISOString().slice(0,10);}
function easter(y:number){const a=y%19,b=Math.floor(y/100),c=y%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),v=h+l-7*m+114;return new Date(Date.UTC(y,Math.floor(v/31)-1,v%31+1));}
export function tradingDay(date:string,bond=false){const d=new Date(date+'T12:00:00Z'),y=d.getUTCFullYear();if([0,6].includes(d.getUTCDay()))return false;const good=easter(y);good.setUTCDate(good.getUTCDate()-2);const memorial=new Date(Date.UTC(y,4,31));memorial.setUTCDate(31-(memorial.getUTCDay()+6)%7);const holidays=[observed(y,0,1),observed(y+1,0,1),nth(y,0,1,3),nth(y,1,1,3),good.toISOString().slice(0,10),memorial.toISOString().slice(0,10),observed(y,5,19),observed(y,6,4),nth(y,8,1,1),nth(y,10,4,4),observed(y,11,25)];if(bond)holidays.push(nth(y,9,1,2),observed(y,10,11));return !holidays.includes(date);}
export function freshness(s?:Series){if(!s?.points.length)return '无数据';if(s.error)return '更新失败 · 保留上次数据';const end=last(s)!.date,today=new Date().toLocaleDateString('en-CA',{timeZone:'America/New_York'});let missing=0;for(let d=new Date(end+'T12:00:00Z');d.toISOString().slice(0,10)<today;){d.setUTCDate(d.getUTCDate()+1);const key=d.toISOString().slice(0,10);if(key<today&&tradingDay(key,['DGS10','DGS2','MOVE'].includes(s.id)))missing++;}return missing>=2?'数据滞后':'日度数据';}
