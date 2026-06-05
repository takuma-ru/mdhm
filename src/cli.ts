import { Command } from "commander";
import { buildSite } from "./build.js";
import { startDevServer } from "./server.js";

const defaultRootDir = ".";
const defaultOutDir = "dist";
const defaultHost = "0.0.0.0";
const defaultPort = 6348;

export async function runCli(): Promise<void> {
  const program = new Command();

  program
    .name("mdhm")
    .description("Minimal Markdown to static HTML documentation framework")
    .version("1.0.0");

  program
    .command("build")
    .description("Build static HTML files")
    .option("--root-dir <dir>", "input root directory", defaultRootDir)
    .option("--out-dir <dir>", "output directory", defaultOutDir)
    .action(async (options: { rootDir: string; outDir: string }) => {
      await runAndExit(() => buildSite({ rootDir: options.rootDir, outDir: options.outDir }));
    });

  program
    .command("dev")
    .description("Start development server")
    .option("--root-dir <dir>", "input root directory", defaultRootDir)
    .option("--out-dir <dir>", "output directory", defaultOutDir)
    .option("--host <host>", "dev server host", defaultHost)
    .option("--port <port>", "dev server port", String(defaultPort))
    .action(async (options: { rootDir: string; outDir: string; host: string; port: string }) => {
      const port = Number(options.port);
      if (!Number.isInteger(port) || port <= 0 || port > 65_535) {
        throw new Error(`Invalid port: ${options.port}`);
      }

      await runAndExit(() =>
        startDevServer({
          rootDir: options.rootDir,
          outDir: options.outDir,
          host: options.host,
          port,
          dev: true,
        }),
      );
    });

  if (process.argv.length <= 2) {
    program.help();
  }

  await program.parseAsync();
}

async function runAndExit(task: () => Promise<void>): Promise<void> {
  try {
    await task();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
