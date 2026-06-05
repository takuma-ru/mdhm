import { access } from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { cleanupTempSite, createTempSite, readText, runMdht, writeText } from "./test/helpers.js";

let tempDir: string | undefined;

afterEach(async () => {
  if (tempDir !== undefined) {
    await cleanupTempSite(tempDir);
    tempDir = undefined;
  }
});

describe("mdht build", () => {
  it("maps Markdown files to HTML files and copies non-Markdown files", async () => {
    tempDir = await createTempSite();
    const rootDir = path.join(tempDir, "site");
    const outDir = path.join(tempDir, "dist");

    await writeText(path.join(rootDir, "index.md"), "# Home");
    await writeText(path.join(rootDir, "README.md"), "# Readme");
    await writeText(path.join(rootDir, "foo.md"), "# Foo");
    await writeText(path.join(rootDir, "nested", "bar.md"), "# Bar");
    await writeText(path.join(rootDir, "asset.txt"), "asset");
    await writeText(path.join(rootDir, ".well-known", "demo.txt"), "dotfile asset");

    const result = await runMdht(["build", "--root-dir", rootDir, "--out-dir", outDir]);

    expect(result.code).toBe(0);
    await expect(access(path.join(outDir, "index.html"))).resolves.toBeUndefined();
    await expect(access(path.join(outDir, "README.html"))).resolves.toBeUndefined();
    await expect(access(path.join(outDir, "foo.html"))).resolves.toBeUndefined();
    await expect(access(path.join(outDir, "nested", "bar.html"))).resolves.toBeUndefined();
    await expect(readText(path.join(outDir, "asset.txt"))).resolves.toBe("asset");
    await expect(readText(path.join(outDir, ".well-known", "demo.txt"))).resolves.toBe(
      "dotfile asset",
    );
  });

  it("respects .gitignore and always excludes outDir", async () => {
    tempDir = await createTempSite();
    const rootDir = path.join(tempDir, "site");
    const outDir = path.join(rootDir, "dist");

    await writeText(path.join(rootDir, ".gitignore"), "ignored.txt\nignored-dir/\n");
    await writeText(path.join(rootDir, "index.md"), "# Home");
    await writeText(path.join(rootDir, "ignored.txt"), "ignored");
    await writeText(path.join(rootDir, "ignored-dir", "file.txt"), "ignored");
    await writeText(path.join(rootDir, "dist", "stale.txt"), "stale");

    const result = await runMdht(["build", "--root-dir", rootDir, "--out-dir", outDir]);

    expect(result.code).toBe(0);
    await expect(access(path.join(outDir, "index.html"))).resolves.toBeUndefined();
    await expect(access(path.join(outDir, "ignored.txt"))).rejects.toThrow();
    await expect(access(path.join(outDir, "ignored-dir", "file.txt"))).rejects.toThrow();
    await expect(access(path.join(outDir, "stale.txt"))).rejects.toThrow();
  });

  it("excludes .git and copies all other files when .gitignore is missing", async () => {
    tempDir = await createTempSite();
    const rootDir = path.join(tempDir, "site");
    const outDir = path.join(rootDir, "dist");

    await writeText(path.join(rootDir, "index.md"), "# Home");
    await writeText(path.join(rootDir, "node_modules", "fixture.txt"), "copied without gitignore");
    await writeText(path.join(rootDir, ".git", "config"), "must not copy");

    const result = await runMdht(["build", "--root-dir", rootDir, "--out-dir", outDir]);

    expect(result.code).toBe(0);
    await expect(readText(path.join(outDir, "node_modules", "fixture.txt"))).resolves.toBe(
      "copied without gitignore",
    );
    await expect(access(path.join(outDir, ".git", "config"))).rejects.toThrow();
  });

  it("rejects dangerous outDir values", async () => {
    tempDir = await createTempSite();
    const rootDir = path.join(tempDir, "site");
    await writeText(path.join(rootDir, "index.md"), "# Home");

    const sameDir = await runMdht(["build", "--root-dir", rootDir, "--out-dir", rootDir]);
    const rootFs = await runMdht([
      "build",
      "--root-dir",
      rootDir,
      "--out-dir",
      path.parse(rootDir).root,
    ]);

    expect(sameDir.code).toBe(1);
    expect(rootFs.code).toBe(1);
  });
});
