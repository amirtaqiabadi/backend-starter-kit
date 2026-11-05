const page = `<!doctype html>
<html lang="fa">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>backend-starter-kit API</title>
    <link rel="stylesheet" href="/docs/assets/swagger-ui.css" />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="/docs/assets/swagger-ui-bundle.js"></script>
    <script src="/docs/assets/swagger-ui-standalone-preset.js"></script>
    <script>
      window.ui = SwaggerUIBundle({
        url: "/openapi.json",
        dom_id: "#swagger-ui",
        presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
        layout: "BaseLayout",
      });
    </script>
  </body>
</html>`;

/** Why: the API is viewed from this page because the project has no application screens. */
export function GET() {
  return new Response(page, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
