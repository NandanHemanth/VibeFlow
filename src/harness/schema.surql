-- ============ VibeFlow harness schema (ns vibeflow / db harness) ============
-- Company knowledge graph -------------------------------------------------
DEFINE TABLE IF NOT EXISTS company SCHEMALESS;
DEFINE TABLE IF NOT EXISTS team SCHEMALESS;
DEFINE TABLE IF NOT EXISTS person SCHEMALESS;
DEFINE TABLE IF NOT EXISTS account SCHEMALESS;      -- customers
DEFINE TABLE IF NOT EXISTS deal SCHEMALESS;
DEFINE TABLE IF NOT EXISTS meeting SCHEMALESS;
DEFINE TABLE IF NOT EXISTS ticket SCHEMALESS;
DEFINE TABLE IF NOT EXISTS policy SCHEMALESS;       -- business rules (pipeline stages, SLAs…)
DEFINE TABLE IF NOT EXISTS member_of TYPE RELATION SCHEMALESS;
DEFINE TABLE IF NOT EXISTS owns TYPE RELATION SCHEMALESS;
DEFINE TABLE IF NOT EXISTS attended TYPE RELATION SCHEMALESS;
DEFINE TABLE IF NOT EXISTS about TYPE RELATION SCHEMALESS;
DEFINE TABLE IF NOT EXISTS raised TYPE RELATION SCHEMALESS;
DEFINE TABLE IF NOT EXISTS uses_tool TYPE RELATION SCHEMALESS;

-- Episodic log: every KG change becomes an episode automatically (DEFINE EVENT)
DEFINE TABLE IF NOT EXISTS episode SCHEMALESS;
DEFINE FIELD IF NOT EXISTS at ON episode TYPE datetime DEFAULT time::now();
DEFINE INDEX IF NOT EXISTS episode_at ON episode FIELDS at;
DEFINE EVENT OVERWRITE kg_deal_change ON TABLE deal WHEN $event IN ["CREATE","UPDATE"] THEN {
  CREATE episode SET kind = "kg_change", table = "deal", record = $after.id, event = $event,
    summary = string::concat("Deal ", $after.name ?? "", " is now in stage ", $after.stage ?? "?"),
    source = "surreal:event";
};
DEFINE EVENT OVERWRITE kg_ticket_change ON TABLE ticket WHEN $event IN ["CREATE","UPDATE"] THEN {
  CREATE episode SET kind = "kg_change", table = "ticket", record = $after.id, event = $event,
    summary = string::concat("Ticket ", $after.title ?? "", " -> ", $after.status ?? "?"), source = "surreal:event";
};
DEFINE EVENT OVERWRITE kg_policy_change ON TABLE policy WHEN $event IN ["CREATE","UPDATE"] THEN {
  CREATE episode SET kind = "policy_change", table = "policy", record = $after.id, event = $event,
    summary = string::concat("Policy ", $after.name ?? "", " updated"), source = "surreal:event";
};

-- Harness runs + streamed run events (UI subscribes with LIVE SELECT) ------
DEFINE TABLE IF NOT EXISTS run SCHEMALESS;
DEFINE TABLE IF NOT EXISTS run_event SCHEMALESS;
DEFINE FIELD IF NOT EXISTS at ON run_event TYPE datetime DEFAULT time::now();
DEFINE INDEX IF NOT EXISTS run_event_run ON run_event FIELDS run;

-- Procedural memory: recipes that passed verification, scored by outcome --
DEFINE TABLE IF NOT EXISTS procedure SCHEMALESS;
DEFINE FIELD IF NOT EXISTS successes ON procedure TYPE int DEFAULT 0;
DEFINE FIELD IF NOT EXISTS failures ON procedure TYPE int DEFAULT 0;
DEFINE FIELD OVERWRITE score ON procedure VALUE <float> (successes + 1) / <float> (successes + failures + 2);
DEFINE INDEX IF NOT EXISTS procedure_kind ON procedure FIELDS kind;

-- Semantic cache: vector-indexed prompt -> plan, with TTL ------------------
DEFINE TABLE IF NOT EXISTS cache SCHEMALESS;
DEFINE FIELD IF NOT EXISTS embedding ON cache TYPE option<array<float>>;
DEFINE FIELD IF NOT EXISTS expires ON cache TYPE datetime DEFAULT time::now() + 1d;
DEFINE INDEX IF NOT EXISTS cache_vec ON cache FIELDS embedding HNSW DIMENSION 2048 DIST COSINE;

-- Tool registry: every vibe-coded tool = a slash command ------------------
DEFINE TABLE IF NOT EXISTS tool SCHEMALESS;
DEFINE INDEX IF NOT EXISTS tool_cmd ON tool FIELDS command UNIQUE;
DEFINE TABLE IF NOT EXISTS tool_version SCHEMALESS;
DEFINE TABLE IF NOT EXISTS version_of TYPE RELATION SCHEMALESS;
DEFINE TABLE IF NOT EXISTS built_with TYPE RELATION SCHEMALESS;  -- tool -> procedure
DEFINE TABLE IF NOT EXISTS informed_by TYPE RELATION SCHEMALESS; -- run -> kg node / memory trace
DEFINE TABLE IF NOT EXISTS simulation SCHEMALESS;
