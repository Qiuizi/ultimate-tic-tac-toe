import { getOnlineConfig } from "./config.js";
import {
  canJoinRoom,
  createInitialRoomState,
  createOnlineSession,
  generateRoomCode,
  getNextRoomVersion,
  markRoomJoinedByO,
  normalizeRoomCode,
  ROOM_STATUS,
  ONLINE_SYNC_STATUS,
} from "./room.js";

const SUPABASE_JS_URL = "https://esm.sh/@supabase/supabase-js@2.91.0";

let supabaseClient = null;
let currentSession = null;
let currentSubscription = null;

export async function createRoom() {
  const supabase = await getSupabaseClient();
  let room = null;
  let lastError = null;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generateRoomCode();
    const initialRoom = createInitialRoomState(code);
    const { data, error } = await supabase
      .from("rooms")
      .insert(toDatabaseRoom(initialRoom))
      .select()
      .single();

    if (!error && data) {
      room = fromDatabaseRoom(data);
      break;
    }

    lastError = error;
    if (error?.code !== "23505") {
      break;
    }
  }

  if (!room) {
    return {
      ok: false,
      error: formatSupabaseError(lastError, "创建 Supabase 房间失败。"),
    };
  }

  currentSession = createOnlineSession(
    room.code,
    "X",
    ONLINE_SYNC_STATUS.SUPABASE_CONNECTED,
  );

  return {
    ok: true,
    room,
    session: currentSession,
    role: "X",
  };
}

export async function joinRoom(roomCode) {
  const supabase = await getSupabaseClient();
  const code = normalizeRoomCode(roomCode);
  const existingRoom = await fetchRoom(code);

  if (!existingRoom) {
    return {
      ok: false,
      error: "找不到这个 Supabase 房间，请检查房间码。",
    };
  }

  if (!canJoinRoom(existingRoom)) {
    return {
      ok: false,
      error: "这个 Supabase 房间暂时不能加入。",
      room: existingRoom,
    };
  }

  const joinedRoom = markRoomJoinedByO(existingRoom);
  const { data, error } = await supabase
    .from("rooms")
    .update(toDatabaseRoom(joinedRoom))
    .eq("code", code)
    .eq("version", existingRoom.version)
    .select()
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      error: formatSupabaseError(error, "加入 Supabase 房间失败。"),
      room: await fetchRoom(code),
    };
  }

  if (!data) {
    return {
      ok: false,
      conflict: true,
      error: "Supabase 房间状态已变化，请重试。",
      room: await fetchRoom(code),
    };
  }

  const room = fromDatabaseRoom(data);
  currentSession = createOnlineSession(
    room.code,
    "O",
    ONLINE_SYNC_STATUS.SUPABASE_CONNECTED,
  );

  return {
    ok: true,
    room,
    session: currentSession,
    role: "O",
  };
}

export async function leaveRoom() {
  if (!currentSession) {
    return { ok: true };
  }

  const supabase = await getSupabaseClient();
  const room = await fetchRoom(currentSession.roomCode);

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
      [`lastSeen${currentSession.role}`]: new Date().toISOString(),
    };

    await supabase
      .from("rooms")
      .update(toDatabaseRoom(nextRoom))
      .eq("code", room.code)
      .eq("version", room.version);
  }

  cleanupOnlineSubscription();
  currentSession = null;

  return { ok: true };
}

export function subscribeToRoom(roomCode, callback) {
  const code = normalizeRoomCode(roomCode);
  cleanupOnlineSubscription();

  const pendingSubscription = {
    code,
    callback,
    channel: null,
    closed: false,
  };
  currentSubscription = pendingSubscription;

  getSupabaseClient()
    .then((supabase) => {
      if (pendingSubscription.closed) {
        return;
      }

      const channel = supabase
        .channel(`rooms:${code}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "rooms",
            filter: `code=eq.${code}`,
          },
          (payload) => callback(fromDatabaseRoom(payload.new)),
        )
        .subscribe((status) => {
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            callback({
              code,
              status: ROOM_STATUS.CLOSED,
              error: `Supabase Realtime ${status}`,
            });
          }
        });

      pendingSubscription.channel = channel;
    })
    .catch(() => {});

  fetchRoom(code).then((room) => {
    if (room && !pendingSubscription.closed) {
      callback(room);
    }
  }).catch(() => {});

  return () => {
    if (currentSubscription === pendingSubscription) {
      cleanupOnlineSubscription();
    }
  };
}

export async function updateRoomState(roomCode, nextState, expectedVersion) {
  const supabase = await getSupabaseClient();
  const code = normalizeRoomCode(roomCode);
  const currentRoom = await fetchRoom(code);

  if (!currentRoom) {
    return {
      ok: false,
      error: "Supabase 房间不存在。",
    };
  }

  if (currentRoom.version !== expectedVersion) {
    return {
      ok: false,
      conflict: true,
      error: "Supabase version conflict",
      room: currentRoom,
    };
  }

  const nextRoom = {
    ...currentRoom,
    status: nextState.winner || nextState.draw ? ROOM_STATUS.FINISHED : currentRoom.status,
    version: getNextRoomVersion(currentRoom),
    moveNumber: currentRoom.moveNumber + 1,
    gameState: nextState,
    score: getUpdatedRoomScore(currentRoom.score, nextState),
  };

  const { data, error } = await supabase
    .from("rooms")
    .update(toDatabaseRoom(nextRoom))
    .eq("code", code)
    .eq("version", expectedVersion)
    .select()
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      error: formatSupabaseError(error, "同步 Supabase 房间失败。"),
      room: await fetchRoom(code),
    };
  }

  if (!data) {
    return {
      ok: false,
      conflict: true,
      error: "Supabase version conflict",
      room: await fetchRoom(code),
    };
  }

  return {
    ok: true,
    room: fromDatabaseRoom(data),
  };
}

export function cleanupOnlineSubscription() {
  if (!currentSubscription) {
    return;
  }

  currentSubscription.closed = true;
  const channel = currentSubscription.channel;
  currentSubscription = null;

  if (channel) {
    getSupabaseClient()
      .then((supabase) => supabase.removeChannel(channel))
      .catch(() => {});
  }
}

export function getOnlinePlayerRole() {
  return currentSession?.role ?? null;
}

export function getAdapterStatus() {
  return {
    provider: "supabase",
    label: "Supabase 已连接",
    note: "使用 Supabase Realtime 和 rooms 表同步房间状态。",
    configured: true,
  };
}

async function getSupabaseClient() {
  if (supabaseClient) {
    return supabaseClient;
  }

  const config = getOnlineConfig();
  if (!config.SUPABASE_URL || !config.SUPABASE_PUBLISHABLE_KEY) {
    throw new Error("Supabase 未配置。");
  }

  const { createClient } = await import(SUPABASE_JS_URL);
  supabaseClient = createClient(
    config.SUPABASE_URL,
    config.SUPABASE_PUBLISHABLE_KEY,
  );

  return supabaseClient;
}

async function fetchRoom(roomCode) {
  const supabase = await getSupabaseClient();
  const { data, error } = await supabase
    .from("rooms")
    .select("*")
    .eq("code", normalizeRoomCode(roomCode))
    .maybeSingle();

  if (error) {
    return null;
  }

  return data ? fromDatabaseRoom(data) : null;
}

function toDatabaseRoom(room) {
  return {
    code: room.code,
    status: room.status,
    game_state: room.gameState,
    score: room.score,
    players: room.players,
    version: room.version,
    move_number: room.moveNumber,
    last_seen_x: room.lastSeenX ?? null,
    last_seen_o: room.lastSeenO ?? null,
  };
}

function fromDatabaseRoom(row) {
  return {
    code: row.code,
    status: row.status,
    version: row.version,
    moveNumber: row.move_number,
    players: row.players,
    gameState: row.game_state,
    score: row.score,
    lastSeenX: row.last_seen_x,
    lastSeenO: row.last_seen_o,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
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

function formatSupabaseError(error, fallback) {
  if (!error) {
    return fallback;
  }

  return `${fallback} ${error.message || error.details || ""}`.trim();
}
