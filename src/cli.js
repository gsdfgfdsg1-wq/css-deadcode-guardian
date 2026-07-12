#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { analyzeCss } from "./analyzer.js";

function usage() { return "Usage: css-deadcode-guardian --css styles.css --sources page.html,app.tsx [--output report.json] [--fail-on unused|risk|any]"; }
function parse(argv) {
  const args = { output: "css-guardian-report.json" };
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (key === "--help") args.help = true;
    else if (["--css", "--sources", "--output", "--fail-on"].includes(key)) args[key.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = argv[++i];
    else throw new Error(`Unknown argument: ${key}`);
  }
  return args;
}
async function main() {
  const args = parse(process.argv.slice(2));
  if (args.help) return console.log(usage());
  if (!args.css || !args.sources) throw new Error(usage());
  const css = await fs.readFile(args.css, "utf8");
  const sourcePaths = args.sources.split(",").map((value) => value.trim()).filter(Boolean);
  const sources = await Promise.all(sourcePaths.map((file) => fs.readFile(file, "utf8")));
  const report = analyzeCss(css, sources);
  report.files = { css: path.resolve(args.css), sources: sourcePaths.map((file) => path.resolve(file)) };
  await fs.writeFile(args.output, JSON.stringify(report, null, 2) + "\n");
  console.log(`CSS Guardian: ${report.summary.unusedSelectors} unused, ${report.summary.duplicateDeclarations} duplicate declaration group(s), ${report.summary.risks} risk(s).`);
  const fail = args.failOn === "unused" ? report.summary.unusedSelectors > 0 : args.failOn === "risk" ? report.summary.risks > 0 : args.failOn === "any" ? report.summary.unusedSelectors + report.summary.risks + report.summary.duplicateDeclarations > 0 : false;
  if (args.failOn && !["unused", "risk", "any"].includes(args.failOn)) throw new Error("--fail-on must be unused, risk, or any.");
  if (fail) process.exitCode = 1;
}
main().catch((error) => { console.error(`css-deadcode-guardian: ${error.message}`); process.exitCode = 2; });
