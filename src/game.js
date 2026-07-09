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
  EXPERT: "expert",
};
export const HARD_AI_DEPTH = 3;
export const HARD_AI_TIME_LIMIT_MS = 950;
export const EXPERT_AI_MAX_DEPTH = 4;
export const EXPERT_AI_TIME_LIMIT_MS = 1200;
export const EXPERT_AI_MAX_CANDIDATES = 14;

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
  return Boolean(board) && !board.full;
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

  if (!boardWinnerBefore) {
    const smallResult = getWinner(board.cells);
    board.winner = smallResult.winner;
    board.winningLine = smallResult.line;
  }

  board.full = isFull(board.cells);

  const macroCells = nextState.boards.map((smallBoard) => smallBoard.winner);
  const macroResult = getWinner(macroCells);
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

export function getComputerMove(
  state,
  computer = PLAYERS.O,
  human = PLAYERS.X,
  difficulty = AI_DIFFICULTIES.NORMAL,
) {
  if (difficulty === AI_DIFFICULTIES.EXPERT) {
    return getExpertComputerMove(state, computer, human);
  }

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

export function getExpertComputerMove(
  state,
  computer = PLAYERS.O,
  human = PLAYERS.X,
  options = {},
) {
  const legalMoves = getLegalMoves(state);

  if (legalMoves.length === 0) {
    return null;
  }

  try {
    return (
      iterativeDeepeningSearch(state, computer, human, options) ||
      getHardComputerMove(state, computer, human, {
        maxDepth: 2,
        timeLimitMs: Math.min(options.timeLimitMs ?? 200, 250),
      }) ||
      getHeuristicMove(state, computer, human)
    );
  } catch {
    return (
      getHardComputerMove(state, computer, human, {
        maxDepth: 2,
        timeLimitMs: 200,
      }) || getHeuristicMove(state, computer, human)
    );
  }
}

export function iterativeDeepeningSearch(
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

  const startedAt = Date.now();
  const timeLimitMs = options.timeLimitMs ?? EXPERT_AI_TIME_LIMIT_MS;
  const deadline = startedAt + timeLimitMs;
  const maxDepth = options.maxDepth ?? EXPERT_AI_MAX_DEPTH;
  const maxCandidatesPerNode = options.maxCandidatesPerNode ?? EXPERT_AI_MAX_CANDIDATES;
  const transpositionTable = options.transpositionTable ?? new Map();
  const rootMoves = orderCandidateMoves(state, legalMoves, computer, human).slice(
    0,
    maxCandidatesPerNode,
  );
  let bestMove = rootMoves[0] || legalMoves[0];
  let bestScore = Number.NEGATIVE_INFINITY;

  for (let depth = 1; depth <= maxDepth; depth += 1) {
    if (Date.now() > deadline) {
      break;
    }

    let depthBestMove = bestMove;
    let depthBestScore = Number.NEGATIVE_INFINITY;
    let completedDepth = true;

    for (const move of rootMoves) {
      if (Date.now() > deadline) {
        completedDepth = false;
        break;
      }

      const nextState = applyMoveToState(state, move, computer);
      const score = alphaBetaExpert(
        nextState,
        depth - 1,
        Number.NEGATIVE_INFINITY,
        Number.POSITIVE_INFINITY,
        false,
        startedAt,
        timeLimitMs,
        computer,
        human,
        { transpositionTable, maxCandidatesPerNode },
      );

      if (score > depthBestScore) {
        depthBestScore = score;
        depthBestMove = move;
      }
    }

    if (completedDepth) {
      bestMove = depthBestMove;
      bestScore = depthBestScore;
      transpositionTable.set(getStateKey(state), {
        depth,
        score: bestScore,
        bestMove,
      });
    }
  }

  return bestMove;
}

export function alphaBetaExpert(
  state,
  depth,
  alpha,
  beta,
  isMaximizing,
  startTime = Date.now(),
  timeLimitMs = EXPERT_AI_TIME_LIMIT_MS,
  computer = PLAYERS.O,
  human = PLAYERS.X,
  context = {},
) {
  const deadline = startTime + timeLimitMs;

  if (Date.now() > deadline) {
    return evaluateExpertGameState(state, computer, human);
  }

  const transpositionTable = context.transpositionTable ?? new Map();
  const maxCandidatesPerNode = context.maxCandidatesPerNode ?? EXPERT_AI_MAX_CANDIDATES;
  const stateKey = getStateKey(state);
  const cached = transpositionTable.get(stateKey);

  if (cached && cached.depth >= depth) {
    return cached.score;
  }

  if (state.winner || state.draw || depth === 0) {
    const score = evaluateExpertGameState(state, computer, human);
    transpositionTable.set(stateKey, { depth, score, bestMove: null });
    return score;
  }

  const legalMoves = orderCandidateMoves(state, getLegalMoves(state), computer, human).slice(
    0,
    maxCandidatesPerNode,
  );

  if (legalMoves.length === 0) {
    return evaluateExpertGameState(state, computer, human);
  }

  let bestMove = legalMoves[0];

  if (isMaximizing) {
    let value = Number.NEGATIVE_INFINITY;

    for (const move of legalMoves) {
      const nextState = applyMoveToState(state, move, computer);
      const score = alphaBetaExpert(
        nextState,
        depth - 1,
        alpha,
        beta,
        false,
        startTime,
        timeLimitMs,
        computer,
        human,
        context,
      );

      if (score > value) {
        value = score;
        bestMove = move;
      }

      alpha = Math.max(alpha, value);
      if (beta <= alpha || Date.now() > deadline) {
        break;
      }
    }

    transpositionTable.set(stateKey, { depth, score: value, bestMove });
    return value;
  }

  let value = Number.POSITIVE_INFINITY;

  for (const move of legalMoves) {
    const nextState = applyMoveToState(state, move, human);
    const score = alphaBetaExpert(
      nextState,
      depth - 1,
      alpha,
      beta,
      true,
      startTime,
      timeLimitMs,
      computer,
      human,
      context,
    );

    if (score < value) {
      value = score;
      bestMove = move;
    }

    beta = Math.min(beta, value);
    if (beta <= alpha || Date.now() > deadline) {
      break;
    }
  }

  transpositionTable.set(stateKey, { depth, score: value, bestMove });
  return value;
}

export function evaluateExpertGameState(state, computer = PLAYERS.O, human = PLAYERS.X) {
  if (state.winner === computer) {
    return 1000000 - state.moveHistory.length;
  }

  if (state.winner === human) {
    return -1000000 + state.moveHistory.length;
  }

  if (state.draw) {
    return 0;
  }

  let score = scoreMacroPosition(state, computer, human) * 3;
  const macroCells = state.boards.map((board) => board.winner);
  score += countTwoInLineThreats(macroCells, computer) * 750;
  score -= countTwoInLineThreats(macroCells, human) * 900;

  score += scoreClaimedBoardShape(state, computer, human);

  for (const [boardIndex, board] of state.boards.entries()) {
    if (!board.winner) {
      score += scoreUnclaimedBoardPotential(board, computer, human, boardIndex);
      continue;
    }

    if (!board.full) {
      score += scoreClaimedBoardMobility(board, boardIndex, computer, human);
    }
  }

  const legalMoves = getLegalMoves(state);
  score += Math.min(legalMoves.length, 30) * 1.5;

  if (state.forcedBoard !== null) {
    score += scoreTargetBoardForPlayer(state, state.forcedBoard, state.currentPlayer, computer, human);
  }

  return score;
}

export function orderCandidateMoves(
  state,
  moves = getLegalMoves(state),
  computer = PLAYERS.O,
  human = PLAYERS.X,
) {
  return [...moves].sort(
    (a, b) =>
      scoreCandidateMove(state, b, computer, human) -
      scoreCandidateMove(state, a, computer, human),
  );
}

export function getStateKey(state) {
  const boardParts = state.boards.map((board) =>
    [
      board.cells.map((cell) => cell || "-").join(""),
      board.winner || "-",
      board.full ? "1" : "0",
    ].join(":"),
  );

  return [
    boardParts.join("|"),
    state.currentPlayer,
    state.forcedBoard ?? "-",
    state.winner || "-",
    state.draw ? "1" : "0",
  ].join(";");
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
    if (board.winner) {
      return false;
    }

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

  if (targetBoard.winner) {
    return targetBoard.winner === computer ? 8 : -10;
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

function scoreCandidateMove(state, move, computer, human) {
  const nextState = applyMoveToState(state, move, computer);
  const boardBefore = state.boards[move.boardIndex];
  const boardAfter = nextState.boards[move.boardIndex];
  let score = 0;

  if (nextState.winner === computer) {
    score += 1000000;
  }

  if (moveBlocksMacroWin(state, move, human)) {
    score += 900000;
  }

  if (!boardBefore.winner && boardAfter.winner === computer) {
    score += 50000;
  }

  if (moveBlocksSmallWin(state, move, human)) {
    score += 22000;
  }

  score += countTwoInLineThreats(nextState.boards.map((board) => board.winner), computer) * 5000;
  score -= countTwoInLineThreats(nextState.boards.map((board) => board.winner), human) * 5500;
  score += scoreTargetBoardForPlayer(nextState, move.cellIndex, human, computer, human) * 22;

  if (move.boardIndex === CENTER_CELL) {
    score += 160;
  }

  if (CORNER_CELLS.includes(move.boardIndex)) {
    score += 90;
  }

  if (move.cellIndex === CENTER_CELL) {
    score += 80;
  }

  if (CORNER_CELLS.includes(move.cellIndex)) {
    score += 38;
  }

  if (boardBefore.winner) {
    score += boardBefore.winner === computer ? 12 : -12;
  }

  if (nextState.forcedBoard === null && !nextState.winner && !nextState.draw) {
    score -= 1200;
  }

  return score + evaluateExpertGameState(nextState, computer, human) * 0.05;
}

function moveBlocksMacroWin(state, move, human) {
  const board = state.boards[move.boardIndex];
  if (board.winner) {
    return false;
  }

  const cells = [...board.cells];
  cells[move.cellIndex] = human;
  const humanSmallWinner = getWinner(cells).winner;

  if (humanSmallWinner !== human) {
    return false;
  }

  const macroCells = state.boards.map((smallBoard, index) =>
    index === move.boardIndex ? humanSmallWinner : smallBoard.winner,
  );

  return getWinner(macroCells).winner === human;
}

function moveBlocksSmallWin(state, move, human) {
  const board = state.boards[move.boardIndex];
  if (board.winner) {
    return false;
  }

  const cells = [...board.cells];
  cells[move.cellIndex] = human;
  return getWinner(cells).winner === human;
}

function scoreClaimedBoardShape(state, computer, human) {
  let score = 0;

  if (state.boards[CENTER_CELL].winner === computer) {
    score += 420;
  } else if (state.boards[CENTER_CELL].winner === human) {
    score -= 460;
  }

  for (const corner of CORNER_CELLS) {
    if (state.boards[corner].winner === computer) {
      score += 180;
    } else if (state.boards[corner].winner === human) {
      score -= 210;
    }
  }

  return score;
}

function scoreUnclaimedBoardPotential(board, computer, human, boardIndex) {
  if (board.full) {
    return 0;
  }

  let score = evaluateLines(board.cells, computer, human) * 14;
  score += countTwoInLineThreats(board.cells, computer) * 85;
  score -= countTwoInLineThreats(board.cells, human) * 110;

  if (board.cells[CENTER_CELL] === computer) {
    score += 35;
  } else if (board.cells[CENTER_CELL] === human) {
    score -= 40;
  }

  for (const corner of CORNER_CELLS) {
    if (board.cells[corner] === computer) {
      score += 12;
    } else if (board.cells[corner] === human) {
      score -= 14;
    }
  }

  if (boardIndex === CENTER_CELL) {
    score *= 1.2;
  } else if (CORNER_CELLS.includes(boardIndex)) {
    score *= 1.08;
  }

  return score;
}

function scoreClaimedBoardMobility(board, boardIndex, computer, human) {
  const openCells = board.cells.filter((cell) => !cell).length;
  let score = openCells * 2;

  if (board.winner === computer) {
    score += 18;
  } else if (board.winner === human) {
    score -= 18;
  }

  if (boardIndex === CENTER_CELL) {
    score += board.winner === computer ? 12 : -12;
  }

  return score;
}

function scoreTargetBoardForPlayer(state, targetBoardIndex, nextPlayer, computer, human) {
  const targetBoard = state.boards[targetBoardIndex];
  const nextPlayerIsHuman = nextPlayer === human;
  const nextPlayerIsComputer = nextPlayer === computer;

  if (!targetBoard || targetBoard.full) {
    return nextPlayerIsHuman ? -90 : 65;
  }

  if (targetBoard.winner) {
    const ownerScore = targetBoard.winner === computer ? 14 : -18;
    const pressureScore =
      countTwoInLineThreats(targetBoard.cells, computer) * 4 -
      countTwoInLineThreats(targetBoard.cells, human) * 5;
    return ownerScore + pressureScore;
  }

  const humanSmallWin = findWinningCell(targetBoard.cells, human) !== null;
  const computerSmallWin = findWinningCell(targetBoard.cells, computer) !== null;
  let score = evaluateLines(targetBoard.cells, computer, human) * 0.8;

  if (humanSmallWin) {
    score -= nextPlayerIsHuman ? 180 : 35;
  }

  if (computerSmallWin) {
    score += nextPlayerIsComputer ? 150 : 30;
  }

  if (nextPlayerIsHuman && playerCanWinMacroFromBoard(state, targetBoardIndex, human)) {
    score -= 700;
  }

  if (nextPlayerIsComputer && playerCanWinMacroFromBoard(state, targetBoardIndex, computer)) {
    score += 620;
  }

  return score;
}

function playerCanWinMacroFromBoard(state, boardIndex, player) {
  const board = state.boards[boardIndex];
  if (!board || board.winner || board.full) {
    return false;
  }

  const winningCell = findWinningCell(board.cells, player);
  if (winningCell === null) {
    return false;
  }

  const macroCells = state.boards.map((smallBoard, index) =>
    index === boardIndex ? player : smallBoard.winner,
  );

  return getWinner(macroCells).winner === player;
}

function countTwoInLineThreats(cells, player) {
  return WIN_LINES.reduce((count, line) => {
    const values = line.map((index) => cells[index]);
    const playerCount = values.filter((value) => value === player).length;
    const emptyCount = values.filter((value) => !value).length;
    return playerCount === 2 && emptyCount === 1 ? count + 1 : count;
  }, 0);
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
