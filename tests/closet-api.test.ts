import {test} from 'node:test';
import assert from 'node:assert/strict';
import {NextRequest} from 'next/server';
import {GET,POST} from '../src/app/api/closet/route';
import {POST as colorAnalysisPOST} from '../src/app/api/color-analysis/route';
import {photoApisAllowed} from '../src/lib/photo-api-guard';

function withHostedFlag<T>(value:string|undefined,run:()=>T){
 const previous=process.env.ATELIER_ALLOW_HOSTED_PHOTO_APIS;
 if(value===undefined)delete process.env.ATELIER_ALLOW_HOSTED_PHOTO_APIS;
 else process.env.ATELIER_ALLOW_HOSTED_PHOTO_APIS=value;
 try{return run();}
 finally{if(previous===undefined)delete process.env.ATELIER_ALLOW_HOSTED_PHOTO_APIS;else process.env.ATELIER_ALLOW_HOSTED_PHOTO_APIS=previous;}
}

test('paid image endpoint rejects nonlocal hosts',async()=>{
 const response=await withHostedFlag(undefined,()=>POST(new NextRequest('https://example.com/api/closet',{method:'POST',headers:{host:'example.com'}})));assert.equal(response.status,403);
});
test('paid image endpoint rejects cross-origin browser requests',async()=>{
 const response=await POST(new NextRequest('http://127.0.0.1:43148/api/closet',{method:'POST',headers:{host:'127.0.0.1:43148',origin:'https://example.com'}}));assert.equal(response.status,403);
});
test('hosted photo APIs stay blocked when the unlock flag is unset',()=>{
 withHostedFlag(undefined,()=>{
  const req=new NextRequest('https://atelier-theta-one.vercel.app/api/closet',{headers:{host:'atelier-theta-one.vercel.app',origin:'https://atelier-theta-one.vercel.app'}});
  assert.equal(photoApisAllowed(req),false);
 });
});
test('hosted photo APIs stay blocked when VERCEL_ENV is production without the unlock flag',()=>{
 const previous=process.env.VERCEL_ENV;
 process.env.VERCEL_ENV='production';
 try{
  withHostedFlag(undefined,()=>{
   const req=new NextRequest('https://atelier-theta-one.vercel.app/api/closet',{headers:{host:'atelier-theta-one.vercel.app'}});
   assert.equal(photoApisAllowed(req),false);
  });
 }finally{if(previous===undefined)delete process.env.VERCEL_ENV;else process.env.VERCEL_ENV=previous;}
});
test('hosted photo APIs are allowed when the unlock flag is set',async()=>{
 await withHostedFlag('1',async()=>{
  const req=new NextRequest('https://atelier-theta-one.vercel.app/api/closet',{headers:{host:'atelier-theta-one.vercel.app',origin:'https://atelier-theta-one.vercel.app'}});
  assert.equal(photoApisAllowed(req),true);
  const response=await GET(req);
  assert.equal(response.status,200);
  const data=await response.json();
  assert.equal(typeof data.ready,'boolean');
 });
 await withHostedFlag('TRUE',()=>{
  assert.equal(photoApisAllowed(new NextRequest('https://atelier-theta-one.vercel.app/api/closet',{headers:{host:'atelier-theta-one.vercel.app'}})),true);
 });
 await withHostedFlag('Yes',()=>{
  assert.equal(photoApisAllowed(new NextRequest('https://atelier-theta-one.vercel.app/api/closet',{headers:{host:'atelier-theta-one.vercel.app'}})),true);
 });
});
test('color analysis rejects hosted hosts when the unlock flag is unset',async()=>{
 const response=await withHostedFlag(undefined,()=>colorAnalysisPOST(new NextRequest('https://atelier-theta-one.vercel.app/api/color-analysis',{method:'POST',headers:{host:'atelier-theta-one.vercel.app'}})));
 assert.equal(response.status,403);
 const data=await response.json();
 assert.equal(data.error,'Local preview only.');
});
test('color analysis allows hosted hosts when the unlock flag is set',async()=>{
 const previousKey=process.env.OPENAI_API_KEY,previousGateway=process.env.AI_GATEWAY_API_KEY;
 delete process.env.OPENAI_API_KEY;delete process.env.AI_GATEWAY_API_KEY;
 try{
  const response=await withHostedFlag('1',()=>colorAnalysisPOST(new NextRequest('https://atelier-theta-one.vercel.app/api/color-analysis',{method:'POST',headers:{host:'atelier-theta-one.vercel.app',origin:'https://atelier-theta-one.vercel.app'}})));
  assert.notEqual(response.status,403);
  assert.equal(response.status,503);
 }finally{
  if(previousKey===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=previousKey;
  if(previousGateway===undefined)delete process.env.AI_GATEWAY_API_KEY;else process.env.AI_GATEWAY_API_KEY=previousGateway;
 }
});
test('connection check exposes status only, never credentials',async()=>{
 const response=await GET(new NextRequest('http://127.0.0.1:43148/api/closet',{headers:{host:'127.0.0.1:43148'}}));const data=await response.json();assert.equal(typeof data.ready,'boolean');assert.deepEqual(Object.keys(data).sort(),['model','ready']);
});
test('single-item redo forwards corrected color and note to image editing',async()=>{
 const oldKey=process.env.OPENAI_API_KEY,oldGateway=process.env.AI_GATEWAY_API_KEY,oldFetch=globalThis.fetch;
 process.env.OPENAI_API_KEY='test-placeholder';delete process.env.AI_GATEWAY_API_KEY;
 let prompt='';
 globalThis.fetch=async (_url,init)=>{prompt=String((init?.body as FormData).get('prompt'));return new Response(JSON.stringify({data:[{b64_json:'test-image'}]}),{headers:{'Content-Type':'application/json'}});};
 try{
 const response=await POST(new NextRequest('http://127.0.0.1:43150/api/closet',{method:'POST',headers:{host:'127.0.0.1:43150','Content-Type':'application/json'},body:JSON.stringify({action:'cutout',image:'data:image/png;base64,aGVsbG8=',item:{name:'Knee-high boots',role:'shoes',color:'brown'},correction:'Keep the shape; correct the boots to brown.'})}));
 assert.equal(response.status,200);assert.match(prompt,/"color":"brown"/);assert.match(prompt,/correct the boots to brown/);assert.match(prompt,/Never substitute a dress/);
 }finally{globalThis.fetch=oldFetch;if(oldKey===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=oldKey;if(oldGateway===undefined)delete process.env.AI_GATEWAY_API_KEY;else process.env.AI_GATEWAY_API_KEY=oldGateway;}
});
