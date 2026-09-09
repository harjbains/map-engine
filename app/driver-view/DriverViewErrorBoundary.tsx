"use client";

import { Component, type ReactNode } from "react";
import { DRIVER_VIEW_EXIT_LABEL } from "./DriverViewConfig";

type Props = {
  onExit: () => void;
  children: ReactNode;
};

type State = { failed: boolean };

export class DriverViewErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <section className="driver-view-screen driver-view-error" role="alert" aria-label="Driver View unavailable">
          <div className="driver-view-error-card">
            <strong>Driver View unavailable</strong>
            <span>The experimental view hit a problem and was isolated. The live map underneath is unaffected.</span>
            <button type="button" onClick={() => { this.setState({ failed: false }); this.props.onExit(); }}>{DRIVER_VIEW_EXIT_LABEL}</button>
          </div>
        </section>
      );
    }
    return this.props.children;
  }
}