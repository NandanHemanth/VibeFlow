import { graphForUi } from "@/harness/kg";
 
export async function GET() {
  try { return Response.json(await graphForUi()); } catch (e) { return Response.json({ nodes: [], edges: [], error: (e as Error).message }); }
}
