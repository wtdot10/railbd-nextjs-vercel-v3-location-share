"use client";
import {useEffect,useState} from "react";

type Live={available:boolean;latitude?:number;longitude?:number;speed?:number|null;reporters?:number;updatedAt?:string;message?:string};
export default function LiveLocation({trainNumber}:{trainNumber:string}){
 const [data,setData]=useState<Live|null>(null);const [error,setError]=useState("");
 useEffect(()=>{let alive=true;const load=async()=>{try{const r=await fetch(`/api/location/public?train=${encodeURIComponent(trainNumber)}`,{cache:"no-store"});const j=await r.json();if(alive){setData(j);setError(j.success?"":j.error||"")}}catch{if(alive)setError("Live location service is unavailable")}};load();const id=setInterval(load,30000);return()=>{alive=false;clearInterval(id)}},[trainNumber]);
 if(error)return <div className="livePanel warn"><div><b>Live location unavailable</b><span>{error}</span></div></div>;
 if(!data?.available)return <div className="livePanel"><div><b>No verified live location yet</b><span>{data?.message??"Waiting for recent passenger reports."}</span></div></div>;
 return <div className="livePanel good"><div><b>Verified community location</b><span>{data.reporters} active reporter{data.reporters===1?"":"s"}</span></div><div className="liveStats"><strong>LIVE</strong><span>{data.speed!=null?`${data.speed} km/h`:"Speed unavailable"}</span><span>{data.latitude!.toFixed(5)}, {data.longitude!.toFixed(5)}</span></div><small>Last report: {new Date(data.updatedAt!).toLocaleString()}</small></div>
}
