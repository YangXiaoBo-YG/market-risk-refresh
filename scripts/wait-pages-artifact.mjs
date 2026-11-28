import {pathToFileURL} from 'node:url';
// Allow bounded propagation time between artifact upload and Pages deployment.
export async function waitForArtifact({url,token,id,fetcher=fetch,pause=ms=>new Promise(r=>setTimeout(r,ms)),attempts=12}){
 if(!/^\d+$/.test(String(id)))throw Error('Uploaded Pages artifact ID is missing');
 for(let attempt=1;attempt<=attempts;attempt++){
  try{
   const r=await fetcher(url,{headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json'},signal:AbortSignal.timeout(15000)});
   if(!r.ok)throw Error('Artifact listing HTTP '+r.status);
   const body=await r.json();const artifacts=body.artifacts||[];
   if(artifacts.some(a=>String(a.id)===String(id)&&a.name==='github-pages'&&!a.expired))return;
  }catch(e){console.log('Artifact check '+attempt+': '+e.message);}
  if(attempt<attempts)await pause(5000);
 }
 throw Error('Uploaded Pages artifact is not visible after retries; data history is already saved.');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
if(process.env.PAGES_ARTIFACT_ID){
 await waitForArtifact({url:process.env.GITHUB_API_URL+'/repos/'+process.env.GITHUB_REPOSITORY+'/actions/runs/'+process.env.GITHUB_RUN_ID+'/artifacts?per_page=100',token:process.env.GH_TOKEN,id:process.env.PAGES_ARTIFACT_ID});
 console.log('Uploaded Pages artifact is visible.');
}else if(process.env.GITHUB_ACTIONS==='true'){throw Error('Missing Pages artifact ID');}
}
