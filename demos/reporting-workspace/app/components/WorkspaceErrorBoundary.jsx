import React from 'react';

import { Button } from '@/components/ui/button';

/**
 * Local error boundary for the reporting workspace. Malformed report data
 * must not unmount the whole application shell; the failure is contained to
 * the route and can be retried.
 */
export default class WorkspaceErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    // Content-free: only the error class and message reach the console.
    console.error('[reporting-workspace] render failure:', error?.name, error?.message);
  }

  componentDidUpdate(previousProps) {
    if (previousProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div role="alert" className="m-6 rounded-lg border border-red-200 bg-red-50 p-6 text-red-900">
          <h2 className="text-lg font-semibold">This part of the workspace could not be displayed</h2>
          <p className="mt-2 text-sm">The reporting data for this view could not be rendered. No clinical record was changed. You can retry, or return to the outputs list.</p>
          <p className="mt-2 font-mono text-xs text-red-700">{String(this.state.error?.message || 'Unknown render failure')}</p>
          <div className="mt-4 flex gap-2">
            <Button variant="outline" onClick={() => this.setState({ error: null })}>Retry</Button>
            <Button variant="secondary" onClick={() => { window.location.assign('/'); }}>Outputs list</Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
