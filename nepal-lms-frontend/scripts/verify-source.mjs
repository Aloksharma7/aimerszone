import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";

const root = process.cwd();
const sourceRoot = join(root, "src");
const errors = [];

function walk(directory) {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const files = walk(sourceRoot).filter((path) => [".ts", ".tsx"].includes(extname(path)));
const normalized = (path) => relative(root, path).replaceAll("\\", "/");

function localTargetExists(specifier) {
  const base = specifier.startsWith("@/") ? join(sourceRoot, specifier.slice(2)) : null;
  if (!base) return true;
  return [base, `${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}.jsx`, join(base, "index.ts"), join(base, "index.tsx")].some(existsSync);
}

for (const path of files) {
  const name = normalized(path);
  const text = readFileSync(path, "utf8");
  for (const match of text.matchAll(/from\s+["'](@\/[^"']+)["']/g)) {
    if (!localTargetExists(match[1])) errors.push(`${name}: unresolved local import ${match[1]}`);
  }
  if ((text.includes('from "@/data/mock"') || text.includes('from "@/data/admin"')) && !name.startsWith("src/lib/data/")) {
    errors.push(`${name}: page/component bypasses the data-service boundary`);
  }
  for (const pattern of [
    [/href\s*=\s*["']#["']/g, "placeholder hash link"],
    [/javascript:/gi, "javascript URL"],
    // The rule exists to keep credentials out of browser storage. Two files
    // legitimately persist non-secret client state and are exempt: the device
    // id sent as X-Device-Id, and the offline draft of an in-progress test
    // attempt. Neither holds a token, and the attempt draft is the reason a
    // dropped connection mid-exam does not lose the student's answers.
    [/\b(?:localStorage|sessionStorage)\b/g, "browser token/state storage", ["src/lib/api/device-id.ts", "src/lib/data/attempt-draft.ts"]],
    [/Authorization\s*:\s*["'`]Bearer/gi, "browser bearer token"],
  ]) {
    if (pattern[2]?.includes(name)) continue;
    if (pattern[0].test(text)) errors.push(`${name}: contains ${pattern[1]}`);
  }
  for (const match of text.matchAll(/<button\b([\s\S]*?)>/g)) {
    if (!/\btype\s*=/.test(match[1])) errors.push(`${name}: raw button without an explicit type`);
  }

  for (const match of text.matchAll(/<Button\b([\s\S]*?)>/g)) {
    const attributes = match[1];
    if (!/\bonClick\s*=|\btype\s*=\s*["'](?:submit|reset)["']|\bdisabled\b/.test(attributes)) {
      errors.push(`${name}: Button component has no action, submit behavior or disabled state`);
    }
  }
  for (const match of text.matchAll(/<button\b([\s\S]*?)>/g)) {
    const attributes = match[1];
    if (/\btype\s*=\s*["']button["']/.test(attributes) && !/\bonClick\s*=|\bdisabled\b/.test(attributes)) {
      errors.push(`${name}: raw type=button has no handler or disabled state`);
    }
  }
}

const layoutExpectations = {
  "src/app/student/layout.tsx": 'role="student"',
  "src/app/teacher/layout.tsx": 'role="teacher"',
  "src/app/staff/layout.tsx": 'role="staff"',
  "src/app/accounting/layout.tsx": 'role="accounting"',
  "src/app/admin/layout.tsx": 'role="admin"',
};
for (const [name, marker] of Object.entries(layoutExpectations)) {
  const text = readFileSync(join(root, name), "utf8");
  if (!text.includes("ProtectedPortalLayout") || !text.includes(marker)) errors.push(`${name}: missing protected role layout`);
}

const productionEnv = readFileSync(join(root, ".env.production.example"), "utf8");
if (!/NEXT_PUBLIC_USE_MOCK_DATA="false"/.test(productionEnv) || !/ALLOW_MOCK_DATA_IN_PRODUCTION="false"/.test(productionEnv)) {
  errors.push(".env.production.example: mock data is not disabled");
}

const pageCount = walk(join(sourceRoot, "app")).filter((path) => path.endsWith("/page.tsx") || path.endsWith("\\page.tsx")).length;
if (pageCount < 108) errors.push(`route count unexpectedly low: ${pageCount}`);

const openApi = readFileSync(join(root, "contract/openapi.yaml"), "utf8");
/*
 * The root copy only exists in the combined monorepo checkout. When the two
 * applications are unzipped side by side there is no parent contract to
 * compare against, and demanding one failed the build for a layout that is
 * perfectly valid. Compared when present, skipped when not.
 */
const rootOpenApiPath = resolve(root, "../contract/openapi.yaml");
if (existsSync(rootOpenApiPath) && readFileSync(rootOpenApiPath, "utf8") !== openApi) {
  errors.push("frontend and root OpenAPI contracts differ");
}
const openApiPathCount = (openApi.match(/^  \/[^\n]+:/gm) || []).length;
if (openApiPathCount < 131) errors.push(`OpenAPI path count unexpectedly low: ${openApiPathCount}`);
const operationIds = [...openApi.matchAll(/^\s+operationId:\s+([^\s]+)$/gm)].map((match) => match[1]);
if (operationIds.length < 150) errors.push(`OpenAPI operation count unexpectedly low: ${operationIds.length}`);
if (new Set(operationIds).size !== operationIds.length) errors.push("OpenAPI operation IDs are not unique");

if (errors.length) {
  console.error(`Source verification failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log(`Source verification passed: ${files.length} TypeScript files, ${pageCount} page routes, ${openApiPathCount} OpenAPI paths, ${operationIds.length} unique operations.`);
