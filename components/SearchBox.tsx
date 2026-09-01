"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Result={number:string;name:string;nameBn:string|null};
type Station={id:number;code:string|null;name:string;nameBn:string|null};
export default function SearchBox(){
 const [q,setQ]=useState("");const [trains,setTrains]=useState<Result[]>([]);const [stations,setStations]=useState<Station[]>([]);const [loading,setLoading]=useState(false);const router=useRouter();
 useEffect(()=>{const value=q.trim();if(!value){setTrains([]);setStations([]);return}const timer=setTimeout(async()=>{setLoading(true);try{const r=await fetch(`/api/search?q=${encodeURIComponent(value)}`,{cache:"no-store"});const j=await r.json();setTrains(j.trains??[]);setStations(j.stations??[])}finally{setLoading(false)}},250);return()=>clearTimeout(timer)},[q]);
 function go(){if(trains[0])router.push(`/trains/${trains[0].number}`);else if(stations[0])router.push(`/stations/${stations[0].id}`)}
 return <div><div className="search"><input value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==="Enter"&&go()} placeholder="Search train number, train name or station…"/><button className="btn" onClick={go}>{loading?"Searching…":"Search"}</button></div>{(trains.length||stations.length)>0&&<div className="searchResults">{trains.map(t=><button key={`t-${t.number}`} onClick={()=>router.push(`/trains/${t.number}`)}><b>Train {t.number}</b> — {t.name}{t.nameBn?` · ${t.nameBn}`:""}</button>)}{stations.map(s=><button key={`s-${s.id}`} onClick={()=>router.push(`/stations/${s.id}`)}><b>Station</b> — {s.name}{s.code?` (${s.code})`:""}</button>)}</div>}</div>
}
