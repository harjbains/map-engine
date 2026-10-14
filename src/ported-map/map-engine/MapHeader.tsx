import { APP_VERSION } from "./config";
import type { TrafficHealthState } from "../lib/traffic";

type MapHeaderProps = {
  darkMode: boolean;
  settingsOpen: boolean;
  trafficState: TrafficHealthState;
  trafficTitle: string;
  onOpenSettings: () => void;
  onToggleDarkMode: () => void;
  onOpenDashboard?: () => void;
  onRefreshLocation?: () => void;
  is3d?: boolean;
  offlineSaved?: boolean;
  online?: boolean;
  legendOpen?: boolean;
  showLandmarks?: boolean;
  onToggle3d?: () => void;
  onToggleLegend?: () => void;
  onToggleLandmarks?: () => void;
};

export function MapHeader({
  darkMode,
  settingsOpen,
  trafficState,
  trafficTitle,
  onOpenSettings,
  onToggleDarkMode,
  onOpenDashboard,
  onRefreshLocation,
}: MapHeaderProps) {
  const trafficLabel =
    trafficState === "live"
      ? "TomTom traffic live"
      : trafficState === "stale"
      ? "TomTom traffic stale"
      : trafficState === "checking"
      ? "Checking TomTom traffic"
      : trafficState === "off"
      ? "Traffic switched off"
      : "TomTom traffic unavailable";

  return (
    <header className="top-bar">
      <div className="brand-tools">
        <div className="brand-lockup" onClick={() => (window as any).showChangelog?.()} style={{ cursor: "pointer" }}>
          <span className="brand-mark" aria-hidden="true" />
          <div><strong>MAP ENGINE</strong><span className="brand-status"><small className="brand-version">{APP_VERSION}</small></span></div>
        </div>
      </div>
      <div className="header-actions">
        <button className={`icon-button settings-button ${settingsOpen ? "active" : ""}`} aria-label="Open settings" aria-pressed={settingsOpen} onClick={onOpenSettings}><span /></button>
        <span className={`status-icon traffic-status-icon ${trafficState}`} aria-label={trafficLabel} title={trafficTitle}>T</span>
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
        {onRefreshLocation && (
          <button className="icon-button mode-button active" onClick={onRefreshLocation} aria-label="Refresh GPS location" title="Refresh GPS location">
            <svg className="location-refresh-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
              <path d="M21 3v5h-5" />
            </svg>
          </button>
        )}
        {onOpenDashboard && (
          <button className="icon-button mode-button active" onClick={onOpenDashboard} aria-label="Open Earnings Dashboard" title="Dashboard">
            £
          </button>
        )}
      </div>
    </header>
  );
}
