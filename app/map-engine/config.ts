import type { Destination } from "../lib/geocoding";
import type { OfflinePack } from "../lib/offline";
import type { CalculatedRoute } from "../lib/routing";
import type { Point } from "../lib/driving";
import type { RouteProfile } from "../lib/route-engine-core";

export type ReleaseMode = "current" | "stable";

export type Settings = {
  releaseMode: ReleaseMode;
  darkMode: boolean;
  default3d: boolean;
  autoZoom: boolean;
  showSpeed: boolean;
  showBuildings: boolean;
  showDriverAmenities: boolean;
  liveTraffic: boolean;
  routeProfile: RouteProfile;
  pitch: number;
};

export type VehicleFix = Point & {
  accuracy: number;
  speedMph: number;
  bearing: number;
};

export type DestinationFavourites = {
  home?: Destination;
  hagleyRoad?: Destination;
};

export type ActiveRoute = CalculatedRoute & { destination: Destination };

export type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export const DEFAULT_SETTINGS: Settings = {
  releaseMode: "stable",
  darkMode: false,
  default3d: true,
  autoZoom: true,
  showSpeed: true,
  showBuildings: true,
  showDriverAmenities: false,
  liveTraffic: true,
  routeProfile: "fast",
  pitch: 55,
};

export const STORAGE_KEYS = {
  settings: "map-engine-settings-v1",
  offlinePack: "map-engine-offline-pack-v1",
  destinationHistory: "map-engine-destination-history-v1",
  destinationFavourites: "map-engine-destination-favourites-v1",
} as const;

export const APP_VERSION = "v2.10.2";
export const ROUTE_TIMEOUT_MS = 18_000;
export const DEFAULT_START = { longitude: -2.152557, latitude: 52.556476, zoom: 15.3 } as const;

export type { Destination, OfflinePack };
