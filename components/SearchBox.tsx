 "use client";
import {useMemo, useState} from "react";
import {useRouter} from "next/navigation";
import {trains} from "@/lib/data";

export default function SearchBox(){
 const [q,setQ]=useState("");
 const router=useRouter();
 const results=useMemo(()=>q.length<1?[]:trains.filter(t=>t.number===q.trim()||t.name.toLowerCase().includes(q.toLowerCase())||t.nameBn.includes(q)).slice(0,5),[q]);
 function go(){const exact=trains.find(t=>t.number===q.trim()); if(exact) router.push(`/trains/${exact.number}`); else if(results[0]) router.push(`/trains/${results[0].number}`);}
 return <div>
  <div className="search"><input value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==="Enter"&&go()} placeholder="Train name or number…" /><button className="btn" onClick={go}>Find train</button></div>
  {results.length>0&&<div className="searchResults">{results.map(t=><button key={t.number} onClick={()=>router.push(`/trains/${t.number}`)}><b>{t.number}</b> — {t.name} · {t.from} → {t.to}</button>)}</div>}
 </div>
}
