import React from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/inter/latin-700.css";
import "@fontsource/inter/latin-800.css";
import Amberly from "./Amberly.jsx";

// Last-resort safety net: a crash shows a friendly screen instead of a blank page.
// Saved data is untouched, so a reload usually recovers.
class CrashScreen extends React.Component {
  state = { crashed: false };
  static getDerivedStateFromError() { return { crashed: true }; }
  render() {
    if (!this.state.crashed) return this.props.children;
    return (
      <div style={{ fontFamily: "Inter, sans-serif", background: "#faf6f0", color: "#2b2622", minHeight: "100vh", padding: "64px 24px", textAlign: "center" }}>
        <h1 style={{ fontSize: 22, margin: "0 0 8px" }}>Something went wrong</h1>
        <p style={{ color: "#6f6458", marginBottom: 20 }}>Your grows and diary are still saved on this device.</p>
        <button onClick={() => window.location.reload()}
          style={{ background: "#d99a3c", color: "#2b2622", border: "none", borderRadius: 16, padding: "14px 28px", fontSize: 16, fontWeight: 600 }}>
          Reload Amberly
        </button>
      </div>
    );
  }
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode><CrashScreen><Amberly /></CrashScreen></React.StrictMode>
);
