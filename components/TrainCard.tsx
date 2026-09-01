import Link from "next/link";
import type {Train} from "@/lib/data";

export default function TrainCard({train}:{train:Train}){
 return <Link href={`/trains/${train.number}`} className="card">
  <div className="top"><span className="badge">● {train.status}</span><span className="number">{train.number}</span></div>
  <div className="trainName">{train.name}</div>
  <div className="number">{train.nameBn}</div>
  <div className="progress"><i style={{width:`${train.progress}%`}}/></div>
  <div className="route"><span>{train.from}</span><span>{train.progress}%</span><span>{train.to}</span></div>
  <div className="delay">+{train.delay} min estimated delay</div>
 </Link>
}
