import {
  canJoinRoom,
  createInitialRoomState,
  createOnlineSession,
  generateRoomCode,
  getNextRoomVersion,
  markRoomJoinedByO,
  normalizeRoomCode,
  ONLINE_SYNC_STATUS,
} from "./room.js";

// Mock adapter only. This module intentionally does not connect to Supabase.
// It keeps room data in memory so the UI/state-machine remains testable without
// external network access or a configured Supabase project.
const mockRooms = new Map();
const subscribers = new Map();

let currentSession = null;
let currentSubscription = null;

export async function createRoom() {
  let code = generateRoomCode();
  while (mockRooms.has(code)) {
    code = generateRoomCode();
  }

  const room = createInitialRoomState(code);
  mockRooms.set(code, room);
  currentSession = createOnlineSession(code, "X", ONLINE_SYNC_STATUS.CONNECTED);
  notifyRoom(code);

  return {
    ok: true,
    room,
    session: currentSession,
    role: "X",
  };
}

export async function joinRoom(roomCode) {
  const code = normalizeRoomCode(roomCode);
  const room = mockRooms.get(code);

  if (!room) {
    return {
      ok: false,
      error: "找不到这个 Mock 房间，请检查房间码。",
    };
  }

  if (!canJoinRoom(room)) {
    return {
      ok: false,
      error: "这个 Mock 房间暂时不能加入。",
    };
  }

  const nextRoom = markRoomJoinedByO(room);
  mockRooms.set(code, nextRoom);
  currentSession = createOnlineSession(code, "O", ONLINE_SYNC_STATUS.CONNECTED);
  notifyRoom(code);

  return {
    ok: true,
    room: nextRoom,
    session: currentSession,
    role: "O",
  };
}

export async function leaveRoom() {
  if (!currentSession) {
    return { ok: true };
  }

  const room = mockRooms.get(currentSession.roomCode);
  if (room) {
    const nextRoom = {
      ...room,
      version: getNextRoomVersion(room),
      players: {
        ...room.players,
        [currentSession.role]: {
          ...room.players[currentSession.role],
          online: false,
        },
      },
    };
    mockRooms.set(currentSession.roomCode, nextRoom);
    notifyRoom(currentSession.roomCode);
  }

  cleanupOnlineSubscription();
  currentSession = null;

  return { ok: true };
}

export function subscribeToRoom(roomCode, callback) {
  const code = normalizeRoomCode(roomCode);
  cleanupOnlineSubscription();

  if (!subscribers.has(code)) {
    subscribers.set(code, new Set());
  }

  subscribers.get(code).add(callback);
  currentSubscription = { code, callback };

  const room = mockRooms.get(code);
  if (room) {
    queueMicrotask(() => callback(room));
  }

  return () => {
    subscribers.get(code)?.delete(callback);
    if (currentSubscription?.code === code && currentSubscription.callback === callback) {
      currentSubscription = null;
    }
  };
}

export async function updateRoomState(roomCode, nextState, expectedVersion) {
  const code = normalizeRoomCode(roomCode);
  const room = mockRooms.get(code);

  if (!room) {
    return { ok: false, error: "Mock 房间不存在。" };
  }

  if (room.version !== expectedVersion) {
    return {
      ok: false,
      conflict: true,
      error: "Mock version conflict",
      room,
    };
  }

  const nextRoom = {
    ...room,
    status: nextState.winner || nextState.draw ? "finished" : room.status,
    version: getNextRoomVersion(room),
    moveNumber: room.moveNumber + 1,
    gameState: nextState,
    score: getUpdatedRoomScore(room.score, nextState),
  };

  mockRooms.set(code, nextRoom);
  notifyRoom(code);

  return {
    ok: true,
    room: nextRoom,
  };
}

export function cleanupOnlineSubscription() {
  if (!currentSubscription) {
    return;
  }

  subscribers
    .get(currentSubscription.code)
    ?.delete(currentSubscription.callback);
  currentSubscription = null;
}

export function getOnlinePlayerRole() {
  return currentSession?.role ?? null;
}

export function getMockRoom(roomCode) {
  return mockRooms.get(normalizeRoomCode(roomCode)) ?? null;
}

export function resetMockOnlineState() {
  mockRooms.clear();
  subscribers.clear();
  currentSession = null;
  currentSubscription = null;
}

export function getAdapterStatus() {
  return {
    provider: "mock",
    label: "Mock 联机预览",
    note: "当前使用内存 Mock adapter，不是真实跨设备联机。",
    configured: false,
  };
}

function notifyRoom(roomCode) {
  const room = mockRooms.get(normalizeRoomCode(roomCode));
  if (!room) {
    return;
  }

  for (const callback of subscribers.get(room.code) ?? []) {
    callback(room);
  }
}

function getUpdatedRoomScore(score, nextState) {
  if (!nextState.winner && !nextState.draw) {
    return score;
  }

  const result = nextState.winner || "draw";
  return {
    ...score,
    [result]: (score[result] ?? 0) + 1,
  };
}

export { ONLINE_SYNC_STATUS };
