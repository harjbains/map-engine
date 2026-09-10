# Uber Engine → Map Engine Shift Progress Integration

Map Engine shows a discreet, tappable progress bar that represents progress towards
the day's Uber earnings target, without revealing any financial figures to passengers.

Map Engine **consumes** this contract. Uber Engine **publishes** it. Map Engine never
reads any other Uber Engine storage, and Uber Engine never touches Map Engine's map or
UI. All detailed earnings, hours and target figures stay inside Uber Engine.

## Origin note

- Map Engine: `https://harjbains.github.io/map-engine/`
- Uber Engine: `https://harjbains.github.io/uber-engine/`

Both apps share the `harjbains.github.io` browser origin, so a single namespaced
`localStorage` is visible to both. The keys below are the complete integration surface.

## Published keys

Uber Engine writes three optional keys into `localStorage`:

| Key                        | Type              | Required | Meaning                                    |
| -------------------------- | ----------------- | -------- | ------------------------------------------ |
| `uberEngine.shift.progress` | string fraction   | Yes*     | Daily earnings target progress, `0`–`1`.   |
| `uberEngine.shift.active`   | `"true"`/`"false"`| No       | Whether a shift is currently running.      |
| `uberEngine.shift.updatedAt`| epoch ms or ISO   | No       | When the value was last published.         |

\* If `uberEngine.shift.progress` is missing or unreadable, Map Engine hides the bar.

## Value formats

- `uberEngine.shift.progress` — a plain fraction string, e.g. `"0.70"` for 70%.
  Values outside `0`–`1` are clamped; anything non-numeric hides the bar.
- `uberEngine.shift.active` — `"true"` or `"false"`. When `"false"` (or the shift has
  ended), Map Engine hides the bar. If the key is absent, the shift is treated as active.
- `uberEngine.shift.updatedAt` — epoch milliseconds (e.g. `"1736452800000"`) or an
  ISO-8601 date string. If the value is older than 12 hours, Map Engine hides the bar so
  it never shows outdated progress. An unreadable value is ignored (does not hide).

## Example

```js
localStorage.setItem("uberEngine.shift.progress", "0.70");
localStorage.setItem("uberEngine.shift.active", "true");
localStorage.setItem("uberEngine.shift.updatedAt", String(Date.now()));
```

Write all three together on any shift update. Map Engine will pick the values up on its
next `focus`/`visibility`/`storage` refresh — no polling is needed.

## Failure behaviour

Map Engine keeps working normally if Uber Engine has never run, no shift exists,
nothing is stored, the data is malformed, it is stale, or Uber Engine is unavailable.
In every case the progress bar is simply hidden and the map is unaffected.

## Tapping the bar

Tapping the bar navigates Map Engine to `https://harjbains.github.io/uber-engine/`
(the Uber Engine dashboard). Uber Engine is responsible for its own "return to Map
Engine" link so the driver can switch back after the progress detail has been viewed.