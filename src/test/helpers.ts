import { execFile, spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect } from "vitest";

export const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const cliPath = path.join(projectRoot, "dist", "index.mjs");

export type CliResult = {
  code: number;
  stdout: string;
  stderr: string;
};

export async function createTempSite(): Promise<string> {
  return await mkdtemp(path.join(tmpdir(), "mdhm-test-"));
}

export async function cleanupTempSite(dir: string): Promise<void> {
  await rm(dir, { recursive: true, force: true });
}

export async function writeText(filePath: string, content: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content);
}

export async function readText(filePath: string): Promise<string> {
  return await readFile(filePath, "utf8");
}

export async function runMdht(args: string[], cwd = projectRoot): Promise<CliResult> {
  return await new Promise((resolve) => {
    execFile(process.execPath, [cliPath, ...args], { cwd }, (error, stdout, stderr) => {
      const code = typeof error?.code === "number" ? error.code : error === null ? 0 : 1;
      resolve({
        code,
        stdout,
        stderr,
      });
    });
  });
}

export function spawnMdht(args: string[], cwd = projectRoot): ChildProcess {
  return spawn(process.execPath, [cliPath, ...args], { cwd, stdio: ["ignore", "pipe", "pipe"] });
}

export async function waitForExit(child: ChildProcess): Promise<number | null> {
  return await new Promise((resolve) => {
    child.on("exit", (code) => resolve(code));
  });
}

export async function stopProcess(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null) {
    return;
  }

  child.kill("SIGTERM");
  await Promise.race([waitForExit(child), new Promise((resolve) => setTimeout(resolve, 1_000))]);
}

export async function waitFor(predicate: () => Promise<boolean> | boolean): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 5_000) {
    if (await predicate()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  expect(await predicate()).toBe(true);
}

export async function getFreePort(): Promise<number> {
  const { createServer } = await import("node:net");
  const server = createServer();
  return await new Promise((resolve, reject) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close();
      if (typeof address === "object" && address !== null) {
        resolve(address.port);
      } else {
        reject(new Error("Failed to allocate a free port"));
      }
    });
  });
}
