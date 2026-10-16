import { startRun } from "@/harness/pipeline";

export async function POST(req: Request) {
  const { prompt, command } = await req.json();
  const id = await startRun(String(prompt ?? ""), command || undefined);
  return Response.json({ id });
}
