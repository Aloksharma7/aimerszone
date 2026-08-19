#!/usr/bin/env node
/*
 * Fails the build on navigation faults that are invisible in review but
 * obvious to a user:
 *
 *   1. a page no link anywhere points at    -> a feature that was built and
 *                                              can never be found
 *   2. a link pointing at no page           -> a 404 the user walks into
 *   3. a detail or "new" page with no route back to its list
 *
 * All three shipped at least once. Each was found by hand, after the fact,
 * by someone using the product.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const APP = "src/app";
const SRC = "src";

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const files = walk(SRC).filter((f) => f.endsWith(".ts") || f.endsWith(".tsx"));

// Every rendered route, with dynamic segments normalised to {}.
const routes = new Set();
for (const file of files) {
  if (!file.endsWith("page.tsx")) continue;
  const dir = relative(APP, file.replace(/\/page\.tsx$/, ""));
  if (dir.startsWith("..")) continue;
  const route =
    "/" +
    dir
      .split("/")
      .filter((seg) => seg && !/^\(.+\)$/.test(seg))
      .map((seg) => (/^\[.+\]$/.test(seg) ? "{}" : seg))
      .join("/");
  routes.add(route === "/" ? "/" : route.replace(/\/$/, ""));
}

// Every internal link, same normalisation.
const links = new Map();
for (const file of files) {
  const text = readFileSync(file, "utf8");
  // href="..." and href={`...`} in JSX, plus href: "..." in nav/tab data.
  for (const match of text.matchAll(/href[=:]\s*(?:"([^"]+)"|\{?`([^`]+)`\}?|\{"([^"]+)"\})/g)) {
    const raw = match[1] || match[2] || match[3];
    if (!raw.startsWith("/") || raw.startsWith("/api/")) continue;
    const href =
      "/" +
      raw
        .split("?")[0]
        .split("#")[0]
        .split("/")
        .filter(Boolean)
        .map((seg) => (seg.includes("${") ? "{}" : seg))
        .join("/");
    if (!links.has(href)) links.set(href, new Set());
    links.get(href).add(relative(SRC, file));
  }
}

// Reached by a redirect or a router push rather than a link.
const REACHED_IN_CODE = new Set([
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/change-password",
  "/verify-email",
  "/two-factor-challenge",
  "/unauthorized",
  "/offline",
  "/student/payments/esewa/success",
  "/student/payments/esewa/failure",

  // Linked from a variable base (CourseCard's detailHref, the course
  // workspace tab list, RecordingLibrary's href) rather than a literal, so
  // the scan cannot see the target. Verified by hand.
  "/student/explore/{}",
  "/student/recordings/{}",
  "/student/attempts/{}",
  "/student/courses/{}/announcements",
  "/student/courses/{}/resources",
  "/student/courses/{}/syllabus",
  "/student/courses/{}/tests",
  "/student/courses/{}/attendance",
  "/teacher/batches/{}/resources",

  // Linked through portalPath(), which rewrites the portal segment at request
  // time so the link stays inside whichever portal the user is in.
  "/staff/enrollment-requests/new",
  "/admin/enrollment-requests/new",
  "/staff/support/{}",
  "/admin/support/{}",
]);

const failures = [];

for (const route of [...routes].sort()) {
  if (route === "/" || REACHED_IN_CODE.has(route)) continue;
  if (links.has(route)) continue;
  // A dynamic route counts as reachable if a link matches it segment-wise.
  const segments = route.split("/");
  // A wildcard on either side matches: a route may be dynamic, and a link may
  // be built from a variable (`/${role}/dashboard`).
  const reachable = [...links.keys()].some((href) => {
    const other = href.split("/");
    return other.length === segments.length && segments.every((seg, i) => seg === "{}" || other[i] === "{}" || seg === other[i]);
  });
  if (!reachable) failures.push(`unreachable page: ${route} — nothing links to it`);
}

for (const [href, sources] of [...links.entries()].sort()) {
  if (routes.has(href)) continue;
  const segments = href.split("/");
  const matched = [...routes].some((route) => {
    const other = route.split("/");
    return other.length === segments.length && other.every((seg, i) => seg === "{}" || segments[i] === "{}" || seg === segments[i]);
  });
  if (!matched) failures.push(`broken link: ${href} — from ${[...sources].join(", ")}`);
}

for (const file of files) {
  if (!file.endsWith("page.tsx")) continue;
  const dir = relative(APP, file.replace(/\/page\.tsx$/, ""));
  const segments = dir.split("/").filter(Boolean);
  const last = segments[segments.length - 1];
  if (!last || (!/^\[.+\]$/.test(last) && last !== "new")) continue;
  const text = readFileSync(file, "utf8");
  const hasWayBack =
    text.includes("back={{") ||
    text.includes("ArrowLeft") ||
    text.includes("export { default }") ||
    text.includes("CourseWorkspaceHeader") ||
    // These components render their own chrome, including the way back.
    text.includes("TestBuilder") ||
    text.includes("TestRunner");
  if (!hasWayBack) failures.push(`dead end: /${dir} — no link back to its list`);
}

/*
 * Third check: a helper used without an import.
 *
 * The public course page called getSessionUser() with no import statement,
 * which threw on every visit. Brace balance passed, the imports that were
 * written all resolved, and nothing looked for the ones that were missing.
 */
const HELPERS = [
  "getSessionUser",
  "requirePortalAccess",
  "requirePermission",
  "preferredPortalHome",
  "portalPath",
  "searchTerm",
  "matchesQuery",
  "firstParam",
  "buildQueryString",
  "formatNpr",
  "kathmanduToday",
  "isMockDataEnabled",
  "refreshPublicCatalogue",
];

for (const file of files) {
  const text = readFileSync(file, "utf8");
  const code = text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*/g, "");
  for (const helper of HELPERS) {
    if (!new RegExp(`\\b${helper}\\s*\\(`).test(code)) continue;
    const imported = new RegExp(`import[^;]*\\b${helper}\\b[^;]*;`).test(code);
    const declared = new RegExp(`(function|const|let)\\s+${helper}\\b`).test(code);
    if (!imported && !declared) failures.push(`missing import: ${helper} used in ${relative(SRC, file)}`);
  }
}

/*
 * Fourth check: a JSX component used but never imported.
 *
 * Same class as the missing getSessionUser import, and the one that turns a
 * working page into a blank error. Destructured renames ({ icon: Icon }) and
 * TypeScript generics are excluded.
 */
const TS_BUILTINS = new Set([
  "Record", "File", "Map", "Set", "Array", "Partial", "Promise", "Omit", "Pick", "React",
  "HTMLFormElement", "HTMLDivElement", "HTMLInputElement", "HTMLElement", "Event", "Error",
]);

for (const file of files) {
  if (!file.endsWith(".tsx")) continue;
  const code = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  const declared = new Set(TS_BUILTINS);
  for (const match of code.matchAll(/import\s+([\w*\s{},]+?)\s+from/g)) {
    for (const part of match[1].replace(/\btype\b/g, "").split(/[{},]/)) {
      const name = part.trim().split(" as ").pop()?.trim();
      if (name && name !== "*") declared.add(name);
    }
  }
  for (const match of code.matchAll(/(?:function|const|let|class|type)\s+([A-Z_]\w*)/g)) declared.add(match[1]);
  for (const match of code.matchAll(/:\s*([A-Z]\w*)\s*[},]/g)) declared.add(match[1]);

  // Array-destructured parameters:  tabs.map(([Icon, label]) => <Icon .../>)
  for (const match of code.matchAll(/\(\s*\[([^\]]*)\]\s*\)\s*=>/g)) {
    for (const part of match[1].split(",")) {
      const name = part.trim();
      if (/^[A-Z]\w*$/.test(name)) declared.add(name);
    }
  }

  // Object-destructured parameters:  cards.map(({ Icon, title }) => <Icon .../>)
  for (const match of code.matchAll(/\(\s*\{([^}]*)\}\s*\)\s*=>/g)) {
    for (const part of match[1].split(",")) {
      const name = part.split(":").pop()?.trim();
      if (name && /^[A-Z]/.test(name)) declared.add(name);
    }
  }

  for (const match of code.matchAll(/(^|[\s({>&|?:,=[])<([A-Z][\w.]*)/gm)) {
    const base = match[2].split(".")[0];
    if (!declared.has(base)) failures.push(`undefined component: <${match[2]}> in ${relative(SRC, file)}`);
  }
}

/*
 * Fifth check: a form control with a border and no focus style.
 *
 * Thirty of these shipped. A keyboard user gets no indication of where they
 * are, which is a WCAG 2.4.7 failure and reads as a broken form.
 */
for (const file of files) {
  if (!file.endsWith(".tsx")) continue;
  const code = readFileSync(file, "utf8");
  for (const match of code.matchAll(/<(input|select|textarea)\b([^>]*)>/gs)) {
    const attrs = match[2];
    if (/type="(checkbox|radio|file|hidden|search)"/.test(attrs)) continue;
    const cls = attrs.match(/className="([^"]*)"/);
    if (!cls) continue;
    if (cls[1].includes("border") && !cls[1].includes("focus:")) {
      failures.push(`no focus style: <${match[1]}> in ${relative(SRC, file)}`);
    }
  }
}

if (failures.length) {
  console.error(`\nNavigation check failed (${failures.length}):\n`);
  for (const failure of failures) console.error(`  ${failure}`);
  console.error("");
  process.exit(1);
}

console.log(`Navigation check passed: ${routes.size} routes, ${links.size} link targets.`);
