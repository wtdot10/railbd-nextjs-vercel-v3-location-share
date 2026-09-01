import Link from "next/link";
import Header from "@/components/Header";
import SearchBox from "@/components/SearchBox";
import TrainCard from "@/components/TrainCard";
import {trains} from "@/lib/data";

export default function Home(){
 return <>
  <Header/>
  <main>
   <section className="hero"><div className="container heroGrid">
    <div><div className="eyebrow">● LIVE TRAIN PLATFORM</div><h1>Find where your train is.</h1><p>Search Bangladesh Railway trains, explore routes and schedules, and build a reliable live-tracking experience from verified data.</p><SearchBox/></div>
    <div className="map"><div className="track"/><div className="station st1">Dhaka</div><div className="station st2">Tangail</div><div className="station st3">Jamalpur</div><div className="pin">🚆</div><div className="mapTag">Live map layer ready</div></div>
   </div></section>

   <section className="section"><div className="container">
    <div className="head"><div><div className="eyebrow">TODAY</div><h2>Running now</h2></div><span className="muted">{trains.length} trains</span></div>
    <div className="grid">{trains.map(t=><TrainCard key={t.number} train={t}/>)}</div>
   </div></section>

   <section className="section"><div className="container">
    <div className="head"><div><div className="eyebrow">EXPLORE</div><h2>Popular routes</h2></div></div>
    <div className="routeGrid">
     {["Dhaka → Chattogram","Dhaka → Sylhet","Dhaka → Mymensingh","Dhaka → Kishoreganj","Dhaka → Cox's Bazar","Dhaka → Rajshahi"].map(x=><Link className="routeButton" href="/routes" key={x}>{x}</Link>)}
    </div>
   </div></section>

   <section className="section info"><div className="container" style={{display:"contents"}}>
    <div><div className="eyebrow">ABOUT RAILBD</div><h2>Built for reliable railway information.</h2><p>This starter separates the UI, API and data layer so real railway schedules can replace the demo dataset without rebuilding the website.</p></div>
    <div className="feature"><b>01</b>Search trains by name or number.</div>
    <div className="feature"><b>02</b>Open a dedicated train page.</div>
    <div className="feature"><b>03</b>Add verified live data later.</div>
   </div></section>
  </main>
  <footer className="footer">RailBD · Independent railway information project</footer>
 </>
}
