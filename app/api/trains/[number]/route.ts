import {NextResponse} from "next/server";
import {getTrain} from "@/lib/data";
export async function GET(_:Request,{params}:{params:Promise<{number:string}>}){
 const {number}=await params; const train=getTrain(number);
 if(!train)return NextResponse.json({error:"Train not found"},{status:404});
 return NextResponse.json({updatedAt:new Date().toISOString(),source:"demo",train});
}
