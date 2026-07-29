import React from "react";
import {
  INITIAL_RENDER_FAILURE_STATE,
  clearRenderFailureState,
  describeRenderFailure,
  nextRenderFailureState,
} from "@/lib/renderFailure";

// Hard constraint on this file: its only imports are react and
// @/lib/renderFailure. No shadcn/ui, no icons, no router, no toast — the
// fallback must still render when the design system or the router is the
// thing that threw. Tailwind class names only (the stylesheet is already
// loaded by the time React mounts).
export default class RootErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { ...INITIAL_RENDER_FAILURE_STATE };
    this.handleRetry = this.handleRetry.bind(this);
  }

  static getDerivedStateFromError(error) {
    return nextRenderFailureState(error);
  }

  componentDidCatch(error, info) {
    const described = describeRenderFailure(error);
    // Metadata only: never log rendered values, client records or provider
    // payloads. describeRenderFailure already bounds and redacts the message.
    console.error("[ui] render failed", {
      name: described.name,
      message: described.message,
      componentStack: String(info?.componentStack || "").slice(0, 500),
    });
  }

  handleRetry() {
    this.setState((previous) => clearRenderFailureState(previous));
  }

  render() {
    if (!this.state.failure) {
      // key={resetToken} is what makes "Try again" recoverable: it forces
      // React to remount the subtree from scratch rather than re-rendering
      // whatever state caused the failure.
      return <React.Fragment key={this.state.resetToken}>{this.props.children}</React.Fragment>;
    }
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl shadow-sm p-6 text-center">
          <h1 className="text-xl font-semibold text-slate-900 mb-2">Something went wrong</h1>
          <p className="text-sm text-slate-600 leading-relaxed mb-6">
            AssessSuite could not display this page. Nothing you have entered has been saved or
            changed by this error. You can try again, or reload the application.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              type="button"
              onClick={this.handleRetry}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors"
            >
              Reload AssessSuite
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-6">
            If this keeps happening, note what you were doing and contact support.
          </p>
        </div>
      </div>
    );
  }
}
