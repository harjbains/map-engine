# Uber Engine ↔ Map Engine Shift Integration

Map Engine shows a large, tappable Tesla-friendly shift control representing progress
towards the day's Uber earnings target, without revealing any financial figures to
passengers. Tapping it opens an Uber Engine dashboard overlay (DAY and WEEK views)
directly above the live map — Map Engine does **not** navigate away from the map.

Map Engine **consumes** this contract. Uber Engine **publishes** it. Map Engine never
reads any other Uber Engine storage, and Uber Engine never touches Map Engine's map or
UI. All detailed earnings, hours and target figures stay inside Uber Engine with the
single documented exception below (the total-sync write-back).

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
  "dailyTarget": 150,
  "todayEarnings": 105,
  "dailyProgress": 0.7,
  "remaining": 45,
  "targetUnitsRemaining": 9,
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
- `targetUnitsRemaining` is the remaining amount expressed as whole £5 units
  (e.g. £45 remaining → `9`).
- `hourlyRate` is today's realised rate; `targetRate` is the planned per-hour rate.
- Weekly fields mirror the day fields for the Week view.
- `updatedAt` is epoch ms. If the object is older than 12 hours Map Engine treats it
  as unavailable rather than showing outdated figures.
- A missing or corrupt object shows `Shift data unavailable` inside the modal. The
  map, the collapsed bar and every other Map Engine feature are unaffected.

## Total-sync write-back (`uberEngine.shift.syncRequest`)

The modal's **SYNC TODAY'S TOTAL / UPDATE TODAY'S TOTAL** flow lets the driver set
today's running total from the Uber Driver app. Map Engine writes a single
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

## Example publish

```js
localStorage.setItem("uberEngine.shift.progress", "0.70");
localStorage.setItem("uberEngine.shift.active", "true");
localStorage.setItem("uberEngine.shift.updatedAt", String(Date.now()));
localStorage.setItem("uberEngine.shift.state", JSON.stringify(stateObject));
```

Write all of them together on any shift update. Map Engine will pick the values up on
its next `focus`/`visibility`/`storage` refresh — no polling is needed.

## Failure behaviour

Map Engine keeps working normally if Uber Engine has never run, no shift exists,
nothing is stored, the data is malformed, it is stale, or Uber Engine is unavailable.
The collapsed bar renders a neutral empty track, the modal shows `Shift data
unavailable`, and the map is unaffected.

## Tapping the bar

Tapping the bar opens the Uber Engine dashboard overlay (DAY donut, remaining and
worked-time panels, WEEK view, SYNC TODAY'S TOTAL) directly above the live map. No
navigation away from Map Engine happens, and a large close control returns instantly
to the map.