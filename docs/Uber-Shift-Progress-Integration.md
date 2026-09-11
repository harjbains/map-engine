# Uber Engine ↔ Map Engine Shift Integration

Map Engine shows a large, tappable Tesla-friendly shift control representing progress
towards the day's Uber earnings target, without revealing any financial figures to
passengers. Tapping it opens an Uber Engine **lean dashboard** overlay (TODAY and WEEK
targets on one screen) directly above the live map — Map Engine does **not** navigate
away from the map. The dashboard answers exactly four questions: the daily target, the
weekly target, today's actual gross £/productive hour, and the recorded business
mileage. All forecasting/estimation tiles are intentionally disabled and preserved in
Map Engine's source under `// TESLA UI:` comments.

Map Engine **consumes** this contract. Uber Engine **publishes** it. Map Engine never
reads any other Uber Engine storage, and Uber Engine never touches Map Engine's map or
UI. All detailed earnings, hours and target figures stay inside Uber Engine with the
two documented write-backs below (the total-sync and the shift-control request).

## Origin note

- Map Engine: `https://harjbains.github.io/map-engine/`
- Uber Engine: `https://harjbains.github.io/uber-engine/`

Both apps share the `harjbains.github.io` browser origin, so a single namespaced
`localStorage` is visible to both. The keys below are the complete integration surface.

## Published keys

Uber Engine writes the following keys into `localStorage` on every daily/weekly
target render:

| Key                          | Type              | Required | Meaning                                       |
| ---------------------------- | ----------------- | -------- | --------------------------------------------- |
| `uberEngine.shift.progress`  | string fraction   | No       | Daily earnings target progress, `0`–`1`.      |
| `uberEngine.shift.active`    | `"true"`/`"false"`| No       | Whether a shift is currently running.         |
| `uberEngine.shift.updatedAt` | epoch ms or ISO   | No       | When the value was last published.            |
| `uberEngine.shift.state`     | JSON string       | No       | Rich shift state for the dashboard overlay.   |

If `uberEngine.shift.progress` and `uberEngine.shift.state` are both unreadable, the
bar renders as a neutral empty track and never shows outdated numbers.

## Rich state object (`uberEngine.shift.state`)

The overlay modal is driven by this JSON object:

```json
{
  "version": 1,
  "date": "2026-09-10",
  "shiftActive": true,
  "paused": false,
  "hasActiveShift": true,
  "dailyTarget": 150,
  "todayEarnings": 105,
  "dailyProgress": 0.7,
  "remaining": 45,
  "ridesRemaining": 9,
  "activeMinutes": 288,
  "hourlyRate": 21.88,
  "targetRate": 20,
  "weeklyTarget": 900,
  "weeklyEarnings": 612.5,
  "weeklyProgress": 0.68,
  "weeklyMinutes": 960,
  "weeklyRemaining": 287.5,
  "businessMilesToday": 47,
  "businessMilesWeek": 214,
  "updatedAt": 1757513600000
}
```

Field notes:

- `dailyTarget` is today's target **rounded to £5 increments** so the dashboard stays
  clean and motivational. `remaining` is `max(0, dailyTarget − todayEarnings)`.
- `shiftActive` is true only when a today target exists and is positive. `hasActiveShift`
  is true whenever a live shift is running, regardless of target, so the map's
  control row can show END SHIFT even on target-free days. `paused` reflects whether
  the live shift is currently paused.
- `ridesRemaining` is the remaining amount expressed as whole rides (each ride is
  roughly £5, e.g. £45 remaining → `9`). Uber Engine publishes this key; for
  compatibility Map Engine still accepts the legacy `targetUnitsRemaining` key.
- `hourlyRate` is today's realised rate; `targetRate` is the planned per-hour rate.
- Weekly fields mirror the day fields for the lean dashboard's WEEK sheet.
- `businessMilesToday` / `businessMilesWeek` are the driver's recorded business miles.
  Both are optional: Map Engine falls back to its own `map-engine-business-miles-v1`
  store (which the driver maintains via the dashboard's UPDATE MILEAGE and the
  end-of-shift mileage entry). If both sources are missing the mileage panels show 0.
- `updatedAt` is epoch ms. If the object is older than 12 hours Map Engine treats it
  as unavailable rather than showing outdated figures.
- A missing or corrupt object shows `Shift data unavailable` inside the modal. The
  map, the collapsed bar and every other Map Engine feature are unaffected.

## Total-sync write-back (`uberEngine.shift.syncRequest`)

The modal's **UPDATE EARNINGS** flow lets the driver set an absolute cumulative
running total for today from the Uber Driver app. Map Engine writes a single
best-effort request key; it never touches Uber Engine's database schema:

| Key                          | Value    | Meaning                              |
| ---------------------------- | -------- | ------------------------------------ |
| `uberEngine.shift.syncRequest` | JSON    | `{ "date": "2026-09-10", "total": 105, "requestedAt": 1757513600000 }` |

Uber Engine consumes this on load, on `storage` events, and on focus: it replaces
today's authoritative day total (recalculating weekly figures), clears the request,
and republishes the state. Map Engine also applies the entered total optimistically so
the bar and modal update immediately without a reload — including the first-ever sync
when Uber Engine has not yet published a state. If the request is for a
non-today date it is ignored.

## Shift control write-back (`uberEngine.shift.controlRequest`)

Map Engine's **START / PAUSE / RESUME / END** control row lets the driver run the
live shift from the car without switching apps. Map Engine writes a single
best-effort request key; Uber Engine owns the live-shift lifecycle:

| Key                            | Value | Meaning |
| ------------------------------ | ----- | ------- |
| `uberEngine.shift.controlRequest` | JSON | `{ "action": "start" \| "pause" \| "resume" \| "end", "miles": 64.3 (end only), "requestedAt": 1757513600000 }` |

Uber Engine consumes this on load and on `storage` events: `start`/`pause`/`resume`
map straight onto the live-shift handlers, and `end` finishes the shift fully —
finalising today's day row with the driver's total business miles (a cumulative
"today so far" total, matching the live-shift checkpoint semantics) while preserving
saved earnings and trips, best-effort syncing the Google Sheets day row, then
archiving and clearing the live shift. Map Engine applies the resulting
`hasActiveShift`/`paused` flags optimistically so the control row flips state
immediately even when Uber Engine is closed; Uber Engine's next publish is
authoritative.

Guards: `miles` must be a finite number when provided (a malformed request is
ignored), the request is cleared after handling regardless of outcome, and ending a
shift never writes a lower gross than the day row already holds.

## Business mileage request (`uberEngine.shift.mileageRequest`)

The dashboard's **UPDATE MILEAGE** flow and the end-of-shift mileage entry both let the
driver record how many business miles were driven. Map Engine writes a best-effort
request key and also records the miles locally; Uber Engine consumes the request on load
and on `storage` events to persist the figure as the authoritative day record:

| Key                             | Value | Meaning |
| ------------------------------- | ----- | ------- |
| `uberEngine.shift.mileageRequest` | JSON | `{ "date": "2026-09-11", "miles": 56, "requestedAt": 1757513600000 }` |

Map Engine keeps its own per-date business-mile record in the `map-engine-business-miles-v1`
scoped store (so the TODAY/WEEK panels work even before Uber Engine republishes) and a
per-date earnings/minutes journal in `map-engine-shift-days-v1` that powers the WEEK
sheet's seven-day strip. `businessMilesToday` / `businessMilesWeek` from the published
state take precedence once Uber Engine republishes them.

## Example publish

```js
localStorage.setItem("uberEngine.shift.progress", "0.70");
localStorage.setItem("uberEngine.shift.active", "true");
localStorage.setItem("uberEngine.shift.updatedAt", String(Date.now()));
localStorage.setItem("uberEngine.shift.state", JSON.stringify(stateObject));
```

Write all of them together on any shift update. Map Engine will pick the values up on
its next `focus`/`visibility`/`storage` refresh — no polling is needed.

Map Engine consumes the `state` key through a snapshot cached on the raw JSON plus the
local day so that `useSyncExternalStore` receives referentially stable objects between
refreshes; this avoids the React "Maximum update depth exceeded" loop that an uncached
re-parse object would cause. The modal subtree is also wrapped in an error boundary so a
render failure closes the modal instead of blanking the dashboard.

## Day rollover

If `state.date` is not today, Map Engine rolls the dashboard over before rendering: the
new day opens at zero `todayEarnings` against the planned `dailyTarget`, with
`ridesRemaining` showing the full ride count that target still needs (`dailyTarget / 5`)
and `hourlyRate` cleared, while `weeklyEarnings`/`weeklyMinutes`/`businessMilesWeek` keep
accumulating only while the publish fell within the same Mon-Sun week and reset at the
week boundary. The rollover is passive and read-only in the browser: the publisher's
stored state is left untouched until the driver acts, at which point the optimistic
state, total-sync and mileage requests republish under today's date. When a new day
begins and Uber Engine has already published for it, that newer state simply takes
precedence as usual.

## Failure behaviour

Map Engine keeps working normally if Uber Engine has never run, no shift exists,
nothing is stored, the data is malformed, it is stale, or Uber Engine is unavailable.
The collapsed bar renders a neutral empty track, the modal shows `Shift data
unavailable`, and the map is unaffected.

## Tapping the bar

A full-width bar at the very bottom of the map is built from rides: the bar is scaled
dynamically to today's target plus a ten-ride tail, each cell is one ride (roughly £5),
filled in as the day's rides come in, turning green when the goal is reached — without
ever revealing figures to passengers. Anonymous bold white count tokens sit inside the
segments themselves at intervals of five (1, 5, 10, ...) so the driver can read off
progress without any money showing on screen. Tapping the bar opens the Uber
Engine lean dashboard directly above the live map: a header stamps `Uber Engine · Shift
Dashboard` with a live shift-status pill, and the body answers the four questions
without scrolling on a Tesla's landscape screen — two equal earnings donuts (TODAY and
WEEK) side by side, each showing the earned figure, the "of" target and the percentage
(ring stays full when over target), then a metrics row with today's actual gross £/hour
and the recorded business mileage (TODAY / WEEK), then a single control row of
PAUSE/RESUME, UPDATE EARNINGS, UPDATE MILEAGE and END SHIFT. Tapping the WEEK donut
opens the weekly sheet: total hours, rate, business mileage (with an inline UPDATE) and
a MON–SUN earnings strip. UPDATE EARNINGS opens the running-total editor (£100/£10/£1
steppers), UPDATE MILEAGE opens a −10/−1/+1/+10 mileage counter, and END SHIFT asks for
today's business miles before finishing. The overlay is sized compact so the whole
dashboard fits a Tesla's landscape browser viewport; navigating away from Map Engine
never happens, and a large close control returns instantly to the map.