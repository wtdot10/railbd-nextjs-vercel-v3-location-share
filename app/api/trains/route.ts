import {NextResponse} from "next/server";
import {trains} from "@/lib/data";
export async function GET(){return NextResponse.json({updatedAt:new Date().toISOString(),source:"demo",trains});}
