import fs from 'node:fs';
import {collectCsp} from './csp.mjs';
const csp=await collectCsp();
fs.writeFileSync('csp-upload.json',JSON.stringify({csp}));
console.log(JSON.stringify(csp.companies.map(c=>({id:c.id,points:c.points.length,filings:c.filings?.length||0,error:c.error,filingsError:c.filingsError}))));
