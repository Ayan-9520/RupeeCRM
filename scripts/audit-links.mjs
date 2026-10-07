import fs from "node:fs";
import path from "node:path";

const root = path.resolve("src");
const files = [];
const walk = (d) => {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (/\.(tsx?|jsx?)$/.test(f) && !f.includes("routeTree.gen")) files.push(p);
  }
};
walk(root);

const tree = fs.readFileSync(path.join(root, "routeTree.gen.ts"), "utf8");
const block = tree.match(/fullPaths:([\s\S]*?)fileRoutesByTo/);
const routes = new Set(
  [...(block ? block[1] : tree).matchAll(/'([^']+)'/g)].map((m) => m[1].replace(/\/$/, "") || "/")
);

const patterns = [
  /\bto=\{?["'`](\/[^"'`?#{}]*)/g,
  /\bhref=\{?["'`](\/[^"'`?#{}]*)/g,
  /navigate\(\{\s*to:\s*["'`](\/[^"'`?#{}]*)/g,
  /\b(?:to|path|href|url):\s*["'`](\/(?:dashboard|admin|partner|auth|login|signup|settings)[^"'`?#{}]*)/g,
];

const matchRoute = (url) => {
  if (routes.has(url)) return true;
  for (const r of routes) {
    if (!r.includes("$")) continue;
    const re = new RegExp("^" + r.replace(/\$[^/]+/g, "[^/]+") + "$");
    if (re.test(url)) return true;
  }
  return false;
};

const broken = [];
for (const f of files) {
  const src = fs.readFileSync(f, "utf8");
  for (const re of patterns) {
    for (const m of src.matchAll(re)) {
      const url = m[1].replace(/\/$/, "") || "/";
      if (url.startsWith("/api") || /\.[a-z0-9]{2,5}$/i.test(url) || url.includes("$")) continue;
      if (!matchRoute(url)) broken.push(`${path.relative(root, f)}: ${url}`);
    }
  }
}
console.log("routes:", routes.size);
console.log([...new Set(broken)].join("\n") || "no broken links");
