import { Component } from "react"
import type { ReactNode, ErrorInfo } from "react"

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-4 p-10">
          <p className="font-display text-[24px] text-[var(--aurora-text)]">
            Something went wrong
          </p>
          <p className="text-[13px] text-[var(--aurora-text-secondary)]">
            An unexpected error occurred in this view.
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false })
              window.location.reload()
            }}
            className="mt-2 px-5 py-2 rounded-full text-[12px] font-semibold aurora-btn-press"
            style={{
              background: "var(--aurora-accent-interactive)",
              color: "var(--aurora-slate)",
            }}
          >
            Reload
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
