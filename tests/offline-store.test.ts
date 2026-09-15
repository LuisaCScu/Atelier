import 'fake-indexeddb/auto';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readOfflineState,writeOfflineState} from '../src/lib/offline-store';
test('upload draft restores source and completed cutouts without overwriting closet state',async()=>{
 const closet=JSON.stringify({closet:[{id:'saved-boots'}]});
 const draft=JSON.stringify({photo:'data:image/jpeg;base64,original',items:[{name:'Brown boots',color:'brown',selected:true,image:'data:image/png;base64,cutout'}]});
 await writeOfflineState(closet);
 await writeOfflineState(draft,'closet-upload-draft');
 assert.equal(await readOfflineState('closet-upload-draft'),draft);
 assert.equal(await readOfflineState(),closet);
 await writeOfflineState(JSON.stringify({photo:'',items:[]}),'closet-upload-draft');
 assert.equal(await readOfflineState(),closet);
});
import {restoreUpload,selectWithinCapacity} from '../src/lib/closet-upload';
test('legacy single-photo drafts retain source associations in batch uploader',()=>{
 const draft=restoreUpload(JSON.stringify({photo:'original-photo',items:[{name:'boots',role:'shoes',color:'brown',selected:true,image:'cutout'}]}));
 assert.equal(draft.photos.length,1);assert.equal(draft.items[0].sourceId,draft.photos[0].id);assert.equal(draft.items[0].image,'cutout');
});
test('batch selection shares one capacity limit across photos',()=>{
 const items=Array.from({length:6},(_,i)=>({id:String(i),sourceId:i<3?'photo-a':'photo-b',name:'item',role:'top',color:'white',selected:true}));
 assert.equal(selectWithinCapacity(items,4).filter(i=>i.selected).length,4);
 assert.equal(selectWithinCapacity(items,0).filter(i=>i.selected).length,0);
 const draft={photos:[{id:'photo-a',name:'a',image:'source',detected:true}],items:[{...items[0],image:'finished-cutout'}]};
 assert.deepEqual(restoreUpload(JSON.stringify(draft)),draft);
});
