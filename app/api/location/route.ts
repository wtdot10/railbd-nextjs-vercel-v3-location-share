import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    console.log("LOCATION POST BODY:", body);

    const trainNumber = body.trainNumber;
    const session_id = body.sessionId;
    const latitude = Number(body.lat);
    const longitude = Number(body.lng);

    if (
      !trainNumber ||
      !session_id ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid location data",
        },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("train_locations")
      .insert({
        train_number: trainNumber,
        session_id: session_id,
        latitude,
        longitude,
      })
      .select()
      .single();

    if (error) {
      console.error("SUPABASE INSERT ERROR:", error);

      return NextResponse.json(
        {
          success: false,
          error: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("LOCATION API ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown server error",
      },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const { error } = await supabaseAdmin
      .from("train_locations")
      .delete()
      .neq("id", 0);

    if (error) {
      console.error("SUPABASE DELETE ERROR:", error);

      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Delete failed" },
      { status: 500 }
    );
  }
}