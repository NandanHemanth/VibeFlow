// What each block needs to know. Rendered as the "configure this step" panel on the canvas.
export type Field = { key: string; label: string; type: "text" | "textarea" | "select" | "number"; options?: string[]; placeholder?: string };

export const BLOCK_FIELDS: Record<string, Field[]> = {
  "trigger.form": [
    { key: "form", label: "Form name", type: "text", placeholder: "Discount request" },
    { key: "fields", label: "Fields", type: "textarea", placeholder: "deal, discount %, justification" },
    { key: "who", label: "Who can submit", type: "select", options: ["Anyone in Acme", "Sales", "Customer Success", "Managers only"] },
  ],
  "trigger.schedule": [
    { key: "every", label: "Runs", type: "select", options: ["Every weekday 9:00", "Every hour", "Every Monday 8:00", "First of the month", "Custom cron"] },
    { key: "cron", label: "Cron (if custom)", type: "text", placeholder: "0 9 * * 1-5" },
    { key: "tz", label: "Time zone", type: "select", options: ["America/New_York", "America/Chicago", "America/Los_Angeles", "Europe/London", "UTC"] },
  ],
  "trigger.webhook": [
    { key: "path", label: "Path", type: "text", placeholder: "/hooks/new-lead" },
    { key: "method", label: "Method", type: "select", options: ["POST", "GET", "PUT"] },
    { key: "auth", label: "Verification", type: "select", options: ["HMAC signature", "Bearer token", "None (internal only)"] },
  ],
  "app.slack": [
    { key: "action", label: "Action", type: "select", options: ["Post message", "Post to thread", "Send DM", "Read channel"] },
    { key: "channel", label: "Channel or user", type: "text", placeholder: "#deal-desk" },
    { key: "message", label: "Message", type: "textarea", placeholder: "{{deal}} needs {{approver}} approval ({{discount}}%)" },
    { key: "mention", label: "Mention", type: "text", placeholder: "@maya" },
  ],
  "app.gmail": [
    { key: "action", label: "Action", type: "select", options: ["Send email", "Create draft", "Watch inbox"] },
    { key: "to", label: "To", type: "text", placeholder: "{{account.champion.email}}" },
    { key: "cc", label: "Cc", type: "text", placeholder: "{{owner.email}}" },
    { key: "subject", label: "Subject", type: "text", placeholder: "Your revised proposal" },
    { key: "body", label: "Body", type: "textarea", placeholder: "Hi {{contact.first_name}}, …" },
  ],
  "app.calendar": [
    { key: "event", label: "When", type: "select", options: ["Meeting created", "Meeting ended", "Meeting with an external attendee"] },
    { key: "calendar", label: "Calendar", type: "text", placeholder: "sales@acme.io" },
    { key: "filter", label: "Only if attendee domain is", type: "text", placeholder: "a client account" },
  ],
  "app.twilio": [
    { key: "to", label: "To number", type: "text", placeholder: "{{contact.phone}}" },
    { key: "from", label: "From", type: "text", placeholder: "Acme support line" },
    { key: "body", label: "Message", type: "textarea", placeholder: "Your technician arrives at {{time}}" },
  ],
  "app.stripe": [
    { key: "action", label: "Action", type: "select", options: ["Create invoice", "Watch failed payments", "Create payment link"] },
    { key: "customer", label: "Customer", type: "text", placeholder: "{{account.name}}" },
    { key: "amount", label: "Amount", type: "text", placeholder: "{{deal.value}}" },
  ],
  "app.hubspot": [
    { key: "object", label: "Object", type: "select", options: ["Deal", "Contact", "Company", "Ticket"] },
    { key: "action", label: "Action", type: "select", options: ["Create", "Update", "Search", "Watch changes"] },
    { key: "mapping", label: "Field mapping", type: "textarea", placeholder: "stage -> dealstage, value -> amount" },
  ],
  "app.jira": [
    { key: "project", label: "Project", type: "text", placeholder: "ENG" },
    { key: "type", label: "Issue type", type: "select", options: ["Bug", "Task", "Story", "Incident"] },
    { key: "summary", label: "Summary", type: "text", placeholder: "{{ticket.title}} at {{account.name}}" },
    { key: "assignee", label: "Assignee", type: "text", placeholder: "marco@acme.io" },
  ],
  "ai.agent": [
    { key: "task", label: "Instruction", type: "textarea", placeholder: "Draft the next step and pick the stage" },
    { key: "model", label: "Model route", type: "select", options: ["Auto (router)", "Fast: gpt-oss-20b", "Quality: Nemotron-3-Super", "Fallback: OpenRouter free"] },
    { key: "output", label: "Output", type: "select", options: ["Text", "JSON", "Decision (approve / reject / escalate)"] },
  ],
  "ai.memory": [
    { key: "mode", label: "Mode", type: "select", options: ["Recall", "Remember", "Recall then remember"] },
    { key: "layer", label: "Layer", type: "select", options: ["Semantic (facts)", "Episodic (what happened)", "Procedural (what works)", "All"] },
    { key: "lens", label: "Scope / lens", type: "text", placeholder: "org/acme or org/acme/tool/dealdesk" },
    { key: "asOf", label: "As of (time travel)", type: "text", placeholder: "blank = now, or 2026-09-01" },
  ],
  "ai.graph": [
    { key: "start", label: "Start from", type: "select", options: ["Account", "Deal", "Person", "Meeting", "Ticket"] },
    { key: "walk", label: "Traverse", type: "textarea", placeholder: "deal <-owns<- person ->reports_to-> manager" },
    { key: "depth", label: "Max hops", type: "number", placeholder: "2" },
  ],
  "ai.sandbox": [
    { key: "runtime", label: "Runtime", type: "select", options: ["Node 22", "Python 3.12"] },
    { key: "network", label: "Network", type: "select", options: ["Block all outbound", "Allow-list only", "Org default"] },
    { key: "code", label: "Code / command", type: "textarea", placeholder: "node report.mjs" },
    { key: "timeout", label: "Timeout (s)", type: "number", placeholder: "60" },
  ],
  "ai.browser": [
    { key: "url", label: "Start URL", type: "text", placeholder: "https://portal.supplier.example" },
    { key: "goal", label: "Goal", type: "textarea", placeholder: "Download this month's invoice PDF" },
    { key: "profile", label: "Saved login profile", type: "text", placeholder: "supplier-portal" },
    { key: "stealth", label: "Proxy + stealth", type: "select", options: ["Off", "On (needs proxy)"] },
  ],
  "logic.approval": [
    { key: "approver", label: "Approver", type: "select", options: ["Walk org chart by policy", "Direct manager", "Named person", "Any of a group"] },
    { key: "rule", label: "Rule", type: "text", placeholder: "discount > 25% → CFO" },
    { key: "sla", label: "Escalate after (hours)", type: "number", placeholder: "24" },
    { key: "reason", label: "Reason required", type: "select", options: ["Yes", "Only on reject", "No"] },
  ],
  "logic.branch": [
    { key: "if", label: "If", type: "text", placeholder: "deal.value > 100000" },
    { key: "then", label: "Then go to", type: "text", placeholder: "Approval" },
    { key: "else", label: "Else go to", type: "text", placeholder: "Slack" },
  ],
  "ui.app": [
    { key: "kind", label: "Screen", type: "select", options: ["Kanban board", "Table + detail drawer", "Approval inbox", "Dashboard", "Form"] },
    { key: "command", label: "Slash command", type: "text", placeholder: "/dealdesk" },
    { key: "audience", label: "Who uses it", type: "text", placeholder: "Sales managers, VP Sales, CFO" },
  ],
};

export function summarize(kind: string, cfg: Record<string, string> = {}) {
  const f = BLOCK_FIELDS[kind] ?? [];
  return f.map((x) => cfg[x.key] ? `${x.label}: ${cfg[x.key]}` : "").filter(Boolean).join(" · ");
}
