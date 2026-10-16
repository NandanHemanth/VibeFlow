export const AGENT_COLOR: Record<string, string> = { router: "#5a6371", planner: "#2f5bea", builder: "#161a22", verifier: "#0f8b8d", curator: "#b7791f", simulator: "#7a4fd6" };
export const PIPELINE = [
  { step: "episode", label: "Open episode", agent: "curator", tech: "Agent Memory session", layer: "episodic" },
  { step: "cache", label: "Semantic cache", agent: "router", tech: "SurrealDB HNSW", layer: "cache" },
  { step: "context", label: "Assemble context", agent: "router", tech: "KG traversal + recall lenses", layer: "semantic" },
  { step: "plan", label: "Plan spec", agent: "planner", tech: "NVIDIA NIM → Gemini → OpenRouter", layer: null },
  { step: "provision", label: "Provision DB", agent: "builder", tech: "SurrealDB database + scoped user", layer: null },
  { step: "sandbox", label: "Isolated sandbox", agent: "builder", tech: "Daytona snapshot, secrets, firewall", layer: null },
  { step: "codegen", label: "Write code", agent: "builder", tech: "Daytona FS API", layer: "procedural" },
  { step: "verify", label: "Build + repair", agent: "verifier", tech: "Daytona process exec, git", layer: null },
  { step: "deploy", label: "Run + preview", agent: "builder", tech: "Daytona signed preview URL", layer: null },
  { step: "qa", label: "Browser QA", agent: "verifier", tech: "Anchor cloud Chromium", layer: null },
  { step: "simulate", label: "Policy simulation", agent: "simulator", tech: "MiroFish-style personas from the graph", layer: "episodic" },
  { step: "register", label: "Register /command", agent: "curator", tech: "SurrealDB graph registry", layer: null },
  { step: "notify", label: "Slack + Jira", agent: "curator", tech: "announce + change record", layer: null },
  { step: "memory", label: "Write back memory", agent: "curator", tech: "facts supersede · procedure score", layer: "procedural" },
] as const;
export const LAYER_COLOR: Record<string, string> = { episodic: "#0f8b8d", semantic: "#2f5bea", procedural: "#b7791f", cache: "#5a6371", graph: "#7a4fd6" };
