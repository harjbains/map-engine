import maplibregl from "maplibre-gl";
import { useEffect, useRef } from "react";
import { DEFAULT_START, type VehicleFix } from "./config";
import { postcodesForGroup, type PostcodeGroup } from "../lib/birmingham-postcodes";
import { styleJsonUrl } from "../lib/tomtom-client";
import { ensurePostcodeLayers, postcodeGroupBounds, setPostcodeOverlay, setPostcodeYou } from "./postcode-layers";

type PostcodeMapWindowProps = {
  group: PostcodeGroup;
  fix: VehicleFix | null;
  onClose: () => void;
};

export function PostcodeMapWindow({ group, fix, onClose }: PostcodeMapWindowProps) {
  const nodeRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const groupRef = useRef(group);
  groupRef.current = group;
  const fixRef = useRef(fix);
  fixRef.current = fix;
  const readyRef = useRef(false);
  const count = postcodesForGroup(group.id).length;

  useEffect(() => {
    const node = nodeRef.current;
    if (!node || mapRef.current) return;
    const map = new maplibregl.Map({
      container: node,
      style: styleJsonUrl(),
      center: [DEFAULT_START.longitude, DEFAULT_START.latitude],
      zoom: 9,
      pitch: 0,
      bearing: 0,
      attributionControl: { compact: true },
      maxPitch: 60,
      touchPitch: true,
      dragPan: true,
      scrollZoom: true,
      touchZoomRotate: true,
      doubleClickZoom: true,
      keyboard: true,
    });
    mapRef.current = map;
    const populate = () => {
      readyRef.current = true;
      const current = groupRef.current;
      ensurePostcodeLayers(map);
      setPostcodeOverlay(map, current.id);
      setPostcodeYou(map, fixRef.current);
      map.fitBounds(postcodeGroupBounds(current.id, fixRef.current ?? undefined), {
        padding: 42,
        bearing: 0,
        pitch: 0,
        duration: 0,
        essential: true,
      });
    };
    if (map.isStyleLoaded()) populate();
    map.on("load", populate);
    map.on("style.load", populate);
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    ensurePostcodeLayers(map);
    setPostcodeOverlay(map, group.id);
    setPostcodeYou(map, fixRef.current);
    map.fitBounds(postcodeGroupBounds(group.id, fixRef.current ?? undefined), {
      padding: 42,
      bearing: 0,
      pitch: 0,
      duration: 300,
      essential: true,
    });
  }, [group]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    setPostcodeYou(map, fix);
  }, [fix]);

  return (
    <section className="postcode-map-window" id="postcode-map-window" role="dialog" aria-modal="true" aria-label={`Postcode map ${group.rangeLabel}`}>
      <header className="postcode-map-window-header">
        <div className="postcode-map-window-title">
          <span className="postcode-lookup-kicker">POSTCODE MAP</span>
          <h2>{group.rangeLabel}</h2>
        </div>
        <p>{count} postcode{count === 1 ? "" : "s"} · green centres highlighted · the car marker shows your position</p>
        <button type="button" onClick={onClose} aria-label="Close postcode map">×</button>
      </header>
      <div className="postcode-map-window-map" ref={nodeRef} aria-label="Postcode area map" />
      <footer className="postcode-map-window-foot">The map is fixed and won't follow the car — drag or pinch to explore</footer>
    </section>
  );
}