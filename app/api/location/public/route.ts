import {NextResponse} from "next/server";
import {supabaseAdmin} from "@/lib/supabase";
export const runtime="nodejs";
export async function GET(req:Request){
 const train=new URL(req.url).searchParams.get("train")?.trim();
 if(!train)return NextResponse.json({error:"train is required"},{status:400});
 const cutoff=new Date(Date.now()-10*60*1000).toISOString();
 const {data,error}=await supabaseAdmin.from("train_location_reports").select("lat,lng").eq("train_number",train).gte("updated_at",cutoff);
 if(error)return NextResponse.json({error:"Could not read locations"},{status:500});
 if(!data||data.length<3)return NextResponse.json({available:false,reporters:data?.length??0,message:"Waiting for at least 3 active location shares."});
 const lat=data.reduce((s,r)=>s+Number(r.lat),0)/data.length,lng=data.reduce((s,r)=>s+Number(r.lng),0)/data.length;
 return NextResponse.json({available:true,lat:Number(lat.toFixed(2)),lng:Number(lng.toFixed(2)),reporters:data.length,updatedAt:new Date().toISOString()});
}
