import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

type RouteValidation = {
  distance_m: number | null;
  route_fraction: number | null;
};

type LocationRequest = {
  trainNumber?: string;
  sessionId?: string;
  lat?: number | string;
  lng?: number | string;
  accuracy?: number | string;
  speed?: number | string;
};

const ACCEPT_DISTANCE_M = 350;

export async function POST(req: Request) {
  try {
    const body: LocationRequest = await req.json();

    console.log("LOCATION POST BODY:", body);

    const trainNumber = String(body.trainNumber ?? "").trim();
    const sessionId = String(body.sessionId ?? "").trim();

    const latitude = Number(body.lat);
    const longitude = Number(body.lng);

    const accuracy =
      body.accuracy !== undefined ? Number(body.accuracy) : null;

    const speed =
      body.speed !== undefined ? Number(body.speed) : null;

    // --------------------------------------------------
    // Validate request
    // --------------------------------------------------

    if (!trainNumber) {
      return NextResponse.json(
        {
          success: false,
          accepted: false,
          error: "Train number is required",
        },
        { status: 400 }
      );
    }

    if (!sessionId) {
      return NextResponse.json(
        {
          success: false,
          accepted: false,
          error: "Session ID is required",
        },
        { status: 400 }
      );
    }

    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      return NextResponse.json(
        {
          success: false,
          accepted: false,
          error: "Invalid latitude or longitude",
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // Validate GPS accuracy
    // --------------------------------------------------

    if (accuracy !== null && !Number.isFinite(accuracy)) {
      return NextResponse.json(
        {
          success: false,
          accepted: false,
          error: "Invalid GPS accuracy",
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // Validate speed
    // --------------------------------------------------

    if (speed !== null && (!Number.isFinite(speed) || speed < 0)) {
      return NextResponse.json(
        {
          success: false,
          accepted: false,
          error: "Invalid speed",
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // PostGIS route validation
    // --------------------------------------------------

    const { data: rawValidation, error: validationError } =
      await supabaseAdmin
        .rpc("validate_train_location", {
          p_train_number: trainNumber,
          p_lat: latitude,
          p_lng: longitude,
        })
        .maybeSingle();

    /*
     * Supabase's generated TypeScript type may return {} here
     * when the custom PostgreSQL function is not included in
     * the generated database types.
     *
     * Explicitly type the RPC response.
     */
    const validation = rawValidation as RouteValidation | null;

    if (validationError) {
      console.error(
        "ROUTE VALIDATION ERROR:",
        validationError
      );

      return NextResponse.json(
        {
          success: false,
          accepted: false,
          error: "Unable to validate train route",
          details: validationError.message,
        },
        { status: 500 }
      );
    }

    if (!validation) {
      return NextResponse.json(
        {
          success: false,
          accepted: false,
          confidence: 0,
          error: "No railway route found for this train",
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // Distance from railway route
    // --------------------------------------------------

    const distance = Number(validation.distance_m);

    const routeFraction =
      validation.route_fraction !== null
        ? Number(validation.route_fraction)
        : null;

    // --------------------------------------------------
    // Confidence calculation
    // --------------------------------------------------

    let confidence = 0;

    // Distance score: maximum 55%
    if (Number.isFinite(distance)) {
      if (distance <= 50) {
        confidence += 0.55;
      } else if (distance <= 150) {
        confidence += 0.40;
      } else if (distance <= 300) {
        confidence += 0.25;
      } else if (distance <= ACCEPT_DISTANCE_M) {
        confidence += 0.10;
      }
    }

    // GPS accuracy score: maximum 20%
    if (accuracy !== null && Number.isFinite(accuracy)) {
      if (accuracy <= 20) {
        confidence += 0.20;
      } else if (accuracy <= 50) {
        confidence += 0.15;
      } else if (accuracy <= 100) {
        confidence += 0.05;
      }
    }

    // Speed score: maximum 25%
    if (speed !== null && Number.isFinite(speed)) {
      // Speed is expected in km/h.
      if (speed >= 10 && speed <= 130) {
        confidence += 0.25;
      } else if (speed >= 0 && speed <= 150) {
        confidence += 0.10;
      }
    }

    confidence = Math.min(
      1,
      Math.max(0, confidence)
    );

    // --------------------------------------------------
    // Accept / reject
    // --------------------------------------------------

    const accepted =
      Number.isFinite(distance) &&
      distance <= ACCEPT_DISTANCE_M &&
      confidence >= 0.60;

    let reason = "";

    if (accepted) {
      reason =
        "Location matches the configured railway route.";
    } else if (
      Number.isFinite(distance) &&
      distance > ACCEPT_DISTANCE_M
    ) {
      reason =
        `Location is ${Math.round(
          distance
        )} metres from the railway route.`;
    } else {
      reason =
        "Location confidence is too low.";
    }

    // --------------------------------------------------
    // Save validation result
    // --------------------------------------------------

    const { error: validationInsertError } =
      await supabaseAdmin
        .from("location_validations")
        .insert({
          train_number: trainNumber,
          session_id: sessionId,
          latitude,
          longitude,
          distance_from_route: Number.isFinite(distance)
            ? distance
            : null,
          speed:
            speed !== null && Number.isFinite(speed)
              ? speed
              : null,
          confidence,
          accepted,
          reason,
        });

    if (validationInsertError) {
      console.error(
        "VALIDATION INSERT ERROR:",
        validationInsertError
      );

      // Do not necessarily reject the GPS location
      // just because validation history failed to save.
    }

    // --------------------------------------------------
    // Only save accepted locations
    // --------------------------------------------------

    if (accepted) {
      const { data, error } = await supabaseAdmin
        .from("train_locations")
        .insert({
          train_number: trainNumber,
          session_id: sessionId,
          latitude,
          longitude,
          speed:
            speed !== null && Number.isFinite(speed)
              ? speed
              : null,
          accuracy:
            accuracy !== null && Number.isFinite(accuracy)
              ? accuracy
              : null,
        })
        .select()
        .single();

      if (error) {
        console.error(
          "SUPABASE INSERT ERROR:",
          error
        );

        return NextResponse.json(
          {
            success: false,
            accepted: false,
            error: error.message,
            code: error.code,
            details: error.details,
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        accepted: true,

        trainNumber,

        confidence: Number(
          confidence.toFixed(2)
        ),

        distanceFromRoute: Math.round(distance),

        routeFraction,

        reason,

        data,
      });
    }

    // --------------------------------------------------
    // Rejected location
    // --------------------------------------------------

    return NextResponse.json({
      success: true,
      accepted: false,

      trainNumber,

      confidence: Number(
        confidence.toFixed(2)
      ),

      distanceFromRoute: Number.isFinite(distance)
        ? Math.round(distance)
        : null,

      routeFraction,

      reason,
    });
  } catch (error) {
    console.error(
      "LOCATION API ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        accepted: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown server error",
      },
      { status: 500 }
    );
  }
}