import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  cleanupTempSite,
  createTempSite,
  getFreePort,
  readText,
  spawnMdht,
  stopProcess,
  waitFor,
  writeText,
  runMdht,
} from "./test/helpers.js";

let tempDir: string | undefined;

afterEach(async () => {
  if (tempDir !== undefined) {
    await cleanupTempSite(tempDir);
    tempDir = undefined;
  }
});

describe("cli behavior", () => {
  it("prints help when no command is provided", async () => {
    const result = await runMdht([]);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("Usage: mdht");
    expect(result.stdout).toContain("build");
    expect(result.stdout).toContain("dev");
  });

  it("rejects invalid dev server ports before starting the server", async () => {
    const result = await runMdht(["dev", "--port", "not-a-port"]);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("Invalid port");
  });

  it("uses default rootDir and outDir for build", async () => {
    tempDir = await createTempSite();
    await writeText(path.join(tempDir, "index.md"), "# Default Build");

    const result = await runMdht(["build"], tempDir);

    expect(result.code).toBe(0);
    expect(await readText(path.join(tempDir, "dist", "index.html"))).toContain(
      "<h1>Default Build</h1>",
    );
  });

  it("uses default host 0.0.0.0 and port 6348 for dev", async () => {
    tempDir = await createTempSite();
    await writeText(path.join(tempDir, "index.md"), "# Default Dev");

    const child = spawnMdht(["dev"], tempDir);
    try {
      await waitFor(async () => {
        try {
          const response = await fetch("http://127.0.0.1:6348/index.html");
          const html = await response.text();
          return response.ok && html.includes("<h1>Default Dev</h1>");
        } catch {
          return false;
        }
      });
    } finally {
      await stopProcess(child);
    }
  });

  it("does not read configuration files", async () => {
    tempDir = await createTempSite();
    await writeText(path.join(tempDir, "index.md"), "# Config Ignored");
    await writeText(
      path.join(tempDir, "mdht.config.js"),
      "throw new Error('config file should not be loaded')",
    );

    const result = await runMdht(["build"], tempDir);

    expect(result.code).toBe(0);
    expect(await readText(path.join(tempDir, "dist", "index.html"))).toContain(
      "<h1>Config Ignored</h1>",
    );
  });

  it("allows overriding dev host and port", async () => {
    tempDir = await createTempSite();
    const port = await getFreePort();
    await writeText(path.join(tempDir, "index.md"), "# Override Dev");

    const child = spawnMdht(["dev", "--host", "127.0.0.1", "--port", String(port)], tempDir);
    try {
      await waitFor(async () => {
        try {
          const response = await fetch(`http://127.0.0.1:${port}/index.html`);
          const html = await response.text();
          return response.ok && html.includes("<h1>Override Dev</h1>");
        } catch {
          return false;
        }
      });
    } finally {
      await stopProcess(child);
    }
  });
});
