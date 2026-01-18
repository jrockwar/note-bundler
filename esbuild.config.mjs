import esbuild from "esbuild";

const isProd = process.argv.includes("--production");
const isWatch = process.argv.includes("--watch");

const ctx = await esbuild.context({
  entryPoints: ["src/main.ts"],
  bundle: true,
  format: "cjs",
  platform: "node",
  target: "es2020",
  outfile: "main.js",
  external: ["obsidian"],
  sourcemap: isProd ? false : "inline",
  logLevel: "info",
});

if (isWatch) {
  await ctx.watch();
  console.log("Note Bundler: watching for changes...");
} else {
  await ctx.rebuild();
  await ctx.dispose();
}
