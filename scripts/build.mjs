import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const dist = join(root, "dist");

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

await cp(join(root, "index.html"), join(dist, "index.html"));
await cp(join(root, "src"), join(dist, "src"), { recursive: true });
await cp(join(root, "assets"), join(dist, "assets"), { recursive: true });
await cp(join(root, "README.md"), join(dist, "README.md"));
await writeFile(join(dist, "src", "config.js"), createPublicConfigModule());

console.log("Built static site to dist/");

function createPublicConfigModule() {
  const publicConfig = {
    ONLINE_PROVIDER: process.env.ONLINE_PROVIDER || "",
    SUPABASE_URL: process.env.SUPABASE_URL || "",
    SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY || "",
  };

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
