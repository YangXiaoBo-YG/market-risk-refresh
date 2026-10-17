export const TOKEN_PRICE_URL='https://openrouter.ai/api/v1/models';
export const BASKET_IDS=['openai/gpt-4.1','openai/gpt-4.1-mini','anthropic/claude-sonnet-4.5','anthropic/claude-opus-4.1','google/gemini-2.5-pro','google/gemini-2.5-flash'];
const price=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))&&Number(v)>=0?Number(v)*1e6:null;
export function parseTokenPrices(json,at){
 if(!Array.isArray(json.data))throw Error('价格接口结构改变');
 const models=[],prices={};
 for(const m of json.data){
  if(typeof m.id!=='string'||!m.architecture?.input_modalities?.includes('text')||!m.architecture?.output_modalities?.includes('text'))continue;
  const input=price(m.pricing?.prompt),output=price(m.pricing?.completion);
  if(input==null||output==null)continue;
  models.push({id:m.id,name:m.name||m.id,url:'https://openrouter.ai/'+m.id,hasTiers:!!m.pricing?.overrides?.length});prices[m.id]={input,output};
 }
 if(!models.length)throw Error('没有有效文本 Token 报价');
 return {models:models.sort((a,b)=>a.id.localeCompare(b.id)),observation:{date:at.slice(0,10),checkedAt:at,prices}};
}
export function mergePriceHistory(old=[],incoming=[]){
 const map=new Map();for(const p of [...old,...incoming]){const prior=map.get(p.date);if(!prior||p.checkedAt>=prior.checkedAt)map.set(p.date,p);}
 return [...map.values()].sort((a,b)=>a.date.localeCompare(b.date));
}
export function updateTokenPrices(previous,json,at){
 const parsed=parseTokenPrices(json,at),history=mergePriceHistory(previous?.history, [parsed.observation]);
 let basket=previous?.basket;
 if(!basket){const first=history.find(p=>BASKET_IDS.every(id=>p.prices[id]&&p.prices[id].input*.75+p.prices[id].output*.25>0));if(first)basket={ids:[...BASKET_IDS],baseDate:first.date,basePrices:Object.fromEntries(BASKET_IDS.map(id=>[id,first.prices[id].input*.75+first.prices[id].output*.25]))};}
 return {models:[...new Map([...(previous?.models||[]),...parsed.models].map(m=>[m.id,m])).values()].sort((a,b)=>a.id.localeCompare(b.id)),history,basket,checkedAt:at,lastSuccess:at,error:null};
}
export async function collectTokenPrices(previous){
 const at=new Date().toISOString();
 try{const r=await fetch(TOKEN_PRICE_URL,{signal:AbortSignal.timeout(22000)});if(!r.ok)throw Error('价格来源返回 HTTP '+r.status);return updateTokenPrices(previous,await r.json(),at)}
 catch(e){return {...previous,models:previous?.models||[],history:previous?.history||[],checkedAt:at,error:String(e.message)}}
}
export function tokenPriceRows(data,id){return (data?.history||[]).flatMap(p=>p.prices[id]?[{date:p.date,input:p.prices[id].input,output:p.prices[id].output}]:[]);}
export function tokenBasketRows(data){
 if(!data?.basket)return [];const b=data.basket;
 return data.history.filter(p=>p.date>=b.baseDate&&b.ids.every(id=>p.prices[id]&&b.basePrices[id]>0)).map(p=>({date:p.date,value:100*b.ids.reduce((sum,id)=>sum+(p.prices[id].input*.75+p.prices[id].output*.25)/b.basePrices[id],0)/b.ids.length}));
}
