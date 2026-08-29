import type { InstallPromptEvent, OfflinePack, ReleaseMode, Settings } from "./config";

type SettingsPanelProps = {
  settings: Settings;
  offlinePack: OfflinePack | null;
  packRadius: number;
  packProgress: { done: number; total: number } | null;
  packError: string | null;
  trafficConfigured: boolean;
  simulating: boolean;
  installPrompt: InstallPromptEvent | null;
  onClose: () => void;
  onRemoveOfflineArea: () => void;
  onSetPackRadius: (radius: number) => void;
  onCancelDownload: () => void;
  onSaveOfflineArea: () => void;
  onToggle: (key: "darkMode" | "showSpeed" | "showBuildings" | "showDriverAmenities", value: boolean) => void;
  onDefault3d: (value: boolean) => void;
  onAutoZoom: (value: boolean) => void;
  onLiveTraffic: (value: boolean) => void;
  onPitch: (pitch: number) => void;
  onReleaseMode: (mode: ReleaseMode) => void;
  onToggleSimulation: () => void;
  onInstall: () => void;
};

export function SettingsPanel({ settings, offlinePack, packRadius, packProgress, packError, trafficConfigured, simulating, installPrompt, onClose, onRemoveOfflineArea, onSetPackRadius, onCancelDownload, onSaveOfflineArea, onToggle, onDefault3d, onAutoZoom, onLiveTraffic, onPitch, onReleaseMode, onToggleSimulation, onInstall }: SettingsPanelProps) {
  const progressPercent = packProgress?.total ? Math.round(packProgress.done / packProgress.total * 100) : 0;

  return (
    <>
      <button className="settings-scrim" aria-label="Close settings" onClick={onClose} />
      <aside className="settings-panel" aria-label="Map settings">
        <div className="settings-heading"><div><span>MAP ENGINE</span><h2>Settings</h2></div><button onClick={onClose} aria-label="Close settings">×</button></div>
        <div className="settings-scroll">
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
            <h3>Driving view</h3>
            <Toggle label="Night map mode" checked={settings.darkMode} onChange={(value) => onToggle("darkMode", value)} />
            <Toggle label="Default 3D view" checked={settings.default3d} onChange={onDefault3d} />
            <Toggle label="Automatic zoom" checked={settings.autoZoom} onChange={onAutoZoom} />
            <Toggle label="Show GPS speed" checked={settings.showSpeed} onChange={(value) => onToggle("showSpeed", value)} />
            <Toggle label="Show 3D buildings" checked={settings.showBuildings} onChange={(value) => onToggle("showBuildings", value)} />
            <Toggle label="Show parking and EV chargers" checked={settings.showDriverAmenities} onChange={(value) => onToggle("showDriverAmenities", value)} />
            <Toggle label="Live traffic congestion" checked={settings.liveTraffic} onChange={onLiveTraffic} />
            {settings.liveTraffic && trafficConfigured && <div className="traffic-legend" aria-label="Live traffic colour key"><span><i className="delay" />Delay</span><span><i className="heavy" />Heavy</span><span><i className="severe" />Severe</span><span><i className="incident" />Incident</span></div>}
            {settings.liveTraffic && !trafficConfigured && <p className="settings-note traffic-setup-note">Live traffic is ready for a TomTom connection. Add the traffic service key to activate it.</p>}
            <p className="settings-note">Choose how routes are calculated when picking a destination — Fast, Short, or Avoid narrow lanes. Routes are still allowed to finish on any road at the start or destination, and if a route cannot be calculated the fastest route is used instead.</p>
            <label className="range-setting"><span>3D pitch <b>{Math.round(settings.pitch)}°</b></span><input type="range" min="35" max="65" step="5" value={settings.pitch} onChange={(event) => onPitch(Number(event.target.value))} /></label>
            <p className="settings-note">The single UK map style uses cool road colours so warm orange and red remain reserved for traffic delays.</p>
            <p className="settings-note safety-note">Safety Pack adds verified one-way arrows, mapped road closures, road restrictions, speed limits, crossings, cameras and clean-air warnings progressively after the base map. Parking and EV chargers remain optional to protect the driving view from clutter. Coverage may be incomplete; physical road signs always take priority.</p>
          </section>

          <section className="settings-group">
            <h3>App</h3>
            <div className="map-style-setting release-mode-setting">
              <span>Version fallback</span>
              <div role="group" aria-label="Map Engine version mode">
                <button className={settings.releaseMode === "current" ? "selected" : ""} aria-pressed={settings.releaseMode === "current"} onClick={() => onReleaseMode("current")}>Current v1.16.1</button>
                <button className={settings.releaseMode === "stable" ? "selected" : ""} aria-pressed={settings.releaseMode === "stable"} onClick={() => onReleaseMode("stable")}>Compatibility v1.5.7</button>
              </div>
            </div>
            <button className="secondary-wide" onClick={onToggleSimulation}>{simulating ? "Stop simulated drive" : "Start desktop simulated drive"}</button>
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
