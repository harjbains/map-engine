"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import maplibregl from "maplibre-gl";
import { dynamicZoom, smooth, smoothBearing, toMph, type Point } from "./lib/driving";
import type { PostcodeGroupId } from "./lib/birmingham-postcodes";
import { fetchSafetyFeatures, readCachedSafetyFeatures, type SafetyFeatureCollection } from "./lib/safety";
import { CompassStrip } from "./map-engine/CompassStrip";
import { DestinationSearch } from "./map-engine/DestinationSearch";
import { MapHeader } from "./map-engine/MapHeader";
import { PostcodeLookup } from "./map-engine/PostcodeLookup";
import { SettingsPanel } from "./map-engine/SettingsPanel";
import { DEFAULT_SETTINGS, DEFAULT_START, ROUTE_TIMEOUT_MS, STORAGE_KEYS, type ActiveRoute, type Destination, type DestinationFavourites, type InstallPromptEvent, type OfflinePack, type Settings, type VehicleFix } from "./map-engine/config";
import { distanceKm, liveRouteProgress, nearestLocality, nearestNamedRoad, positionVehicleMarker, roadFeatureLabel, vehicleScreenOffset } from "./map-engine/map-navigation";
import { collapseAttributionControl, ensureRouteLayers, ensureTrafficLayer, formatMiles, setRouteData, setTrafficVisibility, waitForMapStyle } from "./map-engine/map-routing-layers";
import { applyMapTheme } from "./map-engine/map-theme";
import { ensureSafetyLayers, mergeSafetyData, setDriverAmenitiesVisibility, setSafetyData, speedLimitNearPoint } from "./map-engine/safety-layers";
import { useTraffic } from "./map-engine/useTraffic";
const ROAD_LAYERS = ["road-motorway", "road-a", "road-b", "road-local"];
export default function MapEngine() {
  const mapNode = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const vehicleElementRef = useRef<HTMLDivElement>(null);
  const latestFixRef = useRef<VehicleFix | null>(null);
  const watchRef = useRef<number | null>(null);
  const orientationBoundRef = useRef(false);
  const locationActiveRef = useRef(false);
  const roadQueryTimerRef = useRef<number | null>(null);
  const deviceHeadingRef = useRef<number | null>(null);
  const smoothedRef = useRef<{ lat: number | null; lon: number | null; speed: number | null; bearing: number | null }>({ lat: null, lon: null, speed: null, bearing: null });
  const settingsRef = useRef(DEFAULT_SETTINGS);
  const followRef = useRef(false);
  const is3dRef = useRef(true);
  const abortPackRef = useRef<AbortController | null>(null);
  const destinationSearchAbortRef = useRef<AbortController | null>(null);
  const destinationInputRef = useRef<HTMLInputElement>(null);
  const routeAbortRef = useRef<AbortController | null>(null);
  const destinationMarkerRef = useRef<maplibregl.Marker | null>(null);
  const simulationRef = useRef<number | null>(null);
  const simulationActiveRef = useRef(false);
  const lastViewUpdateRef = useRef(0);
  const manualZoomRef = useRef<number | null>(null);
  const safetyDataRef = useRef<SafetyFeatureCollection | null>(null);

  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [is3d, setIs3d] = useState(true);
  const [follow, setFollow] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [locationState, setLocationState] = useState<"idle" | "requesting" | "active" | "denied" | "unavailable">("idle");
  const [fix, setFix] = useState<VehicleFix | null>(null);
  const [currentRoad, setCurrentRoad] = useState<string | null>(null);
  const [currentLocality, setCurrentLocality] = useState<string | null>(null);
  const [speedLimitMph, setSpeedLimitMph] = useState<number | null>(null);
  const [mapMessage, setMapMessage] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const [offlinePack, setOfflinePack] = useState<OfflinePack | null>(null);
  const [packRadius, setPackRadius] = useState(12);
  const [packProgress, setPackProgress] = useState<{ done: number; total: number } | null>(null);
  const [packError, setPackError] = useState<string | null>(null);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [viewBearing, setViewBearing] = useState(-12);
  const [searchOpen, setSearchOpen] = useState(false);
  const [destinationQuery, setDestinationQuery] = useState("");
  const [destinationResults, setDestinationResults] = useState<Destination[]>([]);
  const [recentDestinations, setRecentDestinations] = useState<Destination[]>([]);
  const [destinationFavourites, setDestinationFavourites] = useState<DestinationFavourites>({});
  const [destinationSearching, setDestinationSearching] = useState(false);
  const [destinationSearchAttempted, setDestinationSearchAttempted] = useState(false);
  const [destinationSearchError, setDestinationSearchError] = useState<string | null>(null);
  const [activeRoute, setActiveRoute] = useState<ActiveRoute | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeClock, setRouteClock] = useState(0);
  const [routeDetailsOpen, setRouteDetailsOpen] = useState(false);
  const [openPostcodeGroup, setOpenPostcodeGroup] = useState<PostcodeGroupId | null>(null);

  const traffic = useTraffic({ mapRef, latestFixRef, mapReady, enabled: settings.liveTraffic, online });

  const changeFollow = useCallback((next: boolean) => {
    followRef.current = next;
    setFollow(next);
  }, []);

  useEffect(() => {
    const initialiseFromBrowserStorage = () => {
      try {
        const saved = localStorage.getItem(STORAGE_KEYS.settings);
        if (saved) {
          const next = {
            ...DEFAULT_SETTINGS,
            ...JSON.parse(saved) as Partial<Settings>,
          } as Settings & { mapStyle?: unknown; atlasMode?: unknown };
          delete next.mapStyle;
          delete next.atlasMode;
          setSettings(next);
          settingsRef.current = next;
          setIs3d(next.default3d);
          is3dRef.current = next.default3d;
        }
        const pack = localStorage.getItem(STORAGE_KEYS.offlinePack);
        if (pack) setOfflinePack(JSON.parse(pack) as OfflinePack);
        const destinationHistory = localStorage.getItem(STORAGE_KEYS.destinationHistory);
        if (destinationHistory) {
          const savedDestinations = JSON.parse(destinationHistory) as Destination[];
          if (Array.isArray(savedDestinations)) setRecentDestinations(savedDestinations.slice(0, 10));
        }
        const destinationFavourites = localStorage.getItem(STORAGE_KEYS.destinationFavourites);
        if (destinationFavourites) setDestinationFavourites(JSON.parse(destinationFavourites) as DestinationFavourites);
      } catch { /* Ignore corrupt local preferences and use safe defaults. */ }
      setOnline(navigator.onLine);
    };
    const initialiseTimer = window.setTimeout(initialiseFromBrowserStorage, 0);
    const onlineHandler = () => setOnline(true);
    const offlineHandler = () => setOnline(false);
    window.addEventListener("online", onlineHandler);
    window.addEventListener("offline", offlineHandler);
    const refreshUrl = new URL(window.location.href);
    if (refreshUrl.searchParams.has("map-engine-refresh")) {
      refreshUrl.searchParams.delete("map-engine-refresh");
      window.history.replaceState(window.history.state, "", `${refreshUrl.pathname}${refreshUrl.search}${refreshUrl.hash}`);
    }
    navigator.serviceWorker?.register("/sw.js", { updateViaCache: "none" })
      .then((registration) => registration.update())
      .catch(() => setMapMessage("Offline app storage could not be started."));
    const installHandler = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", installHandler);
    return () => {
      window.clearTimeout(initialiseTimer);
      window.removeEventListener("online", onlineHandler);
      window.removeEventListener("offline", offlineHandler);
      window.removeEventListener("beforeinstallprompt", installHandler);
    };
  }, []);

  useEffect(() => {
    settingsRef.current = settings;
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
    const map = mapRef.current;
    if (map?.isStyleLoaded()) {
      applyMapTheme(map, settings.darkMode);
      if (map.getLayer("building-3d")) {
        map.setLayoutProperty("building-3d", "visibility", settings.showBuildings && is3d ? "visible" : "none");
      }
      setDriverAmenitiesVisibility(map, settings.showDriverAmenities);
      setTrafficVisibility(map, settings.liveTraffic && traffic.configured === true && online);
      if (followRef.current) map.easeTo({ pitch: is3d ? settings.pitch : 0, duration: 350 });
    }
  }, [settings, is3d, traffic.configured, online]);

  useEffect(() => {
    if (!searchOpen) return;
    const frame = window.requestAnimationFrame(() => destinationInputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [searchOpen]);

  useEffect(() => {
    if (!activeRoute) return;
    const timer = window.setInterval(() => setRouteClock(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, [activeRoute]);

  useEffect(() => {
    if (!mapNode.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: mapNode.current,
      style: "/map-style.json",
      center: [DEFAULT_START.longitude, DEFAULT_START.latitude],
      zoom: DEFAULT_START.zoom,
      pitch: 55,
      bearing: -12,
      attributionControl: { compact: true },
      maxPitch: 65,
      touchPitch: true,
      dragPan: true,
      scrollZoom: true,
      touchZoomRotate: true,
      doubleClickZoom: true,
      keyboard: true,
    });
    mapRef.current = map;
    collapseAttributionControl(map);
    let safetyPending = false;
    let lastSafetyCentre: Point | null = null;
    let lastSafetyTime = 0;
    let visibleSafety: SafetyFeatureCollection | null = null;
    let safetyRetryTimer: number | null = null;
    const showSafety = (data: SafetyFeatureCollection) => {
      visibleSafety = data;
      safetyDataRef.current = data;
      setSafetyData(map, data);
    };
    const scheduleSafetyRefresh = (delayMs = 0) => {
      if (safetyRetryTimer !== null) window.clearTimeout(safetyRetryTimer);
      safetyRetryTimer = window.setTimeout(() => {
        safetyRetryTimer = null;
        void refreshSafety();
      }, delayMs);
    };
    const refreshSafety = async () => {
      if (!navigator.onLine || safetyPending || map.getZoom() < 12.5) return;
      if (!map.isStyleLoaded()) {
        scheduleSafetyRefresh(180);
        return;
      }
      const centre = map.getCenter();
      const point = { latitude: centre.lat, longitude: centre.lng };
      const nearbyCached = readCachedSafetyFeatures(point);
      if (nearbyCached) showSafety(nearbyCached);
      if (lastSafetyCentre && distanceKm(point, lastSafetyCentre) < 1.8 && Date.now() - lastSafetyTime < 600_000) return;
      safetyPending = true;
      lastSafetyCentre = point;
      lastSafetyTime = Date.now();
      try {
        const showPartialSafety = (partial: SafetyFeatureCollection, replacedKinds: Set<string>) => {
          const retainedFeatures: SafetyFeatureCollection = {
            type: "FeatureCollection",
            features: (visibleSafety ?? nearbyCached)?.features.filter((feature) => !replacedKinds.has(feature.properties.kind)) ?? [],
          };
          showSafety(mergeSafetyData(retainedFeatures, partial));
        };
        const completeSafety = await fetchSafetyFeatures(
          point,
          4_200,
          (trafficSignals) => showPartialSafety(trafficSignals, new Set(["traffic_signal"])),
          (restrictions) => showPartialSafety(restrictions, new Set(["restricted", "restriction_entrance"])),
          (roadRules) => showPartialSafety(roadRules, new Set(roadRules.features.map((feature) => feature.properties.kind))),
          (amenities) => showPartialSafety(amenities, new Set(amenities.features.map((feature) => feature.properties.kind))),
          (closures) => showPartialSafety(closures, new Set(["road_closure"])),
        );
        showSafety(mergeSafetyData(nearbyCached, completeSafety));
      } catch { /* Keep the last cached OSM safety overlay when the service is unavailable. */ }
      finally { safetyPending = false; }
    };
    map.on("load", () => {
      collapseAttributionControl(map);
      ensureRouteLayers(map);
      ensureTrafficLayer(map);
      setTrafficVisibility(map, false);
      ensureSafetyLayers(map);
      setDriverAmenitiesVisibility(map, settingsRef.current.showDriverAmenities);
      const initialCentre = map.getCenter();
      const cachedSafety = readCachedSafetyFeatures({ latitude: initialCentre.lat, longitude: initialCentre.lng });
      if (cachedSafety) showSafety(cachedSafety);
      applyMapTheme(map, settingsRef.current.darkMode);
      setMapReady(true);
      setMapMessage(null);
      scheduleSafetyRefresh(0);
    });
    const refreshSafetyWhenSettled = () => scheduleSafetyRefresh(0);
    map.on("idle", refreshSafetyWhenSettled);
    map.on("error", () => {
      if (!navigator.onLine) setMapMessage("Offline map data is missing here. Reconnect and save this area first.");
    });
    const canvasContainer = map.getCanvasContainer();
    const manualInput = () => {
      map.stop();
      changeFollow(false);
    };
    canvasContainer.addEventListener("pointerdown", manualInput, { passive: true });
    canvasContainer.addEventListener("wheel", manualInput, { passive: true });
    canvasContainer.addEventListener("dblclick", manualInput, { passive: true });
    canvasContainer.addEventListener("keydown", manualInput);
    map.on("move", () => {
      const now = performance.now();
      if (now - lastViewUpdateRef.current >= 180) {
        lastViewUpdateRef.current = now;
        setViewBearing(map.getBearing());
      }
      const vehicle = vehicleElementRef.current;
      const latestFix = latestFixRef.current;
      if (vehicle && latestFix) {
        positionVehicleMarker(map, vehicle, latestFix, followRef.current);
      }
    });
    map.on("moveend", refreshSafety);
    return () => {
      canvasContainer.removeEventListener("pointerdown", manualInput);
      canvasContainer.removeEventListener("wheel", manualInput);
      canvasContainer.removeEventListener("dblclick", manualInput);
      canvasContainer.removeEventListener("keydown", manualInput);
      map.off("moveend", refreshSafety);
      map.off("idle", refreshSafetyWhenSettled);
      if (safetyRetryTimer !== null) window.clearTimeout(safetyRetryTimer);
      map.remove();
      mapRef.current = null;
    };
  }, [changeFollow]);

  useEffect(() => () => {
    if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
    if (simulationRef.current !== null) window.cancelAnimationFrame(simulationRef.current);
    if (roadQueryTimerRef.current !== null) window.clearTimeout(roadQueryTimerRef.current);
    abortPackRef.current?.abort();
    destinationSearchAbortRef.current?.abort();
    routeAbortRef.current?.abort();
    destinationMarkerRef.current?.remove();
  }, []);

  const renderFixOnMap = useCallback((nextFix: VehicleFix) => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const vehicle = vehicleElementRef.current;
    if (vehicle) {
      positionVehicleMarker(map, vehicle, nextFix, followRef.current);
    }
    if (followRef.current) {
      map.stop();
      map.easeTo({
        center: [nextFix.longitude, nextFix.latitude],
        offset: vehicleScreenOffset(map),
        bearing: nextFix.bearing,
        pitch: is3dRef.current ? settingsRef.current.pitch : 0,
        zoom: manualZoomRef.current ?? (settingsRef.current.autoZoom ? dynamicZoom(nextFix.speedMph) : map.getZoom()),
        duration: 360,
        essential: true,
      });
    }
    if (roadQueryTimerRef.current !== null) return;
    roadQueryTimerRef.current = window.setTimeout(() => {
      roadQueryTimerRef.current = null;
      if (!map.isStyleLoaded()) return;
      const pointerFix = latestFixRef.current ?? nextFix;
      setSpeedLimitMph(speedLimitNearPoint(safetyDataRef.current, pointerFix));
      const namedRoad = nearestNamedRoad(map, pointerFix);
      if (namedRoad) {
        setCurrentRoad(namedRoad);
      } else {
        const point = map.project([pointerFix.longitude, pointerFix.latitude]);
        const availableLayers = ROAD_LAYERS.filter((id) => Boolean(map.getLayer(id)));
        const feature = map.queryRenderedFeatures([[point.x - 18, point.y - 18], [point.x + 18, point.y + 18]], { layers: availableLayers })[0];
        const renderedRoad = feature ? roadFeatureLabel(feature) : null;
        if (renderedRoad) setCurrentRoad(renderedRoad);
      }
      const locality = nearestLocality(map, pointerFix);
      if (locality) setCurrentLocality(locality);
    }, 90);
  }, []);

  const applyPosition = useCallback((position: GeolocationPosition) => {
    const coords = position.coords;
    const speedMps = Math.max(0, coords.speed ?? 0);
    const smoothing = smoothedRef.current;
    smoothing.lat = smooth(smoothing.lat, coords.latitude, 0.38);
    smoothing.lon = smooth(smoothing.lon, coords.longitude, 0.38);
    smoothing.speed = smooth(smoothing.speed, toMph(speedMps), 0.24);
    const reliableGpsBearing = coords.heading !== null && speedMps >= 2.2 ? coords.heading : null;
    const lowSpeedBearing = speedMps >= 0.8 ? deviceHeadingRef.current : null;
    const targetBearing = reliableGpsBearing ?? lowSpeedBearing ?? smoothing.bearing ?? 0;
    smoothing.bearing = smoothBearing(smoothing.bearing, targetBearing, 0.3);
    const nextFix: VehicleFix = {
      latitude: smoothing.lat,
      longitude: smoothing.lon,
      accuracy: coords.accuracy,
      speedMph: smoothing.speed,
      bearing: smoothing.bearing,
    };
    latestFixRef.current = nextFix;
    setFix(nextFix);
    locationActiveRef.current = true;
    setLocationState("active");
    setMapMessage(null);
  }, []);

  useEffect(() => {
    if (mapReady && fix && !simulationActiveRef.current) renderFixOnMap(fix);
  }, [fix, mapReady, renderFixOnMap]);

  const startLocation = useCallback(async () => {
    if (!navigator.geolocation) {
      setLocationState("unavailable");
      return;
    }
    setLocationState("requesting");
    locationActiveRef.current = false;
    setMapMessage(null);
    changeFollow(true);
    if (typeof DeviceOrientationEvent !== "undefined" && !orientationBoundRef.current) {
      const orientationType = DeviceOrientationEvent as typeof DeviceOrientationEvent & { requestPermission?: () => Promise<string> };
      if (orientationType.requestPermission) {
        try { await orientationType.requestPermission(); } catch { /* GPS bearing remains available while moving. */ }
      }
      const orientationHandler = (event: DeviceOrientationEvent) => {
        const webkitHeading = (event as DeviceOrientationEvent & { webkitCompassHeading?: number }).webkitCompassHeading;
        const heading = webkitHeading ?? (event.alpha === null ? null : (360 - event.alpha) % 360);
        if (heading !== null) deviceHeadingRef.current = heading;
      };
      window.addEventListener("deviceorientationabsolute", orientationHandler as EventListener, { passive: true });
      window.addEventListener("deviceorientation", orientationHandler, { passive: true });
      orientationBoundRef.current = true;
    }
    if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
    const locationError = (error: GeolocationPositionError) => {
      if (locationActiveRef.current && error.code !== error.PERMISSION_DENIED) return;
      if (error.code === error.PERMISSION_DENIED) {
        setLocationState("denied");
        setMapMessage("Location is blocked for this site. Allow it from the address-bar site controls, then try again.");
      } else {
        setLocationState("unavailable");
        setMapMessage("No location fix arrived. You can retry or use the desktop simulated drive in Settings.");
      }
      changeFollow(false);
    };
    navigator.geolocation.getCurrentPosition(applyPosition, locationError, {
      enableHighAccuracy: false,
      maximumAge: 60_000,
      timeout: 15_000,
    });
    watchRef.current = navigator.geolocation.watchPosition(
      applyPosition,
      locationError,
      { enableHighAccuracy: true, maximumAge: 1_000, timeout: 30_000 },
    );
  }, [applyPosition, changeFollow]);

  const stopSimulation = () => {
    simulationActiveRef.current = false;
    if (simulationRef.current !== null) window.cancelAnimationFrame(simulationRef.current);
    simulationRef.current = null;
    setSimulating(false);
  };

  const startSimulation = () => {
    stopSimulation();
    if (watchRef.current !== null) {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    }
    const route = [
      { latitude: 52.4779, longitude: -1.9062 },
      { latitude: 52.4822, longitude: -1.8980 },
      { latitude: 52.4872, longitude: -1.8883 },
      { latitude: 52.4932, longitude: -1.8790 },
      { latitude: 52.4995, longitude: -1.8690 },
      { latitude: 52.5070, longitude: -1.8585 },
    ];
    let leg = 0;
    let direction = 1;
    let legStarted = performance.now();
    let lastFrame = 0;
    let lastUiUpdate = 0;
    let animatedBearing: number | null = null;
    const legDuration = 12_000;
    simulationActiveRef.current = true;
    setSimulating(true);
    changeFollow(true);
    setSettingsOpen(false);
    setLocationState("active");
    setMapMessage(null);

    const animate = (now: number) => {
      if (!simulationActiveRef.current) return;
      if (now - lastFrame < 32) {
        simulationRef.current = window.requestAnimationFrame(animate);
        return;
      }
      lastFrame = now;
      let fraction = (now - legStarted) / legDuration;
      if (fraction >= 1) {
        leg += direction;
        if (leg >= route.length - 1) {
          leg = route.length - 1;
          direction = -1;
        } else if (leg <= 0) {
          leg = 0;
          direction = 1;
        }
        legStarted = now;
        fraction = 0;
      }
      const from = route[leg];
      const to = route[leg + direction];
      const latitude = from.latitude + (to.latitude - from.latitude) * fraction;
      const longitude = from.longitude + (to.longitude - from.longitude) * fraction;
      const targetBearing = (Math.atan2(to.longitude - from.longitude, to.latitude - from.latitude) * 180 / Math.PI + 360) % 360;
      animatedBearing = smoothBearing(animatedBearing, targetBearing, 0.08);
      const bearing = animatedBearing;
      const nextFix: VehicleFix = { latitude, longitude, accuracy: 5, bearing, speedMph: 28 };
      latestFixRef.current = nextFix;
      locationActiveRef.current = true;

      const map = mapRef.current;
      if (map?.isStyleLoaded()) {
        if (followRef.current) {
          map.easeTo({
            center: [nextFix.longitude, nextFix.latitude],
            offset: vehicleScreenOffset(map),
            bearing,
            pitch: is3dRef.current ? settingsRef.current.pitch : 0,
            zoom: manualZoomRef.current ?? (settingsRef.current.autoZoom ? dynamicZoom(nextFix.speedMph) : map.getZoom()),
            duration: 0,
          });
        } else {
          const vehicle = vehicleElementRef.current;
          if (vehicle) {
            positionVehicleMarker(map, vehicle, nextFix, false);
          }
        }
      }

      if (now - lastUiUpdate >= 200) {
        lastUiUpdate = now;
        setFix(nextFix);
      }
      simulationRef.current = window.requestAnimationFrame(animate);
    };
    simulationRef.current = window.requestAnimationFrame(animate);
  };

  const recenter = () => {
    const map = mapRef.current;
    if (!fix || !map) return;
    manualZoomRef.current = null;
    changeFollow(true);
    map.stop();
    map.easeTo({ center: [fix.longitude, fix.latitude], offset: vehicleScreenOffset(map), bearing: fix.bearing, pitch: is3d ? settings.pitch : 0, zoom: settings.autoZoom ? dynamicZoom(fix.speedMph) : map.getZoom(), duration: 400, essential: true });
  };

  const toggle3d = () => {
    const next = !is3d;
    is3dRef.current = next;
    setIs3d(next);
    const map = mapRef.current;
    if (map && !followRef.current) {
      map.stop();
      map.easeTo({ pitch: next ? settings.pitch : 0, duration: 250, essential: true });
    }
  };

  const adjustZoom = (delta: number) => {
    const map = mapRef.current;
    if (!map) return;
    const nextZoom = Math.max(map.getMinZoom(), Math.min(map.getMaxZoom(), map.getZoom() + delta));
    manualZoomRef.current = nextZoom;
    map.stop();
    const latestFix = latestFixRef.current;
    if (followRef.current && latestFix) {
      map.easeTo({
        center: [latestFix.longitude, latestFix.latitude],
        offset: vehicleScreenOffset(map),
        bearing: latestFix.bearing,
        pitch: is3dRef.current ? settingsRef.current.pitch : 0,
        zoom: nextZoom,
        duration: 180,
        essential: true,
      });
    } else {
      map.easeTo({ zoom: nextZoom, duration: 180, essential: true });
    }
  };

  const runDestinationSearch = async (queryValue: string) => {
    const query = queryValue.trim();
    if (query.length < 2) {
      setDestinationSearchError("Enter at least two characters.");
      return;
    }
    if (!navigator.onLine) {
      setDestinationSearchError("Destination search needs an internet connection.");
      return;
    }
    destinationSearchAbortRef.current?.abort();
    const controller = new AbortController();
    destinationSearchAbortRef.current = controller;
    let searchTimedOut = false;
    const searchTimeout = window.setTimeout(() => {
      searchTimedOut = true;
      controller.abort();
    }, 10_000);
    setDestinationSearching(true);
    setDestinationSearchAttempted(true);
    setDestinationSearchError(null);
    try {
      const mapCentre = mapRef.current?.getCenter();
      const focus = latestFixRef.current ?? { latitude: mapCentre?.lat ?? 52.49, longitude: mapCentre?.lng ?? -1.89 };
      const { searchDestinations } = await import("./lib/geocoding");
      setDestinationResults(await searchDestinations(query, focus, controller.signal));
    } catch (error) {
      if (destinationSearchAbortRef.current === controller) {
        if (searchTimedOut) setDestinationSearchError("Search took too long. Please try again.");
        else if ((error as Error).name !== "AbortError") setDestinationSearchError("Search is temporarily unavailable. Please try again.");
      }
    } finally {
      window.clearTimeout(searchTimeout);
      if (destinationSearchAbortRef.current === controller) setDestinationSearching(false);
    }
  };

  const submitDestinationSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void runDestinationSearch(destinationQuery);
  };

  const rememberDestination = (destination: Destination) => {
    setRecentDestinations((current) => {
      const next = [destination, ...current.filter((item) => item.id !== destination.id)].slice(0, 10);
      localStorage.setItem(STORAGE_KEYS.destinationHistory, JSON.stringify(next));
      return next;
    });
  };

  const forgetDestination = (destinationId: string) => {
    setRecentDestinations((current) => {
      const next = current.filter((destination) => destination.id !== destinationId);
      localStorage.setItem(STORAGE_KEYS.destinationHistory, JSON.stringify(next));
      return next;
    });
  };

  const saveFavourite = (key: keyof DestinationFavourites, destination: Destination) => {
    setDestinationFavourites((current) => {
      const next = { ...current, [key]: destination };
      localStorage.setItem(STORAGE_KEYS.destinationFavourites, JSON.stringify(next));
      return next;
    });
    setMapMessage(`${destination.name} saved as ${key === "home" ? "Home" : "Hagley Road"}.`);
  };

  const endRoute = () => {
    routeAbortRef.current?.abort();
    routeAbortRef.current = null;
    setRouteLoading(false);
    setActiveRoute(null);
    setRouteDetailsOpen(false);
    const map = mapRef.current;
    if (map) setRouteData(map, null);
    destinationMarkerRef.current?.remove();
    destinationMarkerRef.current = null;
  };

  const selectDestination = async (destination: Destination) => {
    const origin = latestFixRef.current;
    if (!origin) {
      setDestinationSearchError("Start live position before calculating a route.");
      return;
    }
    if (!navigator.onLine) {
      setDestinationSearchError("Route calculation needs an internet connection.");
      return;
    }
    routeAbortRef.current?.abort();
    const controller = new AbortController();
    routeAbortRef.current = controller;
    setRouteLoading(true);
    setDestinationSearchError(null);
    setMapMessage("Calculating route…");
    let routeTimedOut = false;
    const routeTimeout = window.setTimeout(() => {
      routeTimedOut = true;
      controller.abort();
    }, ROUTE_TIMEOUT_MS);
    try {
      const { calculateRoute } = await import("./lib/routing");
      const calculated = await calculateRoute(origin, destination, controller.signal);
      if (routeAbortRef.current !== controller) return;
      const map = mapRef.current;
      if (!map) throw new Error("The map is not available.");
      await waitForMapStyle(map, controller.signal);
      ensureRouteLayers(map);
      setRouteData(map, calculated);
      destinationMarkerRef.current?.remove();
      destinationMarkerRef.current = new maplibregl.Marker({ color: "#d9413b" })
        .setLngLat([destination.longitude, destination.latitude])
        .addTo(map);
      setActiveRoute({ ...calculated, destination });
      setRouteClock(Date.now());
      setRouteDetailsOpen(false);
      rememberDestination(destination);
      setDestinationQuery(destination.name);
      setDestinationResults([]);
      setDestinationSearchAttempted(false);
      setSearchOpen(false);
      setMapMessage(null);
      manualZoomRef.current = null;
      changeFollow(true);
      map.stop();
      map.easeTo({
        center: [origin.longitude, origin.latitude],
        offset: vehicleScreenOffset(map),
        bearing: origin.bearing,
        pitch: is3dRef.current ? settingsRef.current.pitch : 0,
        zoom: settingsRef.current.autoZoom ? dynamicZoom(origin.speedMph) : Math.max(map.getZoom(), 14),
        duration: 650,
        essential: true,
      });
    } catch (error) {
      if (routeTimedOut) {
        setDestinationSearchError("Route calculation took too long. Please try again.");
        setMapMessage(null);
      } else if ((error as Error).name !== "AbortError") {
        setDestinationSearchError((error as Error).message || "A route could not be calculated. Please try again.");
        setMapMessage(null);
      }
    } finally {
      window.clearTimeout(routeTimeout);
      if (routeAbortRef.current === controller) setRouteLoading(false);
    }
  };

  const chooseQuickDestination = (key: keyof DestinationFavourites) => {
    const destination = destinationFavourites[key];
    if (destination) {
      void selectDestination(destination);
      return;
    }
    if (key === "hagleyRoad") {
      const query = "Hagley Road, Birmingham";
      setDestinationQuery(query);
      void runDestinationSearch(query);
    } else {
      setDestinationSearchError("Search for your home address, then use Save Home beside the result.");
    }
  };

  const saveOfflineArea = async () => {
    const map = mapRef.current;
    if (!map) {
      setPackError("Wait for the map to finish loading, then try again.");
      return;
    }
    if (!online) {
      setPackError("Connect to the internet once to download this offline area.");
      return;
    }
    setPackError(null);
    setPackProgress({ done: 0, total: 0 });
    const controller = new AbortController();
    abortPackRef.current = controller;
    try {
      const centre = map.getCenter();
      const { downloadOfflinePack } = await import("./lib/offline");
      const pack = await downloadOfflinePack(
        { latitude: centre.lat, longitude: centre.lng },
        packRadius,
        (done, total) => setPackProgress({ done, total }),
        controller.signal,
      );
      localStorage.setItem(STORAGE_KEYS.offlinePack, JSON.stringify(pack));
      setOfflinePack(pack);
    } catch (error) {
      if ((error as Error).name !== "AbortError") setPackError((error as Error).message);
    } finally {
      setPackProgress(null);
      abortPackRef.current = null;
    }
  };

  const removeOfflineArea = async () => {
    const { clearOfflinePack } = await import("./lib/offline");
    await clearOfflinePack();
    localStorage.removeItem(STORAGE_KEYS.offlinePack);
    setOfflinePack(null);
  };

  const routeJourney = activeRoute && fix ? liveRouteProgress(activeRoute, fix, routeClock) : null;
  const currentSpeedMph = Math.round(fix?.speedMph ?? 0);
  const speedWarning = speedLimitMph !== null && (fix?.speedMph ?? 0) > speedLimitMph + 4;

  return (
    <main className={`drive-shell ${settings.darkMode ? "classic-dark dark" : "classic"}`}>
      <div ref={mapNode} className="map-surface" aria-label="Live Map Engine road map" />
      <div ref={vehicleElementRef} className="vehicle-map-marker" aria-label="Vehicle position" hidden={!fix} />
      <MapHeader
        darkMode={settings.darkMode}
        is3d={is3d}
        offlineSaved={Boolean(offlinePack)}
        online={online}
        settingsOpen={settingsOpen}
        trafficState={traffic.state}
        trafficTitle={traffic.title}
        onOpenSettings={() => setSettingsOpen(true)}
        onToggleDarkMode={() => setSettings((current) => ({ ...current, darkMode: !current.darkMode }))}
        onToggle3d={toggle3d}
      />

      {settings.releaseMode === "current" && activeRoute && routeDetailsOpen && (
        <section className="active-route-panel" aria-label="Active route" aria-live="polite">
          <button className="route-panel-close" type="button" onClick={() => setRouteDetailsOpen(false)} aria-label="Hide route details">×</button>
          <strong>{activeRoute.destination.name.toUpperCase()} · {formatMiles(routeJourney?.remainingMiles ?? activeRoute.distanceMiles)} mi · {routeJourney?.remainingMinutes ?? activeRoute.durationMinutes} min</strong>
          {activeRoute.instruction && (
            <div className="route-instruction">
              <b aria-hidden="true">{activeRoute.instruction.arrow}</b>
              <span>{activeRoute.instruction.road}</span>
              <small>{formatMiles(activeRoute.instruction.distanceMiles)} mi</small>
            </div>
          )}
          <button type="button" onClick={endRoute}>END ROUTE</button>
        </section>
      )}

      {settings.releaseMode === "current" && !activeRoute && (
        <DestinationSearch
          inputRef={destinationInputRef}
          open={searchOpen}
          query={destinationQuery}
          searching={destinationSearching}
          routeLoading={routeLoading}
          searchAttempted={destinationSearchAttempted}
          error={destinationSearchError}
          results={destinationResults}
          recent={recentDestinations}
          favourites={destinationFavourites}
          onOpen={() => setSearchOpen(true)}
          onClose={() => { destinationSearchAbortRef.current?.abort(); setDestinationSearching(false); setSearchOpen(false); }}
          onQueryChange={(query) => { setDestinationQuery(query); setDestinationSearchAttempted(false); setDestinationSearchError(null); }}
          onSubmit={submitDestinationSearch}
          onQuickDestination={chooseQuickDestination}
          onSelect={(destination) => void selectDestination(destination)}
          onForget={forgetDestination}
          onSave={saveFavourite}
        />
      )}

      <CompassStrip bearing={viewBearing} />

      {mapMessage && <div className="map-alert" role="status">{mapMessage}</div>}

      {settings.releaseMode === "current" && <PostcodeLookup fix={fix} openGroup={openPostcodeGroup} onChangeGroup={setOpenPostcodeGroup} />}

      <div className="zoom-controls" aria-label="Map zoom controls">
        <button onClick={() => adjustZoom(1)} aria-label="Zoom in">+</button>
        <button onClick={() => adjustZoom(-1)} aria-label="Zoom out">−</button>
      </div>

      <section className="drive-controls" aria-label="Driving controls">
        {fix && !follow && <button className="recenter-button" onClick={recenter}><span className="target-icon" />Re-centre</button>}
        {settings.showSpeed && (
          <div className={`speed-card ${speedWarning ? "speed-warning" : ""}`} aria-label={`${currentSpeedMph} miles per hour${speedLimitMph === null ? "" : `, speed limit ${speedLimitMph}`}`}>
            <strong>{currentSpeedMph}</strong>
            <span>mph{speedLimitMph !== null && <small> · {speedLimitMph} limit</small>}</span>
          </div>
        )}
      </section>

      {locationState !== "active" && (
        <section className="permission-card">
          <span className="eyebrow">OFFLINE-READY ROAD MAP</span>
          <h1>Your road, at a glance.</h1>
          <p>{locationState === "denied" ? "Location was not allowed. Enable it in browser settings to follow the vehicle." : locationState === "unavailable" ? "A GPS fix is temporarily unavailable. You can still explore the map manually." : "Enable location to follow your position in a smooth, heading-up driving view."}</p>
          <button onClick={startLocation}>{locationState === "requesting" ? "Waiting for GPS…" : "Start live position"}</button>
          <small>GPS stays on this device. Map packs only download when you ask.</small>
        </section>
      )}

      {locationState === "active" && (
        <section className={`location-card ${activeRoute ? "with-route" : ""}`} aria-label={activeRoute ? "Current road and live journey progress" : "Current road and locality"} aria-live="polite">
          {activeRoute && <button className="route-details-toggle" type="button" onClick={() => setRouteDetailsOpen((current) => !current)} aria-expanded={routeDetailsOpen}>{routeDetailsOpen ? "HIDE" : "ROUTE"}</button>}
          <strong>{currentRoad ?? "Locating current road…"}</strong>
          <small>{currentLocality ?? "Finding locality…"}</small>
          {traffic.roadTraffic && traffic.delayPercent !== null && (traffic.state === "live" || traffic.state === "stale") && (
            <div className={`traffic-road-status ${traffic.roadTraffic.roadClosure ? "closed" : traffic.delayPercent >= 55 ? "severe" : traffic.delayPercent >= 25 ? "heavy" : traffic.delayPercent >= 12 ? "delay" : "clear"}`} aria-label={traffic.title}>
              <span>TRAFFIC</span>
              <b>{traffic.roadTraffic.roadClosure ? "ROAD CLOSED" : traffic.delayPercent < 12 ? "CLEAR" : `${traffic.delayPercent}% SLOWER`}</b>
              <em>{Math.round(traffic.roadTraffic.currentSpeed)} / {Math.round(traffic.roadTraffic.freeFlowSpeed)} mph</em>
            </div>
          )}
          {activeRoute && (
            <div className="journey-destination" title={`${activeRoute.destination.name}${activeRoute.destination.context ? `, ${activeRoute.destination.context}` : ""}`}>
              <b>TO</b><span>{activeRoute.destination.name}{activeRoute.destination.context ? `, ${activeRoute.destination.context}` : ""}</span>
            </div>
          )}
          {routeJourney && (
            <div className="journey-live-stats">
              <div><b>ARRIVE</b><em>{routeJourney.arrivalTime}</em></div>
              <div><b>DISTANCE</b><em>{formatMiles(routeJourney.remainingMiles)} mi</em></div>
              <div><b>REMAINING</b><em>{routeJourney.remainingMinutes} min</em></div>
            </div>
          )}
        </section>
      )}

      {settingsOpen && (
        <SettingsPanel
          settings={settings}
          offlinePack={offlinePack}
          packRadius={packRadius}
          packProgress={packProgress}
          packError={packError}
          trafficConfigured={traffic.configured === true}
          simulating={simulating}
          installPrompt={installPrompt}
          onClose={() => setSettingsOpen(false)}
          onRemoveOfflineArea={() => void removeOfflineArea()}
          onSetPackRadius={setPackRadius}
          onCancelDownload={() => abortPackRef.current?.abort()}
          onSaveOfflineArea={() => void saveOfflineArea()}
          onToggle={(key, value) => setSettings((current) => ({ ...current, [key]: value }))}
          onDefault3d={(value) => { setSettings((current) => ({ ...current, default3d: value })); is3dRef.current = value; setIs3d(value); }}
          onAutoZoom={(value) => { if (value) manualZoomRef.current = null; setSettings((current) => ({ ...current, autoZoom: value })); }}
          onLiveTraffic={(value) => {
            traffic.reset(value);
            setSettings((current) => ({ ...current, liveTraffic: value }));
          }}
          onPitch={(pitch) => setSettings((current) => ({ ...current, pitch }))}
          onReleaseMode={(mode) => { if (mode === "stable") { setSearchOpen(false); endRoute(); } setSettings((current) => ({ ...current, releaseMode: mode })); }}
          onToggleSimulation={simulating ? stopSimulation : startSimulation}
          onInstall={() => { void (async () => { if (!installPrompt) return; await installPrompt.prompt(); await installPrompt.userChoice; setInstallPrompt(null); })(); }}
        />
      )}
    </main>
  );
}
