import { openApiDocument } from "@/server/openapi";

/** Why: Swagger and external clients both read one JSON document. */
export function GET() {
  return Response.json(openApiDocument());
}
