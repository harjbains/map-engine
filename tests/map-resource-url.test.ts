import assert from "node:assert/strict";
import test from "node:test";
import { mapResourceUrl } from "../src/ported-map/lib/map-resource-url.js";

test("local preview proxies the V2 map provider with an absolute MapLibre URL", () => {
  assert.equal(
    mapResourceUrl("https://tiles.openfreemap.org/planet/14/8094/5370.pbf", "http://127.0.0.1:5514", true),
    "http://127.0.0.1:5514/__v2_tiles/planet/14/8094/5370.pbf",
  );
});

test("production keeps the proven V2 tile provider unchanged", () => {
  const url = "https://tiles.openfreemap.org/planet";
  assert.equal(mapResourceUrl(url, "https://harjbains.github.io", false), url);
  assert.equal(mapResourceUrl("https://example.com/other", "http://127.0.0.1:5514", true), "https://example.com/other");
});
