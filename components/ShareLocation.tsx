"use client";
import {useEffect,useRef,useState} from "react";
function sid(){const k="railbd-location-session",o=localStorage.getItem(k);if(o)return o;const v=crypto.randomUUID()+"-"+Math.random().toString(36).slice(2);localStorage.setItem(k,v);return v}
export default function ShareLocation({trainNumber}:{trainNumber:string}){
 const [sharing,setSharing]=useState(false),[message,setMessage]=useState("Your location is shared only after browser permission.");
 const watch=useRef<number|null>(null),session=useRef<string|null>(null);
 useEffect(()=>()=>{if(watch.current!==null)navigator.geolocation.clearWatch(watch.current)},[]);
 async function stop(){if(watch.current!==null)navigator.geolocation.clearWatch(watch.current);watch.current=null;if(session.current)await fetch("/api/location",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({trainNumber,sessionId:session.current})}).catch(()=>{});setSharing(false);setMessage("Location sharing stopped.");}
 function start(){if(!navigator.geolocation){setMessage("This browser does not support GPS.");return}session.current=sid();setSharing(true);setMessage("Waiting for GPS permission…");watch.current=navigator.geolocation.watchPosition(async p=>{const r=await fetch("/api/location",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({trainNumber,sessionId:session.current,lat:p.coords.latitude,lng:p.coords.longitude})});setMessage(r.ok?"Sharing approximate train location. Updates automatically.":"Could not update location.");},e=>{setSharing(false);setMessage(e.code===1?"Location permission was denied.":"Could not get your location.");},{enableHighAccuracy:false,maximumAge:30000,timeout:15000})}
 return <div className="shareBox"><div><div className="eyebrow">PASSENGER REPORTING</div><h3>Share this train's location</h3><p className="muted">If you are on train {trainNumber}, voluntarily share your phone location. Your individual position is never shown publicly.</p><small className="muted">{message}</small></div><button className="btn" onClick={sharing?stop:start}>{sharing?"Stop sharing":"Share my location"}</button></div>
}
