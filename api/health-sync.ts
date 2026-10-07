import { createClient } from '@supabase/supabase-js';
import { parseHealthImport } from '../src/nutritionHealth.js';

export const runtime = 'nodejs';
const reply = (status:number, data:unknown) => Response.json(data,{status,headers:{'Cache-Control':'no-store'}});

export async function POST(request:Request) {
  const token = request.headers.get('authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
  if (!token) return reply(401,{error:'Clé de synchronisation invalide.'});
  if (!request.headers.get('content-type')?.startsWith('application/json')) return reply(415,{error:'JSON requis.'});
  // Enforce the limit while streaming, not only after allocating a large body.
  const reader=request.body?.getReader();
  if (!reader) return reply(400,{error:'Données manquantes.'});
  let size=0;const chunks:Uint8Array[]=[];
  let input:ReturnType<typeof parseHealthImport>;
  try {
    while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>500){await reader.cancel();return reply(413,{error:'Données trop volumineuses.'});}chunks.push(part.value);}
    const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
    input=parseHealthImport(new TextDecoder().decode(bytes));
  }catch{return reply(400,{error:'Données invalides.'});}
  try {
    const url=process.env.MYGYMTRACKER_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
    const key=process.env.MYGYMTRACKER_SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;
    if(!url || !key)return reply(503,{error:'Synchronisation non configurée.'});
    const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(10000)})}});
    const {error}=await client.rpc('health_sync_steps',{p_token:token,p_date:input.date,p_steps:input.steps});
    if(error)return reply(error.code==='42501'?401:error.code==='22023'?400:503,{error:'Synchronisation refusée ou indisponible.'});
    return reply(200,{ok:true});
  }catch{return reply(503,{error:'Synchronisation temporairement indisponible.'});}
}
