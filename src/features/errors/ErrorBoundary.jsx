/**
 * The last thing standing between a bug and a blank phone.
 *
 * React unmounts the whole tree when a render throws, so without this the
 * game becomes a white screen in the middle of a round and the evening is
 * over. With it, the round is still over — but the phone says so, offers to
 * start again, and can hand over a report of what happened.
 *
 * This is a class because an error boundary has to be: `componentDidCatch`
 * has no hook. It is the only class in the app, and this is why.
 */

import { Component } from 'react';

import { record } from './log.js';
import { ErrorScreen } from './ErrorScreen.jsx';
import { FailureNotice } from './FailureNotice.jsx';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { report: null };
  }

  static getDerivedStateFromError() {
    // Something is coming: swap to the error screen on this render, and work
    // out what to say in componentDidCatch, where the details arrive.
    return { pending: true };
  }

  componentDidCatch(error, info) {
    this.setState({
      report: record(error, {
        where: 'render',
        // React's own stack says which component, which is the useful half.
        componentStack: info?.componentStack,
      }),
      pending: false,
    });
  }

  restart = () => {
    this.setState({ report: null, pending: false });
    this.props.onRestart?.();
  };

  render() {
    if (this.state.pending || this.state.report) {
      return <ErrorScreen report={this.state.report} onRestart={this.restart} />;
    }
    // The game, plus a quiet line for anything that went wrong without
    // stopping it.
    return (
      <>
        {this.props.children}
        <FailureNotice />
      </>
    );
  }
}
