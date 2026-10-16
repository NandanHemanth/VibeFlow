import { sqlOne } from "../src/harness/surreal";
sqlOne<any[]>(`SELECT step, status, detail, at FROM run_event WHERE run = $r AND status IN ['ok','error','done'] ORDER BY at`, { r: process.argv[2] })
  .then((rows) => rows.forEach((e) => console.log(e.step, e.status, String(e.detail ?? "").slice(0, 140))));
