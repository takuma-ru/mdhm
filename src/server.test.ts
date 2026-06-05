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
  waitForExit,
  writeText,
} from "./test/helpers.js";

let tempDir: string | undefined;

afterEach(async () => {
  if (tempDir !== undefined) {
    await cleanupTempSite(tempDir);
    tempDir = undefined;
  }
});

describe("server behavior", () => {
  it("builds to outDir, serves files, injects live reload, and rebuilds on changes", async () => {
    tempDir = await createTempSite();
    const rootDir = path.join(tempDir, "site");
    const outDir = path.join(tempDir, "dist");
    const port = await getFreePort();

    await writeText(path.join(rootDir, "index.md"), "# First");

    const child = spawnMdht([
      "dev",
      "--root-dir",
      rootDir,
      "--out-dir",
      outDir,
      "--host",
      "127.0.0.1",
      "--port",
      String(port),
    ]);

    try {
      await waitFor(async () => {
        try {
          const response = await fetch(`http://127.0.0.1:${port}/index.html`);
          const html = await response.text();
          return response.ok && html.includes("<h1>First</h1>");
        } catch {
          return false;
        }
      });

      const initialHtml = await readText(path.join(outDir, "index.html"));
      expect(initialHtml).toContain("/__mdht_events");

      await writeText(path.join(rootDir, "index.md"), "# Second");
      await waitFor(async () =>
        (await readText(path.join(outDir, "index.html"))).includes("Second"),
      );

      const response = await fetch(`http://127.0.0.1:${port}/index.html`);
      const html = await response.text();
      expect(response.ok).toBe(true);
      expect(html).toContain("<h1>Second</h1>");
    } finally {
      await stopProcess(child);
    }
  });

  it("exits with code 1 when dev cannot render invalid frontmatter", async () => {
    tempDir = await createTempSite();
    const rootDir = path.join(tempDir, "site");
    const outDir = path.join(tempDir, "dist");
    const port = await getFreePort();

    await writeText(
      path.join(rootDir, "index.md"),
      `---
head:
  title: Bad
  - invalid
---

# Bad
`,
    );

    const child = spawnMdht([
      "dev",
      "--root-dir",
      rootDir,
      "--out-dir",
      outDir,
      "--host",
      "127.0.0.1",
      "--port",
      String(port),
    ]);

    expect(await waitForExit(child)).toBe(1);
  });
});
