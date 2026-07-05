import {
  BOARD_NAMES,
  AI_DIFFICULTIES,
  applyMove,
  canPlayMove,
  createGameSnapshot,
  createInitialState,
  getAvailableBoards,
  getComputerMove,
  getUndoMoveCount,
  restoreGameSnapshot,
  shouldIgnoreScheduledComputerMove,
} from "./game.js";
import {
  cleanupOnlineSubscription,
  createRoom as createOnlineRoom,
  getOnlineAdapterStatus,
  getOnlineDebugInfo,
  joinRoom as joinOnlineRoom,
  leaveRoom as leaveOnlineRoom,
  ONLINE_SYNC_STATUS,
  subscribeToRoom,
  updateRoomState,
} from "./online.js";
import { normalizeRoomCode, ROOM_STATUS } from "./room.js";

const app = document.querySelector("#app");
const SCORE_STORAGE_KEY = "ultimate-tic-tac-toe-score";
const MODES = {
  TWO_PLAYER: "two-player",
  COMPUTER: "computer",
  ONLINE: "online",
};
const COMPUTER_DELAY_MS = 650;
const EMPTY_SCORE = {
  X: 0,
  O: 0,
  draw: 0,
};

let state = createInitialState();
let score = loadScore();
let lastScoredGame = null;
let snapshots = [];
let gameMode = MODES.TWO_PLAYER;
let aiDifficulty = AI_DIFFICULTIES.NORMAL;
let computerTimer = null;
let isComputerThinking = false;
let feedbackMessage = "";
let feedbackTimer = null;
let isRulesOpen = false;
let isHistoryExpanded = false;
let onlineRoom = null;
let onlineSession = null;
let onlineSyncStatus = getDisconnectedStatus();
let onlineRoomCodeInput = "";
let lastLoggedOnlineDebug = "";

function render() {
  const availableBoards = getAvailableBoards(state);
  const statusText = getStatusText(availableBoards);
  const releasedTarget = getReleasedTarget();
  const gameResult = getGameResult();

  app.innerHTML = `
    <section class="game-layout" aria-label="终极井字棋">
      <header class="site-header">
        <div class="brand-block">
          <p class="eyebrow">Ultimate Tic-Tac-Toe</p>
          <h1>终极井字棋</h1>
          <p class="tagline">九个小棋盘互相牵制，把普通三连变成一场位置博弈。</p>
        </div>
        <button class="rules-button" type="button" data-action="open-rules" data-testid="rules-button">游戏规则</button>
      </header>

      <section class="play-area">
        <aside class="control-panel" aria-label="对局信息">
          ${renderStatusCard(statusText, gameResult)}
          ${renderModeSelector()}
          ${renderDifficultySelector()}
          ${renderOnlinePanel()}
          ${renderReleasedTargetNotice(releasedTarget)}
          ${renderScoreboard()}
          ${renderActions()}
          ${renderRuleNotes()}
          ${renderMoveHistory()}
        </aside>

        <section class="board-wrap">
          <div class="macro-board ${isComputerThinking ? "is-thinking" : ""}" role="grid" aria-label="大棋盘" data-testid="game-board">
            ${state.boards
              .map((board, boardIndex) =>
                renderSmallBoard(board, boardIndex, {
                  isAvailable: availableBoards.includes(boardIndex),
                  isForced:
                    state.forcedBoard === boardIndex && availableBoards.includes(boardIndex),
                  isFreeChoice:
                    state.forcedBoard === null && availableBoards.includes(boardIndex),
                }),
              )
              .join("")}
          </div>
        </section>
      </section>

      <footer class="info-strip" aria-live="polite">
        <span>步数 ${state.moveHistory.length}</span>
        <span>${getConstraintText(availableBoards, releasedTarget)}</span>
        <span>已占领 ${getCapturedCount()} / 9 个小棋盘</span>
      </footer>
      ${isRulesOpen ? renderRulesDialog() : ""}
      ${feedbackMessage ? `<div class="feedback-toast" role="status">${feedbackMessage}</div>` : ""}
    </section>
  `;
}

function renderStatusCard(statusText, gameResult) {
  const mark = state.winner || (state.draw ? "平" : state.currentPlayer);
  const markClass = state.winner
    ? `player-${state.winner.toLowerCase()}`
    : state.draw
      ? "player-draw"
      : `player-${state.currentPlayer.toLowerCase()}`;

  return `
    <section class="status-card ${gameResult ? "is-final" : ""}" aria-live="polite">
      <span class="turn-mark ${markClass}">${mark}</span>
      <div>
        <p class="status-title">${statusText.title}</p>
        <p class="status-detail">${statusText.detail}</p>
      </div>
    </section>
  `;
}

function renderModeSelector() {
  return `
    <section class="mode-card" aria-label="游戏模式">
      <span class="mode-label">游戏模式</span>
      <div class="mode-toggle" role="group" aria-label="选择游戏模式" data-testid="mode-select">
        <button class="mode-button ${gameMode === MODES.TWO_PLAYER ? "is-active" : ""}" type="button" data-mode="${MODES.TWO_PLAYER}">
          本地双人
        </button>
        <button class="mode-button ${gameMode === MODES.COMPUTER ? "is-active" : ""}" type="button" data-mode="${MODES.COMPUTER}">
          人机对战
        </button>
        <button class="mode-button ${gameMode === MODES.ONLINE ? "is-active" : ""}" type="button" data-mode="${MODES.ONLINE}">
          远程对战
        </button>
      </div>
    </section>
  `;
}

function renderDifficultySelector() {
  if (gameMode !== MODES.COMPUTER) {
    return "";
  }

  return `
    <section class="mode-card" aria-label="AI 难度">
      <span class="mode-label">AI 难度</span>
      <div class="mode-toggle" role="group" aria-label="选择 AI 难度" data-testid="difficulty-select">
        <button class="mode-button ${aiDifficulty === AI_DIFFICULTIES.NORMAL ? "is-active" : ""}" type="button" data-difficulty="${AI_DIFFICULTIES.NORMAL}">
          普通
        </button>
        <button class="mode-button ${aiDifficulty === AI_DIFFICULTIES.HARD ? "is-active" : ""}" type="button" data-difficulty="${AI_DIFFICULTIES.HARD}">
          困难
        </button>
      </div>
    </section>
  `;
}

function renderOnlinePanel() {
  if (gameMode !== MODES.ONLINE) {
    return "";
  }

  logOnlineDebugInfo();

  const roomCode = onlineRoom?.code || onlineSession?.roomCode || "";
  const role = onlineSession?.role || "未加入";
  const opponentStatus = getOpponentStatusText();
  const canCopy = Boolean(roomCode);
  const adapterStatus = getOnlineAdapterStatus();
  const onlineDebugInfo = getOnlineDebugInfo();

  return `
    <section class="online-panel" aria-label="远程对战配置" data-testid="online-panel">
      <div class="panel-heading">
        <h2 data-testid="online-provider-label">${adapterStatus.label}</h2>
        <span>${adapterStatus.configured ? "可联机" : "配置中"}</span>
      </div>
      <p class="online-note">${adapterStatus.note}</p>
      <dl class="online-debug" aria-label="远程调试信息" data-testid="online-debug">
        <div>
          <dt>adapter</dt>
          <dd>${onlineDebugInfo.adapter}</dd>
        </div>
        <div>
          <dt>onlineProvider</dt>
          <dd>${onlineDebugInfo.onlineProvider}</dd>
        </div>
        <div>
          <dt>hasSupabaseUrl</dt>
          <dd>${onlineDebugInfo.hasSupabaseUrl}</dd>
        </div>
        <div>
          <dt>hasPublishableKey</dt>
          <dd>${onlineDebugInfo.hasPublishableKey}</dd>
        </div>
      </dl>
      <div class="online-actions">
        <button class="action-button primary" type="button" data-action="create-room" data-testid="create-room-button" ${onlineSession ? "disabled" : ""}>
          创建房间
        </button>
        <label class="room-code-field">
          <span>加入房间</span>
          <input
            type="text"
            inputmode="latin"
            maxlength="8"
            placeholder="输入 6 位房间码"
            value="${onlineRoomCodeInput}"
            data-testid="join-room-input"
            data-field="room-code"
            ${onlineSession ? "disabled" : ""}
          >
        </label>
        <button class="action-button" type="button" data-action="join-room" data-testid="join-room-button" ${onlineSession ? "disabled" : ""}>
          加入房间
        </button>
      </div>
      <dl class="online-room-meta">
        <div>
          <dt>房间码</dt>
          <dd data-testid="room-code-display">${roomCode || "未创建"}</dd>
        </div>
        <div>
          <dt>当前身份</dt>
          <dd data-testid="online-role-display">${role}</dd>
        </div>
        <div>
          <dt>对手状态</dt>
          <dd data-testid="opponent-status">${opponentStatus}</dd>
        </div>
        <div>
          <dt>同步状态</dt>
          <dd data-testid="sync-status">${onlineSyncStatus}</dd>
        </div>
      </dl>
      <div class="online-secondary-actions">
        <button class="action-button" type="button" data-action="copy-room-code" data-testid="copy-room-code-button" ${canCopy ? "" : "disabled"}>
          复制房间码
        </button>
        <button class="action-button subtle" type="button" data-action="leave-room" data-testid="leave-room-button" ${onlineSession ? "" : "disabled"}>
          退出房间
        </button>
      </div>
    </section>
  `;
}

function logOnlineDebugInfo() {
  const onlineDebugInfo = getOnlineDebugInfo();
  const debugKey = JSON.stringify(onlineDebugInfo);
  if (debugKey === lastLoggedOnlineDebug) {
    return;
  }

  lastLoggedOnlineDebug = debugKey;
  console.info("Ultimate Tic-Tac-Toe online debug", onlineDebugInfo);
}

function renderReleasedTargetNotice(releasedTarget) {
  if (!releasedTarget) {
    return "";
  }

  return `
    <section class="notice-card" aria-live="polite">
      <strong>目标区域已结束</strong>
      <span>上一手指向${BOARD_NAMES[releasedTarget.index]}区域，但该区域${releasedTarget.reason}，所以本回合可自由选择。</span>
    </section>
  `;
}

function renderScoreboard() {
  const visibleScore = getVisibleScore();

  return `
    <section class="scoreboard" aria-label="比分">
      <div class="score-card score-x">
        <span class="score-label">X</span>
        <strong data-testid="score-x-value">${visibleScore.X}</strong>
      </div>
      <div class="score-card score-o">
        <span class="score-label">O</span>
        <strong data-testid="score-o-value">${visibleScore.O}</strong>
      </div>
      <div class="score-card">
        <span class="score-label">平局</span>
        <strong data-testid="score-draw-value">${visibleScore.draw}</strong>
      </div>
    </section>
  `;
}

function renderActions() {
  const undoDisabled = getUndoDisabled();

  return `
    <nav class="actions" aria-label="游戏操作">
      <button class="action-button" type="button" data-action="undo" data-testid="undo-button" ${undoDisabled ? "disabled" : ""}>
        <span aria-hidden="true">↶</span>
        撤销上一步
      </button>
      <button class="action-button primary" type="button" data-action="restart" data-testid="restart-button">
        <span aria-hidden="true">↻</span>
        重新开始
      </button>
      <button class="action-button subtle" type="button" data-action="reset-score" data-testid="reset-score-button">
        清空比分
      </button>
    </nav>
  `;
}

function renderRuleNotes() {
  return `
    <section class="rule-notes" aria-label="规则提示">
      <h2>当前规则</h2>
      <p>你在小棋盘中点击的位置，会决定对手下一步必须进入的大区域。</p>
      <p>如果目标区域已经结束，对手可以自由选择任意未结束区域。</p>
    </section>
  `;
}

function renderMoveHistory() {
  const visibleMoves = isHistoryExpanded
    ? [...state.moveHistory].reverse()
    : state.moveHistory.slice(-9).reverse();
  const canToggleHistory = state.moveHistory.length > 9;

  return `
    <section class="move-history" aria-label="落子历史" data-testid="move-history">
      <div class="panel-heading">
        <h2>落子历史</h2>
        <div class="history-heading-actions">
          <span>${state.moveHistory.length} 步</span>
          ${
            canToggleHistory
              ? `<button class="history-toggle" type="button" data-action="toggle-history" data-testid="history-toggle">
                  ${isHistoryExpanded ? "收起" : "展开全部"}
                </button>`
              : ""
          }
        </div>
      </div>
      ${
        visibleMoves.length
          ? `<ol class="history-list">
              ${visibleMoves
                .map((move) => {
                  return `
                    <li>
                      <span class="history-step">#${move.step ?? ""}</span>
                      <strong class="player-${move.player.toLowerCase()}">${move.player}</strong>
                      <span>${formatMoveHistoryText(move)}</span>
                    </li>
                  `;
                })
                .join("")}
            </ol>`
          : `<p class="history-empty">还没有落子。</p>`
      }
    </section>
  `;
}

function formatMoveHistoryText(move) {
  const details = [
    `第 ${move.step} 步：${move.player} 下在小棋盘 ${move.boardIndex + 1}，格子 ${move.cellIndex + 1}`,
  ];

  if (move.wonSmallBoard) {
    details.push("赢下该小棋盘");
  }

  if (move.wonGame) {
    details.push("赢下整局");
  }

  if (move.drewGame) {
    details.push("形成平局");
  }

  return `${details.join("，")}。`;
}

function renderRulesDialog() {
  return `
    <div class="rules-modal" role="dialog" aria-modal="true" aria-labelledby="rules-title" data-testid="rules-dialog">
      <section class="rules-dialog">
        <div class="dialog-heading">
          <div>
            <p class="eyebrow">How to play</p>
            <h2 id="rules-title">游戏规则</h2>
          </div>
          <button class="icon-button" type="button" data-action="close-rules" data-testid="rules-close-button" aria-label="关闭规则说明">×</button>
        </div>
        <ul class="rules-list">
          <li>棋盘由 9 个小棋盘组成，每个小棋盘都是 3 × 3。</li>
          <li>玩家在某个格子落子后，对手下一步必须去对应位置的小棋盘。</li>
          <li>如果目标小棋盘已经结束或下满，对手可以自由选择其他可用小棋盘。</li>
          <li>赢下一个小棋盘后，会占据大棋盘上对应的位置。</li>
          <li>谁先在大棋盘上占据三个连成一线的小棋盘，谁获胜。</li>
        </ul>
        <button class="action-button primary" type="button" data-action="close-rules" data-testid="rules-confirm-button">知道了</button>
      </section>
    </div>
  `;
}

function renderSmallBoard(board, boardIndex, boardState) {
  const macroWon = state.winningLine?.includes(boardIndex) ? " is-macro-win" : "";
  const ownerClass = board.winner ? ` owner-${board.winner.toLowerCase()}` : "";
  const availableClass = boardState.isAvailable ? " is-available" : " is-locked";
  const forcedClass = boardState.isForced ? " is-forced" : "";
  const freeChoiceClass = boardState.isFreeChoice ? " is-free-choice" : "";
  const tiedClass = !board.winner && board.full ? " is-tied" : "";

  return `
    <div
      class="small-board${availableClass}${forcedClass}${freeChoiceClass}${ownerClass}${macroWon}${tiedClass}"
      role="gridcell"
      aria-label="${BOARD_NAMES[boardIndex]}小棋盘"
      data-board="${boardIndex}"
      data-testid="small-board-${boardIndex}"
    >
      <div class="small-grid">
        ${board.cells
          .map((cell, cellIndex) => renderCell(board, boardIndex, cell, cellIndex))
          .join("")}
      </div>
      ${
        board.winner
          ? `<div class="board-owner player-${board.winner.toLowerCase()}" aria-hidden="true">${board.winner}</div>`
          : ""
      }
      ${!board.winner && board.full ? `<div class="board-draw" aria-hidden="true">平</div>` : ""}
    </div>
  `;
}

function renderCell(board, boardIndex, cell, cellIndex) {
  const playable = isCellPlayable(boardIndex, cellIndex);
  const disabledReason = getCellDisabledReason(boardIndex, cellIndex);
  const winCell = board.winningLine?.includes(cellIndex) ? " is-small-win" : "";
  const latestMove = state.moveHistory.at(-1);
  const isLatestMove =
    latestMove?.boardIndex === boardIndex && latestMove?.cellIndex === cellIndex;
  const latestMoveClass = isLatestMove ? " is-latest-move" : "";

  return `
    <button
      class="cell${cell ? " is-filled" : ""}${winCell}${latestMoveClass}${playable ? "" : " is-disabled"}"
      type="button"
      data-board="${boardIndex}"
      data-cell="${cellIndex}"
      data-testid="cell-${boardIndex}-${cellIndex}"
      data-disabled-reason="${disabledReason}"
      aria-label="${BOARD_NAMES[boardIndex]}小棋盘，第 ${cellIndex + 1} 格${cell ? `，${cell}` : ""}"
      aria-disabled="${playable ? "false" : "true"}"
    >
      <span class="${cell ? `player-${cell.toLowerCase()}` : ""}">${cell || ""}</span>
    </button>
  `;
}

function getStatusText(availableBoards) {
  if (state.winner) {
    if (gameMode === MODES.COMPUTER) {
      return {
        title: state.winner === "X" ? "玩家获胜" : "电脑获胜",
        detail: `大棋盘${state.winningLine.map((index) => BOARD_NAMES[index]).join("、")}三连完成`,
      };
    }

    return {
      title: `${state.winner} 获胜`,
      detail: `大棋盘${state.winningLine.map((index) => BOARD_NAMES[index]).join("、")}三连完成`,
    };
  }

  if (state.draw) {
    return {
      title: "平局",
      detail: "所有可用小棋盘均已结束",
    };
  }

  if (isComputerThinking) {
    return {
      title: "电脑思考中...",
      detail: "电脑正在选择一个合法落点",
    };
  }

  if (gameMode === MODES.ONLINE) {
    if (!onlineSession || !onlineRoom) {
      return {
        title: "远程对战配置中",
        detail: "创建或加入房间后才能落子；未配置 Supabase 时会使用 Mock 预览。",
      };
    }

    if (onlineRoom.status === ROOM_STATUS.WAITING) {
      return {
        title: "等待对手加入",
        detail: `房间 ${onlineRoom.code} 已创建，你是 ${onlineSession.role}。`,
      };
    }

    if (state.currentPlayer !== onlineSession.role) {
      return {
        title: "等待对手落子",
        detail: `你是 ${onlineSession.role}，当前轮到 ${state.currentPlayer}。`,
      };
    }

    return {
      title: `轮到你落子`,
      detail:
        availableBoards.length === 1 && state.forcedBoard !== null
          ? `你必须下在${BOARD_NAMES[availableBoards[0]]}区域`
          : "你可以选择任意未结束区域",
    };
  }

  if (gameMode === MODES.COMPUTER) {
    return {
      title: "轮到玩家",
      detail:
        availableBoards.length === 1 && state.forcedBoard !== null
          ? `你必须下在${BOARD_NAMES[availableBoards[0]]}区域`
          : "你可以选择任意未结束区域",
    };
  }

  if (availableBoards.length === 1 && state.forcedBoard !== null) {
    return {
      title: `${state.currentPlayer} 回合`,
      detail: `必须下在${BOARD_NAMES[availableBoards[0]]}区域`,
    };
  }

  const releasedTarget = getReleasedTarget();
  if (releasedTarget) {
    return {
      title: `${state.currentPlayer} 回合`,
      detail: `${BOARD_NAMES[releasedTarget.index]}区域${releasedTarget.reason}，可选择任意未结束区域`,
    };
  }

  return {
    title: `${state.currentPlayer} 回合`,
    detail: "可选择任意未结束区域",
  };
}

function getConstraintText(availableBoards, releasedTarget = getReleasedTarget()) {
  if (state.winner || state.draw) {
    return "对局已结束";
  }

  if (isComputerThinking) {
    return "电脑思考中...请稍候";
  }

  if (gameMode === MODES.ONLINE) {
    if (!onlineSession || !onlineRoom) {
      return "远程模式：尚未加入房间";
    }

    if (onlineRoom.status === ROOM_STATUS.WAITING) {
      return "远程模式：等待对手加入";
    }

    if (state.currentPlayer !== onlineSession.role) {
      return `远程模式：等待 ${state.currentPlayer} 落子`;
    }
  }

  if (availableBoards.length === 1 && state.forcedBoard !== null) {
    return `强制区域：${BOARD_NAMES[availableBoards[0]]}`;
  }

  if (releasedTarget) {
    return `原目标：${BOARD_NAMES[releasedTarget.index]}${releasedTarget.reason}`;
  }

  return "自由选择：目标区域已结束或首步";
}

app.addEventListener("click", async (event) => {
  const target = event.target.closest("button");
  if (!target) {
    return;
  }

  const action = target.dataset.action;
  const mode = target.dataset.mode;
  const difficulty = target.dataset.difficulty;

  if (mode) {
    await setGameMode(mode);
    return;
  }

  if (difficulty) {
    setAiDifficulty(difficulty);
    return;
  }

  if (action === "restart") {
    if (gameMode === MODES.ONLINE && onlineSession) {
      showFeedback("远程模式暂不支持同步重开。");
      return;
    }

    resetRound();
    return;
  }

  if (action === "open-rules") {
    isRulesOpen = true;
    render();
    return;
  }

  if (action === "close-rules") {
    isRulesOpen = false;
    render();
    return;
  }

  if (action === "reset-score") {
    if (gameMode === MODES.ONLINE && onlineSession) {
      showFeedback("远程房间分数只在房间内临时记录。");
      return;
    }

    score = { ...EMPTY_SCORE };
    saveScore(score);
    render();
    return;
  }

  if (action === "undo") {
    undoMove();
    return;
  }

  if (action === "create-room") {
    await handleCreateRoom();
    return;
  }

  if (action === "join-room") {
    await handleJoinRoom();
    return;
  }

  if (action === "leave-room") {
    await handleLeaveRoom();
    return;
  }

  if (action === "copy-room-code") {
    await handleCopyRoomCode();
    return;
  }

  if (action === "toggle-history") {
    isHistoryExpanded = !isHistoryExpanded;
    render();
    return;
  }

  if (!target.classList.contains("cell")) {
    return;
  }

  if (isComputerThinking || (gameMode === MODES.COMPUTER && state.currentPlayer === "O")) {
    showFeedback("电脑思考中，请稍候。");
    return;
  }

  if (gameMode === MODES.ONLINE) {
    const disabledReason = getOnlineCellDisabledReason();
    if (disabledReason) {
      showFeedback(disabledReason);
      return;
    }
  }

  if (state.winner || state.draw) {
    showFeedback("本局已经结束，请重新开始。");
    return;
  }

  const boardIndex = Number(target.dataset.board);
  const cellIndex = Number(target.dataset.cell);
  if (!canPlayMove(state, boardIndex, cellIndex)) {
    showFeedback(target.dataset.disabledReason || "这里暂时不能落子。");
    return;
  }

  const nextState = applyMove(state, boardIndex, cellIndex);

  if (nextState !== state) {
    if (gameMode === MODES.ONLINE) {
      await commitOnlineState(nextState);
      return;
    }

    commitState(nextState);
    render();
    scheduleComputerMove();
  }
});

app.addEventListener("input", (event) => {
  const target = event.target;
  if (target?.dataset?.field !== "room-code") {
    return;
  }

  onlineRoomCodeInput = normalizeRoomCode(target.value);
  target.value = onlineRoomCodeInput;
});

async function setGameMode(nextMode) {
  if (!Object.values(MODES).includes(nextMode) || nextMode === gameMode) {
    return;
  }

  if (gameMode === MODES.ONLINE) {
    await resetOnlineSession();
  }

  gameMode = nextMode;
  showFeedback("已切换模式，当前棋局已重置。");
  resetRound();
}

function setAiDifficulty(nextDifficulty) {
  if (
    !Object.values(AI_DIFFICULTIES).includes(nextDifficulty) ||
    nextDifficulty === aiDifficulty
  ) {
    return;
  }

  aiDifficulty = nextDifficulty;
  showFeedback("已切换 AI 难度，当前棋局已重置。");
  resetRound();
}

function resetRound() {
  clearComputerTimer();
  state = createInitialState();
  lastScoredGame = null;
  isComputerThinking = false;
  isHistoryExpanded = false;
  resetSnapshots();
  render();
}

async function handleCreateRoom() {
  onlineSyncStatus = getSyncingStatus();
  render();

  const result = await createOnlineRoom();
  if (!result.ok) {
    onlineSyncStatus = getDisconnectedStatus();
    showFeedback(result.error || "创建远程房间失败。");
    return;
  }

  onlineSession = result.session;
  onlineRoom = result.room;
  onlineRoomCodeInput = result.room.code;
  state = result.room.gameState;
  resetSnapshots();
  subscribeToCurrentRoom();
  onlineSyncStatus = getConnectedStatus();
  render();
}

async function handleJoinRoom() {
  const roomCode = normalizeRoomCode(onlineRoomCodeInput);
  if (!roomCode) {
    showFeedback("请输入房间码。");
    return;
  }

  onlineSyncStatus = getSyncingStatus();
  render();

  const result = await joinOnlineRoom(roomCode);
  if (!result.ok) {
    onlineSyncStatus = getDisconnectedStatus();
    if (result.room) {
      onlineRoom = result.room;
      state = result.room.gameState;
    }
    showFeedback(result.error || "加入远程房间失败。");
    return;
  }

  onlineSession = result.session;
  onlineRoom = result.room;
  state = result.room.gameState;
  resetSnapshots();
  subscribeToCurrentRoom();
  onlineSyncStatus = getConnectedStatus();
  render();
}

async function handleLeaveRoom() {
  await resetOnlineSession();
  state = createInitialState();
  lastScoredGame = null;
  resetSnapshots();
  render();
}

async function handleCopyRoomCode() {
  const roomCode = onlineRoom?.code || onlineSession?.roomCode;
  if (!roomCode) {
    return;
  }

  try {
    await navigator.clipboard?.writeText(roomCode);
    showFeedback("房间码已复制。");
  } catch {
    showFeedback(`房间码：${roomCode}`);
  }
}

async function commitOnlineState(nextState) {
  if (!onlineRoom || !onlineSession) {
    return;
  }

  onlineSyncStatus = getSyncingStatus();
  render();

  const result = await updateRoomState(onlineRoom.code, nextState, onlineRoom.version);
  if (!result.ok) {
    onlineRoom = result.room || onlineRoom;
    state = onlineRoom.gameState;
    onlineSyncStatus = getConnectedStatus();
    showFeedback("状态已同步，请重试。");
    return;
  }

  onlineRoom = result.room;
  state = result.room.gameState;
  onlineSyncStatus = getConnectedStatus();
  render();
}

function subscribeToCurrentRoom() {
  if (!onlineSession) {
    return;
  }

  subscribeToRoom(onlineSession.roomCode, (room) => {
    if (room.error) {
      onlineSyncStatus = getDisconnectedStatus();
      showFeedback(room.error);
      render();
      return;
    }

    onlineRoom = room;
    state = room.gameState;
    onlineSyncStatus = getConnectedStatus();
    isHistoryExpanded = isHistoryExpanded && state.moveHistory.length > 9;
    render();
  });
}

async function resetOnlineSession() {
  cleanupOnlineSubscription();
  await leaveOnlineRoom();
  onlineRoom = null;
  onlineSession = null;
  onlineRoomCodeInput = "";
  onlineSyncStatus = getDisconnectedStatus();
}

function scheduleComputerMove() {
  if (
    gameMode !== MODES.COMPUTER ||
    state.currentPlayer !== "O" ||
    state.winner ||
    state.draw
  ) {
    return;
  }

  clearComputerTimer();
  isComputerThinking = true;
  const scheduledMoveCount = state.moveHistory.length;
  render();

  computerTimer = setTimeout(() => {
    if (
      gameMode !== MODES.COMPUTER ||
      shouldIgnoreScheduledComputerMove(state, scheduledMoveCount)
    ) {
      isComputerThinking = false;
      computerTimer = null;
      render();
      return;
    }

    const move = getComputerMove(state, "O", "X", aiDifficulty);
    isComputerThinking = false;

    if (move) {
      const nextState = applyMove(state, move.boardIndex, move.cellIndex);
      if (nextState !== state) {
        commitState(nextState);
      }
    }

    computerTimer = null;
    render();
  }, COMPUTER_DELAY_MS);
}

function clearComputerTimer() {
  if (computerTimer) {
    clearTimeout(computerTimer);
    computerTimer = null;
  }
}

function commitState(nextState) {
  state = nextState;
  recordFinishedGame(getGameResult());
  pushSnapshot();
}

function resetSnapshots() {
  snapshots = [];
  pushSnapshot();
}

function pushSnapshot() {
  snapshots.push(
    createGameSnapshot(state, {
      lastScoredGame,
    }),
  );
}

function undoMove() {
  if (getUndoDisabled()) {
    return;
  }

  clearComputerTimer();
  isComputerThinking = false;

  const previousScoredGame = lastScoredGame;
  const undoMoveCount = getUndoMoveCount(state, gameMode === MODES.COMPUTER);
  const targetIndex = Math.max(0, snapshots.length - 1 - undoMoveCount);
  const snapshot = snapshots[targetIndex];

  snapshots = snapshots.slice(0, targetIndex + 1);
  state = restoreGameSnapshot(snapshot);
  lastScoredGame = snapshot.lastScoredGame ?? null;
  rollbackScoreForUndo(previousScoredGame, lastScoredGame);
  isHistoryExpanded = isHistoryExpanded && state.moveHistory.length > 9;
  render();
}

function getUndoDisabled() {
  return (
    gameMode === MODES.ONLINE ||
    snapshots.length <= 1 ||
    getUndoMoveCount(state, gameMode === MODES.COMPUTER) === 0 ||
    isComputerThinking
  );
}

function rollbackScoreForUndo(previousScoredGame, restoredScoredGame) {
  if (!previousScoredGame || previousScoredGame === restoredScoredGame) {
    return;
  }

  score[previousScoredGame] = Math.max(0, score[previousScoredGame] - 1);
  saveScore(score);
}

function getCellDisabledReason(boardIndex, cellIndex) {
  const onlineDisabledReason = getOnlineCellDisabledReason();
  if (onlineDisabledReason) {
    return onlineDisabledReason;
  }

  if (isComputerThinking || (gameMode === MODES.COMPUTER && state.currentPlayer === "O")) {
    return "电脑思考中，请稍候。";
  }

  if (state.winner || state.draw) {
    return "本局已经结束，请重新开始。";
  }

  const board = state.boards[boardIndex];
  if (!board || board.winner) {
    return "这个小棋盘已经被占领。";
  }

  if (board.full) {
    return "这个小棋盘已经下满。";
  }

  if (board.cells[cellIndex]) {
    return "这个格子已经有棋子了。";
  }

  if (!getAvailableBoards(state).includes(boardIndex)) {
    return state.forcedBoard === null
      ? "请选择一个未结束的小棋盘。"
      : `当前必须下在${BOARD_NAMES[state.forcedBoard]}区域。`;
  }

  return "";
}

function isCellPlayable(boardIndex, cellIndex) {
  return (
    canPlayMove(state, boardIndex, cellIndex) &&
    !isComputerThinking &&
    !getOnlineCellDisabledReason()
  );
}

function getOnlineCellDisabledReason() {
  if (gameMode !== MODES.ONLINE) {
    return "";
  }

  if (!onlineSession || !onlineRoom) {
    return "请先创建或加入房间。";
  }

  if (isOnlineSyncing()) {
    return "远程同步中，请稍候。";
  }

  if (onlineRoom.status === ROOM_STATUS.WAITING) {
    return "等待对手加入后才能开始。";
  }

  if (onlineRoom.status === ROOM_STATUS.CLOSED) {
    return "这个远程房间已关闭。";
  }

  if (state.currentPlayer !== onlineSession.role) {
    return "等待对手落子。";
  }

  return "";
}

function getOpponentStatusText() {
  if (!onlineRoom || !onlineSession) {
    return "未加入";
  }

  const opponentRole = onlineSession.role === "X" ? "O" : "X";
  const opponent = onlineRoom.players?.[opponentRole];
  if (opponent?.joined) {
    return "已加入";
  }

  return "等待加入";
}

function getVisibleScore() {
  if (gameMode === MODES.ONLINE && onlineRoom?.score) {
    return onlineRoom.score;
  }

  return score;
}

function getConnectedStatus() {
  return getOnlineAdapterStatus().provider === "supabase"
    ? ONLINE_SYNC_STATUS.SUPABASE_CONNECTED
    : ONLINE_SYNC_STATUS.CONNECTED;
}

function getSyncingStatus() {
  return getOnlineAdapterStatus().provider === "supabase"
    ? ONLINE_SYNC_STATUS.SUPABASE_SYNCING
    : ONLINE_SYNC_STATUS.SYNCING;
}

function getDisconnectedStatus() {
  const adapterStatus = getOnlineAdapterStatus();
  if (adapterStatus.label === "Supabase 未配置") {
    return ONLINE_SYNC_STATUS.SUPABASE_UNCONFIGURED;
  }

  return adapterStatus.provider === "supabase"
    ? ONLINE_SYNC_STATUS.SUPABASE_DISCONNECTED
    : ONLINE_SYNC_STATUS.DISCONNECTED;
}

function isOnlineSyncing() {
  return (
    onlineSyncStatus === ONLINE_SYNC_STATUS.SYNCING ||
    onlineSyncStatus === ONLINE_SYNC_STATUS.SUPABASE_SYNCING
  );
}

function showFeedback(message) {
  feedbackMessage = message;
  if (feedbackTimer) {
    clearTimeout(feedbackTimer);
  }

  feedbackTimer = setTimeout(() => {
    feedbackMessage = "";
    feedbackTimer = null;
    render();
  }, 1800);
  render();
}

function getCapturedCount() {
  return state.boards.filter((board) => board.winner || board.full).length;
}

function getReleasedTarget() {
  if (state.winner || state.draw || state.forcedBoard !== null || state.moveHistory.length === 0) {
    return null;
  }

  const lastMove = state.moveHistory.at(-1);
  const targetBoard = state.boards[lastMove.cellIndex];

  if (targetBoard.winner) {
    return {
      index: lastMove.cellIndex,
      reason: `已被 ${targetBoard.winner} 占领`,
    };
  }

  if (targetBoard.full) {
    return {
      index: lastMove.cellIndex,
      reason: "已下满",
    };
  }

  return null;
}

function getGameResult() {
  if (state.winner) {
    return state.winner;
  }

  if (state.draw) {
    return "draw";
  }

  return null;
}

function recordFinishedGame(gameResult) {
  if (!gameResult || lastScoredGame === gameResult) {
    return;
  }

  score[gameResult] += 1;
  saveScore(score);
  lastScoredGame = gameResult;
}

function loadScore() {
  try {
    const storedScore = JSON.parse(localStorage.getItem(SCORE_STORAGE_KEY));

    return {
      X: Number.isInteger(storedScore?.X) ? storedScore.X : 0,
      O: Number.isInteger(storedScore?.O) ? storedScore.O : 0,
      draw: Number.isInteger(storedScore?.draw) ? storedScore.draw : 0,
    };
  } catch {
    return { ...EMPTY_SCORE };
  }
}

function saveScore(nextScore) {
  try {
    localStorage.setItem(SCORE_STORAGE_KEY, JSON.stringify(nextScore));
  } catch {
    // Score persistence is optional; the game remains playable if storage is blocked.
  }
}

resetSnapshots();
render();
