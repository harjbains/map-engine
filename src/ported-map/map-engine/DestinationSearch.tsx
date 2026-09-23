import type { FormEventHandler, RefObject } from "react";
import type { Destination, DestinationFavourites } from "./config";
import type { RouteProfile } from "../lib/route-engine-core";

type DestinationSearchProps = {
  inputRef: RefObject<HTMLInputElement | null>;
  open: boolean;
  query: string;
  searching: boolean;
  routeLoading: boolean;
  searchAttempted: boolean;
  error: string | null;
  results: Destination[];
  recent: Destination[];
  favourites: DestinationFavourites;
  routeProfile: RouteProfile;
  onOpen: () => void;
  onClose: () => void;
  onQueryChange: (query: string) => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
  onQuickDestination: (key: keyof DestinationFavourites) => void;
  onSelect: (destination: Destination) => void;
  onForget: (destinationId: string) => void;
  onSave: (key: keyof DestinationFavourites, destination: Destination) => void;
  onRouteProfile: (profile: RouteProfile) => void;
};

export function DestinationSearch({ inputRef, open, query, searching, routeLoading, searchAttempted, error, results, recent, favourites, routeProfile, onOpen, onClose, onQueryChange, onSubmit, onQuickDestination, onSelect, onForget, onSave, onRouteProfile }: DestinationSearchProps) {
  if (!open) {
    return (
      <button className="destination-search-toggle" onClick={onOpen} aria-label="Open destination search" aria-expanded="false">
        <span className="search-glyph" aria-hidden="true" />
      </button>
    );
  }

  const destinations = searchAttempted ? results : recent;
  return (
    <section className="destination-search-panel" aria-label="Destination search">
      <form onSubmit={onSubmit}>
        <span className="search-glyph" aria-hidden="true" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Where to?"
          aria-label="Search for a destination"
        />
        <button className="destination-submit" type="submit" disabled={searching || routeLoading}>{searching ? "Searching…" : routeLoading ? "Routing…" : "Search"}</button>
        <button className="destination-close" type="button" onClick={onClose} aria-label="Close destination search">×</button>
      </form>
      <div className="route-preference">
        <span className="route-preference-label">Route</span>
        <div role="group" aria-label="Route calculation preference">
          <button className={routeProfile === "fast" ? "selected" : ""} aria-pressed={routeProfile === "fast"} type="button" onClick={() => onRouteProfile("fast")}><strong>Fast</strong><span>Best time</span></button>
          <button className={routeProfile === "short" ? "selected" : ""} aria-pressed={routeProfile === "short"} type="button" onClick={() => onRouteProfile("short")}><strong>Short</strong><span>Fewest miles</span></button>
          <button className={routeProfile === "avoid-lanes" ? "selected" : ""} aria-pressed={routeProfile === "avoid-lanes"} type="button" onClick={() => onRouteProfile("avoid-lanes")}><strong>Avoid narrow lanes</strong><span>Main roads first</span></button>
        </div>
      </div>
      <div className="quick-destinations" aria-label="Saved destinations">
        <button type="button" onClick={() => onQuickDestination("home")}><b>⌂</b><span>Home</span><small>{favourites.home ? "Saved" : "Set from search"}</small></button>
        <button type="button" onClick={() => onQuickDestination("hagleyRoad")}><b>H</b><span>Hagley Road</span><small>{favourites.hagleyRoad ? "Saved" : "Find it"}</small></button>
      </div>
      <div className="destination-results" aria-live="polite">
        <div className="destination-list-heading">
          <strong>{searchAttempted ? "Search results" : "Recent destinations"}</strong>
          <span>{destinations.length}</span>
        </div>
        {error && <p className="destination-search-error" role="alert">{error}</p>}
        {!searching && searchAttempted && !error && results.length === 0 && <p className="destination-empty">No matching destinations found.</p>}
        {!searchAttempted && recent.length === 0 && <p className="destination-empty">Your last 10 destinations will appear here.</p>}
        {routeLoading && <p className="destination-empty">Calculating the driving route…</p>}
        <div className="destination-list">
          {destinations.map((destination) => (
            <div className="destination-result-row" key={destination.id}>
              <button className="destination-choice" type="button" disabled={routeLoading} onClick={() => onSelect(destination)}>
                <i aria-hidden="true" />
                <span><strong>{destination.name}</strong><small>{destination.context || "Map destination"}</small></span>
              </button>
              {!searchAttempted && <button className="destination-remove" type="button" onClick={() => onForget(destination.id)} aria-label={`Remove ${destination.name} from recent destinations`} title="Remove recent destination">×</button>}
              {searchAttempted && (
                <div className="destination-save-actions" aria-label={`Save ${destination.name}`}>
                  <button type="button" onClick={() => onSave("home", destination)}>Save Home</button>
                  <button type="button" onClick={() => onSave("hagleyRoad", destination)}>Save Hagley</button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
