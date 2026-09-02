import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

type LocationRequest = {
  trainNumber?: string;
  sessionId?: string;
  lat?: number | string;
  lng?: number | string;
  accuracy?: number | string;
  speed?: number | string;
};

type RouteStation = {
  station_id: number;
  station_order: number;
  stop_type: string;
  arrival_time: string | null;
  departure_time: string | null;
  distance_km: number | null;
  station: {
    id: number;
    name: string;
    name_bn: string | null;
    latitude: number | null;
    longitude: number | null;
    type: string;
  } | null;
};

type Point = {
  lat: number;
  lng: number;
};

const ACCEPT_DISTANCE_M = 350;

/**
 * Distance between two GPS points.
 * Returns metres.
 */
function distanceMeters(a: Point, b: Point): number {
  const R = 6371000;

  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;

  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;

  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const y = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));

  return R * y;
}

/**
 * Find the closest point on a line segment.
 *
 * Uses a local flat-earth approximation.
 * Good enough for railway GPS validation over short segments.
 */
function closestPointOnSegment(
  p: Point,
  a: Point,
  b: Point
): {
  point: Point;
  distance: number;
  fraction: number;
} {
  const latRad = (p.lat * Math.PI) / 180;

  const metersPerLat = 111320;
  const metersPerLng = 111320 * Math.cos(latRad);

  const ax = a.lng * metersPerLng;
  const ay = a.lat * metersPerLat;

  const bx = b.lng * metersPerLng;
  const by = b.lat * metersPerLat;

  const px = p.lng * metersPerLng;
  const py = p.lat * metersPerLat;

  const dx = bx - ax;
  const dy = by - ay;

  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) {
    return {
      point: a,
      distance: distanceMeters(p, a),
      fraction: 0,
    };
  }

  let t =
    ((px - ax) * dx + (py - ay) * dy) /
    lengthSquared;

  t = Math.max(0, Math.min(1, t));

  const closestX = ax + t * dx;
  const closestY = ay + t * dy;

  const closest: Point = {
    lat: closestY / metersPerLat,
    lng: closestX / metersPerLng,
  };

  return {
    point: closest,
    distance: distanceMeters(p, closest),
    fraction: t,
  };
}

/**
 * Build route information from train_route_stations.
 */
function calculateRouteProgress(
  gps: Point,
  stations: RouteStation[]
) {
  const validStations = stations
    .filter(
      (item) =>
        item.station &&
        item.station.latitude !== null &&
        item.station.longitude !== null &&
        Number.isFinite(Number(item.station.latitude)) &&
        Number.isFinite(Number(item.station.longitude))
    )
    .sort(
      (a, b) =>
        Number(a.station_order) -
        Number(b.station_order)
    );

  if (validStations.length < 2) {
    return null;
  }

  const points: Point[] = validStations.map((item) => ({
    lat: Number(item.station!.latitude),
    lng: Number(item.station!.longitude),
  }));

  /*
   * Calculate cumulative distance along the route.
   */
  const cumulative: number[] = [0];

  for (let i = 1; i < points.length; i++) {
    const segmentDistance = distanceMeters(
      points[i - 1],
      points[i]
    );

    cumulative[i] =
      cumulative[i - 1] + segmentDistance;
  }

  const totalRouteDistance =
    cumulative[cumulative.length - 1];

  if (
    !Number.isFinite(totalRouteDistance) ||
    totalRouteDistance <= 0
  ) {
    return null;
  }

  /*
   * Find the railway segment closest to the GPS position.
   */
  let closestSegment = -1;
  let closestDistance = Infinity;
  let closestFraction = 0;

  for (let i = 0; i < points.length - 1; i++) {
    const result = closestPointOnSegment(
      gps,
      points[i],
      points[i + 1]
    );

    if (result.distance < closestDistance) {
      closestDistance = result.distance;
      closestSegment = i;
      closestFraction = result.fraction;
    }
  }

  if (closestSegment < 0) {
    return null;
  }

  /*
   * Distance travelled from the first station
   * to the projected GPS position.
   */
  const travelledDistance =
    cumulative[closestSegment] +
    distanceMeters(
      points[closestSegment],
      {
        lat:
          points[closestSegment].lat +
          (points[closestSegment + 1].lat -
            points[closestSegment].lat) *
            closestFraction,
        lng:
          points[closestSegment].lng +
          (points[closestSegment + 1].lng -
            points[closestSegment].lng) *
            closestFraction,
      }
    );

  const progress =
    (travelledDistance / totalRouteDistance) * 100;

  const fromStation =
    validStations[closestSegment];

  const toStation =
    validStations[closestSegment + 1];

  /*
   * Calculate progress between the two stations.
   */
  const segmentStart = cumulative[closestSegment];

  const segmentLength =
    cumulative[closestSegment + 1] -
    cumulative[closestSegment];

  const segmentProgress =
    segmentLength > 0
      ? ((travelledDistance - segmentStart) /
          segmentLength) *
        100
      : 0;

  return {
    distanceFromRoute: closestDistance,
    routeFraction:
      travelledDistance / totalRouteDistance,

    progress: Math.max(
      0,
      Math.min(100, progress)
    ),

    travelledDistanceKm:
      travelledDistance / 1000,

    totalRouteDistanceKm:
      totalRouteDistance / 1000,

    segmentProgress: Math.max(
      0,
      Math.min(100, segmentProgress)
    ),

    fromStation: {
      id: fromStation.station!.id,
      name: fromStation.station!.name,
      nameBn: fromStation.station!.name_bn,
      order: fromStation.station_order,
    },

    toStation: {
      id: toStation.station!.id,
      name: toStation.station!.name,
      nameBn: toStation.station!.name_bn,
      order: toStation.station_order,
    },

    stationCount: validStations.length,
  };
}

export async function POST(req: Request) {
  try {
    const body: LocationRequest = await req.json();

    console.log(
      "LOCATION POST BODY:",
      body
    );

    const trainNumber = String(
      body.trainNumber ?? ""
    ).trim();

    const sessionId = String(
      body.sessionId ?? ""
    ).trim();

    const latitude = Number(body.lat);
    const longitude = Number(body.lng);

    const accuracy =
      body.accuracy !== undefined
        ? Number(body.accuracy)
        : null;

    const speed =
      body.speed !== undefined
        ? Number(body.speed)
        : null;

    /*
     * --------------------------------------------------
     * Basic validation
     * --------------------------------------------------
     */

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
          error:
            "Invalid latitude or longitude",
        },
        { status: 400 }
      );
    }

    if (
      accuracy !== null &&
      (!Number.isFinite(accuracy) ||
        accuracy < 0)
    ) {
      return NextResponse.json(
        {
          success: false,
          accepted: false,
          error: "Invalid GPS accuracy",
        },
        { status: 400 }
      );
    }

    if (
      speed !== null &&
      (!Number.isFinite(speed) ||
        speed < 0)
    ) {
      return NextResponse.json(
        {
          success: false,
          accepted: false,
          error: "Invalid speed",
        },
        { status: 400 }
      );
    }

    /*
     * --------------------------------------------------
     * Find train
     * --------------------------------------------------
     */

    const {
      data: train,
      error: trainError,
    } = await supabaseAdmin
      .from("trains")
      .select("id,number,name,name_bn")
      .eq("number", trainNumber)
      .maybeSingle();

    if (trainError) {
      console.error(
        "TRAIN LOOKUP ERROR:",
        trainError
      );

      return NextResponse.json(
        {
          success: false,
          accepted: false,
          error:
            "Unable to find train",
          details: trainError.message,
        },
        { status: 500 }
      );
    }

    if (!train) {
      return NextResponse.json(
        {
          success: false,
          accepted: false,
          error:
            `Train ${trainNumber} was not found`,
        },
        { status: 404 }
      );
    }

    /*
     * --------------------------------------------------
     * Load train route
     *
     * train_route_stations
     *        ↓
     * stations
     * --------------------------------------------------
     */

    const {
      data: routeStations,
      error: routeError,
    } = await supabaseAdmin
      .from("train_route_stations")
      .select(`
        station_id,
        station_order,
        stop_type,
        arrival_time,
        departure_time,
        distance_km,
        station:stations (
          id,
          name,
          name_bn,
          latitude,
          longitude,
          type
        )
      `)
      .eq("train_id", train.id)
      .order("station_order", {
        ascending: true,
      });

    if (routeError) {
      console.error(
        "ROUTE STATION ERROR:",
        routeError
      );

      return NextResponse.json(
        {
          success: false,
          accepted: false,
          error:
            "Unable to load train route",
          details: routeError.message,
        },
        { status: 500 }
      );
    }

    if (
      !routeStations ||
      routeStations.length < 2
    ) {
      return NextResponse.json(
        {
          success: false,
          accepted: false,
          error:
            "This train does not have enough route stations configured.",
          trainNumber,
          stationCount:
            routeStations?.length ?? 0,
        },
        { status: 400 }
      );
    }

    /*
     * Supabase nested relation can sometimes return
     * station as an array depending on schema metadata.
     *
     * Normalize it here.
     */

    const normalizedStations: RouteStation[] =
      routeStations.map((item: any) => {
        const stationData = Array.isArray(
          item.station
        )
          ? item.station[0] ?? null
          : item.station ?? null;

        return {
          station_id: Number(
            item.station_id
          ),
          station_order: Number(
            item.station_order
          ),
          stop_type:
            item.stop_type ?? "PASS",
          arrival_time:
            item.arrival_time ?? null,
          departure_time:
            item.departure_time ?? null,
          distance_km:
            item.distance_km !== null
              ? Number(item.distance_km)
              : null,
          station:
            stationData
              ? {
                  id: Number(
                    stationData.id
                  ),
                  name:
                    stationData.name,
                  name_bn:
                    stationData.name_bn ??
                    null,
                  latitude:
                    stationData.latitude !==
                    null
                      ? Number(
                          stationData.latitude
                        )
                      : null,
                  longitude:
                    stationData.longitude !==
                    null
                      ? Number(
                          stationData.longitude
                        )
                      : null,
                  type:
                    stationData.type ??
                    "unknown",
                }
              : null,
        };
      });

    /*
     * --------------------------------------------------
     * Calculate route progress
     * --------------------------------------------------
     */

    const gps: Point = {
      lat: latitude,
      lng: longitude,
    };

    const routeProgress =
      calculateRouteProgress(
        gps,
        normalizedStations
      );

    if (!routeProgress) {
      return NextResponse.json(
        {
          success: false,
          accepted: false,
          error:
            "Unable to calculate railway route from configured stations.",
          trainNumber,
        },
        { status: 400 }
      );
    }

    const distance =
      routeProgress.distanceFromRoute;

    /*
     * --------------------------------------------------
     * Confidence calculation
     * --------------------------------------------------
     */

    let confidence = 0;

    /*
     * Distance from railway route.
     */
    if (distance <= 50) {
      confidence += 0.55;
    } else if (distance <= 150) {
      confidence += 0.40;
    } else if (distance <= 300) {
      confidence += 0.25;
    } else if (
      distance <= ACCEPT_DISTANCE_M
    ) {
      confidence += 0.10;
    }

    /*
     * GPS accuracy.
     */
    if (
      accuracy !== null &&
      Number.isFinite(accuracy)
    ) {
      if (accuracy <= 20) {
        confidence += 0.20;
      } else if (accuracy <= 50) {
        confidence += 0.15;
      } else if (accuracy <= 100) {
        confidence += 0.05;
      }
    }

    /*
     * Train speed.
     *
     * Browser geolocation normally returns
     * speed in metres/second.
     *
     * We don't require speed because some
     * devices return null.
     */
    if (
      speed !== null &&
      Number.isFinite(speed)
    ) {
      const speedKmh =
        speed * 3.6;

      if (
        speedKmh >= 10 &&
        speedKmh <= 130
      ) {
        confidence += 0.25;
      } else if (
        speedKmh >= 0 &&
        speedKmh <= 150
      ) {
        confidence += 0.10;
      }
    }

    confidence = Math.min(
      1,
      Math.max(0, confidence)
    );

    /*
     * --------------------------------------------------
     * Accept GPS
     * --------------------------------------------------
     *
     * A good GPS position close to the configured
     * railway route is accepted.
     */

    const accepted =
      Number.isFinite(distance) &&
      distance <= ACCEPT_DISTANCE_M &&
      confidence >= 0.60;

    let reason = "";

    if (accepted) {
      reason =
        "GPS location matches the configured railway route.";
    } else if (
      Number.isFinite(distance) &&
      distance > ACCEPT_DISTANCE_M
    ) {
      reason =
        `GPS location is ${Math.round(
          distance
        )} metres from the railway route.`;
    } else {
      reason =
        "GPS confidence is too low.";
    }

    /*
     * --------------------------------------------------
     * Save validation result
     * --------------------------------------------------
     */

    const {
      error: validationInsertError,
    } = await supabaseAdmin
      .from("location_validations")
      .insert({
        train_number: trainNumber,
        session_id: sessionId,
        latitude,
        longitude,
        distance_from_route:
          Number.isFinite(distance)
            ? distance
            : null,
        route_fraction:
          routeProgress.routeFraction,
        speed:
          speed !== null &&
          Number.isFinite(speed)
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
    }

    /*
     * --------------------------------------------------
     * Save accepted GPS location
     * --------------------------------------------------
     */

    if (accepted) {
      /*
       * Browser speed = m/s.
       * Store as received so the database remains
       * compatible with Geolocation API.
       */

      const {
        data,
        error: locationInsertError,
      } = await supabaseAdmin
        .from("train_locations")
        .insert({
          train_number: trainNumber,
          session_id: sessionId,
          latitude,
          longitude,
          speed:
            speed !== null &&
            Number.isFinite(speed)
              ? speed
              : null,
          accuracy:
            accuracy !== null &&
            Number.isFinite(accuracy)
              ? accuracy
              : null,
          route_fraction:
            routeProgress.routeFraction,
        })
        .select()
        .single();

      if (locationInsertError) {
        console.error(
          "LOCATION INSERT ERROR:",
          locationInsertError
        );

        return NextResponse.json(
          {
            success: false,
            accepted: false,
            error:
              locationInsertError.message,
            code:
              locationInsertError.code,
            details:
              locationInsertError.details,
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

        confidencePercent: Math.round(
          confidence * 100
        ),

        distanceFromRoute: Math.round(
          distance
        ),

        routeFraction: Number(
          routeProgress.routeFraction.toFixed(
            6
          )
        ),

        progress: Number(
          routeProgress.progress.toFixed(2)
        ),

        progressPercent: Math.round(
          routeProgress.progress
        ),

        segmentProgress: Number(
          routeProgress.segmentProgress.toFixed(
            2
          )
        ),

        travelledDistanceKm: Number(
          routeProgress.travelledDistanceKm.toFixed(
            2
          )
        ),

        totalRouteDistanceKm: Number(
          routeProgress.totalRouteDistanceKm.toFixed(
            2
          )
        ),

        fromStation:
          routeProgress.fromStation,

        toStation:
          routeProgress.toStation,

        stationCount:
          routeProgress.stationCount,

        reason,

        data,
      });
    }

    /*
     * --------------------------------------------------
     * GPS rejected
     * --------------------------------------------------
     */

    return NextResponse.json({
      success: true,
      accepted: false,

      trainNumber,

      confidence: Number(
        confidence.toFixed(2)
      ),

      confidencePercent: Math.round(
        confidence * 100
      ),

      distanceFromRoute:
        Number.isFinite(distance)
          ? Math.round(distance)
          : null,

      routeFraction: Number(
        routeProgress.routeFraction.toFixed(
          6
        )
      ),

      progress: Number(
        routeProgress.progress.toFixed(2)
      ),

      progressPercent: Math.round(
        routeProgress.progress
      ),

      segmentProgress: Number(
        routeProgress.segmentProgress.toFixed(
          2
        )
      ),

      travelledDistanceKm: Number(
        routeProgress.travelledDistanceKm.toFixed(
          2
        )
      ),

      totalRouteDistanceKm: Number(
        routeProgress.totalRouteDistanceKm.toFixed(
          2
        )
      ),

      fromStation:
        routeProgress.fromStation,

      toStation:
        routeProgress.toStation,

      stationCount:
        routeProgress.stationCount,

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

