/** Why: a relative redirect preserves the public domain behind Liara's proxy. */
export function GET() {
  return new Response(null, {
    status: 302,
    headers: { Location: "/docs", "Cache-Control": "no-store" },
  });
}
