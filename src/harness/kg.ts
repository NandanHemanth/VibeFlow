// Company knowledge graph in SurrealDB: seed + subgraph extraction for context assembly.
import { sql } from "./surreal";

export const KG_TABLES = ["company", "department", "person", "product", "account", "contact", "contract", "deal", "approval", "meeting", "ticket", "policy"];
export const KG_RELATIONS = ["member_of", "reports_to", "owns", "manages", "attended", "about", "raised", "covers", "includes", "requested", "decided", "uses_tool", "works_at"];

export async function seedAcme() {
  const del = [...KG_TABLES, ...KG_RELATIONS].map((t) => `DELETE ${t};`).join(" ");
  await sql(`${KG_TABLES.map((t) => `DEFINE TABLE IF NOT EXISTS ${t} SCHEMALESS;`).join(" ")} ${KG_RELATIONS.map((t) => `DEFINE TABLE IF NOT EXISTS ${t} TYPE RELATION SCHEMALESS;`).join(" ")} ${del}`);
  await sql(`
  -- Company ---------------------------------------------------------------
  CREATE company:acme SET name = "Acme Robotics", industry = "Industrial automation: robotic arms, welding cells and the Fleet OS SaaS",
    hq = "Jersey City, NJ", employees = 140, arr = 48000000, fiscal_year_start = "02-01", currency = "USD",
    brand = { primary: "#4F46E5", tone: "crisp, enterprise" }, regions = ["East", "Central", "West", "EMEA"];

  -- Departments + org chart (reports_to = hierarchy) -------------------------
  CREATE department:exec SET name = "Executive"; CREATE department:sales SET name = "Sales";
  CREATE department:cs SET name = "Customer Success"; CREATE department:finance SET name = "Finance";
  CREATE department:legal SET name = "Legal"; CREATE department:eng SET name = "Engineering"; CREATE department:revops SET name = "Revenue Operations";
  CREATE person:priya SET name = "Priya Raman", title = "CEO", level = 1, email = "priya@acme.io";
  CREATE person:david SET name = "David Kim", title = "CFO", level = 2, email = "david@acme.io", approval_limit_pct = 100;
  CREATE person:maya SET name = "Maya Chen", title = "VP Sales", level = 2, email = "maya@acme.io", approval_limit_pct = 25;
  CREATE person:marco SET name = "Marco Silva", title = "VP Engineering", level = 2, email = "marco@acme.io";
  CREATE person:grace SET name = "Grace Liu", title = "General Counsel", level = 2, email = "grace@acme.io";
  CREATE person:jordan SET name = "Jordan Lee", title = "Sales Manager, East", level = 3, email = "jordan@acme.io", approval_limit_pct = 15;
  CREATE person:kofi SET name = "Kofi Mensah", title = "Sales Manager, West & EMEA", level = 3, email = "kofi@acme.io", approval_limit_pct = 15;
  CREATE person:raj SET name = "Raj Patel", title = "Account Executive", level = 4, email = "raj@acme.io", approval_limit_pct = 10, territory = "East";
  CREATE person:lena SET name = "Lena Ortiz", title = "Account Executive", level = 4, email = "lena@acme.io", approval_limit_pct = 10, territory = "West";
  CREATE person:tom SET name = "Tom Becker", title = "Account Executive", level = 4, email = "tom@acme.io", approval_limit_pct = 10, territory = "EMEA";
  CREATE person:sam SET name = "Sam Okafor", title = "Head of Customer Success", level = 3, email = "sam@acme.io";
  CREATE person:aisha SET name = "Aisha Bello", title = "Customer Success Manager", level = 4, email = "aisha@acme.io";
  CREATE person:nina SET name = "Nina Park", title = "RevOps Manager", level = 3, email = "nina@acme.io";
  RELATE person:priya->member_of->department:exec; RELATE person:david->member_of->department:finance; RELATE person:grace->member_of->department:legal;
  RELATE [person:maya, person:jordan, person:kofi, person:raj, person:lena, person:tom]->member_of->department:sales;
  RELATE [person:sam, person:aisha]->member_of->department:cs; RELATE person:marco->member_of->department:eng; RELATE person:nina->member_of->department:revops;
  RELATE [person:david, person:maya, person:marco, person:grace]->reports_to->person:priya;
  RELATE [person:jordan, person:kofi, person:sam, person:nina]->reports_to->person:maya;
  RELATE person:raj->reports_to->person:jordan; RELATE [person:lena, person:tom]->reports_to->person:kofi; RELATE person:aisha->reports_to->person:sam;

  -- Products ----------------------------------------------------------------
  CREATE product:a7 SET name = "Atlas Arm A7", kind = "hardware", list_price = 85000;
  CREATE product:cell SET name = "Atlas Welding Cell", kind = "hardware", list_price = 160000;
  CREATE product:fleetos SET name = "Fleet OS", kind = "SaaS subscription", list_price = 24000, unit = "per site / year";
  CREATE product:support SET name = "Support Plus", kind = "service", list_price = 12000, unit = "per year";

  -- Clients (accounts), contacts, contracts ----------------------------------
  CREATE account:northwind SET name = "Northwind Logistics", segment = "Enterprise", industry = "3PL warehousing", region = "East", arr = 180000, health = "at risk", employees = 4200;
  CREATE account:globex SET name = "Globex Manufacturing", segment = "Mid-Market", industry = "Automotive parts", region = "Central", arr = 64000, health = "healthy", employees = 900;
  CREATE account:initech SET name = "Initech Foods", segment = "Mid-Market", industry = "Food processing", region = "East", arr = 52000, health = "healthy", employees = 650;
  CREATE account:umbrella SET name = "Umbrella Pharma", segment = "Enterprise", industry = "Pharmaceuticals", region = "West", arr = 0, health = "prospect", employees = 12000;
  CREATE account:stark SET name = "Stark Fabrication", segment = "SMB", industry = "Metal fabrication", region = "West", arr = 18000, health = "healthy", employees = 120;
  CREATE account:wayne SET name = "Wayne Aerospace", segment = "Enterprise", industry = "Aerospace components", region = "East", arr = 310000, health = "healthy", employees = 8800;
  CREATE account:hooli SET name = "Hooli Devices", segment = "Enterprise", industry = "Consumer electronics", region = "West", arr = 140000, health = "at risk", employees = 15000;
  CREATE account:vandelay SET name = "Vandelay Industries", segment = "Mid-Market", industry = "Import/export packaging", region = "EMEA", arr = 46000, health = "healthy", employees = 700;
  RELATE person:raj->manages->[account:northwind, account:initech, account:wayne]; RELATE person:lena->manages->[account:umbrella, account:stark, account:hooli];
  RELATE person:tom->manages->[account:vandelay, account:globex]; RELATE person:aisha->manages->[account:northwind, account:hooli, account:wayne];
  CREATE contact:c1 SET name = "Elena Voss", title = "VP Operations", email = "elena@northwind.example", role = "economic buyer";
  CREATE contact:c2 SET name = "Mark Diaz", title = "Plant Manager", email = "mark@globex.example", role = "champion";
  CREATE contact:c3 SET name = "Dr. Ana Alvarez", title = "Director of Manufacturing", email = "ana@umbrella.example", role = "champion";
  CREATE contact:c4 SET name = "Bruce Wane", title = "CTO", email = "bruce@wayne.example", role = "economic buyer";
  CREATE contact:c5 SET name = "Gavin Belson", title = "SVP Hardware", email = "gavin@hooli.example", role = "blocker";
  CREATE contact:c6 SET name = "Art Vandelay", title = "Procurement Lead", email = "art@vandelay.example", role = "procurement";
  RELATE contact:c1->works_at->account:northwind; RELATE contact:c2->works_at->account:globex; RELATE contact:c3->works_at->account:umbrella;
  RELATE contact:c4->works_at->account:wayne; RELATE contact:c5->works_at->account:hooli; RELATE contact:c6->works_at->account:vandelay;
  CREATE contract:k1 SET name = "Northwind MSA + Fleet OS", value = 180000, start = d"2024-01-15", end = d"2027-01-14", auto_renew = false, notice_days = 90;
  CREATE contract:k2 SET name = "Wayne enterprise agreement", value = 310000, start = d"2023-12-01", end = d"2026-11-30", auto_renew = true, notice_days = 60;
  CREATE contract:k3 SET name = "Hooli pilot-to-production", value = 140000, start = d"2025-12-20", end = d"2026-12-19", auto_renew = false, notice_days = 30;
  CREATE contract:k4 SET name = "Globex Fleet OS", value = 64000, start = d"2025-03-01", end = d"2027-02-28", auto_renew = true, notice_days = 60;
  RELATE contract:k1->covers->account:northwind; RELATE contract:k2->covers->account:wayne; RELATE contract:k3->covers->account:hooli; RELATE contract:k4->covers->account:globex;
  RELATE contract:k1->includes->[product:a7, product:fleetos]; RELATE contract:k2->includes->[product:cell, product:fleetos, product:support];
  RELATE contract:k3->includes->[product:a7]; RELATE contract:k4->includes->[product:fleetos];

  -- Opportunities -----------------------------------------------------------
  CREATE deal:d1 SET name = "Northwind fleet expansion", value = 240000, stage = "Legal Review", probability = 70, close = d"2026-11-15", discount_pct = 18, next_step = "Send revised 3-year proposal by Oct 20";
  CREATE deal:d2 SET name = "Globex line-3 retrofit", value = 86000, stage = "Proposal", probability = 50, close = d"2026-11-30", discount_pct = 8, next_step = "Plant walk-through Oct 22";
  CREATE deal:d3 SET name = "Initech pilot", value = 24000, stage = "Demo", probability = 30, close = d"2026-12-10", discount_pct = 0, next_step = "Demo with QA team";
  CREATE deal:d4 SET name = "Umbrella cleanroom arms", value = 410000, stage = "Qualified", probability = 20, close = d"2027-01-20", discount_pct = 22, next_step = "GMP compliance review with Dr. Alvarez";
  CREATE deal:d5 SET name = "Stark welding cell", value = 31000, stage = "Lead", probability = 10, close = d"2027-02-01", discount_pct = 5, next_step = "Intro call";
  CREATE deal:d6 SET name = "Wayne renewal + Support Plus", value = 335000, stage = "Proposal", probability = 60, close = d"2026-11-25", discount_pct = 12, next_step = "Renewal notice window closes Oct 1 — escalate";
  CREATE deal:d7 SET name = "Hooli production rollout", value = 520000, stage = "Qualified", probability = 25, close = d"2027-03-15", discount_pct = 27, next_step = "Gavin Belson pushing for 30% off; needs CFO view";
  CREATE deal:d8 SET name = "Vandelay EMEA expansion", value = 72000, stage = "Demo", probability = 35, close = d"2026-12-20", discount_pct = 14, next_step = "Pricing in EUR";
  RELATE person:raj->owns->[deal:d1, deal:d3, deal:d6]; RELATE person:lena->owns->[deal:d4, deal:d5, deal:d7]; RELATE person:tom->owns->[deal:d2, deal:d8];
  RELATE deal:d1->about->account:northwind; RELATE deal:d2->about->account:globex; RELATE deal:d3->about->account:initech; RELATE deal:d4->about->account:umbrella;
  RELATE deal:d5->about->account:stark; RELATE deal:d6->about->account:wayne; RELATE deal:d7->about->account:hooli; RELATE deal:d8->about->account:vandelay;

  -- Past approval decisions (episodic evidence) ------------------------------
  CREATE approval:a1 SET deal_name = "Northwind fleet expansion", discount_pct = 18, status = "approved", reason = "3-year term offsets discount", at = d"2026-09-12T15:00:00Z", approver_title = "VP Sales";
  CREATE approval:a2 SET deal_name = "Hooli pilot", discount_pct = 30, status = "rejected", reason = "Below margin floor; pilot later churned risk", at = d"2026-06-03T18:00:00Z", approver_title = "VP Sales";
  CREATE approval:a3 SET deal_name = "Globex Fleet OS", discount_pct = 9, status = "approved", reason = "Within AE authority", at = d"2025-02-20T14:00:00Z", approver_title = "Account Executive";
  CREATE approval:a4 SET deal_name = "Wayne enterprise agreement", discount_pct = 21, status = "approved", reason = "Strategic logo, multi-product", at = d"2023-11-20T16:00:00Z", approver_title = "VP Sales";
  RELATE person:raj->requested->approval:a1; RELATE person:maya->decided->approval:a1; RELATE approval:a1->about->deal:d1;
  RELATE person:lena->requested->approval:a2; RELATE person:maya->decided->approval:a2; RELATE approval:a2->about->account:hooli;
  RELATE person:tom->requested->approval:a3; RELATE person:tom->decided->approval:a3; RELATE approval:a3->about->account:globex;
  RELATE person:raj->requested->approval:a4; RELATE person:maya->decided->approval:a4; RELATE approval:a4->about->account:wayne;

  -- Meetings ---------------------------------------------------------------
  CREATE meeting:m1 SET title = "Northwind pricing call", at = d"2026-10-14T15:00:00Z", notes = "Northwind asked for 3-year term discount; legal review of MSA pending. Next step: revised proposal by Oct 20.";
  CREATE meeting:m2 SET title = "Umbrella discovery", at = d"2026-10-13T14:00:00Z", notes = "Umbrella needs GMP-compliant arms; budget approved Q1. Champion: Dr. Alvarez.";
  CREATE meeting:m3 SET title = "Weekly pipeline review", at = d"2026-10-15T13:00:00Z", notes = "Maya: every deal must have a next step and a close date. Flag deals idle > 14 days. Hooli discount ask goes to CFO under the new policy.";
  CREATE meeting:m4 SET title = "Q4 pricing council", at = d"2026-09-30T16:00:00Z", notes = "David (CFO): from Oct 1 discounts over 25% need CFO sign-off; VP Sales limit 25%. Margin floor 55%.";
  CREATE meeting:m5 SET title = "Hooli escalation", at = d"2026-10-09T17:00:00Z", notes = "Two P1 tickets open; Gavin threatening to pause rollout unless calibration drift fixed.";
  RELATE [person:raj, person:maya]->attended->meeting:m1; RELATE person:lena->attended->meeting:m2; RELATE [person:maya, person:raj, person:lena, person:tom, person:jordan, person:kofi]->attended->meeting:m3;
  RELATE [person:david, person:maya, person:nina, person:priya]->attended->meeting:m4; RELATE [person:lena, person:aisha, person:sam, person:marco]->attended->meeting:m5;
  RELATE meeting:m1->about->deal:d1; RELATE meeting:m2->about->deal:d4; RELATE meeting:m5->about->account:hooli;

  -- Support tickets ----------------------------------------------------------
  CREATE ticket:t1 SET title = "Arm calibration drift", priority = "P1", status = "Open", opened = d"2026-10-08";
  CREATE ticket:t2 SET title = "Dashboard export failing", priority = "P2", status = "In Progress", opened = d"2026-10-11";
  CREATE ticket:t3 SET title = "Gripper firmware crash", priority = "P1", status = "Open", opened = d"2026-10-10";
  RELATE account:hooli->raised->[ticket:t1, ticket:t3]; RELATE account:globex->raised->ticket:t2;

  -- Policies (current state; history lives in Agent Memory) -------------------
  CREATE policy:pipeline SET name = "Sales pipeline stages", stages = ["Lead","Qualified","Demo","Proposal","Legal Review","Closed Won","Closed Lost"];
  CREATE policy:discount SET name = "Discount approval matrix", effective = d"2026-10-01", tiers = [
    { max_pct: 10, approver: "Account Executive" }, { max_pct: 15, approver: "Sales Manager" },
    { max_pct: 25, approver: "VP Sales" }, { max_pct: 100, approver: "CFO" } ], margin_floor_pct = 55;
  CREATE policy:sla SET name = "Support SLA", p1_hours = 4, p2_hours = 24;
  CREATE policy:renewal SET name = "Renewal policy", notice_days_default = 90, rule = "CSM must log a renewal plan 120 days before contract end";
  `);
}

/** Pull a compact company-context document from the graph (graph traversal, not flat tables). */
export async function companyContext(): Promise<{ text: string; nodes: string[] }> {
  const [company, policies, people, accounts, deals, approvals, meetings, tickets, contracts, products] = await sql<any[]>(`
    SELECT name, industry, hq, employees, arr, brand, regions FROM ONLY company:acme;
    SELECT name, stages, tiers, effective, margin_floor_pct, p1_hours, p2_hours, rule FROM policy;
    SELECT name, title, level, approval_limit_pct, ->member_of->department.name AS dept, ->reports_to->person.name AS reports_to FROM person ORDER BY level;
    SELECT name, segment, industry, region, arr, health, <-manages<-person.name AS team, <-works_at<-contact.{name, title, role} AS contacts FROM account;
    SELECT id, name, value, stage, probability, close, discount_pct, next_step, <-owns<-person.name AS owner, ->about->account.name AS account FROM deal;
    SELECT deal_name, discount_pct, status, reason, at, approver_title, <-requested<-person.name AS requested_by, <-decided<-person.name AS decided_by FROM approval ORDER BY at DESC;
    SELECT title, at, notes, <-attended<-person.name AS attendees FROM meeting ORDER BY at DESC;
    SELECT title, priority, status, <-raised<-account.name AS account FROM ticket;
    SELECT name, value, end, auto_renew, notice_days, ->covers->account.name AS account, ->includes->product.name AS products FROM contract;
    SELECT name, kind, list_price, unit FROM product;
  `);
  const text = [
    `COMPANY: ${JSON.stringify(company)}`,
    `POLICIES (current): ${JSON.stringify(policies)}`,
    `ORG CHART (person -reports_to-> manager): ${JSON.stringify(people)}`,
    `PRODUCTS: ${JSON.stringify(products)}`,
    `CLIENT ACCOUNTS: ${JSON.stringify(accounts)}`,
    `CONTRACTS: ${JSON.stringify(contracts)}`,
    `OPPORTUNITIES: ${JSON.stringify(deals)}`,
    `PAST APPROVAL DECISIONS: ${JSON.stringify(approvals)}`,
    `RECENT MEETINGS: ${JSON.stringify(meetings)}`,
    `SUPPORT TICKETS: ${JSON.stringify(tickets)}`,
  ].join("\n");
  const nodes = [...(deals as any[]).map((d) => String(d.id)), "company:acme", "policy:pipeline", "policy:discount", "policy:sla", "policy:renewal"];
  return { text, nodes };
}

export async function graphForUi() {
  const [nodes, edges] = await sql<any[]>(`
    SELECT id, name ?? title ?? deal_name AS label, meta::tb(id) AS type FROM company, department, person, product, account, contact, contract, deal, approval, meeting, ticket, policy, tool;
    SELECT in, out, meta::tb(id) AS rel FROM member_of, reports_to, owns, manages, attended, about, raised, covers, includes, requested, decided, works_at, uses_tool;
  `);
  return { nodes, edges };
}

/** Read-only projection of the company graph, copied into every tool's own database as kg_* tables. */
export async function kgProjection(): Promise<Record<string, unknown[]>> {
  const [people, accounts, deals, approvals, tickets, contracts, policies, products] = await sql<any[]>(`
    SELECT meta::id(id) AS key, name, title, email, level, approval_limit_pct, array::first(->member_of->department.name) AS department, array::first(->reports_to->person.name) AS manager FROM person;
    SELECT meta::id(id) AS key, name, segment, industry, region, arr, health, employees, <-manages<-person.name AS team, <-works_at<-contact.{name, title, role, email} AS contacts, <-raised<-ticket.{title, priority, status} AS tickets, <-covers<-contract.{name, value, end, notice_days, auto_renew} AS contracts FROM account;
    SELECT meta::id(id) AS key, name, value, stage, probability, <string> close AS close, discount_pct, next_step, array::first(<-owns<-person.name) AS owner, array::first(->about->account.name) AS account FROM deal;
    SELECT deal_name, discount_pct, status, reason, <string> at AS at, approver_title, array::first(<-requested<-person.name) AS requested_by, array::first(<-decided<-person.name) AS decided_by FROM approval ORDER BY at DESC;
    SELECT title, priority, status, <string> opened AS opened, array::first(<-raised<-account.name) AS account FROM ticket;
    SELECT name, value, <string> end AS end, auto_renew, notice_days, array::first(->covers->account.name) AS account, ->includes->product.name AS products FROM contract;
    SELECT meta::id(id) AS key, name, stages, tiers, margin_floor_pct, p1_hours, p2_hours, rule, <string> effective AS effective FROM policy;
    SELECT name, kind, list_price, unit FROM product;
  `);
  return { kg_people: people, kg_accounts: accounts, kg_deals: deals, kg_approvals: approvals, kg_tickets: tickets, kg_contracts: contracts, kg_policies: policies, kg_products: products };
}
