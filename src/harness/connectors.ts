// Company connectors used by the harness (never by tool sandboxes, which have no egress).
// Env names: SLACK_BOT_TOKEN, SLACK_DEFAULT_CHANNEL, ATLASSIAN_SITE, ATLASSIAN_EMAIL, ATLASSIAN_API_TOKEN, JIRA_PROJECT.
const e = (k: string) => process.env[k] ?? "";

export const connectors = {
  slackEnabled: () => !!(e("SLACK_BOT_TOKEN") && e("SLACK_DEFAULT_CHANNEL")),
  jiraEnabled: () => !!(e("ATLASSIAN_SITE") && e("ATLASSIAN_EMAIL") && e("ATLASSIAN_API_TOKEN") && e("JIRA_PROJECT")),
};

export async function slackPost(text: string, channel = e("SLACK_DEFAULT_CHANNEL")) {
  const ch = channel.startsWith("#") || /^[CGD][A-Z0-9]{6,}$/.test(channel) ? channel : `#${channel}`;
  const r = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: { Authorization: `Bearer ${e("SLACK_BOT_TOKEN")}`, "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ channel: ch, text, unfurl_links: false }),
  });
  const j = await r.json();
  if (!j.ok) throw new Error(`Slack: ${j.error}`);
  return { channel: ch, ts: j.ts as string };
}

export async function jiraCreate(summary: string, description: string, labels: string[] = ["vibeflow"]) {
  const site = e("ATLASSIAN_SITE").replace(/\/$/, "");
  const auth = "Basic " + Buffer.from(`${e("ATLASSIAN_EMAIL")}:${e("ATLASSIAN_API_TOKEN")}`).toString("base64");
  const doc = { type: "doc", version: 1, content: description.split("\n").filter(Boolean).map((line) => ({ type: "paragraph", content: [{ type: "text", text: line.slice(0, 2000) }] })) };
  const body = (issuetype: string) => JSON.stringify({ fields: { project: { key: e("JIRA_PROJECT") }, summary: summary.slice(0, 250), issuetype: { name: issuetype }, labels, description: doc } });
  for (const t of ["Task", "Story"]) {
    const r = await fetch(`${site}/rest/api/3/issue`, { method: "POST", headers: { Authorization: auth, "Content-Type": "application/json", Accept: "application/json" }, body: body(t) });
    const j = await r.json().catch(() => ({}));
    if (r.ok) return { key: j.key as string, url: `${site}/browse/${j.key}` };
    if (t === "Story") throw new Error(`Jira ${r.status}: ${JSON.stringify(j).slice(0, 200)}`);
  }
  throw new Error("Jira: unreachable");
}
