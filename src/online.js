import { getOnlineConfig, hasSupabaseConfig } from "./config.js";
import * as mockAdapter from "./online-mock.js";
import * as supabaseAdapter from "./online-supabase.js";
import { ONLINE_SYNC_STATUS } from "./room.js";

export async function createRoom() {
  const resolvedAdapter = getActiveOnlineAdapter();
  logAdapterAction("createRoom", resolvedAdapter);

  try {
    return await resolvedAdapter.adapter.createRoom();
  } catch (error) {
    return createAdapterError(error, "创建远程房间失败。");
  }
}

export async function joinRoom(roomCode) {
  const resolvedAdapter = getActiveOnlineAdapter();
  logAdapterAction("joinRoom", resolvedAdapter);

  try {
    return await resolvedAdapter.adapter.joinRoom(roomCode);
  } catch (error) {
    return createAdapterError(error, "加入远程房间失败。");
  }
}

export async function leaveRoom() {
  try {
    return await getActiveOnlineAdapter().adapter.leaveRoom();
  } catch (error) {
    return createAdapterError(error, "退出远程房间失败。");
  }
}

export function subscribeToRoom(roomCode, callback) {
  return getActiveOnlineAdapter().adapter.subscribeToRoom(roomCode, callback);
}

export async function updateRoomState(roomCode, nextState, expectedVersion) {
  try {
    return await getActiveOnlineAdapter().adapter.updateRoomState(
      roomCode,
      nextState,
      expectedVersion,
    );
  } catch (error) {
    return createAdapterError(error, "同步远程房间失败。");
  }
}

export function cleanupOnlineSubscription() {
  return getActiveOnlineAdapter().adapter.cleanupOnlineSubscription();
}

export function getOnlinePlayerRole() {
  return getActiveOnlineAdapter().adapter.getOnlinePlayerRole();
}

export function getOnlineAdapterStatus() {
  const resolvedAdapter = getActiveOnlineAdapter();

  if (resolvedAdapter.config.ONLINE_PROVIDER === "supabase" && !resolvedAdapter.usesSupabase) {
    return {
      provider: "mock",
      label: "Supabase 未配置",
      note: "缺少 Supabase 公开配置，当前回退到 Mock 联机预览。",
      configured: false,
    };
  }

  if (resolvedAdapter.usesSupabase) {
    return supabaseAdapter.getAdapterStatus();
  }

  return mockAdapter.getAdapterStatus();
}

export function getOnlineDebugInfo() {
  return getActiveOnlineAdapter().debug;
}

export function getActiveOnlineAdapter() {
  const config = getOnlineConfig();
  const usesSupabase = hasSupabaseConfig(config);
  const debug = createOnlineDebugInfo(config, usesSupabase);

  return {
    adapter: usesSupabase ? supabaseAdapter : mockAdapter,
    name: usesSupabase ? "supabase" : "mock",
    config,
    usesSupabase,
    debug,
  };
}

export function resetMockOnlineState() {
  mockAdapter.resetMockOnlineState();
}

export function getMockRoom(roomCode) {
  return mockAdapter.getMockRoom(roomCode);
}

function createAdapterError(error, fallback) {
  return {
    ok: false,
    error: `${fallback} ${error?.message || ""}`.trim(),
  };
}

function createOnlineDebugInfo(config, usesSupabase) {
  return {
    adapter: usesSupabase ? "supabase" : "mock",
    onlineProvider: config.ONLINE_PROVIDER || "(empty)",
    hasSupabaseUrl: Boolean(config.SUPABASE_URL),
    hasPublishableKey: Boolean(config.SUPABASE_PUBLISHABLE_KEY),
  };
}

function logAdapterAction(action, resolvedAdapter) {
  console.info("Ultimate Tic-Tac-Toe online adapter action", {
    action,
    ...resolvedAdapter.debug,
  });
}

export { ONLINE_SYNC_STATUS };
