# Map Engine

Map Engine is a fully web-based, installable UK driving map. It uses MapLibre GL JS with OpenFreeMap/OpenStreetMap vector data, a custom light road-atlas style, smooth GPS follow, heading-up 3D presentation, dynamic zoom, and an original vehicle chevron. It deliberately has no destination search, route planning, ETA, directions, traffic, or navigation prompts.

## Run locally

```text
npm install
npm run dev
```

Open the printed local URL in Chrome or Edge. The app needs HTTPS (or localhost) for browser geolocation and service-worker storage.

### Desktop location testing

For a static location, open browser developer tools and choose **More tools → Sensors**, then select or enter a location. To test realistic motion, open Map Engine Settings, enable **Developer diagnostics**, and select **Start desktop simulated drive**. The simulator moves through Birmingham with changing speed and heading and never sends data anywhere.

## Offline use

The normal testing view uses OpenFreeMap online. For vehicle use, start live position, open Settings, and download a 12 km or 25 km pack centred on the current position. The app shell, light map style, fonts, source metadata, and requested vector tiles are stored in browser Cache Storage. Saved files are cache-first and never refreshed automatically. Install the app from the browser for a fullscreen landscape experience.

Browser quotas vary. A 25 km pack can be large, so the 12 km pack is the safer starting point. The first download requires a connection; GPS follow itself does not.

## Road styling

- motorways: blue, with the strongest casing
- A roads: red
- B roads: gold/yellow
- local roads: restrained off-white with grey casing
- water: subdued blue; vegetation: pale green; buildings: low-contrast 3D

Route-reference prefixes (`M`, `A`, and `B`) take priority, with OpenMapTiles `motorway`, `trunk`/`primary`, and `secondary` classes as fallbacks. POI and business layers are omitted.

## Architecture

- `app/MapEngine.tsx` — live map, permission flow, controls, settings, diagnostics, and desktop simulator
- `app/lib/driving.ts` — speed conversion, smoothing, bearing wrap-around, dynamic zoom, and look-ahead geometry
- `app/lib/offline.ts` — explicit offline region planning and bounded concurrent downloads
- `public/map-style.json` — provider-isolated MapLibre road style
- `public/sw.js` — installable app shell and cache-first map resources
- `public/manifest.webmanifest` — landscape PWA configuration

## Build and test

```text
npm run build
npm test
```

## Git and deployment

The app builds and runs from this repository. Docker/build dependencies are
managed with npm and the production target is a Cloudflare Worker (see
`vite.config.ts` and `worker/`).

```text
npm install
npm run build
```

## Known limitations

Current-road identification queries rendered features and can be ambiguous at stacked junctions. OpenFreeMap uses a general OpenMapTiles schema, so unreferenced `primary`/`trunk` and `secondary` roads use A/B fallback colours. Offline coverage is explicitly downloaded around one centre and is limited by browser storage; a nationwide UK pack is not practical in ordinary browser storage.

## Future Development

- multiple named offline packs
- packaged regional UK vector archives
- speed cameras
- roadworks and closures
- speed limits
- optional dark/night palette
