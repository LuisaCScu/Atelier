'use client';
const colors=['Black','White','Cream','Beige','Tan','Camel','Brown','Dark brown','Gray','Silver','Gold','Navy','Blue','Light blue','Denim blue','Green','Olive','Teal','Yellow','Orange','Rust','Red','Burgundy','Pink','Purple','Multicolor','Other'];
export function ColorSelect({value,onChange}:{value:string;onChange:(color:string)=>void}){
 const match=colors.find(color=>color.toLowerCase()===value.trim().toLowerCase());
 return <select value={match||value} onChange={e=>onChange(e.target.value)}><option value="" disabled>Choose a color</option>{value&&!match&&<option value={value}>{value}</option>}{colors.map(color=><option key={color} value={color}>{color}</option>)}</select>;
}
