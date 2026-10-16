import { sqlOne } from "@/harness/surreal";
import { getSandbox, sshAccess } from "@/harness/daytona";

export async function POST(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const t = await sqlOne<any>(`SELECT * FROM ONLY type::record("tool", $s)`, { s: slug });
  const sb = await getSandbox(t.sandbox);
  return Response.json({ ssh: await sshAccess(sb) });
}
