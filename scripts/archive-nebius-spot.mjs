import fs from 'node:fs';
import path from 'node:path';
import {mergeSpotSeries} from '../web/lib/nebius-spot.mjs';
export function writeSpotArchive(data,directory='web/public/data/nebius-spot'){
 fs.mkdirSync(directory,{recursive:true});const groups=new Map();
 for(const s of data?.series||[])for(const p of s.points){const month=p.timestamp.slice(0,7);if(!/^\d{4}-\d{2}$/.test(month))throw Error('Invalid archive month');const group=groups.get(month)||new Map();const entry=group.get(s.id)||{...s,points:[]};entry.points.push(p);group.set(s.id,entry);groups.set(month,group);}
 for(const [month,group] of groups){const target=path.join(directory,month+'.json'),old=fs.existsSync(target)?JSON.parse(fs.readFileSync(target,'utf8')):null;const series=mergeSpotSeries(old?.series,[...group.values()]);fs.writeFileSync(target,JSON.stringify({schemaVersion:1,unit:'USD/GPU-hour',granularity:'hourly-last-price',month,series})+'\n');}
 const months=fs.readdirSync(directory).filter(n=>/^\d{4}-\d{2}\.json$/.test(n)).sort().map(name=>{const d=JSON.parse(fs.readFileSync(path.join(directory,name),'utf8'));const points=d.series.flatMap(s=>s.points),times=points.map(p=>p.timestamp).sort();return {month:d.month,file:name,series:d.series.length,observations:points.length,start:times[0]||null,end:times.at(-1)||null};});
 const index={schemaVersion:1,source:'https://nebius.com/spot-prices',unit:'USD/GPU-hour',granularity:'hourly-last-price',months};fs.writeFileSync(path.join(directory,'index.json'),JSON.stringify(index,null,2)+'\n');return index;
}
