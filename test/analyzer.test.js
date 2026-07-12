import test from "node:test";
import assert from "node:assert/strict";
import { analyzeCss, extractUsage, specificity } from "../src/analyzer.js";

test("extracts static and JSX literal class usage", () => {
  const usage = extractUsage('<div class="app primary"></div><Button className={active ? "selected" : "idle"} />');
  assert.deepEqual([...usage.classes].sort(), ["app", "idle", "primary", "selected"]);
  assert.equal(usage.dynamicMarkers.length, 1);
});

test("flags unused selectors and keeps used selectors", () => {
  const report = analyzeCss('.app{color:red}.missing{color:blue}#root{display:block}', ['<main id="root" class="app"></main>']);
  assert.equal(report.summary.unusedSelectors, 1);
  assert.equal(report.unused[0].selector, ".missing");
});

test("detects duplicate declarations and cascade risks", () => {
  const report = analyzeCss('.app{color:red;color:blue!important}#root .app .item .label{display:block}', ['<main id="root" class="app item label"></main>']);
  assert.equal(report.summary.duplicateDeclarations, 1);
  assert.ok(report.risks.some((risk) => risk.type === "important"));
  assert.ok(report.risks.some((risk) => risk.type === "high-specificity"));
});

test("calculates CSS specificity", () => {
  assert.deepEqual(specificity('#root .app button'), [1, 1, 1]);
});
