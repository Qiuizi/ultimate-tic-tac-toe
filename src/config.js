export const ONLINE_PROVIDER = "";
export const SUPABASE_URL = "";
export const SUPABASE_PUBLISHABLE_KEY = "";

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
