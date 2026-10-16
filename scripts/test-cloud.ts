import { sql } from "../src/harness/surreal";
import { memory } from "../src/harness/memory";
import { surrealHttpBase } from "../src/lib/env";
(async () => {
  console.log("http base host:", new URL(surrealHttpBase()).host.replace(/^[^.]+/, "***"));
  try { const r = await sql("RETURN 1; INFO FOR ROOT;"); console.log("surreal ok", JSON.stringify(r).slice(0, 160)); } catch (e: any) { console.log("surreal ERR", e.message.slice(0, 300)); }
  try { console.log("memory /me", JSON.stringify(await memory.me()).slice(0, 300)); } catch (e: any) { console.log("memory ERR", e.message.slice(0, 300)); }
  try { console.log("scopes", JSON.stringify(await (await fetch(`${process.env.SPECTRON_URL!.replace(/\/$/, "")}/api/v1/${process.env.SPECTRON_CONTEXT_ID}/scopes`, { headers: { Authorization: `Bearer ${process.env.SPECTRON_API_KEY}` } })).json()).slice(0, 300)); } catch (e: any) { console.log("scopes ERR", e.message); }
})();
