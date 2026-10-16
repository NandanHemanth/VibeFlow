import * as dt from "../src/harness/daytona";
import { anchorQa } from "../src/harness/qa";
(async () => {
  let t = Date.now(); const lap = (m: string) => { console.log(m, ((Date.now() - t) / 1000).toFixed(1) + "s"); t = Date.now(); };
  const { sandbox, secretMode, firewall } = await dt.createToolSandbox({ slug: "smoke", dbName: "tool_smoke", surrealToken: "test-token", runId: "smoke" });
  lap(`created ${sandbox.id} secret=${secretMode} fw=${firewall}`);
  await dt.prepareWorkspace(sandbox); lap("prepared");
  const env = await dt.exec(sandbox, "echo TOKEN=$SURREAL_TOKEN; echo NS=$SURREAL_NS; node -v; ls node_modules | wc -l"); console.log(env.out);
  await dt.writeFiles(sandbox, { "src/App.tsx": `export default function App(){return <div className="p-10 text-2xl font-semibold text-indigo-600">Smoke test OK</div>}` }); lap("wrote");
  const b = await dt.build(sandbox); console.log("build", b.code, b.out.slice(-200)); lap("built");
  console.log("sha", await dt.commit(sandbox, "smoke").catch((e) => "commit err " + e.message)); lap("commit");
  await dt.startServer(sandbox); lap("server");
  const p = await dt.previewUrls(sandbox); console.log("preview", p.url, "signed", !!p.signed); lap("preview");
  const r = await fetch(p.signed ?? p.url, { headers: p.token ? { "x-daytona-preview-token": p.token } : {} }); console.log("fetch", r.status, (await r.text()).slice(0, 120));
  const q = await anchorQa(p.signed ?? p.url, "smoke", p.token); console.log("qa", q.summary, q.shot); lap("qa");
  console.log("SANDBOX_ID", sandbox.id);
})().catch((e) => { console.error("FAIL", e.message, e.stack?.split("\n").slice(0, 4).join(" | ")); process.exit(1); });
