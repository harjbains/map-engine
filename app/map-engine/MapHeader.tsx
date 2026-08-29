import { APP_VERSION } from "./config";
import type { TrafficHealthState } from "../lib/traffic";

type MapHeaderProps = {
  darkMode: boolean;
  is3d: boolean;
  offlineSaved: boolean;
  online: boolean;
  settingsOpen: boolean;
  trafficState: TrafficHealthState;
  trafficTitle: string;
  legendOpen: boolean;
  onOpenSettings: () => void;
  onToggleDarkMode: () => void;
  onToggle3d: () => void;
  onToggleLegend: () => void;
};

export function MapHeader({ darkMode, is3d, offlineSaved, online, settingsOpen, trafficState, trafficTitle, legendOpen, onOpenSettings, onToggleDarkMode, onToggle3d, onToggleLegend }: MapHeaderProps) {
  const trafficLabel = trafficState === "live" ? "TomTom traffic live" : trafficState === "stale" ? "TomTom traffic stale" : trafficState === "checking" ? "Checking TomTom traffic" : trafficState === "off" ? "Traffic switched off" : "TomTom traffic unavailable";

  return (
    <header className="top-bar">
      <div className="brand-tools">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true" />
          <div><strong>MAP ENGINE</strong><span className="brand-status"><small className="brand-version">{APP_VERSION}</small></span></div>
        </div>
      </div>
      <div className="header-actions">
        <button className={`icon-button settings-button ${settingsOpen ? "active" : ""}`} aria-label="Open settings" aria-pressed={settingsOpen} onClick={onOpenSettings}><span /></button>
        <span className={`status-icon traffic-status-icon ${trafficState}`} aria-label={trafficLabel} title={trafficTitle}>T</span>
        <span className={`status-icon online-status-icon ${online ? "available" : "unavailable"}`} aria-label={online ? "Online" : "Offline"} title={online ? "Online" : offlineSaved ? "Offline map" : "No connection"}>O</span>
        <button className={`icon-button dark-mode-button ${darkMode ? "active" : ""}`} aria-label={`Switch to ${darkMode ? "day" : "night"} mode`} aria-pressed={darkMode} title={`Switch to ${darkMode ? "day" : "night"} mode`} onClick={onToggleDarkMode}><span aria-hidden="true">{darkMode ? "☀" : "☾"}</span></button>
        <button className={`icon-button mode-button header-mode-button ${is3d ? "active" : ""}`} onClick={onToggle3d} aria-label={`Switch to ${is3d ? "2D" : "3D"} view`} aria-pressed={is3d}>{is3d ? "3D" : "2D"}</button>
        <button className={`icon-button legend-toggle-button ${legendOpen ? "active" : ""}`} onClick={onToggleLegend} aria-label="Show map legend" aria-pressed={legendOpen} title="Map legend"><span aria-hidden="true">?</span></button>
      </div>
    </header>
  );
}
