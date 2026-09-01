# RailBD — Next.js / Vercel V2

Production-oriented starter for a Bangladesh railway information platform.

## Stack

- Next.js 16.3.3
- React 19
- TypeScript
- App Router
- Vercel-ready API routes
- No external database required for the starter

## Local setup

Requirements: Node.js 24+ and npm/pnpm.

```bash
npm install
npm run dev
```

Open http://localhost:3000.

Production build:

```bash
npm run build
npm start
```

## API

- GET `/api/trains`
- GET `/api/trains/705`

## Deploy to Vercel

1. Create a GitHub repository.
2. Push this project.
3. In Vercel, import the repository.
4. Framework should be detected as Next.js.
5. Deploy.

Or with the CLI:

```bash
npm install -g vercel
vercel login
vercel
vercel --prod
```

## Real-data migration

The current `lib/data.ts` is deliberately marked as demo data. Do not publish these values as live railway positions.

Recommended production database:

- PostgreSQL
- Prisma or Drizzle
- trains
- stations
- train_stops
- service_days
- train_runs
- live_positions
- delay_events

Then replace the API route implementations with database queries.

## Live location

A live map requires a legitimate, reliable location feed. The UI/API is ready for that integration, but this starter does not invent GPS positions.

## Suggested production environment variables

```text
DATABASE_URL=
RAILWAY_DATA_API_URL=
RAILWAY_DATA_API_KEY=
NEXT_PUBLIC_MAP_TILE_URL=
```

Keep private API keys server-side. Never expose them in `NEXT_PUBLIC_*`.

## Important

This project is an independent implementation. It does not copy TrainKothai source code, branding, private APIs, or proprietary assets.


## Passenger location sharing (V3)

Passengers can voluntarily share their phone GPS from a train page. Coordinates are rounded to a coarse ~1 km grid and the public API only returns an aggregate when at least 3 active reporters exist. Reports expire from the public result after 10 minutes without updates. Users can stop sharing at any time.

### Supabase setup
Run `supabase-schema.sql` in Supabase SQL Editor. Add these Vercel environment variables:

`NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co`

`SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY`

Never expose the service-role key through `NEXT_PUBLIC_*`.

The result is community-reported, not official railway GPS. Add rate limiting, cleanup, monitoring and a real map before production.
