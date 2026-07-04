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
export const EDGE_CELLS = [1, 3, 5, 7];
export const DEFAULT_MINIMAX_DEPTH = 5;

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
    findSmallBoardForkBlockMove(state, legalMoves, computer, human) ||
    getBestMinimaxMove(state, legalMoves, computer, human, DEFAULT_MINIMAX_DEPTH)
  );
}

export function getBestMinimaxMove(
  state,
  legalMoves = getLegalMoves(state),
  computer = PLAYERS.O,
  human = PLAYERS.X,
  maxDepth = DEFAULT_MINIMAX_DEPTH,
) {
  let bestMove = null;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const move of orderMoves(state, legalMoves, computer, human)) {
    const nextState = applyMove(state, move.boardIndex, move.cellIndex);
    const score = minimax(nextState, 1, false, computer, human, maxDepth);

    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }

  return bestMove || legalMoves[0] || null;
}

export function minimax(
  state,
  depth,
  isMaximizing,
  computer = PLAYERS.O,
  human = PLAYERS.X,
  maxDepth = DEFAULT_MINIMAX_DEPTH,
) {
  if (state.winner === computer) {
    return 10 - depth;
  }

  if (state.winner === human) {
    return depth - 10;
  }

  if (state.draw) {
    return 0;
  }

  if (depth >= maxDepth) {
    return normalizeHeuristicScore(evaluateState(state, computer, human));
  }

  const legalMoves = orderMoves(state, getLegalMoves(state), computer, human);
  if (legalMoves.length === 0) {
    return 0;
  }

  if (isMaximizing) {
    let bestScore = Number.NEGATIVE_INFINITY;

    for (const move of legalMoves) {
      const nextState = applyMove(state, move.boardIndex, move.cellIndex);
      bestScore = Math.max(
        bestScore,
        minimax(nextState, depth + 1, false, computer, human, maxDepth),
      );
    }

    return bestScore;
  }

  let bestScore = Number.POSITIVE_INFINITY;

  for (const move of legalMoves) {
    const nextState = applyMove(state, move.boardIndex, move.cellIndex);
    bestScore = Math.min(
      bestScore,
      minimax(nextState, depth + 1, true, computer, human, maxDepth),
    );
  }

  return bestScore;
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

function findSmallBoardForkBlockMove(state, legalMoves, computer, human) {
  return legalMoves.find((move) => {
    const board = state.boards[move.boardIndex];

    if (move.cellIndex !== CENTER_CELL && !EDGE_CELLS.includes(move.cellIndex)) {
      return false;
    }

    const hasComputerCenter = board.cells[CENTER_CELL] === computer;
    const hasHumanOppositeCorners =
      (board.cells[0] === human && board.cells[8] === human) ||
      (board.cells[2] === human && board.cells[6] === human);

    return hasComputerCenter && hasHumanOppositeCorners && EDGE_CELLS.includes(move.cellIndex);
  });
}

function evaluateState(state, computer, human) {
  const macroCells = state.boards.map((board) => board.winner);
  let score = evaluateLines(macroCells, computer, human) * 18;

  for (const board of state.boards) {
    if (board.winner === computer) {
      score += 28;
      continue;
    }

    if (board.winner === human) {
      score -= 28;
      continue;
    }

    if (!board.full) {
      score += evaluateLines(board.cells, computer, human);
      if (board.cells[CENTER_CELL] === computer) {
        score += 2;
      }
      if (board.cells[CENTER_CELL] === human) {
        score -= 2;
      }
    }
  }

  const availableBoards = getAvailableBoards(state);
  if (availableBoards.length > 1) {
    score += state.currentPlayer === computer ? 4 : -4;
  }

  return score;
}

function evaluateLines(cells, computer, human) {
  return WIN_LINES.reduce((score, line) => {
    const values = line.map((index) => cells[index]);
    const computerCount = values.filter((value) => value === computer).length;
    const humanCount = values.filter((value) => value === human).length;

    if (computerCount > 0 && humanCount > 0) {
      return score;
    }

    if (computerCount === 3) {
      return score + 100;
    }
    if (computerCount === 2) {
      return score + 12;
    }
    if (computerCount === 1) {
      return score + 2;
    }
    if (humanCount === 3) {
      return score - 100;
    }
    if (humanCount === 2) {
      return score - 14;
    }
    if (humanCount === 1) {
      return score - 2;
    }

    return score;
  }, 0);
}

function orderMoves(state, legalMoves, computer, human) {
  return [...legalMoves].sort((a, b) => {
    return (
      scoreMoveForOrdering(state, b, computer, human) -
      scoreMoveForOrdering(state, a, computer, human)
    );
  });
}

function scoreMoveForOrdering(state, move, computer, human) {
  let score = 0;
  const board = state.boards[move.boardIndex];
  const cells = [...board.cells];
  cells[move.cellIndex] = state.currentPlayer;
  const smallWinner = getWinner(cells).winner;

  if (smallWinner === computer) {
    score += 80;
  }
  if (smallWinner === human) {
    score += 70;
  }
  if (move.cellIndex === CENTER_CELL) {
    score += 8;
  }
  if (CORNER_CELLS.includes(move.cellIndex)) {
    score += 4;
  }
  if (state.boards[move.cellIndex] && !isBoardPlayable(state.boards[move.cellIndex])) {
    score += 6;
  }

  return score;
}

function normalizeHeuristicScore(score) {
  if (score === 0) {
    return 0;
  }

  return Math.max(-9, Math.min(9, score / 60));
}

function isValidIndex(index) {
  return Number.isInteger(index) && index >= 0 && index < 9;
}
