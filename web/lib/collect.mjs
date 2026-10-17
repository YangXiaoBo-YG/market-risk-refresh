import {collectCsp,acceptCspUpload} from './csp.mjs';
import cspSeed from './csp-seed.json' with {type:'json'};
import {collectTokenPrices} from './token-prices.mjs';
import tokenSeed from './token-price-seed.json' with {type:'json'};
import {parseRevenue,REVENUE_URL} from './revenue.mjs';
import revenueSeed from './revenue-seed.json' with {type:'json'};
export const SOURCES = {
 SPX:{name:'标普 500 · 市值加权',unit:'指数点',source:'Yahoo Finance',url:'https://finance.yahoo.com/quote/%5EGSPC/',kind:'第三方日度价格指数'},
 SPXEW:{name:'标普 500 · 等权',unit:'指数点',source:'Yahoo Finance',url:'https://finance.yahoo.com/quote/%5ESP500EW/',kind:'第三方日度价格指数'},
 NDX:{name:'纳斯达克 100 · 修正市值加权',unit:'指数点',source:'Yahoo Finance',url:'https://finance.yahoo.com/quote/%5ENDX/',kind:'第三方日度价格指数'},
 NDXE:{name:'纳斯达克 100 · 等权',unit:'指数点',source:'Yahoo Finance',url:'https://finance.yahoo.com/quote/%5ENDXE/',kind:'第三方日度价格指数'},
 IXIC:{name:'纳斯达克综合 · 市值加权',unit:'指数点',source:'Yahoo Finance',url:'https://finance.yahoo.com/quote/%5EIXIC/',kind:'第三方日度价格指数'},

 IXG:{name:'全球金融股',unit:'USD',source:'Yahoo Finance · iShares',url:'https://finance.yahoo.com/quote/IXG/',kind:'第三方日度行情'},
 MOVE:{name:'美债波动率',unit:'指数点',source:'Yahoo Finance · ICE MOVE',url:'https://finance.yahoo.com/quote/%5EMOVE/',kind:'第三方日度行情'},
 VIX:{name:'标普 500 隐含波动率',unit:'指数点',source:'Cboe',url:'https://www.cboe.com/tradable_products/vix/vix_historical_data/',kind:'官方日度收盘'},
 DGS10:{name:'10 年期美债',unit:'%',source:'美国财政部',url:'https://home.treasury.gov/resource-center/data-chart-center/interest-rates',kind:'官方日度平价收益率'},
 DGS2:{name:'2 年期美债',unit:'%',source:'美国财政部',url:'https://home.treasury.gov/resource-center/data-chart-center/interest-rates',kind:'官方日度平价收益率'},
 H100:{name:'H100 · Neocloud',unit:'$/GPU·h',source:'Silicon Data',url:'https://www.silicondata.com/products/silicon-index/h100',kind:'官方指数 · 本站累计历史'},
 H100HS:{name:'H100 · Hyperscaler',unit:'$/GPU·h',source:'Silicon Data',url:'https://www.silicondata.com/products/silicon-index/h100',kind:'官方指数 · 本站累计历史'},
 H200:{name:'H200 · Neocloud',unit:'$/GPU·h',source:'Silicon Data',url:'https://www.silicondata.com/products/silicon-index/h200',kind:'官方指数 · 本站累计历史'},
 B200:{name:'B200 · Neocloud',unit:'$/GPU·h',source:'Silicon Data',url:'https://www.silicondata.com/products/silicon-index/b200',kind:'官方指数 · 本站累计历史'},
};
export function normalize(points){return [...new Map(points.filter(p=>/^\d{4}-\d{2}-\d{2}$/.test(p.date)&&Number.isFinite(p.value)).map(p=>[p.date,p])).values()].sort((a,b)=>a.date.localeCompare(b.date));}
export const YAHOO_SYMBOLS={IXG:'IXG',MOVE:'^MOVE',SPX:'^GSPC',SPXEW:'^SP500EW',NDX:'^NDX',NDXE:'^NDXE',IXIC:'^IXIC'};
export const GPU_IDS=['H100','H100HS','H200','B200'];
export function mergeGpuHistory(previous=[],incoming=[]){return normalize([...previous,...incoming]);}
export function yahoo(text){const r=JSON.parse(text).chart.result?.[0];if(!r?.timestamp)throw new Error('行情无有效序列');const close=r.indicators.quote[0].close,adj=r.indicators.adjclose?.[0]?.adjclose;const today=new Date().toLocaleDateString('en-CA',{timeZone:'America/New_York'});const hour=Number(new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',hour:'2-digit',hourCycle:'h23'}).format(new Date()));return normalize(r.timestamp.map((t,i)=>({date:new Date(t*1000).toISOString().slice(0,10),value:close[i],...(adj?.[i]!=null?{adjusted:adj[i]}:{})})).filter(p=>p.value!=null&&(p.date<today||(p.date===today&&hour>=17))));}
export function vix(text){return normalize(text.trim().split(/\r?\n/).slice(1).flatMap(line=>{const cols=line.split(','),d=cols[0],c=cols[4];if(!d||!c)return [];const [m,day,y]=d.split('/');return [{date:`${y}-${m.padStart(2,'0')}-${day.padStart(2,'0')}`,value:Number(c)}];}));}
export function gpu(text){const plain=text.replace(/\\"/g,'"');const ids={'h100-neo':'H100','h100-hs':'H100HS','h200':'H200','h200-neo':'H200','b200':'B200','b200-neo':'B200'};const out={};for(const [key,id]of Object.entries(ids)){const start=plain.indexOf(`"key":"${key}"`);if(start<0)continue;const m=plain.slice(start,start+4500).match(/"points":(\[[^\]]+\])/);if(m){const points=normalize(JSON.parse(m[1]).map(p=>({date:p.date,value:p.price})));if(points.length)out[id]=points;}}if(!Object.keys(out).length)throw new Error('官方公开图表结构改变');return out;}
export function treasury(text){const out={DGS10:[],DGS2:[]};for(const block of text.split('<entry>').slice(1)){const date=block.match(/<d:NEW_DATE[^>]*>(\d{4}-\d{2}-\d{2})/)?.[1];if(!date)continue;for(const [tag,id]of [['BC_10YEAR','DGS10'],['BC_2YEAR','DGS2']]){const val=block.match(new RegExp(`<d:${tag}[^>]*>([0-9.]+)</`))?.[1];if(val)out[id].push({date,value:Number(val)});}}if(!out.DGS10.length)throw new Error('财政部未返回有效数据');return out;}
async function get(url){const r=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0 (compatible; PersonalMarketMonitor/1.0)'},signal:AbortSignal.timeout(22000)});if(!r.ok)throw new Error(`来源返回 HTTP ${r.status}`);return r.text();}
export async function collect(previous={series:{}},cspUpload=null){const checkedAt=new Date().toISOString(),series=structuredClone(previous.series||{}),errors=[];function save(id,points){if(!points.length)throw new Error('没有可用观测');series[id]={id,...SOURCES[id],points:normalize([...(series[id]?.points||[]),...points]),checkedAt,lastSuccess:checkedAt,error:null};}function fail(id,e){errors.push(`${id}: ${e.message}`);series[id]={id,...SOURCES[id],...(series[id]||{points:[]}),checkedAt,error:String(e.message)}}
 let revenue=previous.revenue||revenueSeed;let tokenPrices=previous.tokenPrices||tokenSeed;let csp=previous.csp||cspSeed;if(cspUpload)csp=acceptCspUpload(cspUpload,csp);
 await Promise.allSettled([
 (async()=>{csp=await collectCsp(csp,false);for(const c of csp.companies){if(c.error)errors.push(c.id+' 财报: '+c.error);if(c.filingsError)errors.push(c.id+' 文件列表: '+c.filingsError)}if(csp.sofr.error)errors.push('SOFR: '+csp.sofr.error)})(),
 (async()=>{tokenPrices=await collectTokenPrices(tokenPrices);if(tokenPrices.error)errors.push('Token 价格: '+tokenPrices.error)})(),
 (async()=>{try{revenue=parseRevenue(await get(REVENUE_URL),checkedAt)}catch(e){revenue={...revenue,checkedAt,error:String(e.message)};errors.push('ARR: '+e.message)}})(),
 ...Object.keys(YAHOO_SYMBOLS).map(async id=>{try{save(id,yahoo(await get(`https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(YAHOO_SYMBOLS[id])}?period1=-2208988800&period2=${Math.floor(Date.now()/1000)}&interval=1d`)))}catch(e){fail(id,e)}}),
 (async()=>{try{save('VIX',vix(await get('https://cdn.cboe.com/api/global/us_indices/daily_prices/VIX_History.csv')))}catch(e){fail('VIX',e)}})(),
 (async()=>{try{const y=new Date().getUTCFullYear();const parts=await Promise.all([y-1,y].map(year=>get(`https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml?data=daily_treasury_yield_curve&field_tdr_date_value=${year}`).then(treasury)));for(const id of ['DGS10','DGS2'])save(id,normalize(parts.flatMap(p=>p[id])))}catch(e){fail('DGS10',e);fail('DGS2',e)}})(),
 (async()=>{try{for(const group of await Promise.all(['H100','H200','B200'].map(id=>get(SOURCES[id].url).then(gpu))))for(const [id,points]of Object.entries(group))save(id,points)}catch(e){for(const id of ['H100','H100HS','H200','B200'])fail(id,e)}})()
 ]);return {checkedAt,series,errors,revenue,tokenPrices,csp};}
