// Stand-in for the authority's notification endpoint (Appendix B · Output).
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body?.Header?.BatchId || !Array.isArray(body?.Notifications)) {
    return Response.json({ responseId: null, status: "FAILED" }, { status: 400 });
  }
  const d = new Date();
  const responseId = `ABS-${d.toISOString().slice(0, 10)}-${String(Math.floor(Math.random() * 1e6)).padStart(6, "0")}`;
  return Response.json({ responseId, status: "SUCCESS" });
}
