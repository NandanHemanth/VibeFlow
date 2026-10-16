import { ensureSnapshot, daytona } from "../src/harness/daytona";
(async () => {
  const t = Date.now();
  const s: any = await ensureSnapshot((l) => process.stdout.write(l.endsWith("\n") ? l : l + "\n"));
  console.log("SNAPSHOT", s?.name, s?.state, (Date.now() - t) / 1000, "s");
  const list: any = await daytona().secret.list().catch((e: any) => ({ err: e.message }));
  console.log("SECRETS API", JSON.stringify(list).slice(0, 200));
})().catch((e) => { console.error("FAIL", e.message); process.exit(1); });
