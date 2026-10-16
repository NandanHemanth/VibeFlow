// Deletes VibeFlow sandboxes that no registered /command uses. Keys, secrets, snapshots and data are untouched.
// Usage: npx tsx scripts/cleanup.ts          (dry run)
//        npx tsx scripts/cleanup.ts --apply  (delete)
import { daytona } from "../src/harness/daytona";
import { sqlOne } from "../src/harness/surreal";
(async () => {
  const apply = process.argv.includes("--apply");
  const keep = new Set((await sqlOne<string[]>(`SELECT VALUE sandbox FROM tool`).catch(() => [])) ?? []);
  for await (const s of daytona().list() as AsyncIterable<any>) {
    const used = keep.has(s.id);
    console.log(`${used ? "KEEP  " : apply ? "DELETE" : "would delete"} ${s.name ?? s.id} (${s.state}, ${s.labels?.tool ?? "-"})`);
    if (!used && apply) await s.delete().catch((e: any) => console.log("  error:", e.message));
  }
})();
