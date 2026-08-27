import type { Point } from "./driving";

export type Destination = {
  id: string;
  name: string;
  context: string;
  latitude: number;
  longitude: number;
};

type PhotonFeature = {
  geometry?: { type?: string; coordinates?: number[] };
  properties?: Record<string, string | number | undefined>;
};

type PostcodeResult = {
  postcode: string;
  latitude: number;
  longitude: number;
  admin_district?: string;
  region?: string;
  country?: string;
};

const UK_POSTCODE_PATTERN = /\b([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})\b/i;

function destinationFromFeature(feature: PhotonFeature): Destination | null {
  const coordinates = feature.geometry?.coordinates;
  const properties = feature.properties ?? {};
  if (feature.geometry?.type !== "Point" || !coordinates || coordinates.length < 2) return null;
  const longitude = Number(coordinates[0]);
  const latitude = Number(coordinates[1]);
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null;

  const streetAddress = [properties.housenumber, properties.street].filter(Boolean).join(" ");
  const name = String(streetAddress || properties.name || properties.city || properties.locality || "Destination");
  const context = [
    streetAddress && streetAddress !== name ? streetAddress : null,
    properties.district,
    properties.locality,
    properties.city,
    properties.county,
    properties.state,
    properties.postcode,
    properties.country,
  ].filter((part, index, parts) => part && part !== name && parts.indexOf(part) === index).join(", ");
  const osmIdentity = properties.osm_type && properties.osm_id ? `${properties.osm_type}/${properties.osm_id}` : `${longitude.toFixed(6)},${latitude.toFixed(6)}`;
  return { id: String(osmIdentity), name, context, latitude, longitude };
}

const NON_DISTINCTIVE_ADDRESS_WORDS = new Set([
  "a", "an", "the", "road", "rd", "street", "st", "close", "cl", "lane", "ln", "avenue", "ave",
  "drive", "dr", "way", "court", "ct", "place", "pl", "crescent", "gardens", "united", "kingdom", "uk",
]);

function normaliseSearchText(value: string) {
  return value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, " ").trim();
}

function extractPostcode(value: string) {
  const match = value.match(UK_POSTCODE_PATTERN);
  return match ? `${match[1]} ${match[2]}`.toUpperCase() : null;
}

function compactPostcode(value: string | null) {
  return value?.replace(/\s+/g, "").toUpperCase() ?? null;
}

function withoutPostcode(value: string) {
  return value.replace(UK_POSTCODE_PATTERN, " ").replace(/\s+/g, " ").trim();
}

function formatAddressLabel(value: string) {
  return value.split(/\s+/).map((part) => part ? `${part[0].toUpperCase()}${part.slice(1).toLowerCase()}` : part).join(" ");
}

function significantQueryTokens(query: string) {
  return [...new Set(normaliseSearchText(withoutPostcode(query)).split(" ").filter((token) => token.length > 1 && !/^\d+$/.test(token) && !NON_DISTINCTIVE_ADDRESS_WORDS.has(token)))];
}

function distanceKilometres(left: Point, right: Point) {
  const radius = 6371;
  const toRadians = (degrees: number) => degrees * Math.PI / 180;
  const latitudeDelta = toRadians(right.latitude - left.latitude);
  const longitudeDelta = toRadians(right.longitude - left.longitude);
  const latitude1 = toRadians(left.latitude);
  const latitude2 = toRadians(right.latitude);
  const haversine = Math.sin(latitudeDelta / 2) ** 2 + Math.cos(latitude1) * Math.cos(latitude2) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * radius * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function rankDestinations(destinations: Destination[], query: string, postcodeAnchor?: Point | null) {
  const queryText = normaliseSearchText(query);
  const tokens = significantQueryTokens(query);
  const queryPostcode = compactPostcode(extractPostcode(query));
  const houseNumber = normaliseSearchText(query).split(" ").find((token) => /^\d+[a-z]?$/.test(token));
  return destinations
    .map((destination, originalIndex) => {
      const searchable = normaliseSearchText(`${destination.name} ${destination.context}`);
      const matchedTokens = tokens.filter((token) => searchable.includes(token)).length;
      let score = matchedTokens * 30 - (tokens.length - matchedTokens) * 22 - originalIndex * 0.05;
      if (queryText && searchable.includes(queryText)) score += 80;
      const hasHouseNumber = Boolean(houseNumber && new RegExp(`(^| )${houseNumber}( |$)`).test(searchable));
      if (hasHouseNumber) score += 25;
      const destinationPostcode = compactPostcode(extractPostcode(`${destination.name} ${destination.context}`));
      const exactPostcode = Boolean(queryPostcode && destinationPostcode === queryPostcode);
      if (exactPostcode) score += 120;
      const distanceKm = postcodeAnchor ? distanceKilometres(postcodeAnchor, destination) : null;
      if (distanceKm !== null) score += distanceKm <= 3 ? Math.max(0, 70 - distanceKm * 15) : -Math.min(120, distanceKm * 3);
      return { destination, matchedTokens, score, searchable, hasHouseNumber, exactPostcode, distanceKm };
    })
    .sort((left, right) => right.score - left.score);
}

async function requestPhoton(query: string, focus: Point, useLocationBias: boolean, signal?: AbortSignal) {
  const parameters = new URLSearchParams({ q: query, limit: "12", lang: "en", countrycode: "GB" });
  if (useLocationBias) {
    parameters.set("lat", focus.latitude.toFixed(6));
    parameters.set("lon", focus.longitude.toFixed(6));
    parameters.set("zoom", "8");
    parameters.set("location_bias_scale", "0.8");
  }
  const response = await fetch(`https://photon.komoot.io/api/?${parameters}`, {
    headers: { Accept: "application/geo+json, application/json" },
    cache: "no-store",
    signal,
  });
  if (!response.ok) throw new Error(`Destination search ${response.status}`);
  const payload = await response.json() as { features?: PhotonFeature[] };
  return (payload.features ?? []).map(destinationFromFeature).filter((destination): destination is Destination => Boolean(destination));
}

async function requestPostcode(postcode: string, signal?: AbortSignal): Promise<PostcodeResult | null> {
  const response = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(postcode)}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal,
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Postcode search ${response.status}`);
  const payload = await response.json() as { result?: PostcodeResult | null };
  const result = payload.result;
  if (!result || !Number.isFinite(result.latitude) || !Number.isFinite(result.longitude)) return null;
  return result;
}

function postcodeDestination(query: string, road: Destination, postcode: PostcodeResult): Destination {
  const houseNumber = normaliseSearchText(query).split(" ").find((token) => /^\d+[a-z]?$/.test(token));
  const roadName = road.name.replace(/^\s*\d+[a-z]?\s+/i, "");
  const name = houseNumber ? `${houseNumber.toUpperCase()} ${roadName}` : roadName;
  const context = [postcode.admin_district, postcode.region, postcode.postcode, postcode.country || "United Kingdom"]
    .filter((part, index, parts): part is string => Boolean(part) && parts.indexOf(part) === index)
    .join(", ");
  return {
    id: `postcode/${compactPostcode(postcode.postcode)}/${normaliseSearchText(name).replace(/\s+/g, "-")}`,
    name,
    context,
    latitude: postcode.latitude,
    longitude: postcode.longitude,
  };
}

function directPostcodeDestination(query: string, postcode: PostcodeResult): Destination {
  const address = withoutPostcode(query).replace(/[\s,]+$/, "").trim();
  const name = address ? formatAddressLabel(address) : postcode.postcode;
  const context = [postcode.admin_district, postcode.region, postcode.postcode, postcode.country || "United Kingdom"]
    .filter((part, index, parts): part is string => Boolean(part) && part !== name && parts.indexOf(part) === index)
    .join(", ");
  return {
    id: `postcode/${compactPostcode(postcode.postcode)}/${normaliseSearchText(name).replace(/\s+/g, "-") || "centre"}`,
    name,
    context,
    latitude: postcode.latitude,
    longitude: postcode.longitude,
  };
}

export async function searchDestinations(query: string, focus: Point, signal?: AbortSignal): Promise<Destination[]> {
  const cleanedQuery = query.trim();
  const queryPostcode = extractPostcode(cleanedQuery);
  const explicitAddress = normaliseSearchText(cleanedQuery).split(" ").length >= 3 || Boolean(queryPostcode);
  let postcode: PostcodeResult | null = null;
  if (queryPostcode) {
    try {
      postcode = await requestPostcode(queryPostcode, signal);
    } catch (error) {
      if ((error as Error).name === "AbortError") throw error;
    }
  }
  if (postcode) return [directPostcodeDestination(cleanedQuery, postcode)];
  const primary = await requestPhoton(cleanedQuery, focus, !explicitAddress, signal);
  let ranked = rankDestinations(primary, cleanedQuery, null);
  const requiredMatches = significantQueryTokens(cleanedQuery).length;
  const hasNearbyRoadMatch = ranked.some((result) => result.matchedTokens === requiredMatches && (result.distanceKm === null || result.distanceKm <= 3));

  if (explicitAddress && requiredMatches > 0 && !hasNearbyRoadMatch) {
    const relaxedQuery = withoutPostcode(cleanedQuery).replace(/^\s*\d+[a-z]?\s+/i, "");
    if (relaxedQuery !== cleanedQuery) {
      const fallback = await requestPhoton(relaxedQuery, postcodeAnchor ?? focus, Boolean(postcodeAnchor), signal);
      const combined = [...primary, ...fallback].filter((destination, index, destinations) => destinations.findIndex((candidate) => candidate.id === destination.id) === index);
      ranked = rankDestinations(combined, cleanedQuery, postcodeAnchor);
    }
  }

  const fullyMatched = ranked.filter((result) => requiredMatches > 0 && result.matchedTokens === requiredMatches);
  if (queryPostcode) {
    const exactAddress = fullyMatched.filter((result) => result.exactPostcode && result.hasHouseNumber);
    if (exactAddress.length) return exactAddress.slice(0, 8).map((result) => result.destination);
    const nearbyRoad = fullyMatched.find((result) => result.distanceKm !== null && result.distanceKm <= 3);
    if (postcode && nearbyRoad) return [postcodeDestination(cleanedQuery, nearbyRoad.destination, postcode)];
    const exactRoad = fullyMatched.filter((result) => result.exactPostcode);
    return exactRoad.slice(0, 8).map((result) => result.destination);
  }

  const selected = fullyMatched.length ? fullyMatched : explicitAddress ? [] : ranked;
  return selected.slice(0, 8).map((result) => result.destination);
}
