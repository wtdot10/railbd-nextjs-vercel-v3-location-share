"use client";
import {useEffect,useRef,useState} from "react";

function sid(){const k="mytrainroute-location-session",o=localStorage.getItem(k);if(o)return o;const v=crypto.randomUUID()+"-"+Math.random().toString(36).slice(2);localStorage.setItem(k,v);return v}

type Check={accepted:boolean;confidence:number;distanceFromRoute:number|null;reason:string};

export default function ShareLocation({trainNumber}:{trainNumber:string}){
 const [sharing,setSharing]=useState(false);
 const [message,setMessage]=useState("Your location is shared only after browser permission.");
 const [check,setCheck]=useState<Check|null>(null);
 const watch=useRef<number|null>(null),session=useRef<string|null>(null);
 useEffect(()=>()=>{if(watch.current!==null)navigator.geolocation.clearWatch(watch.current)},[]);
 async function stop(){
  if(watch.current!==null)navigator.geolocation.clearWatch(watch.current); watch.current=null;
  if(session.current)await fetch("/api/location",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({trainNumber,sessionId:session.current})}).catch(()=>{});
  setSharing(false);setMessage("Location sharing stopped.");setCheck(null);
 }
 function start(){
  if(!navigator.geolocation){setMessage("This browser does not support GPS.");return}
  session.current=sid();setSharing(true);setMessage("Waiting for GPS and checking the railway route…");
  watch.current=navigator.geolocation.watchPosition(async p=>{
   const r=await fetch("/api/location",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({trainNumber,sessionId:session.current,lat:p.coords.latitude,lng:p.coords.longitude,accuracy:p.coords.accuracy,speed:p.coords.speed})});
   const j=await r.json().catch(()=>({}));
   if(j.success){
    setCheck({accepted:!!j.accepted,confidence:Number(j.confidence||0),distanceFromRoute:j.distanceFromRoute==null?null:Number(j.distanceFromRoute),reason:j.reason||""});
    setMessage(j.accepted?"Your location matches the selected train route.":j.reason||"Location is being checked.");
   } else setMessage(j.error||"Could not validate location.");
  },e=>{setSharing(false);setMessage(e.code===1?"Location permission was denied.":"Could not get your location.");},{enableHighAccuracy:true,maximumAge:10000,timeout:15000});
 }
 const pct=check?Math.round(check.confidence*100):0;
 return <div className="shareBox">
  <div className="shareContent"><div className="eyebrow">PASSENGER REPORTING</div><h3>Verify you are on train {trainNumber}</h3><p className="muted">Your GPS is compared on the server with the configured railway route. Your individual position is never shown publicly.</p>
  {check && <div className={`locationStatus ${check.accepted?"good":"warn"}`}><div className="statusTop"><b>{check.accepted?"✓ Route match":"! Checking route"}</b><strong>{pct}%</strong></div><div className="confidenceBar"><i style={{width:`${pct}%`}}/></div><small>{check.distanceFromRoute==null?"No route geometry configured":`${Math.round(check.distanceFromRoute)} m from route`} · {check.reason}</small></div>}
  <small className="muted">{message}</small></div>
  <button className="btn" onClick={sharing?stop:start}>{sharing?"Stop sharing":"Share & verify location"}</button>
 </div>
}
