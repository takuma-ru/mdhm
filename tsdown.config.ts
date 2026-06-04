import { defineConfig } from "tsdown";

const config = defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
});

export default config;
