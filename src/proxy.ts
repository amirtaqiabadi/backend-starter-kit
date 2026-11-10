import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { corsHeaders } from "@/server/http";

/** Lets the frontend on port 3001 call this API on port 3000 with cookies. */
export function proxy(request: NextRequest) {
  const headers = corsHeaders(request.headers.get("origin"));

  if (request.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers });
  }

  const response = NextResponse.next();
  for (const [name, value] of Object.entries(headers)) {
    response.headers.set(name, value);
  }
  return response;
}

export const config = {
  matcher: "/api/:path*",
};
