import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { validateStyleMin } from "@maplibre/maplibre-gl-style-spec";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(new Request("http://localhost/", { headers: { accept: "text/html" } }), {
    ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
  }, { waitUntil() {}, passThroughOnException() {} });
}

test("renders the Map Engine application shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-cache, no-store, must-revalidate");
  const html = await response.text();
  assert.match(html, /<title>Map Engine — Offline Road Map<\/title>/i);
  assert.match(html, /MAP ENGINE/);
  assert.match(html, /v2\.4\.2/);
  assert.doesNotMatch(html, /Following vehicle/);
  assert.doesNotMatch(html, />CURRENT ROAD</);
  assert.doesNotMatch(html, /Switch to Classic UK map style/);
  assert.match(html, /Your road, at a glance/);
  assert.match(html, /Start live position/);
  assert.match(html, /aria-label="Zoom in"/);
  assert.match(html, /aria-label="Zoom out"/);
  assert.doesNotMatch(html, /aria-label="Enter full screen"/);
  assert.match(html, /aria-label="Show map legend"/);
  assert.match(html, /aria-label="Open destination search"/);
  assert.match(html, /aria-label="Map heading /);
  assert.doesNotMatch(html, />Download<\/b>/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton|Starter Project/i);
});

test("ships PWA and custom UK map configuration", async () => {
  const [manifest, style, serviceWorker, mapEngineEntry, mapEngineCss, globalsCss, safety, offline, postcodes, geocoding, routing, trafficRoute, trafficStatusRoute, trafficIncidentRoute, trafficClient, config, mapTheme, mapNavigation, mapRoutingLayers, safetyLayers, mapHeader, compass, postcodeLookup, destinationSearch, settingsPanel, useTraffic, tomtomClient, routeGraph, routeEngineCore] = await Promise.all([
    readFile(new URL("../public/manifest.webmanifest", import.meta.url), "utf8"),
    readFile(new URL("../public/map-style.json", import.meta.url), "utf8"),
    readFile(new URL("../public/sw.js", import.meta.url), "utf8"),
    readFile(new URL("../app/MapEngine.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/map-engine.css", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/safety.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/offline.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/birmingham-postcodes.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/geocoding.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/routing.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/traffic/[z]/[x]/[y]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/traffic/status/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/traffic/incidents/[z]/[x]/[y]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/traffic.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/map-engine/config.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/map-engine/map-theme.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/map-engine/map-navigation.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/map-engine/map-routing-layers.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/map-engine/safety-layers.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/map-engine/MapHeader.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/map-engine/CompassStrip.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/map-engine/PostcodeLookup.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/map-engine/DestinationSearch.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/map-engine/SettingsPanel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/map-engine/useTraffic.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/tomtom-client.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/route-graph.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/route-engine-core.ts", import.meta.url), "utf8"),
  ]);
  const mapEngine = [mapEngineEntry, trafficClient, tomtomClient, config, mapTheme, mapNavigation, mapRoutingLayers, safetyLayers, mapHeader, compass, postcodeLookup, destinationSearch, settingsPanel, useTraffic].join("\n");
  assert.equal(JSON.parse(manifest).display, "standalone");
  const mapStyle = JSON.parse(style);
  assert.deepEqual(validateStyleMin(mapStyle).map((error) => error.message), []);
  assert.equal(mapStyle.sources.openmaptiles.url, "https://tiles.openfreemap.org/planet");
  assert.equal(mapStyle.layers.find((layer) => layer.id === "road-motorway").paint["line-color"], "#367dbf");
  assert.equal(mapStyle.layers.find((layer) => layer.id === "road-a").paint["line-color"], "#3f7f54");
  assert.equal(mapStyle.layers.find((layer) => layer.id === "road-b").paint["line-color"], "#9fb3be");
  const localRoadWidth = ["interpolate", ["exponential", 1.3], ["zoom"], 5, 0.864, 8, 1.68, 10, 2.88, 12, 4.32, 14, 7.199999999999999, 17, 13.44, 19, 19.2];
  const localRoadCasingWidth = ["interpolate", ["exponential", 1.3], ["zoom"], 5, 1.44, 8, 2.6399999999999997, 10, 4.08, 12, 5.76, 14, 9.12, 17, 16.32, 19, 23.04];
  assert.deepEqual(mapStyle.layers.find((layer) => layer.id === "road-local").paint["line-width"], localRoadWidth);
  assert.deepEqual(mapStyle.layers.find((layer) => layer.id === "road-local-casing").paint["line-width"], localRoadCasingWidth);
  assert.deepEqual(mapStyle.layers.find((layer) => layer.id === "road-b").paint["line-width"], ["interpolate", ["exponential", 1.3], ["zoom"], 5, 1.008, 8, 1.96, 10, 3.36, 12, 5.04, 14, 8.4, 17, 15.68, 19, 22.4]);
  assert.deepEqual(mapStyle.layers.find((layer) => layer.id === "road-b-casing").paint["line-width"], ["interpolate", ["exponential", 1.3], ["zoom"], 5, 1.68, 8, 3.08, 10, 4.76, 12, 6.72, 14, 10.64, 17, 19.04, 19, 26.88]);
  for (const layerId of ["road-motorway", "road-a"]) {
    const width = mapStyle.layers.find((layer) => layer.id === layerId).paint["line-width"];
    assert.equal(width[0], "interpolate");
    assert.deepEqual(width[4].slice(0, 2), ["case", ["==", ["get", "ramp"], 1]]);
    assert.equal(width[4][2], 0.9 * (layerId === "road-motorway" ? 0.45 : 0.75));
  }
  assert.deepEqual(mapStyle.layers.find((layer) => layer.id === "road-a").filter.slice(-2), [["!=", ["get", "class"], "motorway"], ["!=", ["slice", ["coalesce", ["get", "ref"], ""], 0, 1], "M"]]);
  assert.deepEqual(mapStyle.layers.find((layer) => layer.id === "route-a").filter.slice(-1), [["!=", ["get", "class"], "motorway"]]);
  assert.deepEqual(mapStyle.layers.find((layer) => layer.id === "restricted-road").filter, ["match", ["get", "class"], ["busway", "bus_guideway"], true, false]);
  assert.equal(mapStyle.layers.find((layer) => layer.id === "road-name").minzoom, 13);
  const layerIds = mapStyle.layers.map((layer) => layer.id);
  for (const routeLayer of ["route-b", "route-a", "route-motorway"]) {
    assert.ok(layerIds.indexOf("road-name") < layerIds.indexOf(routeLayer));
    assert.equal(mapStyle.layers.find((layer) => layer.id === routeLayer).layout["symbol-placement"], "line-center");
    assert.equal(mapStyle.layers.find((layer) => layer.id === routeLayer).layout["text-rotation-alignment"], "viewport");
    assert.equal(mapStyle.layers.find((layer) => layer.id === routeLayer).layout["text-rotate"], 0);
  }
  assert.ok(mapStyle.layers.find((layer) => layer.id === "restricted-road"));
  assert.ok(mapStyle.layers.find((layer) => layer.id === "restricted-road-label"));
  assert.match(serviceWorker, /map-engine-map-v1/);
  assert.match(serviceWorker, /precacheAppShell/);
  assert.match(serviceWorker, /asset\.startsWith\(`\$\{scopePath\}\/`\)/);
  assert.match(mapEngine, /Night map mode/);
  assert.doesNotMatch(mapEngine, />Modern</);
  assert.doesNotMatch(mapEngine, />Classic UK</);
  assert.doesNotMatch(mapEngine, /quick-style-toggle/);
  assert.match(mapEngine, /const APP_VERSION = "v2\.4\.2"/);
  assert.match(serviceWorker, /map-engine-shell-v1173/);
  assert.ok(mapEngineEntry.split(/\r?\n/).length < 1250, "MapEngine should remain a coordinator rather than regain extracted implementation details");
  assert.doesNotMatch(mapEngineEntry, /function applyMapTheme|function ensureSafetyLayers|function nearestNamedRoad/);
  assert.match(mapEngineEntry, /import\("\.\/lib\/geocoding"\)/);
  assert.match(mapEngineEntry, /import\("\.\/lib\/route-graph"\)/);
  assert.match(mapEngineEntry, /import\("\.\/lib\/offline"\)/);
  assert.match(mapEngine, /ROAD_WIDTH_SCALE = 0\.75/);
  assert.match(mapEngine, /LOCAL_ROAD_WIDTH_SCALE = 0\.48/);
  assert.doesNotMatch(serviceWorker, /skipWaiting/);
  assert.doesNotMatch(serviceWorker, /clients\.claim/);
  assert.doesNotMatch(serviceWorker, /client\.navigate/);
  assert.match(mapEngine, /DEFAULT_START = \{ longitude: -2\.152557, latitude: 52\.556476, zoom: 15\.3 \}/);
  assert.match(mapEngine, /center: \[DEFAULT_START\.longitude, DEFAULT_START\.latitude\]/);
  assert.match(serviceWorker, /event\.request\.mode === "navigate"/);
  assert.match(serviceWorker, /fetch\(event\.request, \{ cache: "no-store" \}\)/);
  assert.match(mapEngine, /updateViaCache: "none"/);
  assert.match(mapEngine, /registration\.update\(\)/);
  assert.match(mapEngine, /map\.on\("idle", onMapIdle\)/);
  assert.match(mapEngine, /scheduleSafetyRefresh\(180\)/);
  assert.match(mapEngineCss, /Tesla's split-screen browser/);
  assert.match(mapEngineCss, /@media \(max-width:1100px\) and \(orientation:landscape\)/);
  assert.match(mapEngineCss, /\.compass-strip \{[^}]+top:14px[^}]+left:50%[^}]+width:280px[^}]+height:42px[^}]+transform:translateX\(-50%\)/);
  assert.doesNotMatch(mapEngineCss, /fullscreen-button/);
  assert.doesNotMatch(mapEngine, /requestFullscreen|exitFullscreen|FullscreenControl/);
  assert.match(mapEngine, /collapseAttributionControl/);
  assert.match(mapEngine, /classList\.remove\("maplibregl-compact-show"\)/);
  assert.match(mapEngineCss, /\.status-icon \{[^}]+width:46px[^}]+height:46px[^}]+border-radius:50%/);
  assert.doesNotMatch(mapEngineCss, /\.download-button/);
  assert.match(mapEngine, /const IS_RAMP = \["==", \["get", "ramp"\], 1\]/);
  assert.match(mapEngine, /compass-strip/);
  assert.match(mapEngine, /MAP_THEME_PAINTS/);
  assert.match(mapEngine, /night: \[/);
  assert.match(mapEngine, /\["road-a", "line-color", "#3f7f54"\]/);
  assert.match(mapEngine, /\["road-b", "line-color", "#9fb3be"\]/);
  assert.match(mapEngine, /\["road-a", "line-color", "#4f9a68"\]/);
  assert.match(mapEngine, /\["road-b", "line-color", "#718792"\]/);
  assert.match(mapEngine, /"tertiary", "#89867f"/);
  assert.match(mapEngine, /"minor", "#aaa69e"/);
  assert.match(mapEngine, /"service", "#b9b6af"/);
  assert.match(mapEngine, /LOCAL_ROAD_CASING_WIDTH = scaleRoadWidth/);
  assert.match(mapEngine, /\["route-a", "text-halo-color", "#28573a"\]/);
  assert.match(mapEngine, /text-allow-overlap/);
  assert.match(mapEngine, /map\.setLayoutProperty\("road-name", "text-ignore-placement", false\)/);
  assert.match(mapEngine, /map\.setLayoutProperty\(layer, "text-allow-overlap", false\)/);
  assert.match(mapEngine, /safety-restricted-label/);
  assert.match(mapEngine, /safety-signal-icon/);
  assert.match(mapEngine, /map\.moveLayer\("safety-signal-icon"\)/);
  assert.match(mapEngine, /createTrafficLightImage/);
  assert.doesNotMatch(mapEngine, /safety-signal-housing/);
  assert.match(mapEngineCss, /background:rgba\(255,253,247,\.97\)/);
  assert.match(mapEngineCss, /\.drive-shell\.dark \.compass-strip[^}]+background:var\(--night-surface\)/);
  assert.match(mapEngineCss, /\.compass-scale span \{[^}]+font-size:14px/);
  assert.match(mapEngineCss, /\.compass-scale span\.is-centre \{[^}]+font-size:19px/);
  assert.match(mapEngineCss, /\.vehicle-map-marker \{[^}]+width:38px[^}]+height:38px[^}]+border-radius:50%/);
  assert.match(mapEngineCss, /\.vehicle-map-marker::after \{[^}]+background:currentColor/);
  assert.match(mapEngineCss, /\.destination-search-toggle/);
  assert.match(mapEngineCss, /\.destination-search-panel/);
  assert.match(globalsCss, /\.brand-lockup strong \{[^}]+font-size:13px/);
  assert.match(globalsCss, /\.brand-lockup \{[^}]+width:145px[^}]+padding:6px 14px 6px 8px/);
  assert.match(globalsCss, /\.brand-version \{[^}]+font-size:9px/);
  assert.match(globalsCss, /\.brand-lockup span:not\(\.brand-mark\) \{[^}]+font-size:10px/);
  assert.match(globalsCss, /\.mode-button \{[^}]+width:46px[^}]+height:46px[^}]+border:2px solid #3179b9[^}]+border-radius:50%/);
  assert.match(mapEngineCss, /\.header-actions \{[^}]+flex-direction:column/);
  assert.match(mapEngine, /dark-mode-button[\s\S]+header-mode-button/);
  assert.match(mapEngineCss, /\.header-actions button\.active \{[^}]+border-color:#398957/);
  assert.match(mapEngineCss, /\.destination-search-toggle \{[^}]+width:56px[^}]+height:56px[^}]+border:2px solid #3179b9[^}]+border-radius:50%/);
  assert.match(mapEngineCss, /\.zoom-controls \{[^}]+right:18px[^}]+bottom:90px[^}]+flex-direction:row/);
  assert.match(mapEngineCss, /\.zoom-controls button \{[^}]+width:56px[^}]+height:56px[^}]+border:2px solid #3179b9[^}]+border-radius:50%/);
  assert.match(globalsCss, /\.location-card \{[^}]+width:min\(330px/);
  assert.doesNotMatch(globalsCss, /\.location-card span \{/);
  assert.match(globalsCss, /\.location-card strong \{[^}]+font-size:18px/);
  assert.match(globalsCss, /\.location-card small \{[^}]+font-size:12px/);
  assert.match(globalsCss, /\.journey-live-stats/);
  assert.match(globalsCss, /\.journey-live-stats b \{[^}]+font-size:10px/);
  assert.match(globalsCss, /\.journey-live-stats em \{[^}]+font-size:16px/);
  assert.match(mapEngine, /safety-camera-lens/);
  assert.match(mapEngine, /vehicleScreenOffset/);
  assert.match(mapEngine, /nearestNamedRoad/);
  assert.match(mapEngine, /directlyUnderPointer/);
  assert.match(mapEngine, /if \(roadQueryTimerRef\.current !== null\) return/);
  assert.match(mapEngine, /latestFixRef\.current \?\? nextFix/);
  assert.match(mapEngine, /transportation_name/);
  assert.match(mapEngine, /delete next\.mapStyle/);
  assert.match(mapEngine, /delete next\.atlasMode/);
  assert.match(mapEngine, /manualZoomRef\.current = nextZoom/);
  assert.doesNotMatch(mapEngine, /const adjustZoom[\s\S]{0,240}changeFollow\(false\)/);
  assert.match(mapEngine, /\["place", "text-color", "#b9c8ce"\]/);
  assert.match(mapEngine, /requestAnimationFrame\(animate\)/);
  assert.doesNotMatch(mapEngine, /setInterval\(.*850/);
  assert.match(mapEngine, /Current road and locality/);
  assert.match(mapEngine, /physical road signs always take priority/);
  assert.match(mapEngine, /map-engine-destination-history-v1/);
  assert.match(mapEngine, /Recent destinations/);
  assert.match(mapEngine, /\.slice\(0, 10\)/);
  assert.match(mapEngine, /Current v1\.16\.1/);
  assert.match(mapEngine, /13, 10\.5, 15, 12\.5, 17, 15\.5, 19, 18/);
  assert.match(mapEngine, /Compatibility v1\.5\.7/);
  assert.match(mapEngine, /map-engine-destination-favourites-v1/);
  assert.match(mapEngine, />Home</);
  assert.match(mapEngine, />Hagley Road</);
  assert.match(mapEngine, /END ROUTE/);
  assert.match(mapEngine, /liveRouteProgress/);
  assert.match(mapEngine, /ARRIVE/);
  assert.match(mapEngine, /DISTANCE/);
  assert.match(mapEngine, /REMAINING/);
  assert.match(mapEngine, /journey-destination/);
  assert.match(mapEngine, /routeDetailsOpen/);
  assert.match(mapEngine, /route-details-toggle/);
  assert.match(mapEngineCss, /\.active-route-panel \{[^}]+bottom:164px/);
  assert.match(mapEngineCss, /\.active-route-panel \{[^}]+width:min\(340px,calc\(100vw - 166px\)\)/);
  assert.match(mapEngineCss, /\.active-route-panel > button:not\(\.route-panel-close\)/);
  assert.match(mapEngine, /active-route-casing/);
  assert.match(mapEngine, /active-route-line/);
  assert.match(mapEngine, /map\.addLayer\(\{[\s\S]+\}, before\)/);
  assert.match(mapEngineCss, /\.active-route-panel/);
  assert.match(mapEngine, /rerouteToDestination/);
  assert.match(mapEngine, /distanceFromRouteMetres/);
  assert.match(mapEngine, /currentRoadRef/);
  assert.match(mapEngine, /Route updated to your current road/);
  assert.match(mapEngine, /Average Speed Zone/);
  assert.match(routing, /router\.project-osrm\.org\/route\/v1\/driving/);
  assert.match(routing, /steps: "true"/);
  assert.match(routing, /geometries: "geojson"/);
  assert.match(routing, /overview: "full"/);
  assert.match(geocoding, /https:\/\/photon\.komoot\.io\/api/);
  assert.match(geocoding, /limit: "12"/);
  assert.match(geocoding, /countrycode: "GB"/);
  assert.match(geocoding, /explicitAddress/);
  assert.match(geocoding, /significantQueryTokens/);
  assert.match(geocoding, /relaxedQuery/);
  assert.match(geocoding, /directPostcodeDestination/);
  assert.match(geocoding, /if \(postcode\) return \[directPostcodeDestination\(cleanedQuery, postcode\)\]/);
  assert.match(mapEngine, /"source-layer": "Traffic flow"/);
  assert.match(mapEngine, /filter: \["<=", \["get", "traffic_level"\], 0\.6\]/);
  assert.match(mapEngine, /"line-color": \["case", \["<=", \["get", "traffic_level"\], 0\.35\], "#6b0f1c", \["<=", \["get", "traffic_level"\], 0\.45\], "#e0242d", "#f2a513"\]/);
  assert.match(mapEngine, /"#f2a513"/);
  assert.doesNotMatch(mapEngine, /"#bd5008"/);
  assert.match(mapEngineCss, /\.traffic-legend i \{[^}]+background:#f2a513/);
  assert.match(mapEngineCss, /\.traffic-legend i\.heavy \{[^}]+background:#e0242d/);
  assert.match(mapEngineCss, /\.traffic-legend i\.severe \{[^}]+background:#6b0f1c/);
  assert.match(trafficRoute, /relative\/\$\{zoom\}\/\$\{column\}\/\$\{row\}\.pbf/);
  assert.match(trafficRoute, /proxyTrafficTile\(url, "flow"\)/);
  assert.match(trafficStatusRoute, /flowSegmentData\/relative\/15\/json/);
  assert.match(trafficStatusRoute, /currentSpeed/);
  assert.match(trafficStatusRoute, /freeFlowSpeed/);
  assert.match(trafficStatusRoute, /confidence/);
  assert.match(trafficIncidentRoute, /tile\/incidents\/\$\{zoom\}\/\$\{column\}\/\$\{row\}\.pbf/);
  assert.match(tomtomClient, /tile\/flow\/relative\/\{z\}\/\{x\}\/\{y\}\.pbf/);
  assert.match(tomtomClient, /tile\/incidents\/\{z\}\/\{x\}\/\{y\}\.pbf/);
  assert.match(tomtomClient, /trafficLevelStep=0\.02/);
  assert.match(mapRoutingLayers, /"source-layer": "Traffic incident POI"/);
  assert.match(mapRoutingLayers, /"source-layer": "Traffic incident flow"/);
  assert.match(mapEngine, /traffic-road-status/);
  assert.match(mapEngine, /TomTom traffic is stale/);
  assert.match(geocoding, /location_bias_scale/);
  assert.match(safety, /traffic_signals/);
  assert.match(safety, /speed_camera/);
  assert.match(safety, /motor_vehicle/);
  assert.match(safety, /motorcar/);
  assert.match(safety, /map-engine-safety-overlay-v14/);
  assert.match(offline, /fetchSafetyFeatures\(centre, radiusKm \* 1_000\)/);
  assert.match(offline, /safetyIncluded: boolean/);
  assert.match(mapEngine, /base map and fetches Safety Pack data/);
  assert.match(safety, /CACHE_MAX_AREAS = 10/);
  assert.match(safety, /clusterTrafficSignals/);
  assert.match(safety, /SIGNAL_CLUSTER_METRES = 60/);
  assert.match(safety, /ROUNDABOUT_SIGNAL_CLUSTER_METRES = 24/);
  assert.match(safety, /ROUNDABOUT_ASSOCIATION_METRES = 45/);
  assert.match(safety, /\["junction"="roundabout"\]/);
  assert.match(safety, /clusterTrafficSignals\(roundaboutSignals, ROUNDABOUT_SIGNAL_CLUSTER_METRES, false\)/);
  assert.match(safety, /Promise\.any/);
  assert.match(safety, /initialDelayMs \+ index \* fallbackDelayMs/);
  assert.match(safety, /fetchOverpass\(trafficQuery, 0, 550\)/);
  assert.match(safety, /fetchOverpass\(restrictionQuery, 120, 650\)/);
  assert.match(safety, /fetchOverpass\(detailQuery, 180, 600\)/);
  assert.match(safety, /nwr\$\{around\}\["enforcement"/);
  assert.match(safety, /average_speed/);
  assert.match(safety, /memberGeometry/);
  assert.match(mapEngine, /waitForMapStyle\(map, controller\.signal\)/);
  assert.match(mapEngine, /ROUTE_TIMEOUT_MS = 18_000/);
  assert.match(mapEngine, /<div className="header-actions">\s*<button className=\{`icon-button settings-button/);
  assert.match(mapEngine, /className="postcode-dock"/);
  assert.match(mapEngine, /className="postcode-lookup-panel"/);
  assert.match(mapEngine, /selected \? null : group\.id/);
  assert.match(mapEngine, /relativePostcodeDirection\(fix, fix\.bearing, postcode\)/);
  assert.match(mapEngine, /AHEAD/);
  assert.match(mapEngine, /BEHIND/);
  assert.match(mapEngineCss, /\.postcode-dock \{[^}]+bottom:10px[^}]+backdrop-filter:blur\(18px\)/);
  assert.match(mapEngineCss, /\.postcode-dock \{[^}]+overflow-x:auto/);
  assert.match(mapEngineCss, /\.postcode-dock::-webkit-scrollbar \{[^}]+display:none/);
  assert.match(mapNavigation, /clientHeight \* 0\.65/);
  assert.match(mapNavigation, /clientHeight \* 0\.15/);
  assert.match(mapEngine, /postcode-range-label/);
  assert.match(mapEngine, /group\.prefix\}\{group\.minimum\}\+/);
  assert.match(mapEngineCss, /\.postcode-range-label \{[^}]+font-size:17px[^}]+font-weight:950/);
  assert.match(mapEngineCss, /\.postcode-dock \{[^}]+left:8px; right:8px/);
  assert.match(mapEngineCss, /\.postcode-dock button \{[^}]+min-width:62px/);
  assert.match(mapEngineCss, /\.postcode-dock button\.selected \{[^}]+border-color:#287848[^}]+background:#398957/);
  assert.match(mapEngine, /speedLimitNearPoint\(safetyDataRef\.current, pointerFix\)/);
  assert.match(mapEngine, /> speedLimitMph \+ 4/);
  assert.match(globalsCss, /\.speed-card \{[^}]+width:86px[^}]+height:86px[^}]+border:3px solid #398957[^}]+border-radius:50%/);
  assert.match(mapEngineCss, /\.speed-card\.speed-warning[^}]+animation:speed-warning-flash/);
  assert.match(mapEngineCss, /\.postcode-lookup-panel \{[^}]+width:min\(80%,820px\)[^}]+height:min\(72dvh,400px\)/);
  assert.match(mapEngineCss, /\.postcode-lookup-grid \{[^}]+grid-template-columns:repeat\(5,minmax\(0,1fr\)\)[^}]+grid-template-rows:repeat\(2,minmax\(0,1fr\)\)/);
  assert.doesNotMatch(mapEngineCss, /\.postcode-lookup-grid \{[^}]+grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(mapEngineCss, /\.postcode-lookup-grid article > span \{[^}]+font-size:14px/);
  assert.match(mapEngineCss, /\.postcode-direction \{[^}]+font-size:12px/);
  assert.deepEqual(
    [...postcodes.matchAll(/buttonLabel: "(B\d+–\d+)"/g)].map((match) => match[1]),
    ["B1–9", "B10–19", "B20–29", "B30–39", "B40–49", "B50–59", "B60–69", "B70–79", "B80–89", "B90–98"],
  );
  const postcodeNumbers = [...postcodes.matchAll(/\{ code: "B(\d+)"/g)].map((match) => Number(match[1]));
  const postcodeRanges = [...postcodes.matchAll(/id: "([a-z0-9]+)", prefix: "([A-Z]+)", buttonLabel: "[^"]+", rangeLabel: "[^"]+", minimum: (\d+), maximum: (\d+)/g)].map((match) => ({ id: match[1], prefix: match[2], minimum: Number(match[3]), maximum: Number(match[4]) }));
  assert.equal(postcodeRanges.length, 10);
  assert.match(postcodes, /\.\.\.\["WV", "DY", "CV"\]\.flatMap/);
  assert.match(postcodes, /postcode\.code\.startsWith\(prefix\)/);
  assert.match(postcodes, /id: `\$\{prefix\.toLowerCase\(\)\}\$\{number\}`/);
  assert.match(postcodes, /buttonLabel: `\$\{prefix\}\$\{number\}`/);
  for (const group of postcodeRanges) {
    if (!group.id.startsWith("b")) continue;
    assert.ok(postcodeNumbers.filter((postcode) => postcode >= group.minimum && postcode <= group.maximum).length <= 10);
  }
  assert.equal([...postcodes.matchAll(/\{ code: "B\d+"/g)].length, 77);
  assert.match(postcodes, /relativePostcodeDirection/);
  assert.match(postcodes, /absoluteDifference <= 45/);
  assert.match(postcodes, /absoluteDifference >= 135/);
  assert.match(postcodes, /code: "B31", areas: "Northfield · Longbridge · West Heath"/);
  assert.match(postcodes, /code: "WV1", areas: "Wolverhampton City Centre"/);
  assert.match(postcodes, /code: "DY5", areas: "Brierley Hill · Netherton"|code: "DY13", areas: "Stourport-on-Severn"/);
  assert.match(postcodes, /code: "CV34", areas: "Warwick · Woodloes Park"/);
  assert.match(postcodes, /POSTCODE_SECTORS/);
  assert.match(postcodes, /if \(sectors && sectors\.length\) return sectors/);
  assert.match(postcodes, /code: "WV3 1", areas: "Compton east · St Andrew's"/);
  assert.match(postcodes, /code: "WV3 2", areas: "West Park · Woodfield"/);
  assert.match(postcodes, /code: "WV10 6", areas: "New Cross"/);
  assert.match(postcodes, /code: "WV14 9", areas: "Ettingshall"/);
  assert.match(postcodes, /code: "WV7", areas: "Albrighton · Donington · Ryton"/);
  assert.match(postcodes, /code: "WV7 1", areas: "Albrighton town"/);
  assert.match(postcodes, /code: "WV7 3", areas: "Donington"/);
  assert.match(safety, /onTrafficSignals\?\.\(signals\)/);
  assert.match(safety, /publishRestrictions\(curated\)/);
  assert.match(safety, /Math\.min\(radiusMetres, 2_400\)/);
  assert.match(safety, /fetchOverpass\(busLaneQuery, 40, 550\)/);
  assert.match(safety, /fetchOverpass\(closureQuery, 80, 600\)/);
  assert.match(safety, /roadClosureFeatures/);
  assert.match(safety, /road_closure/);
  assert.match(safety, /roadWorksFeatures/);
  assert.match(safety, /roadworks/);
  assert.match(safety, /\["highway"="construction"\]/);
  assert.match(safety, /"speed_bump"/);
  assert.match(safety, /traffic_calming/);
  assert.match(safety, /Average speed/);
  assert.match(safety, /const motorRoad/);
  assert.match(safety, /curated\/pipers-row-bus-lane/);
  assert.match(safety, /radiusMetres = 2_800/);
  assert.doesNotMatch(safety, /\["crossing"="traffic_signals"\]/);
  assert.match(safety, /busway:left/);
  assert.match(safety, /busway:right/);
  assert.match(safety, /bus:lanes/);
  assert.match(safety, /isExplicitBusLane/);
  assert.doesNotMatch(safety, /lanes:bus/);
  assert.doesNotMatch(safety, /way\$\{around\}\["highway"\]\["access"~"\^\(no\|private\)\$"\];/);
  assert.match(safety, /maps\.mail\.ru\/osm\/tools\/overpass/);
  assert.match(safety, /overpass\.kumi\.systems\/api\/interpreter/);
  assert.match(safety, /overpass-api\.de\/api\/interpreter/);
  assert.match(safety, /BUS LANE/);
  assert.match(safety, /BUS GATE/);
  assert.match(safety, /roadRuleQuery/);
  assert.match(safety, /amenityQuery/);
  assert.match(safety, /one_way/);
  assert.match(safety, /turn_restriction/);
  assert.match(safety, /speed_limit/);
  assert.match(safety, /rail_crossing/);
  assert.match(safety, /dimension_limit/);
  assert.match(safety, /clean_air_zone/);
  assert.match(safety, /charging_station/);
  assert.match(mapEngine, /safety-one-way-arrows/);
  assert.match(mapEngine, /\["1", "-1", "true", "yes"\]/);
  assert.match(mapEngine, /safety-road-closure-line/);
  assert.match(mapEngine, /safety-road-closure-markers/);
  assert.match(mapEngine, /map-engine-road-closure/);
  assert.match(mapEngine, /safety-roadworks-line/);
  assert.match(mapEngine, /safety-roadworks-markers/);
  assert.match(mapEngine, /map-engine-roadworks/);
  assert.match(mapEngine, /safety-speed-bump/);
  assert.match(mapEngine, /map-engine-speed-bump/);
  assert.match(mapEngine, /"source-layer": "transportation"/);
  assert.match(mapEngine, /createOneWayArrowImage/);
  assert.match(config, /routeProfile: RouteProfile/);
  assert.match(config, /routeProfile: "fast"/);
  assert.match(destinationSearch, /Route calculation preference/);
  assert.match(destinationSearch, /route-preference/);
  assert.match(destinationSearch, /aria-label="Route calculation preference"/);
  assert.match(destinationSearch, /Avoid narrow lanes/);
  assert.match(destinationSearch, /Best time/);
  assert.match(settingsPanel, /Choose how routes are calculated/);
  assert.doesNotMatch(settingsPanel, /route-profile-setting|onRouteProfile|Route calculation preference/);
  assert.match(mapEngine, /route-options/);
  assert.match(mapEngine, /chooseRouteOption/);
  assert.match(mapEngine, /calculateRouteOptions\(origin, destination, controller\.signal\)/);
  assert.match(mapEngine, /onRouteProfile:/);
  assert.match(mapEngine, /country-lane-note/);
  assert.match(mapEngine, /finalMinorRoadMiles/);
  assert.match(mapEngine, /Main-road route unavailable/);
  assert.match(routeGraph, /map-engine-route-corridor-v2/);
  assert.match(routeGraph, /DRIVABLE_HIGHWAY/);
  assert.match(routeGraph, /out body;/);
  assert.match(routeGraph, /minorRoadMiles: plan\.minorMetres \/ 1609\.344/);
  assert.match(routeGraph, /fallback: true/);
  assert.match(routeEngineCore, /CLASS_PENALTY/);
  assert.match(routeEngineCore, /CLASS_PENALTY_FAST/);
  assert.match(routeEngineCore, /CLASS_PENALTY_SHORT/);
  assert.match(routeEngineCore, /RouteProfile/);
  assert.match(routeEngineCore, /motorway: 65/);
  assert.match(routeEngineCore, /track: 5\.2/);
  assert.match(routeEngineCore, /roadWeightPerMetre/);
  assert.match(routeEngineCore, /roadModifiers/);
  assert.match(routeEngineCore, /oneWayOf/);
  assert.match(routeEngineCore, /junction === "roundabout"/);
  assert.match(routeEngineCore, /buildRoadGraph/);
  assert.match(routeEngineCore, /findShortestPath/);
  assert.match(routeEngineCore, /finalMinorMetres/);
  assert.match(routeEngineCore, /buildTurnInstruction/);
  assert.match(mapEngineCss, /\.country-lane-note \{/);
  assert.match(mapEngine, /map-engine-one-way-arrow/);
  assert.match(mapEngine, /Show parking and EV chargers/);
  assert.doesNotMatch(mapEngine, /Developer diagnostics/);
  assert.doesNotMatch(mapEngine, /LAT&nbsp;/);
});
