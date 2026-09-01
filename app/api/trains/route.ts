import { NextResponse } from "next/server";
import { listTrains } from "@/lib/data";
export const runtime="nodejs";
export async function GET(request:Request){try{const q=new URL(request.url).searchParams.get("q")??undefined;return NextResponse.json({success:true,source:"supabase",updatedAt:new Date().toISOString(),trains:await listTrains(q)})}catch(e){return NextResponse.json({success:false,error:e instanceof Error?e.message:"Could not load trains"},{status:500})}}
