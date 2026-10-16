// Verifier QA in Anchor's cloud Chromium (never a local browser). One session per run, always deleted.
import { chromium } from "playwright-core";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { env } from "@/lib/env";

export async function anchorQa(url: string, run: string, previewToken?: string) {
  if (!env.anchorKey) return { ok: true, summary: "Anchor key not set — skipped", shot: null, errors: [], liveView: null };
  const r = await fetch("https://api.anchorbrowser.io/v1/sessions", {
    method: "POST", headers: { "anchor-api-key": env.anchorKey, "Content-Type": "application/json" },
    body: JSON.stringify({ session: { timeout: { max_duration: 5, idle_timeout: 2 } } }),
  });
  const j = await r.json();
  const data = j.data ?? j;
  if (!data.cdp_url) throw new Error("Anchor session failed: " + JSON.stringify(j).slice(0, 200));
  const errors: string[] = [];
  let shot: string | null = null;
  try {
    const browser = await chromium.connectOverCDP(data.cdp_url);
    const ctx = browser.contexts()[0];
    if (previewToken) await ctx.setExtraHTTPHeaders({ "x-daytona-preview-token": previewToken, "X-Daytona-Skip-Preview-Warning": "true" });
    const page = ctx.pages()[0] ?? (await ctx.newPage());
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 200)); });
    page.on("pageerror", (e) => errors.push(e.message.slice(0, 200)));
    // Capture failing API calls with the server's message so the repair agent sees the real SurrealQL error.
    page.on("response", async (res) => {
      if (res.status() >= 400 && res.url().includes("/api/")) {
        let body = ""; try { body = (await res.text()).slice(0, 300); } catch { /* */ }
        let sent = ""; try { sent = (res.request().postData() ?? "").slice(0, 300); } catch { /* */ }
        errors.push(`API ${res.status()} ${new URL(res.url()).pathname}: ${body} | request: ${sent}`);
      }
    });
    await page.setViewportSize({ width: 1440, height: 900 }).catch(() => {});
    await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
    await page.waitForTimeout(2500);
    const bodyText = (await page.locator("body").innerText().catch(() => "")).trim();
    if (bodyText.includes("VibeFlow tool runtime ready") || bodyText.length < 40) errors.push("Blank page: the generated tool rendered no content (starter template or empty App)");
    const buf = await page.screenshot({ type: "png" });
    const dir = path.join(process.cwd(), "public", "shots");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, `${run}.png`), buf);
    shot = `/shots/${run}.png`;
    await browser.close();
  } finally {
    await fetch(`https://api.anchorbrowser.io/v1/sessions/${data.id}`, { method: "DELETE", headers: { "anchor-api-key": env.anchorKey } }).catch(() => {});
  }
  const real = errors.filter((e) => !/favicon|fonts\.g|Failed to load resource/i.test(e));
  return { ok: real.length === 0, summary: real.length ? `${real.length} console error(s): ${real[0]}` : "page rendered, 0 console errors", shot, errors: real, liveView: data.live_view_url ?? null };
}
