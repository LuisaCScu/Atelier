'use client';
import {useState, type ReactNode} from 'react';
import {catalog,type Look} from '@/lib/stylist';
const edits: [string,string[]][] = [
 ['Soft tailoring',['Basic Poplin','Wide-Leg Darted','Loafers']],
 ['Weekend denim',['Box-Cut Tee','Barrel Jeans','Court Sneaker']],
 ['Silk & movement',['Satin Tie','Slip Skirt','Slingback Pumps']],
 ['A little edge',['One Shoulder','Column Jean','Chelsea Boot']],
 ['Modest & polished',['Turtleneck','Maxi Skirt','Ballerinas']],
 ['Coastal afternoon',['Boatneck Tank','Wide-Leg Chino','Braided Leather']],
 ['Relaxed layers',['Slouchy Top','Easy Pant','Blucher']],
 ['Playful proportions',['Shrunken Crew','Circle Mini','Ballet Flats']],
 ['City evening',['Ruched Mini Dress','High-Heeled','Chunky Chain']],
 ['Earthy textures',['Cashmere','Corduroy Cigarette','Kitten Heel']],
 ['Sporty simplicity',['Quarter-Zip Polo Dress','Court Sneaker','Shopper']],
 ['Romantic afternoon',['Gauze Mini','Suede Slingback','Venice']]
];
export const tasteLooks:Look[]=edits.map(([title,queries],i)=>({id:`taste-${i}`,title,occasion:'Inspiration',why:'',pieces:queries.map(q=>catalog.find(p=>p.name.toLowerCase().includes(q.toLowerCase()))).filter(p=>!!p)}));
export function TasteDeck({renderLook,onPreferences}:{renderLook:(look:Look)=>ReactNode;onPreferences:(liked:string[],disliked:string[],likedLookIds:string[])=>void}){
 const [votes,setVotes]=useState<Record<string,boolean>>(()=>{try{return JSON.parse(localStorage.getItem('atelier.taste')||'{}')}catch{return {}}});
 const [index,setIndex]=useState(0);const [start,setStart]=useState<number|null>(null);const [drag,setDrag]=useState(0);
 const look=tasteLooks[index];
 function vote(like:boolean){const next={...votes,[look.id]:like};setVotes(next);try{localStorage.setItem('atelier.taste',JSON.stringify(next))}catch{}const liked=new Set<string>(),disliked=new Set<string>();for(const l of tasteLooks){if(next[l.id]===undefined)continue;for(const p of l.pieces)(next[l.id]?liked:disliked).add(p.id);}onPreferences([...liked],[...disliked].filter(id=>!liked.has(id)),tasteLooks.filter(l=>next[l.id]===true).map(l=>l.id));setIndex(i=>i+1);setDrag(0);}
 return <section className="taste-deck" aria-label="Discover your style">{look?<><div className="taste-progress"><span>YOUR STYLE, ONE LOOK AT A TIME</span><span>{index+1} / 12</span></div><div className="taste-card" tabIndex={0} aria-label="Swipe right to like, left to dislike. Or use arrow keys." style={{transform:`translateX(${drag}px) rotate(${drag/25}deg)`}} onKeyDown={e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();vote(e.key==='ArrowRight')}}} onPointerDown={e=>{setStart(e.clientX);e.currentTarget.setPointerCapture(e.pointerId)}} onPointerMove={e=>{if(start!==null)setDrag(Math.max(-130,Math.min(130,e.clientX-start)))}} onPointerUp={e=>{if(start!==null&&Math.abs(e.clientX-start)>65)vote(e.clientX>start);setStart(null);setDrag(0)}} onPointerCancel={()=>{setStart(null);setDrag(0)}}>{renderLook(look)}<h2>{look.title}</h2><p>Would you wear this?</p></div><div className="taste-actions"><button className="secondary" onClick={()=>vote(false)}>← Not for me</button><button className="text-link" onClick={()=>setIndex(i=>i+1)}>Skip</button><button className="primary" onClick={()=>vote(true)}>Love it →</button></div><p className="fine-print">Swipe or tap. Likes and dislikes inform your next stylist edit.</p></>:<div className="empty"><h2>A little more you.</h2><p>You liked {Object.values(votes).filter(Boolean).length} of 12 looks. Visit Your stylist to try an edit informed by your choices.</p><button className="secondary" onClick={()=>setIndex(0)}>Review my choices</button></div>}</section>
}
