const V2_TILE_ORIGIN = "https://tiles.openfreemap.org";

export function mapResourceUrl(url: string, pageOrigin: string, localPreview: boolean): string {
  if (!localPreview || !url.startsWith(`${V2_TILE_ORIGIN}/`)) return url;
  return new URL(url.replace(V2_TILE_ORIGIN, "/__v2_tiles"), pageOrigin).href;
}
