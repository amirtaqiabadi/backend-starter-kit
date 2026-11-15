// Keep the Prisma CLI available for private-network migrations without runtime downloads.
async function main() {
  const { default: fs } = await import("node:fs/promises");
  const { default: path } = await import("node:path");
  const { default: nft } = await import("next/dist/compiled/@vercel/nft/index.js");
  const { nodeFileTrace } = nft;
  const destination = path.resolve(".next/standalone");
  const { fileList } = await nodeFileTrace([
    "node_modules/prisma/build/index.js",
    "prisma7.config.ts",
  ]);

  for (const file of fileList) {
    const target = path.join(destination, file);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.cp(file, target, { recursive: true, dereference: true });
  }

  // Prisma chooses this native executable dynamically, outside static tracing.
  await fs.cp("node_modules/@prisma/engines", path.join(destination, "node_modules/@prisma/engines"), {
    recursive: true,
    dereference: true,
  });
  await fs.cp("prisma", path.join(destination, "prisma"), { recursive: true });
  console.log("Prisma migration tooling included in standalone output.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
