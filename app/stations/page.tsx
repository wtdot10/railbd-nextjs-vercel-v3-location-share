import Header from "@/components/Header";
import {stations} from "@/lib/data";
export default function Stations(){return <><Header/><main className="details"><div className="eyebrow">NETWORK</div><h1>Stations</h1><div className="routeGrid" style={{marginTop:25}}>{stations.map(s=><div className="card" key={s.code}><div className="badge">{s.code}</div><h3>{s.name}</h3><div className="muted">{s.nameBn}</div></div>)}</div></main></>}
