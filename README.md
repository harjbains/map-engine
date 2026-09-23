# Map-Engine V3

The existing full-screen Map Engine remains the primary application. Its bottom
Uber progress bar opens the V3 dashboard overlay for earnings, mileage, weekly
planning, and recent weekly history. Financial records are read from and written
to the V3 Supabase tables through the typed repository and controlled RPCs.

## Setup

Copy `.env.example` to `.env.local` and supply the V3 project's URL and
**publishable** key. Never put a service-role key in the browser. Run `npm
install`, then `npm run dev`. Sign in through the Uber entry point with your
Supabase Auth account; the map remains usable before sign-in. Auth sessions may
be stored locally by the Supabase client, but no financial journal is kept in
localStorage.

The current-week plan is initialized with a fixed £750 target and seven OFF
days for a newly authenticated owner. Set LIGHT, NORMAL, or HEAVY days in the
Weekly Plan. Targets are derived in whole pennies from weights 0.5, 1, and 1.5,
with remainder pennies distributed Monday to Sunday. Historical actuals do not
change when the plan changes. `owner_id` is derived by the RPCs from `auth.uid()`.

## Checks

```sh
npm run check
```

This runs both TypeScript configurations and application tests. `npm run build`
produces the static application. See `supabase/README.md` for migrations and
pgTAP tests. A genuine write check requires signing in through the running app.
