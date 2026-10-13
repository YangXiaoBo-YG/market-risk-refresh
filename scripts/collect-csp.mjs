import fs from 'node:fs';
import {collectCsp} from './csp.mjs';
const nativeFetch=globalThis.fetch;
const agent=process.env.SEC_USER_AGENT;
if(!agent)throw Error('SEC contact identity not configured');
globalThis.fetch=(url,options={})=>nativeFetch(url,{...options,headers:{...options.headers,...(String(url).startsWith('https://data.sec.gov/')?{'User-Agent':agent}:{})}});
const csp=await collectCsp();
fs.writeFileSync('csp-upload.json',JSON.stringify({csp}));
console.log(JSON.stringify(csp.companies.map(c=>({id:c.id,points:c.points.length,filings:c.filings?.length||0,error:c.error,filingsError:c.filingsError}))));
