"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class GlobalErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);

    // POST error to unified ingest endpoint
    const ingestUrl = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/monitor/ingest-client-error`;
    
    fetch(ingestUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: error.message || "Unknown error",
        stack_trace: errorInfo.componentStack || error.stack || "",
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent : "SSR",
        path: typeof window !== "undefined" ? window.location.pathname : "SSR"
      })
    }).catch(err => {
      // Intentionally ignore failure to post error so we don't cause an infinite loop
      console.error("Failed to post crash report to monitor", err);
    });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: "100px 20px", textAlign: "center", minHeight: "60vh", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--text-main)", marginBottom: 16 }}>Oops, something went wrong.</h1>
          <p style={{ color: "var(--text-muted)", maxWidth: 500, lineHeight: 1.6, marginBottom: 24 }}>
            The application encountered an unexpected error. Our engineering team has been automatically notified via the System Monitor.
          </p>
          <button 
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            style={{
              background: "var(--text-main)",
              color: "var(--bg-primary)",
              border: "none",
              padding: "12px 24px",
              fontWeight: 700,
              cursor: "pointer",
              borderRadius: 8
            }}
          >
            REFRESH PAGE
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
