"use client";
import { useState } from "react";
import { FileInput, Clock, Webhook, Box, Globe, CheckCheck, GitBranch, AppWindow } from "lucide-react";
const ICONS: Record<string, any> = { "Form submit": FileInput, Schedule: Clock, Webhook, "Daytona sandbox": Box, "Anchor browser": Globe, Approval: CheckCheck, Branch: GitBranch, "Internal tool UI": AppWindow };
export function Logo({ slug, color, label, size = 18 }: { slug?: string; color?: string; label: string; size?: number }) {
  const [err, setErr] = useState(!slug);
  const I = ICONS[label];
  if (err && I) return <span style={{ width: size, height: size, background: color }} className="inline-flex items-center justify-center rounded-md text-white"><I size={size * 0.62} /></span>;
  if (err) return <span style={{ width: size, height: size, background: color ?? "#5a6371", fontSize: size * 0.5 }} className="inline-flex items-center justify-center rounded-md text-white font-semibold">{label.slice(0, 2)}</span>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`https://cdn.simpleicons.org/${slug}${color ? "/" + color.replace("#", "") : ""}`} alt="" width={size} height={size} onError={() => setErr(true)} />;
}

export const BLOCKS: { kind: string; label: string; slug?: string; color: string; group: string; hint: string }[] = [
  { kind: "trigger.form", label: "Form submit", color: "#2f5bea", group: "Triggers", hint: "Runs when someone submits a form" },
  { kind: "trigger.schedule", label: "Schedule", color: "#2f5bea", group: "Triggers", hint: "Runs on a cron schedule" },
  { kind: "trigger.webhook", label: "Webhook", color: "#2f5bea", group: "Triggers", hint: "Runs on an inbound HTTP call" },
  { kind: "app.slack", label: "Slack", slug: "slack", color: "#4A154B", group: "Apps", hint: "Post or read messages" },
  { kind: "app.gmail", label: "Gmail", slug: "gmail", color: "#EA4335", group: "Apps", hint: "Send or parse email" },
  { kind: "app.calendar", label: "Calendar", slug: "googlecalendar", color: "#4285F4", group: "Apps", hint: "Meetings feed the company graph" },
  { kind: "app.twilio", label: "Twilio SMS", slug: "twilio", color: "#F22F46", group: "Apps", hint: "Send SMS to contacts" },
  { kind: "app.stripe", label: "Stripe", slug: "stripe", color: "#635BFF", group: "Apps", hint: "Payments and invoices" },
  { kind: "app.hubspot", label: "HubSpot", slug: "hubspot", color: "#FF7A59", group: "Apps", hint: "Sync contacts and deals" },
  { kind: "app.jira", label: "Jira", slug: "jira", color: "#0052CC", group: "Apps", hint: "Create or move issues" },
  { kind: "ai.agent", label: "LLM agent", slug: "nvidia", color: "#76B900", group: "Harness", hint: "Routed to NVIDIA NIM, Gemini or OpenRouter" },
  { kind: "ai.memory", label: "Agent Memory", slug: "surrealdb", color: "#FF00A0", group: "Harness", hint: "Recall or remember facts" },
  { kind: "ai.graph", label: "Company graph", slug: "surrealdb", color: "#7a4fd6", group: "Harness", hint: "Query people, deals, meetings" },
  { kind: "ai.sandbox", label: "Daytona sandbox", color: "#111827", group: "Harness", hint: "Run code in isolation" },
  { kind: "ai.browser", label: "Anchor browser", color: "#0f8b8d", group: "Harness", hint: "Act on a website in cloud Chromium" },
  { kind: "logic.approval", label: "Approval", color: "#b7791f", group: "Logic", hint: "Wait for a person to approve" },
  { kind: "logic.branch", label: "Branch", color: "#5a6371", group: "Logic", hint: "If / else on a condition" },
  { kind: "ui.app", label: "Internal tool UI", color: "#2f5bea", group: "Output", hint: "Generate a screen people use" },
];
