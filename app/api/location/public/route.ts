import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

type Point = {
  lat: number;
  lng: number;
};

type Station = {
  id: number;
  name: string;
  name_bn: string | null;
  latitude: number | null;
  longitude: number | null;
  type: string;
};

type RouteStation = {
  stationId: number;
  stationOrder: number;
  stopType: string;
  arrivalTime: string | null;
  departureTime: string | null;
  distanceKm: number | null;
  station: Station;
};

type LocationRow = {
  latitude: number;
  longitude: number;
  speed: number | null;
  accuracy: number | null;
  route_fraction: number | null;
  session_id: string | null;
  created_at: string;
};

/* -------------------------------------------------------
   Geographic helpers
------------------------------------------------------- */

function distanceMeters(a: Point, b: Point): number {
  const R = 6371000;

  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;

  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;

  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(dLng / 2) ** 2;

  return (
    R *
    2 *
    Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
  );
}

function closestPointOnSegment(
  p: Point,
  a: Point,
  b: Point
) {
  const latRad = (p.lat * Math.PI) / 180;

  const metersPerLat = 111320;
  const metersPerLng =
    111320 * Math.cos(latRad);

  const ax = a.lng * metersPerLng;
  const ay = a.lat * metersPerLat;

  const bx = b.lng * metersPerLng;
  const by = b.lat * metersPerLat;

  const px = p.lng * metersPerLng;
  const py = p.lat * metersPerLat;

  const dx = bx - ax;
  const dy = by - ay;

  const len2 = dx * dx + dy * dy;

  if (len2 === 0) {
    return {
      distance: distanceMeters(p, a),
      fraction: 0,
    };
  }

  let t =
    ((px - ax) * dx +
      (py - ay) * dy) /
    len2;

  t = Math.max(0, Math.min(1, t));

  const closest: Point = {
    lat:
      (ay + (by - ay) * t) /
      metersPerLat,

    lng:
      (ax + (bx - ax) * t) /
      metersPerLng,
  };

  return {
    distance: distanceMeters(p, closest),
    fraction: t,
  };
}

/* -------------------------------------------------------
   Calculate fraction along complete station route
------------------------------------------------------- */

function calculateRouteFraction(
  gps: Point,
  route: RouteStation[]
) {
  const points = route.map((r) => ({
    lat: Number(r.station.latitude),
    lng: Number(r.station.longitude),
  }));

  const cumulative: number[] = [0];

  for (let i = 1; i < points.length; i++) {
    cumulative[i] =
      cumulative[i - 1] +
      distanceMeters(
        points[i - 1],
        points[i]
      );
  }

  const total =
    cumulative[cumulative.length - 1];

  if (!Number.isFinite(total) || total <= 0) {
    return null;
  }

  let bestDistance = Infinity;
  let bestSegment = 0;
  let bestFraction = 0;

  for (
    let i = 0;
    i < points.length - 1;
    i++
  ) {
    const result =
      closestPointOnSegment(
        gps,
        points[i],
        points[i + 1]
      );

    if (result.distance < bestDistance) {
      bestDistance = result.distance;
      bestSegment = i;
      bestFraction = result.fraction;
    }
  }

  const segmentLength =
    cumulative[bestSegment + 1] -
    cumulative[bestSegment];

  const travelled =
    cumulative[bestSegment] +
    segmentLength * bestFraction;

  return {
    fraction: Math.max(
      0,
      Math.min(1, travelled / total)
    ),

    distanceFromRoute: bestDistance,

    segment: bestSegment,
  };
}

/* -------------------------------------------------------
   Median
------------------------------------------------------- */

function median(values: number[]) {
  if (!values.length) return null;

  const sorted = [...values].sort(
    (a, b) => a - b
  );

  const middle =
    Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (
      (sorted[middle - 1] +
        sorted[middle]) /
      2
    );
  }

  return sorted[middle];
}

/* -------------------------------------------------------
   GET
------------------------------------------------------- */

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);

    const trainNumber =
      url.searchParams
        .get("train")
        ?.trim();

    if (!trainNumber) {
      return NextResponse.json(
        {
          success: false,
          error: "train is required",
        },
        { status: 400 }
      );
    }

    /* ---------------------------------------------------
       Find train
    --------------------------------------------------- */

    const {
      data: train,
      error: trainError,
    } = await supabaseAdmin
      .from("trains")
      .select(
        "id,number,name,name_bn"
      )
      .eq("number", trainNumber)
      .maybeSingle();

    if (trainError) {
      console.error(
        "PUBLIC TRAIN ERROR:",
        trainError
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Unable to find train",
        },
        { status: 500 }
      );
    }

    if (!train) {
      return NextResponse.json(
        {
          success: false,
          error:
            `Train ${trainNumber} not found`,
        },
        { status: 404 }
      );
    }

    /* ---------------------------------------------------
       Load route station sequence
    --------------------------------------------------- */

    const {
      data: routeRows,
      error: routeError,
    } = await supabaseAdmin
      .from("train_route_stations")
      .select(`
        station_id,
        station_order,
        stop_type,
        arrival_time,
        departure_time,
        distance_km
      `)
      .eq("train_id", train.id)
      .order("station_order", {
        ascending: true,
      });

    if (routeError) {
      console.error(
        "PUBLIC ROUTE ERROR:",
        routeError
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Unable to load train route",
        },
        { status: 500 }
      );
    }

    if (
      !routeRows ||
      routeRows.length < 2
    ) {
      return NextResponse.json(
        {
          success: true,
          available: false,
          routeAvailable: false,
          reporters: 0,
          route: [],
          message:
            "Station route is not configured for this train.",
        }
      );
    }

    /* ---------------------------------------------------
       Load stations
    --------------------------------------------------- */

    const stationIds = [
      ...new Set(
        routeRows.map((r) =>
          Number(r.station_id)
        )
      ),
    ];

    const {
      data: stationRows,
      error: stationError,
    } = await supabaseAdmin
      .from("stations")
      .select(`
        id,
        name,
        name_bn,
        latitude,
        longitude,
        type
      `)
      .in("id", stationIds);

    if (stationError) {
      console.error(
        "PUBLIC STATION ERROR:",
        stationError
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Unable to load stations",
        },
        { status: 500 }
      );
    }

    const stationMap =
      new Map<number, Station>();

    for (const station of stationRows ?? []) {
      stationMap.set(
        Number(station.id),
        {
          id: Number(station.id),
          name: station.name,
          name_bn:
            station.name_bn ?? null,
          latitude:
            station.latitude !== null
              ? Number(station.latitude)
              : null,
          longitude:
            station.longitude !== null
              ? Number(station.longitude)
              : null,
          type:
            station.type ?? "unknown",
        }
      );
    }

    /* ---------------------------------------------------
       Build route
    --------------------------------------------------- */

    const route: RouteStation[] =
      routeRows
        .map((row) => {
          const station =
            stationMap.get(
              Number(row.station_id)
            );

          if (!station) return null;

          if (
            station.latitude === null ||
            station.longitude === null
          ) {
            return null;
          }

          return {
            stationId:
              Number(row.station_id),

            stationOrder:
              Number(row.station_order),

            stopType:
              row.stop_type ?? "PASS",

            arrivalTime:
              row.arrival_time ?? null,

            departureTime:
              row.departure_time ?? null,

            distanceKm:
              row.distance_km !== null
                ? Number(row.distance_km)
                : null,

            station,
          };
        })
        .filter(
          Boolean
        ) as RouteStation[];

    if (route.length < 2) {
      return NextResponse.json({
        success: true,
        available: false,
        routeAvailable: false,
        reporters: 0,
        route: [],
        message:
          "Not enough station coordinates are available.",
      });
    }

    /* ---------------------------------------------------
       Recent verified locations

       train_locations contains only accepted locations
       because /api/location saves only accepted GPS.
    --------------------------------------------------- */

    const cutoff = new Date(
      Date.now() -
        10 * 60 * 1000
    ).toISOString();

    const {
      data: locationRows,
      error: locationError,
    } = await supabaseAdmin
      .from("train_locations")
      .select(`
        latitude,
        longitude,
        speed,
        accuracy,
        route_fraction,
        session_id,
        created_at
      `)
      .eq(
        "train_number",
        trainNumber
      )
      .gte("created_at", cutoff)
      .order("created_at", {
        ascending: false,
      })
      .limit(100);

    if (locationError) {
      console.error(
        "PUBLIC LOCATION ERROR:",
        locationError
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Unable to read live locations",
        },
        { status: 500 }
      );
    }

    const locations =
      (locationRows ?? []) as LocationRow[];

    /* ---------------------------------------------------
       One latest report per session

       This prevents one passenger sending many GPS
       updates from dominating the calculation.
    --------------------------------------------------- */

    const sessionMap =
      new Map<
        string,
        LocationRow
      >();

    for (const location of locations) {
      const key =
        location.session_id ??
        `location-${location.created_at}`;

      if (
        !sessionMap.has(key)
      ) {
        sessionMap.set(
          key,
          location
        );
      }
    }

    const uniqueLocations =
      [...sessionMap.values()];

    /* ---------------------------------------------------
       Calculate route fraction for each report
    --------------------------------------------------- */

    const reports = uniqueLocations
      .map((location) => {
        const gps: Point = {
          lat: Number(
            location.latitude
          ),
          lng: Number(
            location.longitude
          ),
        };

        let fraction =
          location.route_fraction;

        let distanceFromRoute =
          null as number | null;

        let segment = 0;

        /*
         * If route_fraction wasn't saved by an older
         * version of the API, calculate it now.
         */
        if (
          fraction === null ||
          !Number.isFinite(
            Number(fraction)
          )
        ) {
          const calculated =
            calculateRouteFraction(
              gps,
              route
            );

          if (!calculated) {
            return null;
          }

          fraction =
            calculated.fraction;

          distanceFromRoute =
            calculated.distanceFromRoute;

          segment =
            calculated.segment;
        } else {
          /*
           * Still calculate segment/distance for
           * current station information.
           */
          const calculated =
            calculateRouteFraction(
              gps,
              route
            );

          if (calculated) {
            distanceFromRoute =
              calculated.distanceFromRoute;

            segment =
              calculated.segment;
          }
        }

        return {
          fraction: Number(fraction),
          latitude: gps.lat,
          longitude: gps.lng,
          speed:
            location.speed !== null
              ? Number(location.speed)
              : null,
          accuracy:
            location.accuracy !== null
              ? Number(location.accuracy)
              : null,
          createdAt:
            location.created_at,
          segment,
          distanceFromRoute,
        };
      })
      .filter(Boolean) as Array<{
      fraction: number;
      latitude: number;
      longitude: number;
      speed: number | null;
      accuracy: number | null;
      createdAt: string;
      segment: number;
      distanceFromRoute: number | null;
    }>;

    /*
     * Require at least 1 recent verified report.
     *
     * Since train_locations contains only accepted
     * locations, this is already a verified GPS report.
     */
    const available =
      reports.length > 0;

    /* ---------------------------------------------------
       No live GPS
    --------------------------------------------------- */

    if (!available) {
      return NextResponse.json({
        success: true,
        available: false,
        routeAvailable: true,
        reporters: 0,

        train: {
          number: train.number,
          name: train.name,
          nameBn: train.name_bn,
        },

        route: route.map(
          (item) => ({
            order:
              item.stationOrder,

            stationId:
              item.stationId,

            name:
              item.station.name,

            nameBn:
              item.station.name_bn,

            type:
              item.station.type,

            stopType:
              item.stopType,

            arrivalTime:
              item.arrivalTime,

            departureTime:
              item.departureTime,

            distanceKm:
              item.distanceKm,
          })
        ),

        message:
          "Waiting for recent verified passenger GPS.",
      });
    }

    /* ---------------------------------------------------
       Calculate combined position

       Median prevents an outlier GPS report from moving
       the train marker too far.
    --------------------------------------------------- */

    const fractions =
      reports
        .map((r) => r.fraction)
        .filter(
          (v) =>
            Number.isFinite(v) &&
            v >= 0 &&
            v <= 1
        );

    const progressFraction =
      median(fractions) ?? 0;

    const progress =
      Math.max(
        0,
        Math.min(
          100,
          progressFraction * 100
        )
      );

    /* ---------------------------------------------------
       Current route segment
    --------------------------------------------------- */

    let currentSegment = 0;

    for (
      let i = 0;
      i < route.length - 1;
      i++
    ) {
      const start =
        i / (route.length - 1);

      const end =
        (i + 1) /
        (route.length - 1);

      if (
        progressFraction >= start &&
        progressFraction <= end
      ) {
        currentSegment = i;
        break;
      }
    }

    /*
     * Better segment detection using route distances.
     */
    const routePoints =
      route.map((r) => ({
        lat: Number(
          r.station.latitude
        ),
        lng: Number(
          r.station.longitude
        ),
      }));

    const cumulative = [0];

    for (
      let i = 1;
      i < routePoints.length;
      i++
    ) {
      cumulative[i] =
        cumulative[i - 1] +
        distanceMeters(
          routePoints[i - 1],
          routePoints[i]
        );
    }

    const totalDistance =
      cumulative[
        cumulative.length - 1
      ];

    const travelledDistance =
      totalDistance *
      progressFraction;

    for (
      let i = 0;
      i < cumulative.length - 1;
      i++
    ) {
      if (
        travelledDistance >=
          cumulative[i] &&
        travelledDistance <=
          cumulative[i + 1]
      ) {
        currentSegment = i;
        break;
      }
    }

    /* ---------------------------------------------------
       Current + next station
    --------------------------------------------------- */

    const currentStation =
      route[currentSegment]
        ?.station ?? null;

    const nextStation =
      route[currentSegment + 1]
        ?.station ?? null;

    /* ---------------------------------------------------
       Speed

       Browser Geolocation API speed is m/s.
       Convert to km/h.
    --------------------------------------------------- */

    const speeds =
      reports
        .map((r) => r.speed)
        .filter(
          (v): v is number =>
            v !== null &&
            Number.isFinite(v) &&
            v >= 0
        );

    const speedMps =
      speeds.length
        ? median(speeds)
        : null;

    const speedKmh =
      speedMps !== null
        ? speedMps * 3.6
        : null;

    const latestReport =
      reports.reduce(
        (latest, report) =>
          new Date(
            report.createdAt
          ).getTime() >
          new Date(
            latest.createdAt
          ).getTime()
            ? report
            : latest
      );

    /* ---------------------------------------------------
       Response
    --------------------------------------------------- */

    return NextResponse.json({
      success: true,

      available: true,

      routeAvailable: true,

      reporters:
        reports.length,

      train: {
        number: train.number,
        name: train.name,
        nameBn: train.name_bn,
      },

      progress: Number(
        progress.toFixed(2)
      ),

      progressPercent:
        Math.round(progress),

      routeFraction: Number(
        progressFraction.toFixed(6)
      ),

      travelledDistanceKm:
        Number(
          (
            travelledDistance /
            1000
          ).toFixed(2)
        ),

      totalRouteDistanceKm:
        Number(
          (
            totalDistance /
            1000
          ).toFixed(2)
        ),

      currentStation: currentStation
        ? {
            id: currentStation.id,
            name:
              currentStation.name,
            nameBn:
              currentStation.name_bn,
          }
        : null,

      nextStation: nextStation
        ? {
            id: nextStation.id,
            name:
              nextStation.name,
            nameBn:
              nextStation.name_bn,
          }
        : null,

      speed:
        speedKmh !== null
          ? Number(
              speedKmh.toFixed(1)
            )
          : null,

      latitude:
        latestReport.latitude,

      longitude:
        latestReport.longitude,

      accuracy:
        latestReport.accuracy,

      updatedAt:
        latestReport.createdAt,

      route: route.map(
        (item) => ({
          order:
            item.stationOrder,

          stationId:
            item.stationId,

          name:
            item.station.name,

          nameBn:
            item.station.name_bn,

          type:
            item.station.type,

          stopType:
            item.stopType,

          arrivalTime:
            item.arrivalTime,

          departureTime:
            item.departureTime,

          distanceKm:
            item.distanceKm,
        })
      ),
    });
  } catch (error) {
    console.error(
      "PUBLIC LOCATION API ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown error",
      },
      { status: 500 }
    );
  }
}

