import Header from "@/components/Header";
const routes=["Dhaka → Chattogram","Dhaka → Sylhet","Dhaka → Mymensingh","Dhaka → Kishoreganj","Dhaka → Cox's Bazar","Dhaka → Rajshahi"];
export default function Routes(){return <><Header/><main className="details"><div className="eyebrow">JOURNEYS</div><h1>Popular routes</h1><p className="muted">Route pages can later include station-by-station schedules and availability.</p><div className="routeGrid" style={{marginTop:25}}>{routes.map(r=><div className="card" key={r}><h3>{r}</h3><p className="muted">View route →</p></div>)}</div></main></>}
