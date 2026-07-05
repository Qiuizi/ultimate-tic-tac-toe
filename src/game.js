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
export const AI_DIFFICULTIES = {
  NORMAL: "normal",
  HARD: "hard",
};
export const HARD_AI_DEPTH = 3;
export const HARD_AI_TIME_LIMIT_MS = 950;

export function createInitialState(currentPlayer = PLAYERS.X) {
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
  const boardWinnerBefore = board.winner;
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

export function getComputerMove(
  state,
  computer = PLAYERS.O,
  human = PLAYERS.X,
  difficulty = AI_DIFFICULTIES.NORMAL,
) {
  if (difficulty === AI_DIFFICULTIES.HARD) {
    return getHardComputerMove(state, computer, human);
  }

  return getHeuristicMove(state, computer, human);
}

export function getHeuristicMove(state, computer = PLAYERS.O, human = PLAYERS.X) {
  const legalMoves = getLegalMoves(state);

  if (legalMoves.length === 0) {
    return null;
  }

  return (
    findMoveByOutcome(state, legalMoves, computer, "macro-win") ||
    findMoveByOutcome(state, legalMoves, human, "macro-win") ||
    getBestUltimateMove(state, legalMoves, computer, human)
  );
}

export function getHardComputerMove(
  state,
  computer = PLAYERS.O,
  human = PLAYERS.X,
  options = {},
) {
  const legalMoves = getLegalMoves(state);

  if (legalMoves.length === 0) {
    return null;
  }

  const immediateMove =
    findMoveByOutcome(state, legalMoves, computer, "macro-win") ||
    findMoveByOutcome(state, legalMoves, human, "macro-win");

  if (immediateMove) {
    return immediateMove;
  }

  const maxDepth = options.maxDepth ?? HARD_AI_DEPTH;
  const deadline = Date.now() + (options.timeLimitMs ?? HARD_AI_TIME_LIMIT_MS);
  const orderedMoves = orderMoves(state, legalMoves, computer, human);
  let bestMove = orderedMoves[0];
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const move of orderedMoves) {
    if (Date.now() > deadline) {
      break;
    }

    const nextState = applyMoveToState(state, move, computer);
    const score = alphaBeta(
      nextState,
      maxDepth - 1,
      Number.NEGATIVE_INFINITY,
      Number.POSITIVE_INFINITY,
      false,
      computer,
      human,
      deadline,
    );

    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }

  return bestMove;
}

export function getBestUltimateMove(
  state,
  legalMoves = getLegalMoves(state),
  computer = PLAYERS.O,
  human = PLAYERS.X,
) {
  let bestMove = null;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const move of legalMoves) {
    const score = scoreUltimateMove(state, move, computer, human);

    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }

  return bestMove || legalMoves[0] || null;
}

export function alphaBeta(
  state,
  depth,
  alpha,
  beta,
  isMaximizing,
  computer = PLAYERS.O,
  human = PLAYERS.X,
  deadline = Date.now() + HARD_AI_TIME_LIMIT_MS,
) {
  if (state.winner || state.draw || depth === 0 || Date.now() > deadline) {
    return evaluateGameState(state, computer, human);
  }

  const legalMoves = orderMoves(state, getLegalMoves(state), computer, human);
  if (legalMoves.length === 0) {
    return evaluateGameState(state, computer, human);
  }

  if (isMaximizing) {
    let value = Number.NEGATIVE_INFINITY;

    for (const move of legalMoves) {
      const nextState = applyMoveToState(state, move, computer);
      value = Math.max(
        value,
        alphaBeta(nextState, depth - 1, alpha, beta, false, computer, human, deadline),
      );
      alpha = Math.max(alpha, value);

      if (beta <= alpha || Date.now() > deadline) {
        break;
      }
    }

    return value;
  }

  let value = Number.POSITIVE_INFINITY;

  for (const move of legalMoves) {
    const nextState = applyMoveToState(state, move, human);
    value = Math.min(
      value,
      alphaBeta(nextState, depth - 1, alpha, beta, true, computer, human, deadline),
    );
    beta = Math.min(beta, value);

    if (beta <= alpha || Date.now() > deadline) {
      break;
    }
  }

  return value;
}

export function evaluateGameState(state, computer = PLAYERS.O, human = PLAYERS.X) {
  if (state.winner === computer) {
    return 100000;
  }

  if (state.winner === human) {
    return -100000;
  }

  if (state.draw) {
    return 0;
  }

  let score = scoreMacroPosition(state, computer, human);

  for (const board of state.boards) {
    score += scoreSmallBoard(board, computer, human);
  }

  const legalMoves = getLegalMoves(state);
  score += legalMoves.reduce(
    (total, move) => total + scoreSentBoard(state, move.cellIndex, computer, human) * 0.08,
    0,
  );

  return score;
}

export function applyMoveToState(state, move, player = state.currentPlayer) {
  const playableState =
    state.currentPlayer === player ? state : { ...state, currentPlayer: player };
  return applyMove(playableState, move.boardIndex, move.cellIndex);
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

export function cloneGameState(state) {
  return cloneState(state);
}

export function createGameSnapshot(state, metadata = {}) {
  return {
    state: cloneState(state),
    ...metadata,
  };
}

export function restoreGameSnapshot(snapshot) {
  return cloneState(snapshot.state);
}

export function getUndoMoveCount(state, isComputerMode = false) {
  const moves = state.moveHistory;
  if (moves.length === 0) {
    return 0;
  }

  if (!isComputerMode) {
    return 1;
  }

  const lastMove = moves.at(-1);
  const previousMove = moves.at(-2);
  if (lastMove?.player === PLAYERS.O && previousMove?.player === PLAYERS.X) {
    return 2;
  }

  return 1;
}

export function shouldIgnoreScheduledComputerMove(state, scheduledMoveCount) {
  return (
    state.moveHistory.length !== scheduledMoveCount ||
    state.currentPlayer !== PLAYERS.O ||
    state.winner ||
    state.draw
  );
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

function scoreUltimateMove(state, move, computer, human) {
  const nextState = applyMove(state, move.boardIndex, move.cellIndex);
  const boardBefore = state.boards[move.boardIndex];
  const boardAfter = nextState.boards[move.boardIndex];
  let score = 0;

  if (nextState.winner === computer) {
    return 10000;
  }

  if (!boardBefore.winner && boardAfter.winner === computer) {
    score += 900;
  }

  score += scoreMacroPosition(nextState, computer, human);
  score += scoreSmallBoard(boardAfter, computer, human);

  if (move.cellIndex === CENTER_CELL) {
    score += 12;
  }

  if (CORNER_CELLS.includes(move.cellIndex)) {
    score += 6;
  }

  score += scoreSentBoard(nextState, move.cellIndex, computer, human);

  if (nextState.forcedBoard === null && !nextState.winner && !nextState.draw) {
    score -= 30;
  }

  return score;
}

function scoreMacroPosition(state, computer, human) {
  const macroCells = state.boards.map((board) => board.winner);
  return evaluateLines(macroCells, computer, human) * 120;
}

function scoreSmallBoard(board, computer, human) {
  if (board.winner === computer) {
    return 180;
  }

  if (board.winner === human) {
    return -180;
  }

  if (board.full) {
    return 0;
  }

  let score = evaluateLines(board.cells, computer, human) * 5;

  if (board.cells[CENTER_CELL] === computer) {
    score += 10;
  }

  if (board.cells[CENTER_CELL] === human) {
    score -= 10;
  }

  return score;
}

function scoreSentBoard(state, targetBoardIndex, computer, human) {
  const targetBoard = state.boards[targetBoardIndex];

  if (!targetBoard || !isBoardPlayable(targetBoard)) {
    return -24;
  }

  const humanCanWinTarget = findWinningCell(targetBoard.cells, human) !== null;
  const computerCanWinTarget = findWinningCell(targetBoard.cells, computer) !== null;
  let score = 0;

  if (humanCanWinTarget) {
    score -= 260;
  }

  if (computerCanWinTarget) {
    score += 80;
  }

  score -= Math.max(0, evaluateLines(targetBoard.cells, human, computer)) * 3;
  score += Math.max(0, evaluateLines(targetBoard.cells, computer, human));

  return score;
}

function orderMoves(state, legalMoves, computer, human) {
  return [...legalMoves].sort(
    (a, b) => scoreMoveForOrdering(state, b, computer, human) - scoreMoveForOrdering(state, a, computer, human),
  );
}

function scoreMoveForOrdering(state, move, computer, human) {
  const legalMoves = [move];
  let score = scoreUltimateMove(state, move, computer, human);

  if (findMoveByOutcome(state, legalMoves, computer, "macro-win")) {
    score += 100000;
  }

  if (findMoveByOutcome(state, legalMoves, human, "macro-win")) {
    score += 90000;
  }

  if (findMoveByOutcome(state, legalMoves, computer, "small-win")) {
    score += 4000;
  }

  if (findMoveByOutcome(state, legalMoves, human, "small-win")) {
    score += 2500;
  }

  if (move.cellIndex === CENTER_CELL) {
    score += 35;
  }

  if (CORNER_CELLS.includes(move.cellIndex)) {
    score += 16;
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

function findWinningCell(cells, player) {
  for (const line of WIN_LINES) {
    const values = line.map((index) => cells[index]);
    const playerCount = values.filter((value) => value === player).length;
    const emptyCells = line.filter((index) => !cells[index]);

    if (playerCount === 2 && emptyCells.length === 1) {
      return emptyCells[0];
    }
  }

  return null;
}

function isValidIndex(index) {
  return Number.isInteger(index) && index >= 0 && index < 9;
}
