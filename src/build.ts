import { copyFile, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import ignore, { type Ignore } from "ignore";
import { renderMarkdownFile } from "./markdown.js";

export type BuildOptions = {
  rootDir: string;
  outDir: string;
  dev?: boolean;
};

export async function buildSite(options: BuildOptions): Promise<void> {
  const paths = resolveBuildPaths(options);
  await assertSafePaths(paths.rootDir, paths.outDir);
  const gitignore = await loadGitignore(paths.rootDir);
  await rm(paths.outDir, { recursive: true, force: true });
  await mkdir(paths.outDir, { recursive: true });
  await processDirectory(
    paths.rootDir,
    paths.rootDir,
    paths.outDir,
    gitignore,
    options.dev === true,
  );
}

export function resolveBuildPaths(options: BuildOptions): { rootDir: string; outDir: string } {
  return {
    rootDir: path.resolve(options.rootDir),
    outDir: path.resolve(options.outDir),
  };
}

export function isAlwaysExcluded(filePath: string, rootDir: string, outDir: string): boolean {
  const resolved = path.resolve(filePath);
  const relative = path.relative(rootDir, resolved);

  if (relative === ".git" || relative.startsWith(`.git${path.sep}`)) {
    return true;
  }

  return resolved === outDir || path.relative(outDir, resolved).startsWith("..") === false;
}

async function processDirectory(
  rootDir: string,
  currentDir: string,
  outDir: string,
  gitignore: Ignore | null,
  dev: boolean,
): Promise<void> {
  const entries = await readdir(currentDir, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(currentDir, entry.name);
    if (isAlwaysExcluded(sourcePath, rootDir, outDir)) {
      continue;
    }

    const relativePath = toPosixPath(path.relative(rootDir, sourcePath));
    if (
      gitignore?.ignores(relativePath) ||
      (entry.isDirectory() && gitignore?.ignores(`${relativePath}/`))
    ) {
      continue;
    }

    if (entry.isDirectory()) {
      await processDirectory(rootDir, sourcePath, outDir, gitignore, dev);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const outputPath = path.join(outDir, relativePath.replace(/\.md$/i, ".html"));
    await mkdir(path.dirname(outputPath), { recursive: true });

    if (/\.md$/i.test(entry.name)) {
      const html = await renderMarkdownFile(sourcePath, relativePath, dev);
      await writeFile(outputPath, html);
    } else {
      await copyFile(sourcePath, outputPath);
    }
  }
}

async function loadGitignore(rootDir: string): Promise<Ignore | null> {
  try {
    const content = await readFile(path.join(rootDir, ".gitignore"), "utf8");
    return ignore().add(content);
  } catch {
    return null;
  }
}

async function assertSafePaths(rootDir: string, outDir: string): Promise<void> {
  if (outDir.length === 0) {
    throw new Error("outDir must not be empty");
  }
  if (outDir === path.parse(outDir).root) {
    throw new Error("outDir must not be filesystem root");
  }
  if (rootDir === outDir) {
    throw new Error("outDir must not be the same as rootDir");
  }

  const rootStat = await stat(rootDir);
  if (!rootStat.isDirectory()) {
    throw new Error("rootDir must be a directory");
  }
}

function toPosixPath(value: string): string {
  return value.split(path.sep).join("/");
}
