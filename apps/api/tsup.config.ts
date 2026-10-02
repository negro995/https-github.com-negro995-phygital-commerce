import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  platform: "node",
  target: "node20",
  sourcemap: true,
  clean: true,
  noExternal: [/^@phygital\//],
  external: ["@prisma/client", ".prisma/client"],
});
