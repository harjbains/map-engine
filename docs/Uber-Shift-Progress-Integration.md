# Uber Engine ↔ Map Engine Shift Integration

Map Engine shows a large, tappable Tesla-friendly shift control representing progress
towards the day's Uber earnings target, without revealing any financial figures to
passengers. Tapping it opens an Uber Engine dashboard overlay (DAY and WEEK views)
directly above the live map — Map Engine does **not** navigate away from the map.

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
- Weekly fields mirror the day fields for the Week view.
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

## Example publish

```js
localStorage.setItem("uberEngine.shift.progress", "0.70");
localStorage.setItem("uberEngine.shift.active", "true");
localStorage.setItem("uberEngine.shift.updatedAt", String(Date.now()));
localStorage.setItem("uberEngine.shift.state", JSON.stringify(stateObject));
```

Write all of them together on any shift update. Map Engine will pick the values up on
its next `focus`/`visibility`/`storage` refresh — no polling is needed.

Map Engine consumes the `state` key through a snapshot cached on the raw JSON so that
`useSyncExternalStore` receives referentially stable objects between refreshes; this
avoids the React "Maximum update depth exceeded" loop that an uncached re-parse
object would cause. The modal subtree is also wrapped in an error boundary so a
render failure closes the modal instead of blanking the dashboard.

## Failure behaviour

Map Engine keeps working normally if Uber Engine has never run, no shift exists,
nothing is stored, the data is malformed, it is stale, or Uber Engine is unavailable.
The collapsed bar renders a neutral empty track, the modal shows `Shift data
unavailable`, and the map is unaffected.

## Tapping the bar

A full-width bar at the very bottom of the map is built from rides: each cell is one
ride (roughly £5) towards today's target, filled in as the day's rides come in, turning
green when the goal is reached — without ever revealing figures to passengers. Anonymous
count tokens sit below the strip at intervals of five (1, 5, 10, ...) so the driver can
read off progress without any money showing on screen. Tapping the bar opens the Uber
Engine dashboard overlay directly above the live map: a header stamps `Uber Engine ·
Shift Progress` with the date/time and a live shift-status pill, and the body is a
landscape two-column layout with the earnings donut (plus its slimmer amber inner ring
showing hours worked against the hours needed to reach the planned `targetRate`, e.g.
`4h 48m of 10h to target`) on the left and a 2×3 grid of statistic tiles on the right
(remaining, rides left with a large blue figure, worked, estimated time remaining at the
current rate, your hourly rate, and the target rate; a WEEK view swaps in the weekly
figures). A single bottom control row carries PAUSE/RESUME, UPDATE EARNINGS, END SHIFT
and WEEK VIEW/DAY VIEW; ending a shift reveals the end-of-shift mileage entry, and
UPDATE EARNINGS opens a smaller modal with the current running total, three +/− steppers
(£100/£10/£1), a SAVE & UPDATE action, and a confirmation screen that either returns to
the dashboard or lets the driver adjust the total again. The overlay is sized compact so
the whole dashboard fits a Tesla's landscape browser viewport; navigating away from Map
Engine never happens, and a large close control returns instantly to the map.