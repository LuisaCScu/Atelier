import {test} from 'node:test';
import assert from 'node:assert/strict';
import {NextRequest} from 'next/server';
import {GET,POST} from '../src/app/api/closet/route';
test('paid image endpoint rejects nonlocal hosts',async()=>{
 const response=await POST(new NextRequest('https://example.com/api/closet',{method:'POST',headers:{host:'example.com'}}));assert.equal(response.status,403);
});
test('paid image endpoint rejects cross-origin browser requests',async()=>{
 const response=await POST(new NextRequest('http://127.0.0.1:43148/api/closet',{method:'POST',headers:{host:'127.0.0.1:43148',origin:'https://example.com'}}));assert.equal(response.status,403);
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
