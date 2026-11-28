import assert from 'node:assert/strict';
import {waitForArtifact} from './wait-pages-artifact.mjs';
const base={url:'https://example.invalid',token:'test',id:'42',attempts:3,pause:async()=>{}};
let calls=0;await waitForArtifact({...base,fetcher:async()=>({ok:true,json:async()=>({artifacts:++calls<3?[]:[{id:42,name:'github-pages',expired:false}]})})});assert.equal(calls,3);
await assert.rejects(waitForArtifact({...base,fetcher:async()=>({ok:true,json:async()=>({artifacts:[{id:41,name:'github-pages',expired:false}]})})}));
await assert.rejects(waitForArtifact({...base,fetcher:async()=>({ok:true,json:async()=>({artifacts:[{id:42,name:'github-pages',expired:true}]})})}));
let retries=0;await waitForArtifact({...base,fetcher:async()=>{if(++retries===1)throw Error('temporary');return {ok:true,json:async()=>({artifacts:[{id:42,name:'github-pages',expired:false}]})}}});assert.equal(retries,2);
console.log('Pages artifact readiness checks passed.');
