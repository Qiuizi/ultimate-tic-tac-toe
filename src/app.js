import {
  BOARD_NAMES,
  applyMove,
  canPlayMove,
  createInitialState,
  getAvailableBoards,
  getComputerMove,
} from "./game.js";

const app = document.querySelector("#app");
const SCORE_STORAGE_KEY = "ultimate-tic-tac-toe-score";
const MODES = {
  TWO_PLAYER: "two-player",
  COMPUTER: "computer",
};
const COMPUTER_DELAY_MS = 300;
const EMPTY_SCORE = {
  X: 0,
  O: 0,
  draw: 0,
};

let state = createInitialState();
let history = [state];
let score = loadScore();
let lastScoredGame = null;
let gameMode = MODES.TWO_PLAYER;
let computerTimer = null;
let isComputerThinking = false;

function render() {
  const availableBoards = getAvailableBoards(state);
  const statusText = getStatusText(availableBoards);
  const releasedTarget = getReleasedTarget();
  const gameResult = getGameResult();
  recordFinishedGame(gameResult);

  app.innerHTML = `
    <section class="game-layout" aria-label="终极井字棋">
      <header class="site-header">
        <div class="brand-block">
          <p class="eyebrow">Ultimate Tic-Tac-Toe</p>
          <h1>终极井字棋</h1>
          <p class="tagline">九个小棋盘互相牵制，把普通三连变成一场位置博弈。</p>
        </div>
      </header>

      <section class="play-area">
        <aside class="control-panel" aria-label="对局信息">
          ${renderStatusCard(statusText, gameResult)}
          ${renderModeSelector()}
          ${renderReleasedTargetNotice(releasedTarget)}
          ${renderScoreboard()}
          ${renderActions(gameResult)}
          ${renderRuleNotes()}
        </aside>

        <section class="board-wrap">
          <div class="macro-board" role="grid" aria-label="大棋盘">
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
      <div class="mode-toggle" role="group" aria-label="选择游戏模式">
        <button class="mode-button ${gameMode === MODES.TWO_PLAYER ? "is-active" : ""}" type="button" data-mode="${MODES.TWO_PLAYER}">
          两人对战
        </button>
        <button class="mode-button ${gameMode === MODES.COMPUTER ? "is-active" : ""}" type="button" data-mode="${MODES.COMPUTER}">
          人机对战
        </button>
      </div>
    </section>
  `;
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
  return `
    <section class="scoreboard" aria-label="比分">
      <div class="score-card score-x">
        <span class="score-label">X</span>
        <strong>${score.X}</strong>
      </div>
      <div class="score-card score-o">
        <span class="score-label">O</span>
        <strong>${score.O}</strong>
      </div>
      <div class="score-card">
        <span class="score-label">平局</span>
        <strong>${score.draw}</strong>
      </div>
    </section>
  `;
}

function renderActions(gameResult) {
  const undoDisabled = history.length <= 1 || gameResult || gameMode === MODES.COMPUTER;

  return `
    <nav class="actions" aria-label="游戏操作">
      <button class="action-button" type="button" data-action="undo" ${undoDisabled ? "disabled" : ""}>
        <span aria-hidden="true">↶</span>
        悔棋
      </button>
      <button class="action-button primary" type="button" data-action="restart">
        <span aria-hidden="true">↻</span>
        重新开始
      </button>
      <button class="action-button subtle" type="button" data-action="reset-score">
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
  const playable = canPlayMove(state, boardIndex, cellIndex) && !isComputerThinking;
  const winCell = board.winningLine?.includes(cellIndex) ? " is-small-win" : "";
  const latestMove = state.moveHistory.at(-1);
  const isLatestMove =
    latestMove?.boardIndex === boardIndex && latestMove?.cellIndex === cellIndex;
  const latestMoveClass = isLatestMove ? " is-latest-move" : "";

  return `
    <button
      class="cell${cell ? " is-filled" : ""}${winCell}${latestMoveClass}"
      type="button"
      data-board="${boardIndex}"
      data-cell="${cellIndex}"
      aria-label="${BOARD_NAMES[boardIndex]}小棋盘，第 ${cellIndex + 1} 格${cell ? `，${cell}` : ""}"
      ${playable ? "" : "disabled"}
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
      title: "电脑思考中",
      detail: "电脑正在选择一个合法落点",
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
    return "电脑思考中，请稍候";
  }

  if (availableBoards.length === 1 && state.forcedBoard !== null) {
    return `强制区域：${BOARD_NAMES[availableBoards[0]]}`;
  }

  if (releasedTarget) {
    return `原目标：${BOARD_NAMES[releasedTarget.index]}${releasedTarget.reason}`;
  }

  return "自由选择：目标区域已结束或首步";
}

app.addEventListener("click", (event) => {
  const target = event.target.closest("button");
  if (!target) {
    return;
  }

  const action = target.dataset.action;
  const mode = target.dataset.mode;

  if (mode) {
    setGameMode(mode);
    return;
  }

  if (action === "restart") {
    resetRound();
    return;
  }

  if (action === "reset-score") {
    score = { ...EMPTY_SCORE };
    saveScore(score);
    render();
    return;
  }

  if (action === "undo") {
    if (history.length > 1 && !getGameResult() && gameMode === MODES.TWO_PLAYER) {
      history.pop();
      state = history[history.length - 1];
      render();
    }
    return;
  }

  if (!target.classList.contains("cell")) {
    return;
  }

  if (isComputerThinking || (gameMode === MODES.COMPUTER && state.currentPlayer === "O")) {
    return;
  }

  const boardIndex = Number(target.dataset.board);
  const cellIndex = Number(target.dataset.cell);
  const nextState = applyMove(state, boardIndex, cellIndex);

  if (nextState !== state) {
    state = nextState;
    history.push(state);
    render();
    scheduleComputerMove();
  }
});

function setGameMode(nextMode) {
  if (!Object.values(MODES).includes(nextMode) || nextMode === gameMode) {
    return;
  }

  gameMode = nextMode;
  resetRound();
}

function resetRound() {
  clearComputerTimer();
  state = createInitialState();
  history = [state];
  lastScoredGame = null;
  isComputerThinking = false;
  render();
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
  render();

  computerTimer = setTimeout(() => {
    const move = getComputerMove(state);
    isComputerThinking = false;

    if (move) {
      const nextState = applyMove(state, move.boardIndex, move.cellIndex);
      if (nextState !== state) {
        state = nextState;
        history.push(state);
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

render();
