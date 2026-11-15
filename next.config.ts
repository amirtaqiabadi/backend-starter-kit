import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingIncludes: {
    "/docs/assets/*": [
      "./node_modules/swagger-ui-dist/package.json",
      "./node_modules/swagger-ui-dist/swagger-ui-bundle.js",
      "./node_modules/swagger-ui-dist/swagger-ui-standalone-preset.js",
      "./node_modules/swagger-ui-dist/swagger-ui.css",
      "./node_modules/swagger-ui-dist/favicon-*.png",
    ],
  },
  // Route handlers run on the Node.js runtime so Argon2 and Redis stay available.
};

export default nextConfig;
