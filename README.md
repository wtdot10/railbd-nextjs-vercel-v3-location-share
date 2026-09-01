# RailBD — Supabase database-powered train tracker

This version is **database-first**. It does not contain a demo train/station dataset.

## Database source

The app reads:

- `trains` — train number, name, Bengali name, type and active flag
- `stations` — station code, names, coordinates and type
- `train_route_stations` — ordered timetable/route stops
- `train_locations` — recent accepted passenger GPS reports
- `location_validations` — validation history
- `train_routes` — optional PostGIS railway geometry used to verify passenger GPS

## Features

- Database-backed train search
- Train directory with filtering
- Train detail pages
- Station-by-station timetable
- Station directory and station detail pages
- Trains calling at a station
- Route explorer generated from `train_route_stations`
- Passenger GPS sharing and server-side route verification
- Recent verified live-location aggregation
- Automatic live-location polling every 30 seconds
- No fabricated delay, ETA, speed or position values
- API endpoints for trains, stations, search and live location

## Environment

Create `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_server_only_service_role_key
```

Never expose `SUPABASE_SERVICE_ROLE_KEY` to browser/client code.

## Database migration

Run `supabase/production-migration.sql` in the Supabase SQL Editor. It is additive and does not seed fake railway records.

Passenger location verification requires real railway geometry in `train_routes`. Without geometry, the app deliberately refuses to label a GPS report as verified.

## Run

```bash
npm ci
npm run dev
```

Production:

```bash
npm run build
npm start
```

## Important deployment note

If a service-role key was ever committed or shared outside the server environment, rotate it in Supabase and update Vercel's environment variable.
