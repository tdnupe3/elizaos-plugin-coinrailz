import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const tscPath = fileURLToPath(
  new URL("../node_modules/typescript/bin/tsc", import.meta.url),
);
const baselinePath = fileURLToPath(
  new URL("./typecheck-baseline.json", import.meta.url),
);
const baseline = JSON.parse(readFileSync(baselinePath, "utf8"));

const result = spawnSync(
  process.execPath,
  [
    "--max-old-space-size=8192",
    tscPath,
    "--project",
    "tsconfig.json",
    "--pretty",
    "false",
  ],
  {
    cwd: projectRoot,
    encoding: "utf8",
    env: process.env,
    maxBuffer: 32 * 1024 * 1024,
  },
);

if (result.error) {
  console.error(`Unable to run TypeScript: ${result.error.message}`);
  process.exit(1);
}

const diagnostics = `${result.stdout}${result.stderr}`.replace(/\r\n/g, "\n");

if (result.status === 0) {
  console.log("TypeScript check passed with no diagnostics.");
  process.exit(0);
}

const diagnosticCount = (diagnostics.match(/error TS\d+:/g) ?? []).length;
const diagnosticHash = createHash("sha256").update(diagnostics).digest("hex");
const matchesBaseline =
  diagnosticCount === baseline.diagnosticCount &&
  diagnosticHash === baseline.sha256;

if (matchesBaseline) {
  console.log(
    `TypeScript checked the full root application: ${diagnosticCount} known diagnostics are unchanged and no regression was introduced.`,
  );
  process.exit(0);
}

process.stderr.write(diagnostics);
console.error("\nTypeScript diagnostic baseline changed.");
console.error(
  `Expected ${baseline.diagnosticCount} diagnostics (${baseline.sha256}),`,
);
console.error(`received ${diagnosticCount} diagnostics (${diagnosticHash}).`);
console.error(
  "Fix new diagnostics. If this change intentionally removes known diagnostics, update the baseline in the same reviewed change.",
);
process.exit(1);