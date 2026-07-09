const PLAYERS = {
  X: "X",
  O: "O",
};

const WIN_LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

const BOARD_NAMES = [
  "左上",
  "上方",
  "右上",
  "左侧",
  "中央",
  "右侧",
  "左下",
  "下方",
  "右下",
];

const CENTER_CELL = 4;
const CORNER_CELLS = [0, 2, 6, 8];

function createInitialState(currentPlayer = PLAYERS.X) {
  return {
    boards: Array.from({ length: 9 }, () => createSmallBoard()),
    currentPlayer,
    forcedBoard: null,
    winner: null,
    winningLine: null,
    draw: false,
    moveHistory: [],
  };
}

function createSmallBoard() {
  return {
    cells: Array(9).fill(null),
    winner: null,
    winningLine: null,
    full: false,
  };
}

function checkWinner(cells) {
  for (const line of WIN_LINES) {
    const [a, b, c] = line;
    if (cells[a] && cells[a] === cells[b] && cells[a] === cells[c]) {
      return { winner: cells[a], line };
    }
  }

  return { winner: null, line: null };
}

function isFull(cells) {
  return cells.every(Boolean);
}

function isBoardPlayable(board) {
  return Boolean(board) && !board.full;
}

function getAvailableBoards(state) {
  if (state.winner || state.draw) {
    return [];
  }

  if (
    state.forcedBoard !== null &&
    isBoardPlayable(state.boards[state.forcedBoard])
  ) {
    return [state.forcedBoard];
  }

  return state.boards
    .map((board, index) => (isBoardPlayable(board) ? index : null))
    .filter((index) => index !== null);
}

function canPlayMove(state, boardIndex, cellIndex) {
  if (state.winner || state.draw) {
    return false;
  }

  if (!isValidIndex(boardIndex) || !isValidIndex(cellIndex)) {
    return false;
  }

  if (!getAvailableBoards(state).includes(boardIndex)) {
    return false;
  }

  return !state.boards[boardIndex].cells[cellIndex];
}

function getLegalMoves(state) {
  return getAvailableBoards(state).flatMap((boardIndex) =>
    state.boards[boardIndex].cells
      .map((cell, cellIndex) => (cell ? null : { boardIndex, cellIndex }))
      .filter(Boolean),
  );
}

function applyMove(state, boardIndex, cellIndex) {
  if (!canPlayMove(state, boardIndex, cellIndex)) {
    return state;
  }

  const nextState = cloneState(state);
  const board = nextState.boards[boardIndex];
  const boardWinnerBefore = board.winner;
  const player = nextState.currentPlayer;

  board.cells[cellIndex] = player;

  if (!boardWinnerBefore) {
    const smallResult = checkWinner(board.cells);
    board.winner = smallResult.winner;
    board.winningLine = smallResult.line;
  }

  board.full = isFull(board.cells);

  const macroCells = nextState.boards.map((smallBoard) => smallBoard.winner);
  const macroResult = checkWinner(macroCells);
  nextState.winner = macroResult.winner;
  nextState.winningLine = macroResult.line;
  nextState.draw =
    !nextState.winner && nextState.boards.every((smallBoard) => smallBoard.full);

  nextState.moveHistory.push({
    step: nextState.moveHistory.length + 1,
    player,
    boardIndex,
    cellIndex,
    forcedBoardBefore: state.forcedBoard,
    wonSmallBoard: !boardWinnerBefore && board.winner === player,
    wonGame: nextState.winner === player,
    drewGame: nextState.draw,
  });

  const targetBoard = nextState.boards[cellIndex];
  nextState.forcedBoard =
    !nextState.winner && !nextState.draw && isBoardPlayable(targetBoard)
      ? cellIndex
      : null;

  if (!nextState.winner && !nextState.draw) {
    nextState.currentPlayer = player === PLAYERS.X ? PLAYERS.O : PLAYERS.X;
  }

  return nextState;
}

function applyMoveToState(state, move, player = state.currentPlayer) {
  const playableState =
    state.currentPlayer === player ? state : { ...state, currentPlayer: player };
  return applyMove(playableState, move.boardIndex, move.cellIndex);
}

function cloneState(state) {
  return {
    ...state,
    boards: state.boards.map((board) => ({
      ...board,
      cells: [...board.cells],
      winningLine: board.winningLine ? [...board.winningLine] : null,
    })),
    winningLine: state.winningLine ? [...state.winningLine] : null,
    moveHistory: state.moveHistory.map((move) => ({ ...move })),
  };
}

function createGameSnapshot(state, metadata = {}) {
  return {
    state: cloneState(state),
    ...metadata,
  };
}

function restoreGameSnapshot(snapshot) {
  return cloneState(snapshot.state);
}

function getUndoMoveCount(state, isComputerMode = false) {
  const moves = state.moveHistory;
  if (moves.length === 0) {
    return 0;
  }

  if (!isComputerMode) {
    return 1;
  }

  const lastMove = moves[moves.length - 1];
  const previousMove = moves[moves.length - 2];
  if (lastMove && previousMove && lastMove.player === PLAYERS.O && previousMove.player === PLAYERS.X) {
    return 2;
  }

  return 1;
}

function shouldIgnoreScheduledComputerMove(state, scheduledMoveCount) {
  return (
    state.moveHistory.length !== scheduledMoveCount ||
    state.currentPlayer !== PLAYERS.O ||
    state.winner ||
    state.draw
  );
}

function isValidIndex(index) {
  return Number.isInteger(index) && index >= 0 && index < 9;
}

module.exports = {
  PLAYERS,
  WIN_LINES,
  BOARD_NAMES,
  CENTER_CELL,
  CORNER_CELLS,
  createInitialState,
  createSmallBoard,
  checkWinner,
  isFull,
  isBoardPlayable,
  getAvailableBoards,
  canPlayMove,
  getLegalMoves,
  applyMove,
  applyMoveToState,
  cloneState,
  createGameSnapshot,
  restoreGameSnapshot,
  getUndoMoveCount,
  shouldIgnoreScheduledComputerMove,
};
