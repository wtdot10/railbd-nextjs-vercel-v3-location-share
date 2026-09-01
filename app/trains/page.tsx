import Header from "@/components/Header";
import TrainCard from "@/components/TrainCard";
import {trains} from "@/lib/data";
export default function Trains(){
 return <><Header/><main className="details"><div className="eyebrow">BANGLADESH RAILWAY</div><h1>Trains</h1><p className="muted">Browse available train records.</p><div className="grid" style={{marginTop:25}}>{trains.map(t=><TrainCard key={t.number} train={t}/>)}</div></main></>
}
