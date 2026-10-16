import { readFileSync, writeFileSync } from "node:fs";
import { complete, extractJson, extractCode } from "../src/harness/llm";
import { PLANNER_SYSTEM, BUILDER_SYSTEM } from "../src/harness/prompts";
const kg = `COMPANY: {"name":"Acme Robotics","industry":"Industrial automation","brand":{"primary":"#4F46E5"}}
POLICIES: [{"name":"Sales pipeline stages","stages":["Lead","Qualified","Demo","Proposal","Negotiation","Closed Won","Closed Lost"],"rule":"Deals over $100k need VP Sales approval before Proposal"}]
PEOPLE: Maya Chen VP Sales, Raj Patel AE, Lena Ortiz AE
DEALS: Northwind fleet expansion 240000 Negotiation (Raj, Northwind Logistics); Globex line-3 retrofit 86000 Proposal (Lena); Initech pilot 24000 Demo (Raj); Umbrella cleanroom arms 410000 Qualified (Lena); Stark welding cell 31000 Lead (Lena)`;
(async () => {
  const SKIP = process.env.SKIP_PLAN;
  let t = Date.now();
  let spec: any;
  if (SKIP) spec = JSON.parse(readFileSync("/tmp/claude-0/spec.json", "utf8")); else {
  const p = await complete("plan", [{ role: "system", content: PLANNER_SYSTEM }, { role: "user", content: `REQUEST: A CRM for our sales team\nCOMMAND: /crm\n\n${kg}` }], { json: true, maxTokens: 6000 });
  console.log("plan", p.provider, p.model, (Date.now() - t) / 1000, "s");
  spec = extractJson<any>(p.text); writeFileSync("/tmp/claude-0/spec.json", JSON.stringify(spec, null, 2)); }
  t = Date.now();
  const c = await complete("code", [{ role: "system", content: BUILDER_SYSTEM }, { role: "user", content: `SPEC:\n${JSON.stringify(spec, null, 2)}\n\nCOMPANY CONTEXT:\n${kg}` }], { maxTokens: 12000, temperature: 0.3 });
  console.log("code", c.provider, c.model, (Date.now() - t) / 1000, "s");
  writeFileSync("/tmp/claude-0/App.tsx", extractCode(c.text));
})();
