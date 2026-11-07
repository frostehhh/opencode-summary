// Compiles src/tui.tsx to dist/tui.js with the OpenTUI Solid transform.
//
// opencode does not apply that transform to .tsx files under node_modules, so a
// published package must ship compiled JS. Host-provided modules stay external:
// opencode resolves them from its own runtime so there is a single Solid instance.
import solidPlugin from "@opentui/solid/bun-plugin"

const result = await Bun.build({
  entrypoints: ["./src/tui.tsx"],
  outdir: "./dist",
  target: "bun",
  format: "esm",
  plugins: [solidPlugin],
  external: ["solid-js", "solid-js/*", "@opentui/*", "@opencode/*"],
})

if (!result.success) {
  for (const log of result.logs) console.error(log)
  process.exit(1)
}
console.log(`built ${result.outputs.map((o) => o.path).join(", ")}`)
