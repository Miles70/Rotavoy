import { execFileSync } from "node:child_process";

function audit(directory, label) {
  let output;

  try {
    output = execFileSync("npm", ["audit", "--omit=dev", "--json"], {
      cwd: directory,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "inherit"],
    });
  } catch (error) {
    output = error.stdout;
  }

  const report = JSON.parse(output);
  const counts = report.metadata?.vulnerabilities || {};
  const blocking = Number(counts.high || 0) + Number(counts.critical || 0);

  console.log(
    `${label}: ${counts.high || 0} high, ${counts.critical || 0} critical vulnerabilities.`,
  );

  return blocking;
}

const root = new URL("..", import.meta.url);
const blocking =
  audit(root, "Frontend") + audit(new URL("../server/", import.meta.url), "Backend");

if (blocking > 0) {
  process.exitCode = 1;
}
