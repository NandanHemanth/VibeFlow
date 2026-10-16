import { simulate } from "../src/harness/simulate";
import { kgProjection } from "../src/harness/kg";
import { sqlOne } from "../src/harness/surreal";
(async () => {
  const t = Date.now();
  const tool = await sqlOne<any>(`SELECT * FROM ONLY tool:dealdesk`);
  const r = await simulate({ toolName: tool.name, command: tool.command, spec: tool.spec, kg: await kgProjection(), onRound: (i, n) => console.log("round", i, n) });
  console.log((Date.now() - t) / 1000, "s"); console.log(JSON.stringify({ ...r, rounds: r.rounds.map((x) => x.events.slice(0, 2)) }, null, 1).slice(0, 3000));
})().catch((e) => console.log("ERR", e.message));
