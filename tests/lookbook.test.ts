import {test} from 'node:test';
import assert from 'node:assert/strict';
import {saveToLookbook} from '../src/lib/lookbook';
import {catalog,type Look} from '../src/lib/stylist';
const look=(i:number):Look=>({id:'look-'+i,title:'Look '+i,occasion:'Everyday',why:'',pieces:[{...catalog[0],id:'piece-'+i}]});
test('Free allows ten saved looks and blocks an eleventh',()=>{
 const saved=Array.from({length:9},(_,i)=>look(i));const ten=saveToLookbook(saved,look(9),'free')!;
 assert.equal(ten.length,10);assert.equal(saveToLookbook(ten,look(10),'free'),null);assert.equal(ten.length,10);
});
test('replacement is atomic and preserves all unselected older looks',()=>{
 const saved=Array.from({length:10},(_,i)=>look(i));const next=saveToLookbook(saved,look(10),'free','look-3')!;
 assert.equal(next.length,10);assert.equal(next[0].id,'look-10');assert.ok(!next.some(l=>l.id==='look-3'));assert.equal(saved.length,10);assert.ok(saved.some(l=>l.id==='look-3'));
 assert.equal(saveToLookbook(saved,look(10),'free','missing'),null);
});
test('Premium capacity and duplicates are handled without extra slots',()=>{
 const saved=Array.from({length:100},(_,i)=>look(i));assert.equal(saveToLookbook(saved,look(100),'premium'),null);assert.equal(saveToLookbook(saved,{...look(0),id:'different-id'},'premium'),saved);assert.equal(saveToLookbook(saved.slice(0,99),look(100),'premium')!.length,100);
});
