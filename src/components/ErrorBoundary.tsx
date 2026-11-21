import React from 'react';

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error?.message || 'An unexpected application error occurred.',
    };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F6F5F0] dark:bg-[#121513] text-[#1C211E] dark:text-[#F0F2EF] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white dark:bg-[#1B1F1C] border border-[#E6E4DC] dark:border-[#2A302C] rounded-2xl p-6 space-y-4">
            <h2 className="text-xl font-semibold">Workspace paused for recovery</h2>
            <p className="text-sm text-[#5B635E] dark:text-[#9BA39D] break-words">
              {this.state.message}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2.5 rounded-xl bg-[#3A5A40] text-white text-sm font-medium hover:bg-[#588157] transition-colors"
            >
              Reload Verdant Day
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
