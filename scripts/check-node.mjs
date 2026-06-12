const REQUIRED_MAJOR = 24;

function fail(message) {
  console.error(`\n[preflight] ${message}\n`);
  process.exit(1);
}

const version = process.versions.node;
const major = Number(version.split(".")[0]);

if (!Number.isFinite(major)) {
  fail(`Could not parse Node.js version: ${version}`);
}

if (major !== REQUIRED_MAJOR) {
  fail(
    `Unsupported Node.js version ${version}. Use Node ${REQUIRED_MAJOR}.x for consistent team/runtime behavior.`
  );
}

console.log(`[preflight] Node.js ${version} OK`);
