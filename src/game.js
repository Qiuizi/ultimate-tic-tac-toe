export const PLAYERS = {
  X: "X",
  O: "O",
};

export const WIN_LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

export const BOARD_NAMES = [
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

export const CENTER_CELL = 4;
export const CORNER_CELLS = [0, 2, 6, 8];

export function createInitialState() {
  return {
    boards: Array.from({ length: 9 }, () => createSmallBoard()),
    currentPlayer: PLAYERS.X,
    forcedBoard: null,
    winner: null,
    winningLine: null,
    draw: false,
    moveHistory: [],
  };
}

export function createSmallBoard() {
  return {
    cells: Array(9).fill(null),
    winner: null,
    winningLine: null,
    full: false,
  };
}

export function getWinner(cells) {
  for (const line of WIN_LINES) {
    const [a, b, c] = line;
    if (cells[a] && cells[a] === cells[b] && cells[a] === cells[c]) {
      return { winner: cells[a], line };
    }
  }

  return { winner: null, line: null };
}

export function isFull(cells) {
  return cells.every(Boolean);
}

export function isBoardPlayable(board) {
  return !board.winner && !board.full;
}

export function getAvailableBoards(state) {
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

export function canPlayMove(state, boardIndex, cellIndex) {
  if (state.winner || state.draw) {
    return false;
  }

  if (!isValidIndex(boardIndex) || !isValidIndex(cellIndex)) {
    return false;
  }

  const availableBoards = getAvailableBoards(state);
  if (!availableBoards.includes(boardIndex)) {
    return false;
  }

  const board = state.boards[boardIndex];
  return !board.cells[cellIndex];
}

export function getLegalMoves(state) {
  return getAvailableBoards(state).flatMap((boardIndex) =>
    state.boards[boardIndex].cells
      .map((cell, cellIndex) => (cell ? null : { boardIndex, cellIndex }))
      .filter(Boolean),
  );
}

export function applyMove(state, boardIndex, cellIndex) {
  if (!canPlayMove(state, boardIndex, cellIndex)) {
    return state;
  }

  const nextState = cloneState(state);
  const board = nextState.boards[boardIndex];
  const player = nextState.currentPlayer;

  board.cells[cellIndex] = player;

  const smallResult = getWinner(board.cells);
  board.winner = smallResult.winner;
  board.winningLine = smallResult.line;
  board.full = isFull(board.cells);

  const macroCells = nextState.boards.map((smallBoard) => smallBoard.winner);
  const macroResult = getWinner(macroCells);
  nextState.winner = macroResult.winner;
  nextState.winningLine = macroResult.line;
  nextState.draw =
    !nextState.winner && nextState.boards.every((smallBoard) => !isBoardPlayable(smallBoard));

  nextState.moveHistory.push({
    player,
    boardIndex,
    cellIndex,
    forcedBoardBefore: state.forcedBoard,
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

export function getComputerMove(state, computer = PLAYERS.O, human = PLAYERS.X) {
  const legalMoves = getLegalMoves(state);

  if (legalMoves.length === 0) {
    return null;
  }

  return (
    findMoveByOutcome(state, legalMoves, computer, "macro-win") ||
    findMoveByOutcome(state, legalMoves, human, "macro-win") ||
    findMoveByOutcome(state, legalMoves, computer, "small-win") ||
    findMoveByOutcome(state, legalMoves, human, "small-win") ||
    legalMoves.find((move) => move.cellIndex === CENTER_CELL) ||
    legalMoves.find((move) => CORNER_CELLS.includes(move.cellIndex)) ||
    legalMoves[Math.floor(Math.random() * legalMoves.length)]
  );
}

export function cloneState(state) {
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

function findMoveByOutcome(state, legalMoves, player, outcome) {
  return legalMoves.find((move) => {
    const board = state.boards[move.boardIndex];
    const cells = [...board.cells];
    cells[move.cellIndex] = player;

    const smallWinner = getWinner(cells).winner;
    if (outcome === "small-win") {
      return smallWinner === player;
    }

    if (outcome === "macro-win") {
      const macroCells = state.boards.map((smallBoard, index) => {
        if (index === move.boardIndex && smallWinner) {
          return smallWinner;
        }

        return smallBoard.winner;
      });

      return getWinner(macroCells).winner === player;
    }

    return false;
  });
}

function isValidIndex(index) {
  return Number.isInteger(index) && index >= 0 && index < 9;
}
