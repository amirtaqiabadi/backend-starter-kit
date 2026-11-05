import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import path from "node:path";

const assets: Record<string, string> = {
  "swagger-ui-bundle.js": "text/javascript; charset=utf-8",
  "swagger-ui-standalone-preset.js": "text/javascript; charset=utf-8",
  "swagger-ui.css": "text/css; charset=utf-8",
  "favicon-32x32.png": "image/png",
  "favicon-16x16.png": "image/png",
};

const require = createRequire(path.join(process.cwd(), "package.json"));

/** Why: only the Swagger UI files are exposed, so a path cannot read the rest of the package. */
export async function GET(_request: Request, context: { params: Promise<{ file: string }> }) {
  const { file } = await context.params;
  const contentType = assets[file];
  if (!contentType) {
    return new Response(null, { status: 404 });
  }
  const dist = path.dirname(require.resolve("swagger-ui-dist/package.json"));
  const target = path.resolve(dist, file);
  if (!target.startsWith(`${dist}${path.sep}`)) {
    return new Response(null, { status: 404 });
  }
  const bytes = await readFile(target);
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400",
    },
  });
}
