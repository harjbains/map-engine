export const runtime = "edge";

const OVERPASS_MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://lz4.overpass-api.de/api/interpreter",
  "https://z.overpass-api.de/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

const MIRROR_STAGGER_MS = 400;
const REQUEST_BODY_LIMIT = 64 * 1024;

type OverpassPayload = { elements?: ReadonlyArray<unknown> };

type MirrorResult = {
  payload: OverpassPayload;
  endpoint: string;
  hasData: boolean;
};

type Attempt = { state: "fulfilled"; index: number; value: MirrorResult } | { state: "rejected"; index: number };

function readTimeoutMilliseconds(data: string) {
  const match = data.match(/\[timeout:(\d+)\]/);
  const declared = match ? Number(match[1]) : 0;
  return Number.isFinite(declared) && declared > 0 ? declared * 1_000 : 20_000;
}

async function requestMirror(endpoint: string, data: string, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Accept": "application/json", "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body: new URLSearchParams({ data }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Overpass mirror ${response.status}`);
    const text = await response.text();
    let parsed: OverpassPayload;
    try {
      parsed = JSON.parse(text) as OverpassPayload;
    } catch {
      throw new Error("Overpass mirror returned invalid JSON");
    }
    return { payload: parsed, endpoint, hasData: Array.isArray(parsed.elements) && parsed.elements.length > 0 };
  } finally {
    clearTimeout(timeout);
  }
}

async function attemptMirrors(mirrors: string[], data: string, perMirrorTimeoutMs: number) {
  const startedAt = Date.now();
  const attempts: Array<Promise<Attempt>> = mirrors.map((endpoint, index) =>
    requestMirror(endpoint, data, perMirrorTimeoutMs + index * MIRROR_STAGGER_MS).then(
      (value) => ({ state: "fulfilled" as const, index, value }),
      () => ({ state: "rejected" as const, index }),
    ),
  );
  const alive = new Set(attempts.map((_, index) => index));
  let fallback: MirrorResult | null = null;
  while (alive.size) {
    const settled = await Promise.race(attempts.filter((_, index) => alive.has(index)));
    alive.delete(settled.index);
    if (settled.state === "rejected") continue;
    if (settled.value.hasData) return { result: settled.value as MirrorResult, elapsedMs: Date.now() - startedAt };
    if (!fallback) fallback = settled.value;
  }
  return { result: fallback, elapsedMs: Date.now() - startedAt };
}

function respond(value: MirrorResult, startedAt: number) {
  return Response.json(value.payload, {
    headers: {
      "Cache-Control": "no-store",
      "X-Overpass-Mirror": value.endpoint,
      "X-Overpass-Msid": String(Date.now() - startedAt),
    },
  });
}

export async function POST(request: Request) {
  let data: string;
  try {
    const value = await request.text();
    const form = new URLSearchParams(value);
    data = form.get("data")?.trim() ?? "";
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
  if (!data) return Response.json({ error: "Missing Overpass query" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  if (data.length > REQUEST_BODY_LIMIT) return Response.json({ error: "Overpass query too large" }, { status: 413, headers: { "Cache-Control": "no-store" } });

  const startedAt = Date.now();
  const declaredTimeout = readTimeoutMilliseconds(data);
  const perMirrorTimeout = Math.max(12_000, declaredTimeout + 5_000);
  const deadline = startedAt + Math.max(20_000, declaredTimeout + 10_000);

  let best: MirrorResult | null = null;
  // First wave: stagger all mirrors.
  const first = await attemptMirrors(OVERPASS_MIRRORS, data, perMirrorTimeout);
  if (first.result?.hasData) return respond(first.result, startedAt);
  if (first.result) best = first.result;

  // Retry pass: mirrors are frequently rate-limited (429/502); retry until the deadline.
  while (Date.now() < deadline) {
    const retry = await attemptMirrors(OVERPASS_MIRRORS, data, Math.max(6_000, deadline - Date.now()));
    if (retry.result?.hasData) return respond(retry.result, startedAt);
    if (retry.result) best = retry.result;
  }

  if (best) return respond(best, startedAt);
  return Response.json(
    { error: "All Overpass mirrors are unavailable", elapsedMs: Date.now() - startedAt },
    { status: 502, headers: { "Cache-Control": "no-store" } },
  );
}
