import Header from "@/components/Header";
import {getTrain,trains} from "@/lib/data";
import {notFound} from "next/navigation";
import ShareLocation from "@/components/ShareLocation";

export function generateStaticParams(){return trains.map(t=>({number:t.number}));}

export default async function TrainPage({params}:{params:Promise<{number:string}>}){
 const {number}=await params;
 const train=getTrain(number);
 if(!train) notFound();
 return <><Header/><main className="details">
  <div className="eyebrow">TRAIN {train.number}</div><h1>{train.name}</h1><p className="muted">{train.nameBn} · {train.from} → {train.to}</p>
  <div className="detailCard">
   <span className="badge">● {train.status}</span>
   <div className="progress"><i style={{width:`${train.progress}%`}}/></div>
   <div className="route"><span>{train.from}</span><b>{train.progress}% journey</b><span>{train.to}</span></div>
   <div className="detailGrid">
    <div className="detailItem"><small>Delay</small><b>+{train.delay} min</b></div>
    <div className="detailItem"><small>Next station</small><b>{train.nextStation}</b></div>
    <div className="detailItem"><small>ETA</small><b>{train.eta}</b></div>
    <div className="detailItem"><small>Speed</small><b>{train.speed} km/h</b></div>
    <div className="detailItem"><small>From</small><b>{train.from}</b></div>
    <div className="detailItem"><small>To</small><b>{train.to}</b></div>
   </div>
   <p className="muted" style={{marginTop:22}}>Demo status only. Replace this record with verified live railway data before publishing live-location claims.</p>
  </div>
  <ShareLocation trainNumber={train.number}/>
 </main></>
}
