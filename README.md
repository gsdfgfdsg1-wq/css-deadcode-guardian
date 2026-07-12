# css-deadcode-guardian

A dependency-free CLI that compares CSS selectors with HTML, JSX/TSX, Vue, and Svelte source files to surface style debt before it becomes production debt.

It reports:

- selectors with missing class or ID references;
- conflicting duplicate declarations in the same selector;
- `!important` declarations;
- high-specificity selectors;
- dynamic class expressions that need human review.

## Quick start

Requires Node.js 20 or later.

```bash
npx css-deadcode-guardian \
  --css examples/styles.css \
  --sources examples/page.html \
  --output css-guardian-report.json \
  --fail-on any
```

The command writes a machine-readable JSON report and returns exit code `1` when the selected CI policy is violated.

## CLI

```text
--css <file>            CSS stylesheet to analyze
--sources <files>       Comma-separated HTML, JSX/TSX, Vue, or Svelte files
--output <file>         JSON report path, default: css-guardian-report.json
--fail-on <policy>      unused, risk, or any
```

## How matching works

Static `class`, `className`, and `id` attributes are matched directly. String literals inside JSX expressions are also included. Dynamic expressions such as `clsx(...)`, ternaries, concatenation, and template interpolation are retained in `dynamicUsage` so that the report does not claim they are safe to remove.

A selector containing an unreferenced class or ID is reported as unused. Element-only selectors are intentionally not marked unused because they require DOM/runtime knowledge.

## CI example

```yaml
- name: Guard CSS debt
  run: |
    npx css-deadcode-guardian \
      --css dist/assets/app.css \
      --sources "src/**/*.tsx" \
      --output artifacts/css-guardian.json \
      --fail-on risk
```

For shell glob expansion, pass the expanded file list as a comma-separated value or invoke the CLI from your build script.

## Development

```bash
npm test
node src/cli.js --css examples/styles.css --sources examples/page.html --output report.json
```

## Limits

This first release is a conservative static analyzer. It does not execute application code, inspect CSS-in-JS, or resolve framework-specific generated class names. Treat `dynamicUsage` as an explicit review queue, not an automatic deletion signal.

## License

MIT
