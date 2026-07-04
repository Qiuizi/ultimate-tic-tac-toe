import {
  BOARD_NAMES,
  applyMove,
  canPlayMove,
  createInitialState,
  getAvailableBoards,
} from "./game.js";

const app = document.querySelector("#app");
let state = createInitialState();
let history = [state];

function render() {
  const availableBoards = getAvailableBoards(state);
  const statusText = getStatusText(availableBoards);

  app.innerHTML = `
    <section class="game-layout" aria-label="终极井字棋">
      <header class="top-panel">
        <div>
          <p class="eyebrow">Ultimate Tic-Tac-Toe</p>
          <h1>终极井字棋</h1>
        </div>
        <div class="status-card ${state.winner ? "is-final" : ""}">
          <span class="turn-mark player-${state.currentPlayer.toLowerCase()}">${state.winner || state.currentPlayer}</span>
          <div>
            <p class="status-title">${statusText.title}</p>
            <p class="status-detail">${statusText.detail}</p>
          </div>
        </div>
        <nav class="actions" aria-label="游戏操作">
          <button class="icon-button" type="button" data-action="undo" title="悔棋" aria-label="悔棋" ${history.length <= 1 ? "disabled" : ""}>
            <span aria-hidden="true">↶</span>
          </button>
          <button class="icon-button" type="button" data-action="restart" title="重新开始" aria-label="重新开始">
            <span aria-hidden="true">↻</span>
          </button>
        </nav>
      </header>

      <section class="board-wrap">
        <div class="macro-board" role="grid" aria-label="大棋盘">
          ${state.boards
            .map((board, boardIndex) =>
              renderSmallBoard(board, boardIndex, availableBoards.includes(boardIndex)),
            )
            .join("")}
        </div>
      </section>

      <footer class="info-strip" aria-live="polite">
        <span>步数 ${state.moveHistory.length}</span>
        <span>${getConstraintText(availableBoards)}</span>
      </footer>
    </section>
  `;
}

function renderSmallBoard(board, boardIndex, isAvailable) {
  const macroWon = state.winningLine?.includes(boardIndex) ? " is-macro-win" : "";
  const ownerClass = board.winner ? ` owner-${board.winner.toLowerCase()}` : "";
  const availableClass = isAvailable ? " is-available" : " is-locked";
  const tiedClass = !board.winner && board.full ? " is-tied" : "";

  return `
    <div
      class="small-board${availableClass}${ownerClass}${macroWon}${tiedClass}"
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
  const playable = canPlayMove(state, boardIndex, cellIndex);
  const winCell = board.winningLine?.includes(cellIndex) ? " is-small-win" : "";

  return `
    <button
      class="cell${cell ? " is-filled" : ""}${winCell}"
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
    return {
      title: `${state.winner} 获胜`,
      detail: "大棋盘三连完成",
    };
  }

  if (state.draw) {
    return {
      title: "平局",
      detail: "所有可用小棋盘均已结束",
    };
  }

  if (availableBoards.length === 1 && state.forcedBoard !== null) {
    return {
      title: `${state.currentPlayer} 回合`,
      detail: `必须下在${BOARD_NAMES[availableBoards[0]]}区域`,
    };
  }

  return {
    title: `${state.currentPlayer} 回合`,
    detail: "可选择任意未结束区域",
  };
}

function getConstraintText(availableBoards) {
  if (state.winner || state.draw) {
    return "对局已结束";
  }

  if (availableBoards.length === 1 && state.forcedBoard !== null) {
    return `强制区域：${BOARD_NAMES[availableBoards[0]]}`;
  }

  return "自由选择：目标区域已结束或首步";
}

app.addEventListener("click", (event) => {
  const target = event.target.closest("button");
  if (!target) {
    return;
  }

  const action = target.dataset.action;
  if (action === "restart") {
    state = createInitialState();
    history = [state];
    render();
    return;
  }

  if (action === "undo") {
    if (history.length > 1) {
      history.pop();
      state = history[history.length - 1];
      render();
    }
    return;
  }

  if (!target.classList.contains("cell")) {
    return;
  }

  const boardIndex = Number(target.dataset.board);
  const cellIndex = Number(target.dataset.cell);
  const nextState = applyMove(state, boardIndex, cellIndex);

  if (nextState !== state) {
    state = nextState;
    history.push(state);
    render();
  }
});

render();
