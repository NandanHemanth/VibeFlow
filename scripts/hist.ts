import { memory } from "../src/harness/memory";
(async () => {
  const h: any = await memory.history("organisation", "acme_robotics", "sales_pipeline_stages").catch((e) => e.message);
  console.log(JSON.stringify(h, null, 1).slice(0, 2500));
})();
