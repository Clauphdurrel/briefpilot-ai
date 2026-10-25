export const dynamic = "force-dynamic";
/** Liveness only: no connection strings, versions or costly dependency calls. */
export function GET() {
  return Response.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
}
