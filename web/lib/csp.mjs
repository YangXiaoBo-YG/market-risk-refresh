export const CSP_COMPANIES=[{id:'AMZN',name:'Amazon',cik:'0001018724'},{id:'MSFT',name:'Microsoft',cik:'0000789019'},{id:'GOOGL',name:'Alphabet',cik:'0001652044'},{id:'ORCL',name:'Oracle',cik:'0001341439'},{id:'CRWV',name:'CoreWeave',cik:'0001769628'}];
const interestTags={AMZN:['InterestExpenseNonoperating','InterestExpense'],MSFT:['InterestExpenseNonoperating','InterestExpense'],GOOGL:['InterestExpenseNonoperating','InterestExpense'],ORCL:['InterestExpense'],CRWV:['InterestExpenseDebt']};
const revenueTags=['RevenueFromContractWithCustomerExcludingAssessedTax','Revenues','SalesRevenueNet'];
const day=86400000;
function facts(json,tags){return tags.flatMap((tag,priority)=>(json.facts?.['us-gaap']?.[tag]?.units?.USD||[]).filter(p=>['10-K','10-Q','10-K/A','10-Q/A'].includes(p.form)&&p.start&&p.end&&p.filed&&p.accn&&Number.isFinite(p.val)).map(p=>({...p,tag,priority})));}
export function parseCspFacts(json,company,at){
 const interest=facts(json,interestTags[company.id]),revenue=facts(json,revenueTags),map=new Map();
 for(const p of interest){const days=(Date.parse(p.end)-Date.parse(p.start))/day+1,period=days>=330&&days<=380?'annual':days>=75&&days<=105?'quarter':null;if(!period||p.val<0||p.filed>at.slice(0,10))continue;
  const key=p.start+'|'+p.end,old=map.get(key);if(!old||p.filed>old.filed||(p.filed===old.filed&&p.priority<old.priority))map.set(key,{...p,period});
 }
 const points=[...map.values()].map(p=>{const sales=revenue.filter(r=>r.start===p.start&&r.end===p.end&&r.accn===p.accn&&r.val>0).sort((a,b)=>a.priority-b.priority)[0];return {date:p.end,start:p.start,filed:p.filed,period:p.period,expense:p.val/1e9,revenue:sales?sales.val/1e9:null,burden:sales?p.val/sales.val*100:null,tag:p.tag,url:`https://www.sec.gov/Archives/edgar/data/${Number(company.cik)}/${p.accn.replaceAll('-','')}/${p.accn}-index.html`};}).sort((a,b)=>a.date.localeCompare(b.date)||a.start.localeCompare(b.start));
 if(!points.length)throw Error('没有可用的公司利息披露');
 return {...company,points,checkedAt:at,lastSuccess:at,error:null};
}
export function parseSofr(json){const points=(json.refRates||[]).filter(p=>p.type==='SOFR'&&/^\d{4}-\d{2}-\d{2}$/.test(p.effectiveDate)&&Number.isFinite(p.percentRate)).map(p=>({date:p.effectiveDate,value:p.percentRate})).sort((a,b)=>a.date.localeCompare(b.date));if(!points.length)throw Error('SOFR 返回空数据');return points;}
export function parseFilings(json,company){const r=json.filings?.recent;if(!Array.isArray(r?.form))throw Error('SEC 文件列表结构改变');return r.form.flatMap((form,i)=>['8-K','FWP','424B2','424B5'].includes(form)&&r.primaryDocument[i]?[{date:r.filingDate[i],form,url:`https://www.sec.gov/Archives/edgar/data/${Number(company.cik)}/${r.accessionNumber[i].replaceAll('-','')}/${r.primaryDocument[i]}`}]:[]).slice(0,10);}
async function get(url){const r=await fetch(url,{headers:{'User-Agent':'MarketRiskObservatory/1.0 https://github.com/YangXiaoBo-YG/market-risk-refresh'},signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('官方来源 HTTP '+r.status);return r.json();}
export function mergeCspPoints(old=[],incoming=[]){const map=new Map(old.map(p=>[p.start+'|'+p.date,p]));for(const p of incoming){const key=p.start+'|'+p.date;if(!map.has(key)||p.filed>=map.get(key).filed)map.set(key,p);}return [...map.values()].sort((a,b)=>a.date.localeCompare(b.date)||a.start.localeCompare(b.start));}
export async function collectCsp(previous,financials=true){
 const at=new Date().toISOString(),data=structuredClone(previous||{companies:[],sofr:{points:[]}});data.checkedAt=at;
 // Bound requests to two concurrent companies; no daily interpolation of disclosures.
 if(financials)for(let i=0;i<CSP_COMPANIES.length;i+=2)await Promise.all(CSP_COMPANIES.slice(i,i+2).map(async c=>{
  const old=data.companies.find(p=>p.id===c.id)||{...c,points:[]};let item=old;
  const [financial,filing]=await Promise.allSettled([get(`https://data.sec.gov/api/xbrl/companyfacts/CIK${c.cik}.json`),get(`https://data.sec.gov/submissions/CIK${c.cik}.json`)]);
  try{if(financial.status==='rejected')throw financial.reason;item={...old,...parseCspFacts(financial.value,c,at)};item.points=mergeCspPoints(old.points,item.points);}catch(e){item={...old,checkedAt:at,error:String(e.message)}}
  try{if(filing.status==='rejected')throw filing.reason;item.filings=parseFilings(filing.value,c);item.filingsCheckedAt=at;item.filingsError=null;}catch(e){item.filingsError=String(e.message)}
  data.companies=data.companies.filter(p=>p.id!==c.id).concat(item);
 }));
 try{const points=parseSofr(await get('https://markets.newyorkfed.org/api/rates/secured/sofr/last/30.json'));data.sofr={points:[...new Map([...(data.sofr?.points||[]),...points].map(p=>[p.date,p])).values()].sort((a,b)=>a.date.localeCompare(b.date)),checkedAt:at,lastSuccess:at,error:null}}catch(e){data.sofr={...data.sofr,checkedAt:at,error:String(e.message)}}
 data.companies.sort((a,b)=>CSP_COMPANIES.findIndex(c=>c.id===a.id)-CSP_COMPANIES.findIndex(c=>c.id===b.id));return data;
}

export function acceptCspUpload(incoming,previous,now=new Date().toISOString()){
 if(!incoming||!Array.isArray(incoming.companies)||incoming.companies.length!==5||!incoming.checkedAt||Math.abs(Date.parse(now)-Date.parse(incoming.checkedAt))>3600000||!Number.isFinite(Date.parse(incoming.checkedAt)))throw Error('无效的 CSP 云端上传');
 const next=structuredClone(previous);next.checkedAt=incoming.checkedAt;
 for(const c of CSP_COMPANIES){const row=incoming.companies.find(r=>r.id===c.id),old=previous.companies.find(r=>r.id===c.id);if(!row||!Array.isArray(row.points)||row.points.length>2000)throw Error('无效的 CSP 公司记录');
  if(row.points.some(p=>!/^\d{4}-\d{2}-\d{2}$/.test(p.date)||!/^\d{4}-\d{2}-\d{2}$/.test(p.start)||!/^\d{4}-\d{2}-\d{2}$/.test(p.filed)||!Number.isFinite(p.expense)||p.expense<0||(p.burden!=null&&!Number.isFinite(p.burden))||!['annual','quarter'].includes(p.period)||!String(p.url).startsWith('https://www.sec.gov/Archives/edgar/data/')))throw Error('无效的 CSP 观测');
  if(row.filings?.some(f=>!String(f.url).startsWith('https://www.sec.gov/Archives/edgar/data/')))throw Error('无效的 SEC 链接');
  next.companies=next.companies.filter(r=>r.id!==c.id).concat({...old,...row,...c,points:mergeCspPoints(old?.points,row.points),...(row.error?{lastSuccess:old?.lastSuccess}:{}),...(row.filingsError?{filings:old?.filings}: {})});
 }
 return next;
}
