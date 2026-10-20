export const TOKEN_DEMAND_URL='https://openrouter.ai/api/frontend/v1/rankings/models?view=day';
export const TOKEN_DEMAND_SOURCE='https://openrouter.ai/rankings';
const MODEL_URL='https://openrouter.ai/api/v1/models';
const numeric=v=>['string','number'].includes(typeof v)&&v!==''&&String(v).trim()!==''&&Number.isFinite(Number(v))&&Number(v)>=0?Number(v):null;
function count(v){const n=numeric(v);if(n==null||!Number.isSafeInteger(n))throw Error('Token count missing or outside safe integer range');return n;}
export function buildTokenDemand(usage,models,at){
 if(!Array.isArray(usage?.data)||!usage.data.length||!Array.isArray(models?.data)||!models.data.length)throw Error('Public rankings or price schema changed');
 const prices=new Map();
 for(const m of models.data){
  if(typeof m.canonical_slug!=='string'||typeof m.id!=='string'||!m.architecture?.input_modalities?.includes('text')||!m.architecture?.output_modalities?.includes('text'))continue;
  const input=numeric(m.pricing?.prompt),output=numeric(m.pricing?.completion);if(input==null||output==null)continue;
  const suffix=m.id.includes(':')?m.id.slice(m.id.indexOf(':')):'';
  const key=suffix&&m.canonical_slug.endsWith(suffix)?m.canonical_slug:m.canonical_slug+suffix;
  const group=prices.get(key)||[];group.push({id:m.id,input:input*1e6,output:output*1e6});prices.set(key,group);
 }
 const seen=new Set(),details=[];let date;
 for(const row of usage.data){
  const d=typeof row.date==='string'?row.date.slice(0,10):'';
  if(!/^\d{4}-\d{2}-\d{2}$/.test(d)||!Number.isFinite(Date.parse(d))||new Date(d).toISOString().slice(0,10)!==d||d>=at.slice(0,10))throw Error('Usage date must be a completed UTC day');
  if(date&&date!==d)throw Error('Expected one daily public rankings bucket');date=d;
  const inputTokens=count(row.total_prompt_tokens),outputTokens=count(row.total_completion_tokens);
  // The public endpoint may include one anonymous all-zero placeholder. It contributes no volume.
  if(row.variant_permaslug===''&&inputTokens===0&&outputTokens===0)continue;
  if(typeof row.variant_permaslug!=='string'||!row.variant_permaslug.trim()||seen.has(row.variant_permaslug))throw Error('Missing or duplicate exact model variant');seen.add(row.variant_permaslug);
  const group=prices.get(row.variant_permaslug)||[];
  // Match exact dated canonical version AND variant. Never strip dates, substitute a newer model, or infer free/batch pricing.
  const match=group.length&&group.every(p=>p.input===group[0].input&&p.output===group[0].output)?group.slice().sort((a,b)=>a.id.localeCompare(b.id))[0]:null;
  const nominalSpend=match?(inputTokens*match.input+outputTokens*match.output)/1e6:null;
  details.push({usageId:row.variant_permaslug,inputTokens,outputTokens,modelId:match?.id||null,inputPrice:match?.input??null,outputPrice:match?.output??null,nominalSpend,reason:match?'matched':group.length?'ambiguous-price':'no-exact-text-price'});
 }
 const matched=details.filter(r=>r.nominalSpend!=null),sum=(rows,key)=>rows.reduce((n,r)=>n+r[key],0);
 const totalInput=sum(details,'inputTokens'),totalOutput=sum(details,'outputTokens'),totalTokens=totalInput+totalOutput,matchedInput=sum(matched,'inputTokens'),matchedOutput=sum(matched,'outputTokens'),matchedTokens=matchedInput+matchedOutput;
 if(!Number.isSafeInteger(totalTokens)||totalTokens<=0)throw Error('Invalid aggregate token count');
 const estimatedSpend=matched.length?sum(matched,'nominalSpend'):null;
 const summary={date,checkedAt:at,priceCheckedAt:at,totalInput,totalOutput,totalTokens,matchedInput,matchedOutput,matchedTokens,estimatedSpend,weightedPrice:estimatedSpend!=null&&matchedTokens>0?estimatedSpend/matchedTokens*1e6:null,coverage:matchedTokens/totalTokens,totalModels:details.length,matchedModels:matched.length,freeTokens:matched.filter(r=>r.inputPrice===0&&r.outputPrice===0).reduce((n,r)=>n+r.inputTokens+r.outputTokens,0)};
 return {summary,details};
}
export function mergeDemandHistory(previous=[],incoming=[]){
 const map=new Map(previous.map(p=>[p.date,p]));for(const p of incoming){const old=map.get(p.date);if(!old||p.checkedAt>=old.checkedAt)map.set(p.date,p);}return [...map.values()].sort((a,b)=>a.date.localeCompare(b.date));
}
export async function collectTokenDemand(previous,fetcher=fetch,at=new Date().toISOString()){
 try{
  const [usage,models]=await Promise.all([TOKEN_DEMAND_URL,MODEL_URL].map(async url=>{const r=await fetcher(url,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(25000)});if(!r.ok)throw Error('Public Token source HTTP '+r.status);return r.json();}));
  const result=buildTokenDemand(usage,models,at);
  if(previous?.history?.at(-1)?.date>result.summary.date)throw Error('Public usage date regressed; previous history retained');
  return {source:TOKEN_DEMAND_SOURCE,endpoint:TOKEN_DEMAND_URL,checkedAt:at,lastSuccess:at,error:null,history:mergeDemandHistory(previous?.history,[result.summary]),latest:{date:result.summary.date,checkedAt:at,details:result.details}};
 }catch(e){return {...previous,source:TOKEN_DEMAND_SOURCE,endpoint:TOKEN_DEMAND_URL,checkedAt:at,history:previous?.history||[],error:String(e.message)};}
}
