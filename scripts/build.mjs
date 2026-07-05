import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const dist = join(root, "dist");
const localEnvPath = join(root, ".env.local");

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

await cp(join(root, "index.html"), join(dist, "index.html"));
await cp(join(root, "src"), join(dist, "src"), { recursive: true });
await cp(join(root, "assets"), join(dist, "assets"), { recursive: true });
await cp(join(root, "README.md"), join(dist, "README.md"));
await writeFile(join(dist, "src", "config.js"), await createPublicConfigModule());

console.log("Built static site to dist/");

async function createPublicConfigModule() {
  const env = {
    ...(await loadLocalEnv()),
    ...process.env,
  };
  const publicConfig = getPublicConfig(env);

  return `export const ONLINE_PROVIDER = ${JSON.stringify(publicConfig.ONLINE_PROVIDER)};
export const SUPABASE_URL = ${JSON.stringify(publicConfig.SUPABASE_URL)};
export const SUPABASE_PUBLISHABLE_KEY = ${JSON.stringify(publicConfig.SUPABASE_PUBLISHABLE_KEY)};

export function getOnlineConfig() {
  const runtimeConfig = globalThis.__ULTIMATE_TTT_CONFIG__ ?? {};

  return {
    ONLINE_PROVIDER: normalizeProvider(runtimeConfig.ONLINE_PROVIDER || ONLINE_PROVIDER),
    SUPABASE_URL: normalizeValue(runtimeConfig.SUPABASE_URL || SUPABASE_URL),
    SUPABASE_PUBLISHABLE_KEY:
      normalizeValue(runtimeConfig.SUPABASE_PUBLISHABLE_KEY || SUPABASE_PUBLISHABLE_KEY),
  };
}

export function hasSupabaseConfig(config = getOnlineConfig()) {
  return Boolean(
    config.ONLINE_PROVIDER === "supabase" &&
      config.SUPABASE_URL &&
      config.SUPABASE_PUBLISHABLE_KEY,
  );
}

function normalizeProvider(value) {
  return normalizeValue(value).toLowerCase();
}

function normalizeValue(value) {
  return String(value ?? "").trim();
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

async function loadLocalEnv() {
  if (!existsSync(localEnvPath)) {
    return {};
  }

  return (await readFile(localEnvPath, "utf8"))
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
