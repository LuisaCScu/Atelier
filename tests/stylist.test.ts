import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildLooks,
  defaultProfile,
  palettes,
  total,
  catalog,
  type Piece,
} from "../src/lib/stylist";
import { existsSync } from "node:fs";
test("every complete outfit respects the exact budget across palettes and seeds", () => {
  for (const season of Object.keys(palettes))
    for (const budget of [100, 150, 200, 280, 500, 800])
      for (let seed = 0; seed < 8; seed++) {
        const looks = buildLooks(
          { ...defaultProfile, season, budget },
          "Work",
          seed,
        );
        for (const l of looks) {
          assert.ok(total(l) <= budget, `${total(l)} exceeds ${budget}`);
          assert.ok(l.pieces.some((p) => p.role === "top"));
          assert.ok(l.pieces.some((p) => p.role === "bottom"));
          assert.ok(l.pieces.some((p) => p.role === "shoes"));
          assert.equal(
            new Set(l.pieces.map((p) => p.id)).size,
            l.pieces.length,
          );
        }
      }
});
test("owned dress replaces top and bottom and costs zero", () => {
  const dress: Piece = {
    id: "owned-dress",
    role: "dress",
    name: "Favorite dress",
    brand: "Your closet",
    price: 300,
    color: "cream",
    image: "",
    shopUrl: "",
    owned: true,
  };
  for (const l of buildLooks(defaultProfile, "Dinner", 0, [dress], true)) {
    assert.ok(l.pieces.some((p) => p.id === dress.id));
    assert.ok(!l.pieces.some((p) => p.role === "top" || p.role === "bottom"));
    assert.ok(total(l) <= defaultProfile.budget);
  }
});
test("style this piece includes the specified closet item in all looks", () => {
  const piece = { ...catalog[0], id: "owned-item", owned: true };
  const looks = buildLooks(defaultProfile, "Everyday", 0, [piece], true);
  assert.equal(looks.length, 4);
  assert.ok(looks.every((l) => l.pieces.some((p) => p.id === "owned-item")));
});
test("catalog pieces are well-formed with HTTPS shop links and reachable image refs", () => {
  assert.ok(catalog.length > 0);
  const jewelry = catalog.filter(
    (p) =>
      /missoma|gorjana|mejuri|astrid-miyu/.test(p.id) ||
      (p.role === "accessory" &&
        /necklace|bracelet|ring|earring|chain|cuff|bangle/i.test(p.name)),
  );
  assert.ok(jewelry.length > 0, "jewelry accessories stay in the catalog");
  for (const p of catalog) {
    assert.equal(typeof p.id, "string");
    assert.ok(p.id);
    assert.ok(p.role);
    assert.ok(p.name);
    assert.equal(typeof p.price, "number");
    assert.ok(p.shopUrl.startsWith("https://"), p.shopUrl);
    assert.ok(!/theta-one/i.test(p.image + p.shopUrl), p.id);
    if (p.image.startsWith("/")) {
      assert.ok(existsSync("public" + p.image), p.image);
    } else {
      assert.ok(p.image.startsWith("https://"), p.image);
    }
  }
});
test("ordinary budget produces four distinct looks and refreshing changes suggestions", () => {
  const a = buildLooks(defaultProfile, "Everyday", 0),
    b = buildLooks(defaultProfile, "Everyday", 1);
  assert.equal(a.length, 4);
  assert.equal(
    new Set(a.map((l) => l.pieces.map((p) => p.id).join(","))).size,
    4,
  );
  assert.notDeepEqual(
    a.map((l) => l.pieces),
    b.map((l) => l.pieces),
  );
});
test("modest skirt request filters mini skirts and revealing tops", () => {
 const looks=buildLooks({...defaultProfile,budget:800,outfitBrief:'Brunch with in laws, cute and modest with a skirt'},'Weekend');
 assert.ok(looks.length>0);
 for(const look of looks){assert.ok(look.pieces.some(p=>p.role==='bottom'&&/skirt/i.test(p.name)));assert.ok(look.pieces.every(p=>!/mini|one.shoulder|tank/i.test(p.name)));}
});
test("unsupported gown details do not return unrelated separates",()=>{
 assert.deepEqual(buildLooks({...defaultProfile,outfitBrief:'Formal event, need a gown, sleeveless and low back'},'Dinner'),[]);
});
test("dress request with an owned dress still includes shoes",()=>{
 const dress={...catalog.find(p=>p.role==='dress')!,owned:true};
 const looks=buildLooks({...defaultProfile,outfitBrief:'dress'},'Dinner',0,[dress],true);
 assert.ok(looks.length>0);for(const l of looks)assert.ok(l.pieces.some(p=>p.role==='shoes'));
});
test("taste feedback changes outfit ranking",()=>{
 const base=buildLooks(defaultProfile,'Everyday');
 const profile={...defaultProfile,dislikedPieces:base.flatMap(l=>l.pieces.map(p=>p.id))};
 assert.notDeepEqual(base,buildLooks(profile,'Everyday'));
});
import {canAddPieces} from '../src/lib/closet-limits';
test('closet limits reject overflow including batch additions',()=>{
 assert.equal(canAddPieces('free',9,1),true);assert.equal(canAddPieces('free',9,2),false);assert.equal(canAddPieces('free',10,1),false);
 assert.equal(canAddPieces('premium',99,1),true);assert.equal(canAddPieces('premium',99,2),false);assert.equal(canAddPieces('premium',100,1),false);
});
import {lookKey} from '../src/lib/stylist';
test('new recommendations never reuse combinations from persistent history',()=>{
 const history:string[]=[];
 for(let seed=0;seed<30;seed++){
  const batch=buildLooks(defaultProfile,'Everyday',seed,[],false,history);
  for(const look of batch){const key=lookKey(look);assert.ok(!history.includes(key));history.push(key);assert.equal(key,lookKey({...look,pieces:[...look.pieces].reverse()}));}
 }
 assert.ok(history.length>4);
 const first=buildLooks(defaultProfile,'Everyday',0);
 const next=buildLooks(defaultProfile,'Everyday',0,[],false,first.map(lookKey));
 assert.ok(next.every(look=>!first.some(old=>lookKey(old)===lookKey(look))));
});
