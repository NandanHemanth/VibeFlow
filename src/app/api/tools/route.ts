import { sqlOne } from "@/harness/surreal";
 
export async function GET() {
  try {
    const tools = await sqlOne<any[]>(`SELECT *, ->version_of->tool_version.* AS versions, ->built_with->procedure.name AS procedures FROM tool ORDER BY updated DESC`);
    return Response.json({ tools });
  } catch (e) { return Response.json({ tools: [], error: (e as Error).message }); }
}
