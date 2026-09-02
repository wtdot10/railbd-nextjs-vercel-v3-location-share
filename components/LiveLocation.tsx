"use client";

import { useEffect, useMemo, useState } from "react";

type RouteStation = {
  order: number;
  stationId: number;
  name: string;
  nameBn: string | null;
  type: string;
  stopType: string;
  arrivalTime: string | null;
  departureTime: string | null;
  distanceKm: number | null;
};

type Live = {
  success?: boolean;

  available: boolean;
  routeAvailable?: boolean;

  reporters?: number;

  progress?: number;
  progressPercent?: number;

  routeFraction?: number;

  travelledDistanceKm?: number;
  totalRouteDistanceKm?: number;

  latitude?: number;
  longitude?: number;

  speed?: number | null;
  accuracy?: number | null;

  updatedAt?: string;

  currentStation?: {
    id: number;
    name: string;
    nameBn: string | null;
  } | null;

  nextStation?: {
    id: number;
    name: string;
    nameBn: string | null;
  } | null;

  train?: {
    number: string;
    name: string;
    nameBn: string | null;
  };

  route?: RouteStation[];

  message?: string;
  error?: string;
};

function getStationLabel(
  station: RouteStation
) {
  return station.nameBn || station.name;
}

export default function LiveLocation({
  trainNumber,
}: {
  trainNumber: string;
}) {
  const [data, setData] =
    useState<Live | null>(null);

  const [error, setError] =
    useState("");

  useEffect(() => {
    let alive = true;

    const load = async () => {
      try {
        const response =
          await fetch(
            `/api/location/public?train=${encodeURIComponent(
              trainNumber
            )}`,
            {
              cache: "no-store",
            }
          );

        const json =
          await response.json();

        if (!response.ok) {
          throw new Error(
            json.error ||
              "Unable to load train route"
          );
        }

        if (alive) {
          setData(json);
          setError("");
        }
      } catch (err) {
        if (alive) {
          setError(
            err instanceof Error
              ? err.message
              : "Live location service is unavailable"
          );
        }
      }
    };

    load();

    /*
     * Refresh every 30 seconds.
     */
    const interval =
      setInterval(
        load,
        30_000
      );

    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, [trainNumber]);

  /*
   * Calculate marker position.
   *
   * The route is rendered evenly across the available
   * horizontal space. The marker is placed according
   * to routeFraction.
   */
  const markerPosition =
    useMemo(() => {
      if (
        !data?.available ||
        data.progress === undefined
      ) {
        return null;
      }

      return Math.max(
        0,
        Math.min(
          100,
          data.progress
        )
      );
    }, [data]);

  /*
   * ----------------------------------------------------
   * Error
   * ----------------------------------------------------
   */

  if (error) {
    return (
      <div className="livePanel livePanelRoute">
        <div className="liveRouteHeader">
          <div>
            <b>Train route</b>

            <span>
              {error}
            </span>
          </div>
        </div>
      </div>
    );
  }

  /*
   * ----------------------------------------------------
   * Loading
   * ----------------------------------------------------
   */

  if (!data) {
    return (
      <div className="livePanel livePanelRoute">
        <div className="liveRouteHeader">
          <div>
            <b>
              Train route
            </b>

            <span>
              Loading station route...
            </span>
          </div>
        </div>
      </div>
    );
  }

  const route =
    data.route ?? [];

  /*
   * ----------------------------------------------------
   * No configured route
   * ----------------------------------------------------
   */

  if (
    !data.routeAvailable ||
    route.length < 2
  ) {
    return (
      <div className="livePanel livePanelRoute">
        <div className="liveRouteHeader">
          <div>
            <b>
              Train route
            </b>

            <span>
              Station-by-station route is
              not configured yet.
            </span>
          </div>
        </div>
      </div>
    );
  }

  /*
   * ----------------------------------------------------
   * Route UI
   * ----------------------------------------------------
   */

  return (
    <div className="livePanel livePanelRoute">

      {/* Header */}

      <div className="liveRouteHeader">
        <div>
          <b>
            {data.available
              ? "Live train route"
              : "Train route"}
          </b>

          <span>
            {data.available
              ? `${data.reporters ?? 0} verified reporter${
                  data.reporters === 1
                    ? ""
                    : "s"
                }`
              : data.message ??
                "Waiting for recent verified passenger GPS."}
          </span>
        </div>

        {data.available && (
          <div className="liveRouteBadge">
            <i />
            LIVE
          </div>
        )}
      </div>

      {/* Route */}

      <div className="stationRoute">

        <div className="stationRouteScroller">

          <div className="stationRouteInner">

            {/* Base line */}

            <div className="stationRouteLine" />

            {/* Completed line */}

            {markerPosition !== null && (
              <div
                className="stationRouteProgress"
                style={{
                  width: `${markerPosition}%`,
                }}
              />
            )}

            {/* Train marker */}

            {markerPosition !== null && (
              <div
                className="trainPosition"
                style={{
                  left: `${markerPosition}%`,
                }}
              >
                <div className="trainPositionIcon">
                  🚆
                </div>

                <div className="trainPositionLabel">
                  {Math.round(
                    markerPosition
                  )}
                  %
                </div>
              </div>
            )}

            {/* Stations */}

            <div className="stationNodes">

              {route.map(
                (
                  station,
                  index
                ) => {

                  const position =
                    route.length ===
                    1
                      ? 0
                      : (index /
                          (route.length -
                            1)) *
                        100;

                  const passed =
                    markerPosition !==
                      null &&
                    position <=
                      markerPosition;

                  const isStart =
                    index === 0;

                  const isEnd =
                    index ===
                    route.length - 1;

                  const isCurrent =
                    data.currentStation
                      ?.id ===
                    station.stationId;

                  const isNext =
                    data.nextStation
                      ?.id ===
                    station.stationId;

                  return (
                    <div
                      key={`${station.stationId}-${station.order}`}
                      className={`stationNode ${
                        passed
                          ? "passed"
                          : ""
                      } ${
                        isCurrent
                          ? "current"
                          : ""
                      } ${
                        isNext
                          ? "next"
                          : ""
                      } ${
                        isStart
                          ? "start"
                          : ""
                      } ${
                        isEnd
                          ? "end"
                          : ""
                      }`}
                      style={{
                        left: `${position}%`,
                      }}
                    >

                      <div className="stationDot">
                        {isCurrent &&
                        data.available ? (
                          <span>
                            ●
                          </span>
                        ) : (
                          ""
                        )}
                      </div>

                      <div className="stationLabel">

                        <strong>
                          {getStationLabel(
                            station
                          )}
                        </strong>

                        {station.nameBn &&
                          station.name !==
                            station.nameBn && (
                            <small>
                              {
                                station.name
                              }
                            </small>
                          )}

                        {isCurrent &&
                          data.available && (
                            <em>
                              Current
                            </em>
                          )}

                        {isNext &&
                          data.available && (
                            <em>
                              Next
                            </em>
                          )}

                      </div>

                    </div>
                  );
                }
              )}

            </div>

          </div>

        </div>

      </div>

      {/* Live details */}

      {data.available ? (
        <div className="liveRouteDetails">

          <div className="liveRouteCurrent">

            <small>
              CURRENT POSITION
            </small>

            <strong>
              {data.currentStation
                ?.nameBn ||
                data.currentStation
                  ?.name ||
                "On route"}
            </strong>

            {data.nextStation && (
              <span>
                Next:{" "}
                {data.nextStation
                  .nameBn ||
                  data.nextStation
                    .name}
              </span>
            )}

          </div>

          <div className="liveRouteStats">

            <div>
              <small>
                Progress
              </small>

              <strong>
                {data.progressPercent ??
                  Math.round(
                    data.progress ?? 0
                  )}
                %
              </strong>
            </div>

            <div>
              <small>
                Speed
              </small>

              <strong>
                {data.speed !== null &&
                data.speed !== undefined
                  ? `${data.speed} km/h`
                  : "—"}
              </strong>
            </div>

            <div>
              <small>
                Reports
              </small>

              <strong>
                {data.reporters ??
                  0}
              </strong>
            </div>

          </div>

          {data.updatedAt && (
            <small className="liveUpdated">
              Last verified report:{" "}
              {new Date(
                data.updatedAt
              ).toLocaleString()}
            </small>
          )}

        </div>
      ) : (
        <div className="liveWaiting">

          <span className="liveWaitingDot" />

          <div>
            <strong>
              Live position unavailable
            </strong>

            <small>
              The station route is shown,
              but no recent verified GPS
              report is available.
            </small>
          </div>

        </div>
      )}

    </div>
  );
}
