import { networkInterfaces } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const pythonExecutable = join(projectRoot, ".venv", "Scripts", "python.exe");
const port = Number.parseInt(Bun.env.PORT || "8011", 10);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error("PORT must be an integer between 1 and 65535.");
  process.exit(1);
}

if (!(await Bun.file(pythonExecutable).exists())) {
  console.error(`Python virtual environment was not found: ${pythonExecutable}`);
  console.error("Run the Python installation steps in README.md first.");
  process.exit(1);
}

const lanAddresses = Object.values(networkInterfaces())
  .flat()
  .filter(
    (address): address is NonNullable<typeof address> =>
      Boolean(address)
      && address.family === "IPv4"
      && !address.internal
      && !address.address.startsWith("169.254.")
  )
  .map((address) => address.address);

console.log("");
console.log("SKBP Pipeline Dashboard · company network mode");
console.log(`Local:   http://127.0.0.1:${port}`);
for (const address of lanAddresses) {
  console.log(`Company: http://${address}:${port}`);
}
console.log("");
console.log("Keep this terminal open while coworkers use the dashboard.");
console.log("Data source: json/pipeline-records.json");
console.log("Security: no application login is configured; Windows Firewall limits access.");
console.log("");

const server = Bun.spawn(
  [
    pythonExecutable,
    "-m",
    "uvicorn",
    "main:app",
    "--host",
    "0.0.0.0",
    "--port",
    String(port),
    "--workers",
    "1"
  ],
  {
    cwd: projectRoot,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
    env: process.env
  }
);

const stopServer = () => {
  if (!server.killed) server.kill();
};

process.on("SIGINT", stopServer);
process.on("SIGTERM", stopServer);

const exitCode = await server.exited;
process.exit(exitCode);
