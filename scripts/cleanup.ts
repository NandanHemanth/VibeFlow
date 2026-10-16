import { daytona } from "../src/harness/daytona";
(async () => {
  const d = daytona();
  for await (const s of d.list() as AsyncIterable<any>) { console.log("delete", s.id, s.labels?.tool, s.state); await s.delete().catch((e: any) => console.log("err", e.message)); }
  const sec: any = await d.secret.list();
  for (const s of sec.items ?? []) if (s.name === "vf-probe") { await d.secret.delete(s.id); console.log("deleted secret probe"); }
})();
