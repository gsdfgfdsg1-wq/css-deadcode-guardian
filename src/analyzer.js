const CLASS_TOKEN = /\.([_a-zA-Z][\w-]*)/g;
const ID_TOKEN = /#([_a-zA-Z][\w-]*)/g;

function unique(items) { return [...new Set(items)]; }

export function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

export function parseCss(css) {
  const rules = [];
  const source = stripComments(css);
  const pattern = /([^{}@][^{}]*)\{([^{}]*)\}/g;
  let match;
  while ((match = pattern.exec(source))) {
    const selectors = match[1].split(",").map((value) => value.trim()).filter(Boolean);
    const declarations = match[2].split(";").map((value) => value.trim()).filter(Boolean).map((declaration) => {
      const colon = declaration.indexOf(":");
      return colon === -1 ? null : { property: declaration.slice(0, colon).trim(), value: declaration.slice(colon + 1).trim() };
    }).filter(Boolean);
    selectors.forEach((selector) => rules.push({ selector, declarations, start: match.index }));
  }
  return rules;
}

export function extractUsage(source) {
  const classes = new Set();
  const ids = new Set();
  const dynamicMarkers = [];
  const staticAttributes = /\b(?:class|className)\s*=\s*["']([^"']+)["']/g;
  let match;
  while ((match = staticAttributes.exec(source))) match[1].split(/\s+/).filter(Boolean).forEach((name) => classes.add(name));
  const idAttributes = /\bid\s*=\s*["']([^"']+)["']/g;
  while ((match = idAttributes.exec(source))) ids.add(match[1]);
  const jsxExpression = /\b(?:className|class)\s*=\s*\{([^}]+)\}/g;
  while ((match = jsxExpression.exec(source))) {
    const literals = match[1].match(/["'`]([^"'`\s]+)["'`]/g) ?? [];
    literals.forEach((literal) => literal.slice(1, -1).split(/\s+/).forEach((name) => classes.add(name)));
    if (!literals.length || /\?|\+|\$\{|clsx|classnames/.test(match[1])) dynamicMarkers.push(match[1].trim());
  }
  return { classes, ids, dynamicMarkers };
}

export function specificity(selector) {
  const ids = (selector.match(/#[\w-]+/g) ?? []).length;
  const classes = (selector.match(/\.[\w-]+|\[[^\]]+\]|:(?!:)[\w-]+(?:\([^)]*\))?/g) ?? []).length;
  const elements = (selector.match(/(^|[\s>+~])([a-z][\w-]*|::[\w-]+)/gi) ?? []).length;
  return [ids, classes, elements];
}

function selectorTokens(selector, regex) { return unique([...selector.matchAll(regex)].map((match) => match[1])); }

export function analyzeCss(css, sources, options = {}) {
  const rules = parseCss(css);
  const usage = sources.reduce((acc, source) => {
    const found = extractUsage(source);
    found.classes.forEach((value) => acc.classes.add(value));
    found.ids.forEach((value) => acc.ids.add(value));
    acc.dynamicMarkers.push(...found.dynamicMarkers);
    return acc;
  }, { classes: new Set(), ids: new Set(), dynamicMarkers: [] });
  const unused = [];
  const risks = [];
  const declarationIndex = new Map();

  rules.forEach((rule) => {
    const classes = selectorTokens(rule.selector, CLASS_TOKEN);
    const ids = selectorTokens(rule.selector, ID_TOKEN);
    const isUsed = !classes.length && !ids.length ? true : classes.every((name) => usage.classes.has(name)) && ids.every((name) => usage.ids.has(name));
    if (!isUsed) unused.push({ selector: rule.selector, missingClasses: classes.filter((name) => !usage.classes.has(name)), missingIds: ids.filter((name) => !usage.ids.has(name)) });
    const score = specificity(rule.selector);
    if (score[0] > 0 || score[1] >= Number(options.highSpecificityClasses ?? 3)) risks.push({ type: "high-specificity", selector: rule.selector, specificity: score });
    rule.declarations.forEach((declaration) => {
      if (/!important\b/.test(declaration.value)) risks.push({ type: "important", selector: rule.selector, property: declaration.property, value: declaration.value });
      const key = `${rule.selector}::${declaration.property}`;
      const seen = declarationIndex.get(key) ?? [];
      seen.push(declaration.value);
      declarationIndex.set(key, seen);
    });
  });
  const duplicates = [...declarationIndex.entries()].filter(([, values]) => new Set(values).size > 1).map(([key, values]) => {
    const [selector, property] = key.split("::");
    return { selector, property, values: unique(values) };
  });
  return {
    summary: { rules: rules.length, unusedSelectors: unused.length, duplicateDeclarations: duplicates.length, risks: risks.length, dynamicUsageDetected: usage.dynamicMarkers.length > 0 },
    unused,
    duplicates,
    risks,
    dynamicUsage: unique(usage.dynamicMarkers)
  };
}
