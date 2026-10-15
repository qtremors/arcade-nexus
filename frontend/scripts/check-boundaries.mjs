/** Parse local imports so ownership checks also cover type imports, re-exports and lazy loaders. */
import ts from "typescript";
import { readFileSync, readdirSync, existsSync, writeFileSync } from "node:fs";
import { resolve, relative, dirname } from "node:path";
import { createHash } from "node:crypto";
const root = resolve(import.meta.dirname, "../src");
function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? files(resolve(dir, entry.name))
      : /\.tsx?$/.test(entry.name) && !entry.name.endsWith(".d.ts")
        ? [resolve(dir, entry.name)]
        : [],
  );
}
const paths = files(root).filter(
  (path) => !relative(root, path).startsWith("__tests__/"),
);
const known = new Set(paths),
  edges = new Map(),
  violations = [];
const name = (path) => relative(root, path).replaceAll("\\", "/");
const pure = (path) =>
  /games\/(?:[^/]+\/(?:codec|.*Simulation|PrismRun|SpaceJourney|flightMotion|racePolicy|raceProgression|collisionPolicy|progressionPolicy)|saveCodec|catalog|simulationEffects)\.ts$/.test(
    name(path),
  );
function destination(path, specifier) {
  if (!specifier.startsWith(".")) return null;
  const base = resolve(dirname(path), specifier);
  return (
    [
      base,
      base + ".ts",
      base + ".tsx",
      resolve(base, "index.ts"),
      resolve(base, "index.tsx"),
    ].find((value) => known.has(value)) ?? null
  );
}
for (const path of paths) {
  const source = readFileSync(path, "utf8"),
    sf = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
  const imports = [];
  function visit(node) {
    let specifier = null,
      kind = "static";
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      specifier = node.moduleSpecifier;
      kind =
        node.isTypeOnly || node.importClause?.isTypeOnly ? "type" : "static";
    }
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword
    ) {
      specifier = node.arguments[0];
      kind = "dynamic";
    }
    if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
      specifier = node.argument.literal;
      kind = "type";
    }
    if (specifier && ts.isStringLiteral(specifier))
      imports.push({ specifier: specifier.text, kind });
    if (
      pure(path) &&
      ts.isIdentifier(node) &&
      /^(?:document|window|HTMLCanvasElement|CanvasRenderingContext2D|HTMLElement|localStorage|navigator)$/.test(
        node.text,
      )
    )
      violations.push(`${name(path)} uses browser global ${node.text}`);
    ts.forEachChild(node, visit);
  }
  visit(sf);
  edges.set(
    path,
    imports.flatMap((item) => {
      const target = destination(path, item.specifier);
      return target ? [{ target, kind: item.kind }] : [];
    }),
  );
  for (const { specifier } of imports) {
    if (
      name(path).startsWith("sdk/") &&
      /(?:stores|services)\//.test(specifier)
    )
      violations.push(`${name(path)} imports application state`);
    if (
      pure(path) &&
      /(?:stores\/|services\/|descriptors$|feedback$|renderer$|CanvasLayer$|GameEngine$|InputManager$|AudioManager$|^react$)/.test(
        specifier,
      )
    )
      violations.push(
        `${name(path)} imports browser/application module ${specifier}`,
      );
    if (
      name(path).startsWith("components/session/") &&
      /(?:api\/|services\/)/.test(specifier)
    )
      violations.push(`${name(path)} bypasses session commands`);
  }
}
function cycles(include) {
  let next = 0;
  const indices = new Map(),
    low = new Map(),
    stack = [],
    active = new Set(),
    groups = [];
  function visit(path) {
    indices.set(path, next);
    low.set(path, next++);
    stack.push(path);
    active.add(path);
    for (const edge of edges.get(path) ?? []) {
      if (!include(edge)) continue;
      if (!indices.has(edge.target)) {
        visit(edge.target);
        low.set(path, Math.min(low.get(path), low.get(edge.target)));
      } else if (active.has(edge.target))
        low.set(path, Math.min(low.get(path), indices.get(edge.target)));
    }
    if (low.get(path) === indices.get(path)) {
      const group = [];
      let item;
      do {
        item = stack.pop();
        active.delete(item);
        group.push(name(item));
      } while (item !== path);
      if (group.length > 1) groups.push(group.sort());
    }
  }
  for (const path of paths) if (!indices.has(path)) visit(path);
  return groups;
}
const runtimeCycles = cycles((edge) => edge.kind !== "type"),
  allCycles = cycles(() => true);
for (const group of allCycles)
  violations.push(`Local import cycle: ${group.join(" -> ")}`);
const report = {
  scope:
    "Production local TypeScript imports, including re-exports, lazy and type imports; external packages and CSS excluded.",
  modules: paths.length,
  staticRuntimeCycles: cycles((edge) => edge.kind === "static"),
  runtimeCycles,
  allImportCycles: allCycles,
  pureModules: paths.filter(pure).map(name).sort(),
  sourceSha256: createHash("sha256")
    .update(
      paths
        .sort()
        .map((path) => name(path) + "\0" + readFileSync(path, "utf8"))
        .join("\0"),
    )
    .digest("hex"),
};
if (process.argv.includes("--report")) {
  const target = process.argv[process.argv.indexOf("--report") + 1];
  if (!target) throw new Error("Supply a report path");
  writeFileSync(target, JSON.stringify(report, null, 2) + "\n");
}
if (violations.length) {
  console.error([...new Set(violations)].join("\n"));
  process.exitCode = 1;
} else
  console.log(
    `TypeScript ownership and acyclic import checks passed (${paths.length} modules, ${report.pureModules.length} pure modules).`,
  );
