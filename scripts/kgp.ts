import { kgProjection } from "../src/harness/kg";
kgProjection().then((r) => { for (const [k, v] of Object.entries(r)) console.log(k, (v as any[]).length, JSON.stringify((v as any[])[0]).slice(0, 160)); }).catch((e) => console.log("ERR", e.message));
