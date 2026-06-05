import { createServer, type ServerResponse } from "node:http";
import path from "node:path";
import chokidar from "chokidar";
import sirv from "sirv";
import { buildSite, isAlwaysExcluded, type BuildOptions } from "./build.js";
import { reloadPath } from "./constants.js";

type DevOptions = BuildOptions & {
  host: string;
  port: number;
};

export async function startDevServer(options: DevOptions): Promise<void> {
  await buildSite(options);

  const clients = new Set<ServerResponse>();
  const serve = sirv(path.resolve(options.outDir), { dev: true });
  const server = createServer((request, response) => {
    if (request.url === reloadPath) {
      response.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      clients.add(response);
      request.on("close", () => clients.delete(response));
      return;
    }

    serve(request, response);
  });

  await new Promise<void>((resolve) => server.listen(options.port, options.host, resolve));
  console.log(`mdhm dev server listening on http://${options.host}:${options.port}`);
  if (options.host === "0.0.0.0") {
    console.log(`local: http://localhost:${options.port}`);
  }

  let building = false;
  let pending = false;
  const rebuild = async () => {
    if (building) {
      pending = true;
      return;
    }

    building = true;
    try {
      do {
        pending = false;
        await buildSite(options);
      } while (pending);

      for (const client of clients) {
        client.write("event: reload\ndata: reload\n\n");
      }
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      await closeServer(server);
      process.exit(1);
    } finally {
      building = false;
    }
  };

  const watcher = chokidar.watch(path.resolve(options.rootDir), {
    ignored: (watchedPath) =>
      isAlwaysExcluded(watchedPath, path.resolve(options.rootDir), path.resolve(options.outDir)),
    ignoreInitial: true,
  });
  watcher.on("all", () => void rebuild());
}

async function closeServer(server: ReturnType<typeof createServer>): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error === undefined ? resolve() : reject(error)));
  });
}
