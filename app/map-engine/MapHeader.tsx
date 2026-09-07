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
  showLandmarks: boolean;
  onOpenSettings: () => void;
  onToggleDarkMode: () => void;
  onToggle3d: () => void;
  onToggleLegend: () => void;
  onToggleLandmarks: () => void;
};

export function MapHeader({ darkMode, is3d, offlineSaved, online, settingsOpen, trafficState, trafficTitle, legendOpen, showLandmarks, onOpenSettings, onToggleDarkMode, onToggle3d, onToggleLegend, onToggleLandmarks }: MapHeaderProps) {
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
        <button className={`icon-button dark-mode-button ${darkMode ? "active" : ""}`} aria-label={`Switch to ${darkMode ? "day" : "night"} mode`} aria-pressed={darkMode} title={`Switch to ${darkMode ? "day" : "night"} mode`} onClick={onToggleDarkMode}>
          {darkMode ? (
            <svg className="dark-mode-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2" /><path d="M12 20v2" /><path d="m4.93 4.93 1.41 1.41" /><path d="m17.66 17.66 1.41 1.41" /><path d="M2 12h2" /><path d="M20 12h2" /><path d="m6.34 17.66-1.41 1.41" /><path d="m19.07 4.93-1.41 1.41" />
            </svg>
          ) : (
            <svg className="dark-mode-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
            </svg>
          )}
        </button>
        <button className={`icon-button mode-button header-mode-button ${is3d ? "active" : ""}`} onClick={onToggle3d} aria-label={`Switch to ${is3d ? "2D" : "3D"} view`} aria-pressed={is3d}>{is3d ? "3D" : "2D"}</button>
        <button className={`icon-button legend-toggle-button ${legendOpen ? "active" : ""}`} onClick={onToggleLegend} aria-label="Show map legend" aria-pressed={legendOpen} title="Map legend"><span aria-hidden="true">?</span></button>
        <button className={`icon-button poi-toggle-button ${showLandmarks ? "active" : ""}`} onClick={onToggleLandmarks} aria-label="Show landmarks" aria-pressed={showLandmarks} title="Landmarks">
          <svg className="poi-toggle-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 21s-7-5.2-7-11a7 7 0 0 1 14 0c0 5.8-7 11-7 11Z" />
            <circle cx="12" cy="10" r="2.5" />
          </svg>
        </button>
      </div>
    </header>
  );
}
