import { createServer } from "node:http";
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";

const root = process.cwd();
const port = Number(process.env.PORT || 3000);
const localEnvPath = join(root, ".env.local");

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

function resolvePath(url) {
  const pathname = new URL(url, `http://localhost:${port}`).pathname;
  const requested = pathname === "/" ? "/index.html" : pathname;
  const resolved = normalize(join(root, requested));

  if (!resolved.startsWith(root)) {
    return null;
  }

  return resolved;
}

const server = createServer((request, response) => {
  const filePath = resolvePath(request.url);

  if (filePath === join(root, "src", "config.js")) {
    response.writeHead(200, {
      "Content-Type": "text/javascript; charset=utf-8",
    });
    response.end(createPublicConfigModule());
    return;
  }

  if (!filePath || !existsSync(filePath) || !statSync(filePath).isFile()) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  response.writeHead(200, {
    "Content-Type": contentTypes[extname(filePath)] || "application/octet-stream",
  });
  createReadStream(filePath).pipe(response);
});

server.listen(port, () => {
  console.log(`Ultimate Tic-Tac-Toe running at http://localhost:${port}`);
});

function createPublicConfigModule() {
  const env = {
    ...loadLocalEnv(),
    ...process.env,
  };
  const publicConfig = getPublicConfig(env);

  return `export const ONLINE_PROVIDER = ${JSON.stringify(publicConfig.ONLINE_PROVIDER)};
export const SUPABASE_URL = ${JSON.stringify(publicConfig.SUPABASE_URL)};
export const SUPABASE_PUBLISHABLE_KEY = ${JSON.stringify(publicConfig.SUPABASE_PUBLISHABLE_KEY)};

export function getOnlineConfig() {
  const runtimeConfig = globalThis.__ULTIMATE_TTT_CONFIG__ ?? {};

  return {
    ONLINE_PROVIDER: runtimeConfig.ONLINE_PROVIDER || ONLINE_PROVIDER,
    SUPABASE_URL: runtimeConfig.SUPABASE_URL || SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY:
      runtimeConfig.SUPABASE_PUBLISHABLE_KEY || SUPABASE_PUBLISHABLE_KEY,
  };
}

export function hasSupabaseConfig(config = getOnlineConfig()) {
  return Boolean(
    config.ONLINE_PROVIDER === "supabase" &&
      config.SUPABASE_URL &&
      config.SUPABASE_PUBLISHABLE_KEY,
  );
}
`;
}

function getPublicConfig(env) {
  return {
    ONLINE_PROVIDER: env.ONLINE_PROVIDER || "",
    SUPABASE_URL: env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || "",
    SUPABASE_PUBLISHABLE_KEY:
      env.SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "",
  };
}

function loadLocalEnv() {
  if (!existsSync(localEnvPath)) {
    return {};
  }

  return readFileSync(localEnvPath, "utf8")
    .split(/\r?\n/)
    .reduce((env, line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        return env;
      }

      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex === -1) {
        return env;
      }

      const key = trimmed.slice(0, separatorIndex).trim();
      const value = trimmed.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, "");
      env[key] = value;
      return env;
    }, {});
}
