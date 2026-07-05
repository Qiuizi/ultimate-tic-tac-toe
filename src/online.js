import { getOnlineConfig, hasSupabaseConfig } from "./config.js";
import * as mockAdapter from "./online-mock.js";
import * as supabaseAdapter from "./online-supabase.js";
import { ONLINE_SYNC_STATUS } from "./room.js";

let activeAdapter = mockAdapter;
let activeAdapterName = "mock";

export async function createRoom() {
  try {
    return await getActiveAdapter().createRoom();
  } catch (error) {
    return createAdapterError(error, "创建远程房间失败。");
  }
}

export async function joinRoom(roomCode) {
  try {
    return await getActiveAdapter().joinRoom(roomCode);
  } catch (error) {
    return createAdapterError(error, "加入远程房间失败。");
  }
}

export async function leaveRoom() {
  try {
    return await getActiveAdapter().leaveRoom();
  } catch (error) {
    return createAdapterError(error, "退出远程房间失败。");
  }
}

export function subscribeToRoom(roomCode, callback) {
  return getActiveAdapter().subscribeToRoom(roomCode, callback);
}

export async function updateRoomState(roomCode, nextState, expectedVersion) {
  try {
    return await getActiveAdapter().updateRoomState(roomCode, nextState, expectedVersion);
  } catch (error) {
    return createAdapterError(error, "同步远程房间失败。");
  }
}

export function cleanupOnlineSubscription() {
  return getActiveAdapter().cleanupOnlineSubscription();
}

export function getOnlinePlayerRole() {
  return getActiveAdapter().getOnlinePlayerRole();
}

export function getOnlineAdapterStatus() {
  const config = getOnlineConfig();

  if (config.ONLINE_PROVIDER === "supabase" && !hasSupabaseConfig(config)) {
    return {
      provider: "mock",
      label: "Supabase 未配置",
      note: "缺少 Supabase 公开配置，当前回退到 Mock 联机预览。",
      configured: false,
    };
  }

  if (activeAdapterName === "supabase") {
    return activeAdapter.getAdapterStatus();
  }

  return mockAdapter.getAdapterStatus();
}

export function resetMockOnlineState() {
  mockAdapter.resetMockOnlineState();
  activeAdapter = mockAdapter;
  activeAdapterName = "mock";
}

export function getMockRoom(roomCode) {
  return mockAdapter.getMockRoom(roomCode);
}

function getActiveAdapter() {
  const config = getOnlineConfig();

  if (!hasSupabaseConfig(config)) {
    activeAdapter = mockAdapter;
    activeAdapterName = "mock";
    return activeAdapter;
  }

  if (activeAdapterName === "supabase") {
    return activeAdapter;
  }

  activeAdapter = supabaseAdapter;
  activeAdapterName = "supabase";
  return activeAdapter;
}

function createAdapterError(error, fallback) {
  return {
    ok: false,
    error: `${fallback} ${error?.message || ""}`.trim(),
  };
}

export { ONLINE_SYNC_STATUS };
