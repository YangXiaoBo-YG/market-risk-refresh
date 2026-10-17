export const REVENUE_URL='https://epoch.ai/data/ai_companies_revenue_reports.csv';
export function csvRows(text){
 const rows=[];let row=[],field='',quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++;}else quoted=!quoted;}else if(!quoted&&(c===','||c==='\n')){row.push(field.replace(/\r$/,''));field='';if(c==='\n'){rows.push(row);row=[];}}else field+=c;}
 if(quoted)throw Error('收入 CSV 引号未闭合');
 if(field||row.length){row.push(field.replace(/\r$/,''));rows.push(row);}
 const headers=rows.shift()?.map(h=>h.replace(/^\uFEFF/,''))||[];
 for(const key of ['Company','Date','Annualized revenue (USD)','Annualized revenue type','Scope','Report date','Source 1'])if(!headers.includes(key))throw Error('收入数据字段改变：'+key);
 return rows.map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i]||''])));
}
export function parseRevenue(text,now=new Date().toISOString()){
 const byCompany={OpenAI:new Map(),Anthropic:new Map()};
 for(const r of csvRows(text)){
  const company=r.Company,type=r['Annualized revenue type'],value=Number(r['Annualized revenue (USD)']),date=r.Date,reportDate=r['Report date'];
  if(!(company in byCompany)||r.Scope!=='Full company'||!['Annualized run rate','Annual recurring revenue (ARR)'].includes(type)||!Number.isFinite(value)||value<=0)continue;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^\d{4}-\d{2}-\d{2}$/.test(reportDate)||date>now.slice(0,10)||reportDate>now.slice(0,10))continue;
  const sources=['Source 1','Source 2','Source 3'].map(k=>r[k]?.trim()).filter(u=>/^https?:\/\//.test(u||''));if(!sources.length)continue;
  const notes=[r['Notes'],r['Other revenue info'],r['Graph note']].filter(Boolean).join(' · ');
  const p={company,date,reportDate,value:value/1e9,type,sourceType:r['Source type'],sources,notes};
  const old=byCompany[company].get(date);if(!old||old.reportDate<reportDate)byCompany[company].set(date,p);
 }
 const points=Object.values(byCompany).flatMap(m=>[...m.values()]).sort((a,b)=>a.date.localeCompare(b.date)||a.company.localeCompare(b.company));
 for(const company of Object.keys(byCompany))if(!byCompany[company].size)throw Error(company+' 缺少有效收入观测');
 return {checkedAt:now,lastSuccess:now,error:null,points};
}
