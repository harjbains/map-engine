import type { InstallPromptEvent, OfflinePack, SafetyOverlayToggleKey, Settings } from "./config";

type ToggleableSettingKey =
  | SafetyOverlayToggleKey
  | "darkMode"
  | "showSpeed"
  | "showBuildings"
  | "showLandmarks"
  | "showPickups";

type SettingsPanelProps = {
  settings: Settings;
  offlinePack: OfflinePack | null;
  packRadius: number;
  packProgress: { done: number; total: number } | null;
  packError: string | null;
  trafficConfigured: boolean;
  installPrompt: InstallPromptEvent | null;
  onClose: () => void;
  onRemoveOfflineArea: () => void;
  onSetPackRadius: (radius: number) => void;
  onCancelDownload: () => void;
  onSaveOfflineArea: () => void;
  onToggle: (key: ToggleableSettingKey, value: boolean) => void;
  onBatchSettings: (patch: Partial<Settings>) => void;
  onDefault3d: (value: boolean) => void;
  onAutoZoom: (value: boolean) => void;
  onLiveTraffic: (value: boolean) => void;
  onPitch: (pitch: number) => void;
  onInstall: () => void;
  onShowLegend?: () => void;
};

const ESSENTIAL_OVERLAYS: Record<SafetyOverlayToggleKey, boolean> = {
  showTrafficSignals: true,
  showSpeedCameras: true,
  showRoadClosures: true,
  showRoadworks: true,
  showBusLanes: true,
  showSpeedBumps: false,
  showOneWayArrows: false,
  showRailCrossings: false,
  showTurnRestrictions: false,
  showNoEntry: false,
  showDimensionLimits: false,
  showAccessZones: false,
  showRoadSpeedLimits: false,
  showDriverAmenities: false,
};

const ALL_OVERLAYS_ON: Record<SafetyOverlayToggleKey, boolean> = {
  showTrafficSignals: true,
  showSpeedCameras: true,
  showRoadClosures: true,
  showRoadworks: true,
  showBusLanes: true,
  showSpeedBumps: true,
  showOneWayArrows: true,
  showRailCrossings: true,
  showTurnRestrictions: true,
  showNoEntry: true,
  showDimensionLimits: true,
  showAccessZones: true,
  showRoadSpeedLimits: true,
  showDriverAmenities: true,
};

export function SettingsPanel({ settings, offlinePack, packRadius, packProgress, packError, trafficConfigured, installPrompt, onClose, onRemoveOfflineArea, onSetPackRadius, onCancelDownload, onSaveOfflineArea, onToggle, onBatchSettings, onDefault3d, onAutoZoom, onLiveTraffic, onPitch, onInstall, onShowLegend }: SettingsPanelProps) {
  const progressPercent = packProgress?.total ? Math.round(packProgress.done / packProgress.total * 100) : 0;
  const isEssentialsPreset = (Object.keys(ESSENTIAL_OVERLAYS) as SafetyOverlayToggleKey[]).every((key) => settings[key] === ESSENTIAL_OVERLAYS[key]);
  const isAllOnPreset = (Object.keys(ALL_OVERLAYS_ON) as SafetyOverlayToggleKey[]).every((key) => settings[key] === true);

  return (
    <>
      <button className="settings-scrim" aria-label="Close settings" onClick={onClose} />
      <aside className="settings-panel" aria-label="Map settings">
        <div className="settings-heading"><div><span>MAP ENGINE</span><h2>Settings</h2></div><button onClick={onClose} aria-label="Close settings">×</button></div>
        <div className="settings-scroll">
          <section className="settings-group">
            <div className="group-title-row">
              <div>
                <h3>Map objects &amp; overlays</h3>
                <p>Switch off extra road symbols to keep the map uncluttered.</p>
              </div>
            </div>
            <div className="radius-options" style={{ marginBottom: "10px" }}>
              <button type="button" className={isEssentialsPreset ? "selected" : ""} onClick={() => onBatchSettings(ESSENTIAL_OVERLAYS)}>
                <strong>Essentials only</strong>
                <span>Lights, cameras &amp; closures</span>
              </button>
              <button type="button" className={isAllOnPreset ? "selected" : ""} onClick={() => onBatchSettings(ALL_OVERLAYS_ON)}>
                <strong>Show all</strong>
                <span>Every sign &amp; hazard</span>
              </button>
            </div>
            <Toggle label="Traffic lights" checked={settings.showTrafficSignals} onChange={(value) => onToggle("showTrafficSignals", value)} />
            <Toggle label="Speed cameras" checked={settings.showSpeedCameras} onChange={(value) => onToggle("showSpeedCameras", value)} />
            <Toggle label="Road closures" checked={settings.showRoadClosures} onChange={(value) => onToggle("showRoadClosures", value)} />
            <Toggle label="Roadworks" checked={settings.showRoadworks} onChange={(value) => onToggle("showRoadworks", value)} />
            <Toggle label="Bus lanes &amp; bus gates" checked={settings.showBusLanes} onChange={(value) => onToggle("showBusLanes", value)} />
            <Toggle label="Speed humps" checked={settings.showSpeedBumps} onChange={(value) => onToggle("showSpeedBumps", value)} />
            <Toggle label="One-way streets" checked={settings.showOneWayArrows} onChange={(value) => onToggle("showOneWayArrows", value)} />
            <Toggle label="Tram &amp; rail crossings" checked={settings.showRailCrossings} onChange={(value) => onToggle("showRailCrossings", value)} />
            <Toggle label="Turn Only / No Turn" checked={settings.showTurnRestrictions} onChange={(value) => onToggle("showTurnRestrictions", value)} />
            <Toggle label="No Entry signs" checked={settings.showNoEntry} onChange={(value) => onToggle("showNoEntry", value)} />
            <Toggle label="Height, width &amp; weight limits" checked={settings.showDimensionLimits} onChange={(value) => onToggle("showDimensionLimits", value)} />
            <Toggle label="Pedestrian &amp; access zones" checked={settings.showAccessZones} onChange={(value) => onToggle("showAccessZones", value)} />
            <Toggle label="Road speed limit labels" checked={settings.showRoadSpeedLimits} onChange={(value) => onToggle("showRoadSpeedLimits", value)} />
            <Toggle label="Parking, EV chargers &amp; CAZ" checked={settings.showDriverAmenities} onChange={(value) => onToggle("showDriverAmenities", value)} />
            {onShowLegend && (
              <button className="secondary-wide" style={{ marginTop: "12px" }} onClick={() => { onClose(); onShowLegend(); }}>
                View map legend &amp; symbols
              </button>
            )}
          </section>

          <section className="settings-group">
            <h3>Driving view</h3>
            <Toggle label="Night map mode" checked={settings.darkMode} onChange={(value) => onToggle("darkMode", value)} />
            <Toggle label="Default 3D view" checked={settings.default3d} onChange={onDefault3d} />
            <Toggle label="Automatic zoom" checked={settings.autoZoom} onChange={onAutoZoom} />
            <Toggle label="Show GPS speed" checked={settings.showSpeed} onChange={(value) => onToggle("showSpeed", value)} />
            <Toggle label="Show 3D buildings" checked={settings.showBuildings} onChange={(value) => onToggle("showBuildings", value)} />
            <Toggle label="Show landmarks ahead" checked={settings.showLandmarks} onChange={(value) => onToggle("showLandmarks", value)} />
            <Toggle label="Show recorded pickups" checked={settings.showPickups} onChange={(value) => onToggle("showPickups", value)} />
            <Toggle label="Live traffic congestion" checked={settings.liveTraffic} onChange={onLiveTraffic} />
            {settings.liveTraffic && trafficConfigured && <div className="traffic-legend" aria-label="Live traffic colour key"><span><i className="delay" />Delay</span><span><i className="heavy" />Heavy</span><span><i className="severe" />Severe</span><span><i className="incident" />Incident</span></div>}
            {settings.liveTraffic && !trafficConfigured && <p className="settings-note traffic-setup-note">Live traffic is ready for a TomTom connection. Add the traffic service key to activate it.</p>}
            <p className="settings-note">Choose how routes are calculated when picking a destination — Fast, Short, or Avoid narrow lanes. Routes are still allowed to finish on any road at the start or destination, and if a route cannot be calculated the fastest route is used instead.</p>
            <label className="range-setting"><span>3D pitch <b>{Math.round(settings.pitch)}°</b></span><input type="range" min="35" max="65" step="5" value={settings.pitch} onChange={(event) => onPitch(Number(event.target.value))} /></label>
            <p className="settings-note">Landmarks ahead lists up to three recognised roadside places — petrol stations, supermarkets, pubs, hotels and large stores — inside the 45° view in front of you while driving.</p>
          </section>

          <section className="settings-group offline-group">
            <div className="group-title-row"><div><h3>Offline map download</h3><p>Pan the map to the area you need, then download it over Wi-Fi.</p></div><span className={`status-dot ${offlinePack ? "saved" : ""}`} /></div>
            {offlinePack && <div className="pack-summary"><strong>{offlinePack.radiusKm} km local area saved</strong><span>{offlinePack.tiles.toLocaleString()} map tiles · downloaded {new Date(offlinePack.downloadedAt).toLocaleDateString("en-GB")}</span><button className="text-button danger" onClick={onRemoveOfflineArea}>Remove saved map</button></div>}
            <div className="radius-options">
              <button className={packRadius === 5 ? "selected" : ""} onClick={() => onSetPackRadius(5)} disabled={Boolean(packProgress)}><strong>5 km</strong><span>Town area · faster</span></button>
              <button className={packRadius === 12 ? "selected" : ""} onClick={() => onSetPackRadius(12)} disabled={Boolean(packProgress)}><strong>12 km</strong><span>Local journeys</span></button>
            </div>
            {packProgress ? <div className="pack-progress"><div><span style={{ width: `${progressPercent}%` }} /></div><p>{packProgress.total ? `${progressPercent}% · ${packProgress.done.toLocaleString()} of ${packProgress.total.toLocaleString()} files` : "Calculating map download…"}</p><button className="text-button" onClick={onCancelDownload}>Cancel download</button></div> : <button className="primary-wide" onClick={onSaveOfflineArea}>{offlinePack ? "Replace with current map area" : "Download current map area"}</button>}
            <p className="download-note">Keep Map Engine open until the download reaches 100%. This saves the base map and fetches Safety Pack data for the selected area. Downloads are stored separately by each browser. For reliable offline reopening, install it from your browser or add it to the tablet home screen while still on Wi-Fi.</p>
            {offlinePack && !offlinePack.safetyIncluded && <p className="setting-error">The base map was saved, but Safety Pack data could not be refreshed. Replace this area again while online.</p>}
            {packError && <p className="setting-error" role="alert">{packError}</p>}
          </section>

          <section className="settings-group">
            <h3>App</h3>
            {installPrompt && <button className="secondary-wide" onClick={onInstall}>Install Map Engine</button>}
            <p className="settings-note">Install from your browser for an app-like tablet experience. GPS follow continues offline inside a saved area.</p>
          </section>
        </div>
        <footer>OpenFreeMap · OpenMapTiles · OpenStreetMap · Traffic © TomTom</footer>
      </aside>
    </>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="toggle-row"><span>{label}</span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><i aria-hidden="true" /></label>;
}
