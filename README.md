# VibeFlow

**Vibe-code internal tools that already know your company.**

Type `/dealdesk` or draw a workflow on the canvas. VibeFlow's agent harness reads your company's knowledge graph and memory, writes the tool, builds it inside an isolated Daytona sandbox with its own SurrealDB, opens it in a cloud browser to check it, and registers it as a slash command. Building the same tool again uses what the last build learned.

---

## Why this is different

Most "prompt to app" builders start from zero every time. They don't know your org chart, your pricing rules, or what changed last week, and the code they generate runs wherever it lands. VibeFlow makes three different bets:

1. **Context before code.** Every build starts with the company graph (people, reporting lines, clients, contracts, deals, tickets, policies) and three typed memory layers. A deal desk built here already knows that a 27% discount at Hooli goes to the CFO, because the policy changed on October 1.
2. **Memory that is time-aware and traceable.** Facts are never overwritten. A new policy *supersedes* the old one: the old value is closed with `valid_until`, the new one opens, and every link records what it replaced and which session it came from. The harness can ask "what did we believe 45 days ago?" and tell the planner never to use superseded values.
3. **Generated code is untrusted by default.** Each tool runs in its own Daytona sandbox with all outbound network blocked, its own embedded SurrealDB, and a password that never leaves the sandbox. It ships only after a real build and a real browser check.

## The harness (12 steps, 5 agents, 1 shared memory)

```
/command or canvas
  1 Episode     curator   opens an Agent Memory session (episodic)
  2 Cache       router    HNSW vector lookup on the request (SurrealDB)
  3 Context     router    company graph traversal + semantic recall (now and as-of 45 days ago)
                          + episodes + top procedures
  4 Plan        planner   spec grounded in real people, stages, policies, accounts
  5 Sandbox     builder   Daytona sandbox from snapshot, labels, auto-stop, outbound network blocked
  6 Provision   builder   embedded SurrealDB inside the sandbox; company graph projected in
                          read-only as kg_* tables; spec tables seeded
  7 Codegen     builder   writes src/App.tsx through the Daytona filesystem API
  8 Verify      verifier  vite build via Daytona process exec; repair loop on failure; git commit
  9 Deploy      builder   start server, signed preview URL (expires in 6h)
 10 QA          verifier  Anchor cloud Chromium opens the tool, collects console errors and a
                          screenshot; runtime errors go back to the repair agent
 10b Simulate   simulator MiroFish-style policy simulation: personas from the company graph
                          (AEs, managers, VP, CFO, customer champions and blockers) use the new
                          tool for 3 simulated weeks under current policy; a report agent writes
                          predictions, risks, policy friction and recommendations
 11 Register    curator   /command in the SurrealDB tool registry (graph-linked versions)
 11b Notify     curator   Slack announcement + Jira change record (with the simulation summary)
 12 Write back  curator   semantic facts (tool scope), procedure score + code, episode
```

All five agents (router, planner, builder, verifier, curator) share **one** Agent Memory context. Each writes under its own scope (`org/acme/agent/<name>`), and the others read through lenses. That is how what the verifier learned in one build reaches the planner in the next.

Every step is written to SurrealDB `run_event`, and the UI streams it with **`LIVE SELECT`**.

## Memory: what each layer does

| Layer | Question it answers | Where it lives | Makes tools better | Makes the system safer |
|---|---|---|---|---|
| **Knowledge graph** | Who and what is connected? | SurrealDB records + `RELATE` edges (reports_to, owns, manages, covers, raised, requested, decided…) | Tools are built on the real org chart, accounts and contracts, and approval routing is a graph walk | One source of truth; tools get a read-only projection, never write access to it |
| **Semantic** | What is true now? | Agent Memory typed facts (identity / knowledge), tri-temporal, **supersede instead of overwrite** | The planner uses the current policy, not last quarter's | Full history per key, a recall trace ID for every answer, no silent last-write-wins |
| **Time-aware recall** | What did we believe then? | Agent Memory `asOf` queries + `observed_at` on ingest | The planner sees what changed and is told never to use superseded values | Audit question "why did the tool do that in September?" has an answer |
| **Episodic** | What happened? | Agent Memory sessions/turns for every run + SurrealDB `episode` table filled by `DEFINE EVENT` on every deal, ticket and policy change | Builds know about past failures, escalations and recent changes | Immutable, replayable record of who did what |
| **Procedural** | What works? | SurrealDB `procedure` table: score = (successes + 1) / (runs + 2), stores the last code that passed browser QA, linked to tools via `built_with` | The next build of a tool starts from a version known to work | Only verified recipes are promoted; failures lower the score |
| **Cache** | Have we planned this already? | SurrealDB HNSW index (NVIDIA Nemotron embeddings, 2048 dims) + TTL | Skips the planner on near-identical requests | **Invalidated automatically** when a fact is superseded, so a stale plan can't ship |
| **Tool database** | The tool's own data | Embedded SurrealDB inside each sandbox (RocksDB on the sandbox disk) | Real persistence, graph and SurrealQL inside every tool | Data and credentials never leave the sandbox |

### How this maps to "best use of typed, time-aware memory"

- **Typed:** facts are extracted into categories (identity, knowledge, context, instructions); episodes, procedures, cache and graph are separate typed stores, each with its own retention and purpose.
- **Facts that supersede rather than overwrite:** the discount policy (July: VP above 20%; October: CFO above 25%) and pipeline stages (Negotiation renamed Legal Review) each form a visible chain in the Memory view, with `supersedes` / `supersededBy` and `valid_until` on each link.
- **Retrieval you can trace to its source:** every recall returns a trace ID (shown in the run panel), and every fact links back to the session and turn it came from.
- **Memory shared across more than one agent:** five agents, one context, separate write scopes, shared read lenses.

## Policy simulation (inspired by MiroFish)

[MiroFish](https://github.com/666ghj/MiroFish) builds a simulated world from seed material, lets many agents interact, and has a report agent predict outcomes. VibeFlow applies the same idea to every tool it ships: the seed is the company graph (org chart, approval limits, accounts, contacts with roles, open tickets, past decisions) plus the policies in force today. Personas use the new tool for three simulated weeks, reacting to each other's outcomes, and the report agent returns:

- **Predictions** for the next quarter (approvals, escalations, cycle time)
- **Policy findings**: where the current policy creates friction, loopholes or bottlenecks
- **Risks** and **recommendations** for the tool or the policy

The report is stored in SurrealDB (`simulation`), written to episodic memory and to the tool's Agent Memory scope, announced in Slack and attached to the Jira change record. The next build of the tool reads it. It runs in the harness, because tool sandboxes have no network. It is a lightweight re-implementation (NIM models, about 50 seconds, 4 LLM calls), not the MiroFish codebase.

## Connectors

Used by the harness only (tool sandboxes stay offline). Env names: `SLACK_BOT_TOKEN`, `SLACK_DEFAULT_CHANNEL`, `ATLASSIAN_SITE`, `ATLASSIAN_EMAIL`, `ATLASSIAN_API_TOKEN`, `JIRA_PROJECT` (`CONFLUENCE_SPACE` reserved). Each deploy posts to Slack and opens a Jira change record with the commit, sandbox ID, QA result and simulation summary: an audit trail of every AI-built tool in the systems the company already uses.

## How VibeFlow uses Daytona

Sandbox per tool · prebuilt **snapshot** (declarative image builder: Node 22 + SurrealDB + Vite/React runtime) · **labels** (app, org, tool, run) · **auto-stop / auto-archive** · **network block-all** · filesystem API · process sessions (async server + database) · **git** init/commit per version · **signed preview URLs** with expiry · **SSH access** minted per request (Tools → SSH) · one live sandbox per tool (older versions retired, history kept in git + `tool_version`) · **Secrets** (cloud mode: database token swapped in at the egress proxy, never visible to code).

## How VibeFlow uses SurrealDB

Company knowledge graph (`RELATE`, multi-hop traversal) · `DEFINE EVENT` → episodic log · `LIVE SELECT` streaming of run events to the UI · HNSW vector index for the semantic cache · computed `procedure.score` field · graph-linked tool registry (`tool → version_of → tool_version`, `tool → built_with → procedure`, `run → informed_by → kg node`) · **Agent Memory** for typed, tri-temporal, traceable, multi-agent memory · an **embedded SurrealDB per tool** inside its sandbox.

## Security (all from Daytona)

- **Isolation:** one sandbox per tool, its own kernel, filesystem and network stack.
- **No egress:** tool sandboxes are created with all outbound traffic blocked.
- **Credentials stay put:** each tool's database password is generated per sandbox and never leaves it. In cloud mode, Daytona Secrets inject the token at the proxy and the code only sees a placeholder.
- **Signed, expiring previews and short-lived SSH.**
- **Ephemeral by default:** auto-stop after 1h, auto-archive after 1 day.
- **Audit:** Daytona audit logs, plus VibeFlow's own episode log and an append-only audit table in tools that record decisions.

## Models

NVIDIA NIM first (gpt-oss-20b with reasoning effort low for planning and code, Nemotron-3-Super with thinking off as the quality fallback, Nemotron embed for vectors), OpenRouter free models as the last fallback. The router picks a model chain per task and falls through on errors.

## Who would use this

Revenue operations (deal desk, CRM, renewals), customer success (health and escalation boards), finance (approvals, spend), support (triage with SLA timers), and ops teams that live in spreadsheets. They get tools that follow their policies on day one, and the tools change when the policies change.

## Demo script (about 5 minutes)

1. **Company graph:** 13 people across 7 departments with reporting lines, 8 client accounts, contracts, products, 8 opportunities, past approval decisions, meetings and tickets.
2. **`/crm`:** an already-built CRM modelled on Salesforce Sales Cloud and Twenty (companies, people, opportunities kanban + table, record pages).
3. **Run demo → `/dealdesk`:** watch the 12 steps stream. Open **Memory used for this build**: graph sections, current facts, what was believed 45 days ago, recent episodes, procedures, recall trace ID.
4. **Simulation panel:** three simulated weeks of AEs, managers, the CFO and customers using the tool; predictions and the policy findings (e.g. friction between tiers). Show the Slack post and the Jira change record it created.
5. **The tool:** each discount request is routed through the org chart under the October policy (Hooli 27% → CFO), with account health, P1 tickets, renewal dates and past decisions as precedent.
6. **Memory view:** the fact-history chain. Record a policy change, show the cache invalidation in episodes, rebuild.
7. **Security view:** sandbox per tool, no egress, signed previews.

## Run

```bash
npm install
npm run dev               # http://localhost:3000, reads .env
```
1. **Seed company data** once (schema, Acme graph, dated memory facts). Re-seeding resets the graph but never re-asserts memory facts, so supersessions stick.
2. Click **Run demo** or type `/crm`.

One-time: `npx tsx scripts/build-snapshot.ts` (snapshot `vibeflow-tool-runtime-v3`, already built for this org). `scripts/run.sh /cmd "prompt"` runs a build from the terminal.

Env: `DAYTONA_API_KEY`, `DAYTONA_API_URL`, `SURREAL_URL/USER/PASS`, `SPECTRON_URL/CONTEXT_ID/API_KEY`, `NVIDIA_API_KEY`, `OPENROUTER_API_KEY`, `ANCHORBROWSER_API_KEY`. Optional `VF_TOOL_DB=cloud` puts tool data on SurrealDB Cloud via Daytona Secrets (needs a Daytona tier that allows egress allow-lists).

## Known limits

- A full build takes about 2.5–4 minutes on free NIM models (simulation adds about 50 seconds).
- Generated tool quality varies between runs; pre-build the demo tools.
- The canvas compiles the workflow into a build prompt; the connector blocks (Slack, Gmail…) are configuration, not live integrations yet.
- The Daytona org tier limits concurrent sandbox memory to 10 GiB (about 5 tools at once with the v3 snapshot).
