import { createInitialState } from "./game.js";

export const ROOM_CODE_LENGTH = 6;
export const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const ROOM_STATUS = {
  WAITING: "waiting",
  PLAYING: "playing",
  FINISHED: "finished",
  CLOSED: "closed",
};
export const ONLINE_SYNC_STATUS = {
  CONNECTED: "Mock connected",
  SYNCING: "Mock syncing",
  DISCONNECTED: "Mock disconnected",
  SUPABASE_CONNECTED: "Supabase connected",
  SUPABASE_SYNCING: "Supabase syncing",
  SUPABASE_DISCONNECTED: "Supabase disconnected",
  SUPABASE_UNCONFIGURED: "Supabase unconfigured",
};

export function generateRoomCode() {
  return Array.from({ length: ROOM_CODE_LENGTH }, () =>
    ROOM_CODE_ALPHABET[Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)]
  ).join("");
}

export function normalizeRoomCode(input) {
  return String(input ?? "")
    .replace(/\s+/g, "")
    .toUpperCase();
}

export function createInitialRoomState(code, gameState = createInitialState()) {
  return {
    code: normalizeRoomCode(code),
    status: ROOM_STATUS.WAITING,
    version: 1,
    moveNumber: 0,
    players: {
      X: { joined: true, online: true },
      O: { joined: false, online: false },
    },
    gameState,
    score: {
      X: 0,
      O: 0,
      draw: 0,
    },
  };
}

export function canJoinRoom(room) {
  return Boolean(
    room &&
      room.status === ROOM_STATUS.WAITING &&
      room.players?.X?.joined &&
      !room.players?.O?.joined,
  );
}

export function getNextRoomVersion(room) {
  return (room?.version ?? 0) + 1;
}

export function createOnlineSession(
  roomCode,
  role,
  syncStatus = ONLINE_SYNC_STATUS.CONNECTED,
) {
  return {
    roomCode: normalizeRoomCode(roomCode),
    role,
    syncStatus,
  };
}

export function markRoomJoinedByO(room) {
  if (!canJoinRoom(room)) {
    return room;
  }

  return {
    ...room,
    status: ROOM_STATUS.PLAYING,
    version: getNextRoomVersion(room),
    players: {
      ...room.players,
      O: { joined: true, online: true },
    },
  };
}
