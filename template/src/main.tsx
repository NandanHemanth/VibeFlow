import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
class Boundary extends React.Component<{ children: React.ReactNode }, { err?: Error }> {
  state: { err?: Error } = {};
  static getDerivedStateFromError(err: Error) { return { err }; }
  componentDidCatch(err: Error) { console.error("VF_RUNTIME_ERROR", err.message); }
  render() { return this.state.err ? <pre style={{ padding: 24, color: "#b91c1c" }}>Runtime error: {this.state.err.message}</pre> : this.props.children; }
}
createRoot(document.getElementById("root")!).render(<Boundary><App /></Boundary>);
