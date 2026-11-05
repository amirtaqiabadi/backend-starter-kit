/** Why: the service has no screen of its own, so the root address opens the API docs. */
export function GET(request: Request) {
  return Response.redirect(new URL("/docs", request.url), 302);
}
