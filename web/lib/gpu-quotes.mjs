export const GPU_MODELS=['H100','H200','B200','B300','GB200','GB300','RUBIN'];
export const QUOTE_SOURCES={CoreWeave:'https://www.coreweave.com/pricing',Nebius:'https://nebius.com/prices'};
const decode=s=>s.replace(/&nbsp;|&#160;/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(Number(n)));
// Parse structure only: never execute vendor scripts or interpret embedded JSON as prices.
function dom(html){
 const root={tag:'root',attrs:{},children:[],parent:null};const stack=[root];
 html=html.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>|<style\b[^>]*>[\s\S]*?<\/style\s*>/gi,'');
 for(const token of html.match(/<!--[\s\S]*?-->|<[^>]+>|[^<]+/g)||[]){
  if(token.startsWith('<!--')||token.startsWith('<!'))continue;
  if(token.startsWith('</')){const tag=token.match(/^<\/\s*([^\s>]+)/)?.[1]?.toLowerCase();for(let i=stack.length-1;i>0;i--)if(stack[i].tag===tag){stack.length=i;break;}continue;}
  if(token.startsWith('<')){const tag=token.match(/^<\s*([^\s/>]+)/)?.[1]?.toLowerCase();if(!tag)continue;const attrs={};for(const m of token.matchAll(/([^\s=<>/]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g))attrs[m[1].toLowerCase()]=decode(m[2]??m[3]);const node={tag,attrs,children:[],parent:stack.at(-1)};stack.at(-1).children.push(node);if(!/\/$/.test(token.slice(0,-1))&&!['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'].includes(tag))stack.push(node);
  }else stack.at(-1).children.push(decode(token));
 }
 return root;
}
const has=(node,cls)=>node&&typeof node!=='string'&&(node.attrs.class||'').split(/\s+/).includes(cls);
function all(node,test,out=[]){if(typeof node==='string')return out;if(test(node))out.push(node);for(const child of node.children)all(child,test,out);return out;}
const text=node=>typeof node==='string'?node:node.children.map(text).join(' ').replace(/\s+/g,' ').trim();
function ancestor(node,test){for(let n=node.parent;n;n=n.parent)if(test(n))return n;return null;}
const money=value=>{const m=value.match(/^\$\s*([\d,]+(?:\.\d+)?)/);return m?Number(m[1].replaceAll(',','')):null;};
const model=name=>{const m=name.match(/\b(GB300|GB200|B300|B200|H200|H100)\b/);return m?.[1]||null;};
export function normalizeQuote({provider,gpu,region,billing,rawPrice,gpuCount,unit,lowerBound=false,...rest}){
 if(!GPU_MODELS.includes(gpu)||!['on-demand','spot'].includes(billing))throw Error('Invalid quote category');
 if(rawPrice!=null&&(!Number.isFinite(rawPrice)||rawPrice<=0))throw Error('Invalid positive quote');
 if(unit==='instance-hour'&&(!Number.isInteger(gpuCount)||gpuCount<=0))throw Error('GPU count must be verified from instance row');
 const perGpu=rawPrice==null?null:unit==='gpu-hour'?rawPrice:rawPrice/gpuCount;
 return {id:[provider,gpu,region,billing].join(':'),provider,gpu,region,billing,currency:'USD',unit,rawPrice,gpuCount,perGpu,lowerBound,status:rawPrice==null?'contact-sales':'priced',source:QUOTE_SOURCES[provider],...rest};
}
export function parseCoreWeave(html){
 const tree=dom(html),offers=[];
 for(const row of all(tree,n=>has(n,'table-grid'))){
  if(!ancestor(row,n=>has(n,'gpu-pricing')))continue;
  const section=ancestor(row,n=>has(n,'section-content'));const title=section&&all(section,n=>n.tag==='h5')[0];const regionText=title?text(title):'';const region=regionText.includes('NORTH AMERICA')?'North America':regionText.includes('EUROPE')?'Europe':null;if(!region)continue;
  const heading=all(row,n=>n.tag==='h3')[0];const gpu=heading&&model(text(heading));if(!gpu)continue;
  const cells=row.children.filter(n=>has(n,'table-v2-cell'));if(cells.length<7)throw Error('CoreWeave instance columns changed');
  const count=Number(text(cells[1]).match(/^\d+/)?.[0]);const expected=gpu.startsWith('GB')?4:8;if(count!==expected)throw Error('CoreWeave GPU-count specification changed; manual review required');
  for(const [billing,cls] of [['on-demand','instance-price'],['spot','spot-price']]){
   const priceNode=all(row,n=>has(n,cls))[0];if(!priceNode)throw Error('CoreWeave price label changed');const val=all(priceNode,n=>has(n,'item-value'))[0];if(!val)throw Error('CoreWeave price value missing');
   const priceText=text(val);if(priceText&&!/^\$|N\/A|contact/i.test(priceText))throw Error('Unknown CoreWeave price format');
   offers.push(normalizeQuote({provider:'CoreWeave',gpu,region,billing,rawPrice:money(priceText),gpuCount:count,unit:'instance-hour',status:/N\/A/i.test(priceText)?'not-offered':money(priceText)==null?'contact-sales':'priced',vcpus:text(cells[3]),ramGb:text(cells[4]),note:'整实例挂牌价按该行 GPU 数折算；不使用仅限推理平台客户的单卡报价。'}));
  }
 }
 for(const gpu of ['H100','H200','B200','B300','GB200','GB300'])if(!offers.some(o=>o.gpu===gpu&&o.region==='North America'))throw Error('CoreWeave model coverage changed: '+gpu);
 return offers;
}
export function parseNebius(html){
 const tree=dom(html),offers=[];
 for(const table of all(tree,n=>has(n,'pc-highlight-table-block__content'))){
  const rows=all(table,n=>has(n,'pc-highlight-table-block__row'));if(!rows.length)continue;
  const headers=text(rows[0]);if(!headers.includes('GPU-hour'))continue;
  const billing=headers.includes('Spot')?'spot':'on-demand';
  for(const row of rows.slice(1)){const cells=row.children.filter(n=>has(n,'pc-highlight-table-block__cell'));if(cells.length!==4)throw Error('Nebius GPU columns changed');const gpu=model(text(cells[0]));if(!gpu)continue;const raw=text(cells[3]);const lowerBound=/^from\s+/i.test(raw);const value=raw.replace(/^from\s+/i,'');if(!/^\$|contact/i.test(value))throw Error('Unknown Nebius price format');offers.push(normalizeQuote({provider:'Nebius',gpu,region:'Not specified',billing,rawPrice:money(value),gpuCount:null,unit:'gpu-hour',lowerBound,vcpus:text(cells[1]),ramGb:text(cells[2]),note:'官网直接按 GPU-hour 公布；地区未在该表指定。Spot 的 from 是起价，不是保证可成交价格。'}));}
 }
 for(const gpu of ['H100','H200','B200','B300'])if(!offers.some(o=>o.gpu===gpu&&o.billing==='on-demand'))throw Error('Nebius model coverage changed: '+gpu);
 return offers;
}
export function mergeQuoteHistory(previous=[],offers=[],at=new Date().toISOString()){
 const map=new Map(previous.map(p=>[p.date+'|'+p.offerId,p]));for(const offer of offers){const date=at.slice(0,10);map.set(date+'|'+offer.id,{date,offerId:offer.id,value:offer.perGpu,observedAt:at,lowerBound:offer.lowerBound});}return [...map.values()].sort((a,b)=>a.date.localeCompare(b.date)||a.offerId.localeCompare(b.offerId));
}
export async function collectGpuQuotes(previous,fetcher=fetch){
 const at=new Date().toISOString();const next=structuredClone(previous||{offers:[],history:[],sources:[]});next.checkedAt=at;
 await Promise.all(Object.entries(QUOTE_SOURCES).map(async([provider,url])=>{
  try{const r=await fetcher(url,{headers:{'User-Agent':'Mozilla/5.0 (MarketRiskObservatory)'},signal:AbortSignal.timeout(25000)});if(!r.ok)throw Error('Official pricing HTTP '+r.status);const html=await r.text();const offers=(provider==='CoreWeave'?parseCoreWeave(html):parseNebius(html)).map(o=>({...o,observedAt:at}));next.offers=next.offers.filter(o=>o.provider!==provider).concat(offers);next.history=mergeQuoteHistory(next.history,offers,at);next.sources=next.sources.filter(s=>s.provider!==provider).concat({provider,url,checkedAt:at,lastSuccess:at,error:null,rubinListed:/\brubin\b/i.test(text(dom(html)))});
  }catch(e){const old=next.sources.find(s=>s.provider===provider);next.sources=next.sources.filter(s=>s.provider!==provider).concat({...old,provider,url,checkedAt:at,error:String(e.message)});}
 }));return next;
}
