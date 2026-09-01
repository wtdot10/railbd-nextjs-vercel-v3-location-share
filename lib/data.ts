import { supabaseAdmin } from "./supabase";

export type Train = { id:number; number:string; name:string; nameBn:string|null; trainType:string|null; active:boolean; from:string|null; to:string|null; stationCount:number; progress:number|null; speed:number|null; accuracy:number|null; latitude:number|null; longitude:number|null; updatedAt:string|null };
export type Station = { id:number; code:string|null; name:string; nameBn:string|null; latitude:number|null; longitude:number|null; type:string|null };
export type Stop = { id:number; stationOrder:number; stopType:string|null; arrivalTime:string|null; departureTime:string|null; distanceKm:number|null; station:Station|null };
export type Route = { train:{id:number;number:string;name:string;nameBn:string|null}; stops:Stop[] };

type TrainRow={id:number;number:string;name:string;name_bn:string|null;train_type:string|null;active:boolean};
type StopRow={id:number;station_order:number;stop_type:string|null;arrival_time:string|null;departure_time:string|null;distance_km:number|null;stations:{id:number;code:string|null;name:string;name_bn:string|null;latitude:number|null;longitude:number|null;type:string|null}|null};
type LocationRow={latitude:number;longitude:number;speed:number|null;accuracy:number|null;created_at:string};

function mapStation(row:StopRow["stations"]):Station|null{return row?{id:row.id,code:row.code,name:row.name,nameBn:row.name_bn,latitude:row.latitude,longitude:row.longitude,type:row.type}:null}
export async function getRouteForTrain(trainId:number):Promise<Stop[]>{
 const {data,error}=await supabaseAdmin.from("train_route_stations").select("id, station_order, stop_type, arrival_time, departure_time, distance_km, stations(id, code, name, name_bn, latitude, longitude, type)").eq("train_id",trainId).order("station_order",{ascending:true});
 if(error) throw new Error(`Could not load train route: ${error.message}`);
 return ((data??[]) as unknown as StopRow[]).map(r=>({id:r.id,stationOrder:r.station_order,stopType:r.stop_type,arrivalTime:r.arrival_time,departureTime:r.departure_time,distanceKm:r.distance_km==null?null:Number(r.distance_km),station:mapStation(r.stations)}));
}
async function latestLocations(numbers:string[]){
 const result=new Map<string,LocationRow>(); if(!numbers.length)return result;
 const {data,error}=await supabaseAdmin.from("train_locations").select("train_number, latitude, longitude, speed, accuracy, created_at").in("train_number",numbers).order("created_at",{ascending:false}).limit(Math.max(numbers.length*5,50));
 if(error) throw new Error(`Could not load live train locations: ${error.message}`);
 for(const row of (data??[]) as Array<LocationRow&{train_number:string}>){if(!result.has(row.train_number))result.set(row.train_number,row)} return result;
}
function toTrain(row:TrainRow,stops:Stop[],live?:LocationRow):Train{return{id:row.id,number:row.number,name:row.name,nameBn:row.name_bn,trainType:row.train_type,active:row.active,from:stops[0]?.station?.name??null,to:stops.at(-1)?.station?.name??null,stationCount:stops.length,progress:null,speed:live?.speed==null?null:Number(live.speed),accuracy:live?.accuracy==null?null:Number(live.accuracy),latitude:live?.latitude==null?null:Number(live.latitude),longitude:live?.longitude==null?null:Number(live.longitude),updatedAt:live?.created_at??null}}
export async function listTrains(query?:string):Promise<Train[]>{
 let request=supabaseAdmin.from("trains").select("id, number, name, name_bn, train_type, active").order("active",{ascending:false}).order("name",{ascending:true}); const q=query?.trim(); if(q)request=request.or(`number.ilike.%${q}%,name.ilike.%${q}%,name_bn.ilike.%${q}%`);
 const {data,error}=await request; if(error)throw new Error(`Could not load trains: ${error.message}`); const rows=(data??[]) as TrainRow[]; const locations=await latestLocations(rows.map(r=>r.number));
 return Promise.all(rows.map(async r=>toTrain(r,await getRouteForTrain(r.id),locations.get(r.number))));
}
export async function getTrain(number:string):Promise<Train|null>{
 const {data,error}=await supabaseAdmin.from("trains").select("id, number, name, name_bn, train_type, active").eq("number",number).maybeSingle(); if(error)throw new Error(`Could not load train: ${error.message}`); if(!data)return null; const row=data as TrainRow; const stops=await getRouteForTrain(row.id); return toTrain(row,stops,(await latestLocations([row.number])).get(row.number));
}
export async function listStations(query?:string):Promise<Station[]>{let request=supabaseAdmin.from("stations").select("id, code, name, name_bn, latitude, longitude, type").order("name",{ascending:true});const q=query?.trim();if(q)request=request.or(`code.ilike.%${q}%,name.ilike.%${q}%,name_bn.ilike.%${q}%`);const {data,error}=await request;if(error)throw new Error(`Could not load stations: ${error.message}`);return(data??[]) as Station[]}
export async function getStation(idOrCode:string):Promise<Station|null>{const n=Number(idOrCode);let request=supabaseAdmin.from("stations").select("id, code, name, name_bn, latitude, longitude, type");request=Number.isInteger(n)&&String(n)===idOrCode?request.eq("id",n):request.eq("code",idOrCode);const {data,error}=await request.maybeSingle();if(error)throw new Error(`Could not load station: ${error.message}`);return(data??null) as Station|null}
export async function getTrainsAtStation(stationId:number){const {data,error}=await supabaseAdmin.from("train_route_stations").select("arrival_time, departure_time, stop_type, trains(id, number, name, name_bn, train_type, active)").eq("station_id",stationId);if(error)throw new Error(`Could not load station trains: ${error.message}`);const rows=(data??[]) as unknown as Array<{arrival_time:string|null;departure_time:string|null;stop_type:string|null;trains:TrainRow|null}>;const trainRows=rows.filter(r=>r.trains).map(r=>r.trains!);const locs=await latestLocations(trainRows.map(r=>r.number));return rows.filter(r=>r.trains).map(r=>({...toTrain(r.trains!,[],locs.get(r.trains!.number)),arrivalTime:r.arrival_time,departureTime:r.departure_time,stopType:r.stop_type}))}
export async function listRoutes():Promise<Route[]>{const {data,error}=await supabaseAdmin.from("trains").select("id, number, name, name_bn").order("name",{ascending:true});if(error)throw new Error(`Could not load routes: ${error.message}`);return Promise.all(((data??[]) as Array<{id:number;number:string;name:string;name_bn:string|null}>).map(async t=>({train:{id:t.id,number:t.number,name:t.name,nameBn:t.name_bn},stops:await getRouteForTrain(t.id)})))}
