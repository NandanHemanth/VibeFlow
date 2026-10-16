import * as dt from "../src/harness/daytona";
(async () => {
  const sb = await dt.getSandbox(process.argv[2]);
  for (const u of ["https://surrealdb.com", "https://api.surrealdb.com", "https://registry.npmjs.org", "https://api.anchorbrowser.io", "https://example.com", "https://generativelanguage.googleapis.com", "https://integrate.api.nvidia.com"]) {
    const r = await dt.exec(sb, `node -e "fetch('${u}').then(r=>console.log(r.status)).catch(e=>console.log('BLOCKED',e.cause?.code||e.message))"`, "/home/daytona", 20);
    console.log(u, r.out.trim());
  }
  const d: any = await (sb as any);
  console.log("secret test");
  try { await dt.ensureSecret("vf-probe", "x", ["example.com"]); console.log("secret ok"); } catch (e: any) { console.log("secret err", e.message); }
})();
