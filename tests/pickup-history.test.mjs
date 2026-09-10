import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const history = await import("../app/lib/pickup-history.ts");
const matcher = await import("../app/lib/pickup-time-matcher.ts");

test("time matcher compares clock time within a wrap-aware window", () => {
  const { pickupMatchesWindow, pickupMinutesOfDay, minutesOfDay } = matcher;
  assert.equal(pickupMinutesOfDay({ time: "07:15" }), 435);
  assert.equal(pickupMinutesOfDay({ time: "00:00" }), 0);
  assert.equal(pickupMinutesOfDay({ time: "23:59" }), 1439);
  assert.equal(pickupMinutesOfDay({ time: "bad" }), null);
  assert.equal(minutesOfDay(new Date(2026, 8, 10, 8, 0)), 480);
  assert.equal(pickupMatchesWindow({ time: "07:00" }, new Date(2026, 8, 10, 8, 0)), true, "exactly on the ±60 minute edge matches");
  assert.equal(pickupMatchesWindow({ time: "07:00" }, new Date(2026, 8, 10, 8, 1)), false, "61 minutes out of the ±60 minute window");
  assert.equal(pickupMatchesWindow({ time: "05:35" }, new Date(2026, 8, 10, 8, 0)), false);
  assert.equal(pickupMatchesWindow({ time: "07:30" }, new Date(2026, 8, 10, 7, 0), 30), true);
  assert.equal(pickupMatchesWindow({ time: "08:00" }, new Date(2026, 8, 10, 7, 0), 30), false);
  assert.equal(pickupMatchesWindow({ time: "23:50" }, new Date(2026, 8, 10, 0, 10)), true, "midnight wrap stays inside the window");
  assert.equal(pickupMatchesWindow({ time: "00:10" }, new Date(2026, 8, 10, 23, 50)), true, "midnight wrap in the other direction");
  assert.equal(pickupMatchesWindow({ time: "garbage" }, new Date(2026, 8, 10, 8, 0)), false);
});

test("creates a pickup record with every required field", () => {
  const record = history.createPickupRecord({ latitude: 52.483414, longitude: -1.899133 }, new Date(2026, 8, 10, 7, 15));
  assert.match(record.pickup_id, /^pk_/);
  assert.equal(record.latitude, 52.483414);
  assert.equal(record.longitude, -1.899133);
  assert.equal(record.date, "2026-09-10");
  assert.equal(record.time, "07:15");
  assert.equal(record.hour, 7);
  assert.ok(record.day_of_week >= 0 && record.day_of_week <= 6);
  assert.equal(record.timestamp, record.created_at);
  assert.match(record.time_window, /^07:/);
  assert.ok(record.time_window.includes("-"));
  const windowStart = history.createPickupRecord({ latitude: 52.0, longitude: -2.0 }, new Date(2026, 8, 10, 23, 45));
  assert.equal(windowStart.time_window, "23:30-24:00");
});

test("records a pickup and re-reads it from the session store", () => {
  const before = history.readPickupHistory().length;
  const records = history.recordPickupAt({ latitude: 52.483414, longitude: -1.899133 }, new Date(2026, 8, 10, 7, 15));
  assert.equal(records.length, before + 1);
  const latest = history.readPickupHistory().at(-1);
  assert.equal(latest.latitude, 52.483414);
  assert.equal(latest.longitude, -1.899133);
  assert.equal(latest.time, "07:15");
});

test("nearby pickups cluster within the 50 m radius while raw coordinates are kept", () => {
  const records = [
    history.createPickupRecord({ latitude: 52.4834, longitude: -1.8991 }, new Date(2026, 8, 10, 7, 5)),
    history.createPickupRecord({ latitude: 52.48335, longitude: -1.89915 }, new Date(2026, 8, 10, 7, 45)),
    history.createPickupRecord({ latitude: 52.5, longitude: -1.9 }, new Date(2026, 8, 10, 9, 0)),
  ];
  const clusters = history.clusterPickupRecords(records, 50);
  assert.equal(clusters.length, 2);
  assert.equal(clusters[0].records.length, 2);
  assert.equal(clusters[1].records.length, 1);
  assert.equal(records[0].latitude, 52.4834, "raw coordinates are always retained");
  assert.ok(history.pickupDistanceMetres(records[0], records[1]) < 50);
});

test("features flag current-window pickups for the two-colour layer", () => {
  const now = new Date(2026, 8, 10, 8, 0);
  const records = [
    history.createPickupRecord({ latitude: 52.4834, longitude: -1.8991 }, new Date(2026, 8, 10, 7, 30)),
    history.createPickupRecord({ latitude: 52.5, longitude: -1.9 }, new Date(2026, 8, 10, 12, 0)),
  ];
  const collection = history.pickupFeatureCollection(records, now, 60);
  assert.equal(collection.type, "FeatureCollection");
  assert.equal(collection.features.length, 2);
  const matching = collection.features.filter((feature) => feature.properties.matchesWindow);
  const historic = collection.features.filter((feature) => !feature.properties.matchesWindow);
  assert.equal(matching.length, 1);
  assert.equal(historic.length, 1);
  assert.equal(collection.features[0].properties.count, 1);
  assert.deepEqual(collection.features[0].geometry.coordinates.length, 2);
});

test("pickup history ships as an additive two-colour layer module", async () => {
  const [mapEngine, mapEngineCss, config, settingsPanel, layers, historySource] = await Promise.all([
    readFile(new URL("../app/MapEngine.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/map-engine.css", import.meta.url), "utf8"),
    readFile(new URL("../app/map-engine/config.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/map-engine/SettingsPanel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/map-engine/pickup-layers.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/pickup-history.ts", import.meta.url), "utf8"),
  ]);
  assert.match(config, /pickupHistory: "map-engine-pickup-history-v1"/);
  assert.match(config, /showPickups: true/);
  assert.match(config, /showPickups: boolean/);
  assert.match(settingsPanel, /Show recorded pickups/);
  assert.match(mapEngine, /RECORD PICKUP/);
  assert.match(mapEngine, /recordPickup/);
  assert.match(mapEngine, /pickup-notice/);
  assert.match(mapEngine, /pickupFeatureCollection\(readPickupHistory\(\), new Date\(\)\)/);
  assert.match(mapEngine, /settings\.showPickups && !areaActive/);
  assert.match(mapEngineCss, /\.record-pickup-button/);
  assert.match(mapEngineCss, /\.pickup-notice/);
  assert.match(mapEngineCss, /\.drive-shell\.dark \.record-pickup-button/);
  assert.match(historySource, /day_of_week/);
  assert.match(historySource, /time_window/);
  assert.match(historySource, /PICKUP_CLUSTER_RADIUS_METRES = 50/);
  assert.match(historySource, /PICKUP_MAX_RECORDS = 500/);
  assert.match(layers, /HISTORIC_PICKUP_COLOUR/);
  assert.match(layers, /CURRENT_TIME_PICKUP_COLOUR/);
  assert.match(layers, /"pickup-historic"/);
  assert.match(layers, /"pickup-current"/);
  assert.match(layers, /\["==", \["get", "matchesWindow"\], false\]/);
  assert.match(layers, /\["==", \["get", "matchesWindow"\], true\]/);
  const read = await import("../app/lib/pickup-time-matcher.ts");
  assert.equal(read.CURRENT_TIME_WINDOW_MINUTES, 60);
});