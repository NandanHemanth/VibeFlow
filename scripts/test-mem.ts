import { memory, SCOPES } from "../src/harness/memory";
const B = `${process.env.SPECTRON_URL!.replace(/\/$/, "")}/api/v1/${process.env.SPECTRON_CONTEXT_ID}`;
const H = { Authorization: `Bearer ${process.env.SPECTRON_API_KEY}`, "Content-Type": "application/json" };
(async () => {
  for (const body of [{ path: "org/acme" }, { scope: "org/acme" }, { paths: ["org/acme"] }]) {
    const r = await fetch(`${B}/scopes`, { method: "POST", headers: H, body: JSON.stringify(body) });
    console.log(JSON.stringify(body), r.status, (await r.text()).slice(0, 150));
  }
  const r = await fetch(`${B}/scopes`, { headers: H }); console.log((await r.text()).slice(0, 300));
})();
