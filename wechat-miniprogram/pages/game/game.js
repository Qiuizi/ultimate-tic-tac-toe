const {
  PLAYERS,
  BOARD_NAMES,
  createInitialState,
  applyMove,
  canPlayMove,
  createGameSnapshot,
  restoreGameSnapshot,
  getAvailableBoards,
  getUndoMoveCount,
  shouldIgnoreScheduledComputerMove,
} = require("../../utils/game");
const { AI_DIFFICULTIES, getComputerMove } = require("../../utils/ai");
const {
  DEFAULT_SCORES,
  loadScores,
  saveScores,
  resetScores,
  loadSettings,
  saveSettings,
} = require("../../utils/storage");

const MODES = {
  TWO_PLAYER: "twoPlayer",
  COMPUTER: "computer",
};

const COMPUTER_DELAY_MS = 350;
const HISTORY_COLLAPSED_COUNT = 6;

Page({
  data: {
    boards: [],
    currentPlayer: PLAYERS.X,
    forcedBoard: null,
    forcedBoardName: "",
    gameMode: MODES.TWO_PLAYER,
    aiDifficulty: AI_DIFFICULTIES.NORMAL,
    scores: { ...DEFAULT_SCORES },
    moveHistory: [],
    displayedHistory: [],
    undoStack: [],
    winner: null,
    draw: false,
    gameOver: false,
    isComputerThinking: false,
    rulesVisible: false,
    historyExpanded: false,
    feedback: "",
    statusTitle: "X 先手",
    statusDetail: "请选择任意未满小棋盘落子",
    modeOptions: [
      { value: MODES.TWO_PLAYER, label: "本地双人" },
      { value: MODES.COMPUTER, label: "人机对战" },
    ],
    difficultyOptions: [
      { value: AI_DIFFICULTIES.NORMAL, label: "普通" },
      { value: AI_DIFFICULTIES.HARD, label: "困难" },
      { value: AI_DIFFICULTIES.EXPERT, label: "专家" },
    ],
  },

  onLoad() {
    const settings = loadSettings();
    this.state = createInitialState();
    this.undoStack = [];
    this.computerTimer = null;
    this.lastScoredMoveCount = null;
    this.setData({
      gameMode: settings.gameMode || MODES.TWO_PLAYER,
      aiDifficulty: settings.aiDifficulty || AI_DIFFICULTIES.NORMAL,
      scores: loadScores(),
    });
    this.syncView();
  },

  onUnload() {
    this.clearComputerTimer();
  },

  handleCellTap(event) {
    const boardIndex = Number(event.currentTarget.dataset.boardIndex);
    const cellIndex = Number(event.currentTarget.dataset.cellIndex);

    if (this.getBoardDisabledReason(boardIndex, cellIndex)) {
      this.showFeedback(this.getBoardDisabledReason(boardIndex, cellIndex));
      return;
    }

    this.commitMove(boardIndex, cellIndex);
    this.scheduleComputerMove();
  },

  handleModeTap(event) {
    const gameMode = event.currentTarget.dataset.mode;
    if (!Object.values(MODES).includes(gameMode) || gameMode === this.data.gameMode) {
      return;
    }

    this.clearComputerTimer();
    saveSettings({ gameMode, aiDifficulty: this.data.aiDifficulty });
    this.setData({ gameMode });
    this.resetRound("已切换模式，当前棋局已重置。");
  },

  handleDifficultyTap(event) {
    const aiDifficulty = event.currentTarget.dataset.difficulty;
    if (
      !Object.values(AI_DIFFICULTIES).includes(aiDifficulty) ||
      aiDifficulty === this.data.aiDifficulty
    ) {
      return;
    }

    this.clearComputerTimer();
    saveSettings({ gameMode: this.data.gameMode, aiDifficulty });
    this.setData({ aiDifficulty });
    this.resetRound("已切换 AI 难度，当前棋局已重置。");
  },

  handleUndo() {
    if (this.data.isComputerThinking) {
      this.showFeedback("电脑思考中，请稍候。");
      return;
    }

    const undoCount = getUndoMoveCount(this.state, this.data.gameMode === MODES.COMPUTER);
    if (undoCount === 0 || this.undoStack.length === 0) {
      this.showFeedback("当前没有可以撤销的落子。");
      return;
    }

    this.clearComputerTimer();
    let snapshot = null;
    for (let index = 0; index < undoCount && this.undoStack.length > 0; index += 1) {
      snapshot = this.undoStack.pop();
    }

    if (snapshot) {
      this.state = restoreGameSnapshot(snapshot);
      this.lastScoredMoveCount = this.state.winner || this.state.draw
        ? this.state.moveHistory.length
        : null;
      this.showFeedback("已撤销。");
      this.syncView();
      this.scheduleComputerMove();
    }
  },

  handleRestart() {
    this.resetRound("当前棋局已重新开始。");
  },

  handleResetScores() {
    const scores = resetScores();
    this.setData({ scores });
    this.showFeedback("比分已清零。");
  },

  showRules() {
    this.setData({ rulesVisible: true });
  },

  hideRules() {
    this.setData({ rulesVisible: false });
  },

  noop() {},

  toggleHistory() {
    this.setData({ historyExpanded: !this.data.historyExpanded }, () => {
      this.syncView();
    });
  },

  commitMove(boardIndex, cellIndex) {
    if (!canPlayMove(this.state, boardIndex, cellIndex)) {
      this.showFeedback("这个位置现在不能落子。");
      return false;
    }

    const snapshot = createGameSnapshot(this.state);
    const nextState = applyMove(this.state, boardIndex, cellIndex);

    if (nextState === this.state) {
      this.showFeedback("这个位置现在不能落子。");
      return false;
    }

    this.undoStack.push(snapshot);
    this.state = nextState;
    this.setData({ feedback: "" });
    this.updateScoresIfNeeded();
    this.syncView();
    return true;
  },

  scheduleComputerMove() {
    if (
      this.data.gameMode !== MODES.COMPUTER ||
      this.state.currentPlayer !== PLAYERS.O ||
      this.state.winner ||
      this.state.draw
    ) {
      return;
    }

    this.clearComputerTimer();
    const scheduledMoveCount = this.state.moveHistory.length;
    this.setData({ isComputerThinking: true }, () => this.syncView());

    this.computerTimer = setTimeout(() => {
      if (
        this.data.gameMode !== MODES.COMPUTER ||
        shouldIgnoreScheduledComputerMove(this.state, scheduledMoveCount)
      ) {
        this.computerTimer = null;
        this.setData({ isComputerThinking: false }, () => this.syncView());
        return;
      }

      const move = getComputerMove(this.state, this.data.aiDifficulty);
      this.setData({ isComputerThinking: false });

      if (move) {
        this.commitMove(move.boardIndex, move.cellIndex);
      } else {
        this.syncView();
      }

      this.computerTimer = null;
    }, COMPUTER_DELAY_MS);
  },

  clearComputerTimer() {
    if (this.computerTimer) {
      clearTimeout(this.computerTimer);
      this.computerTimer = null;
    }
    if (this.data.isComputerThinking) {
      this.setData({ isComputerThinking: false });
    }
  },

  resetRound(feedback) {
    this.clearComputerTimer();
    this.state = createInitialState();
    this.undoStack = [];
    this.lastScoredMoveCount = null;
    this.setData({
      historyExpanded: false,
      feedback: feedback || "",
    });
    this.syncView();
  },

  updateScoresIfNeeded() {
    if (!this.state.winner && !this.state.draw) {
      return;
    }

    if (this.lastScoredMoveCount === this.state.moveHistory.length) {
      return;
    }

    const scores = { ...this.data.scores };
    if (this.state.winner) {
      scores[this.state.winner] += 1;
    } else {
      scores.draw += 1;
    }

    this.lastScoredMoveCount = this.state.moveHistory.length;
    this.setData({ scores: saveScores(scores) });
  },

  syncView() {
    const availableBoards = getAvailableBoards(this.state);
    const lastMove = this.state.moveHistory[this.state.moveHistory.length - 1] || null;
    const moveHistory = this.state.moveHistory.map((move) => ({
      ...move,
      text: formatMove(move),
    }));
    const displayedHistory = this.data.historyExpanded
      ? moveHistory
      : moveHistory.slice(-HISTORY_COLLAPSED_COUNT);

    this.setData({
      boards: buildBoardViews(this.state, availableBoards, lastMove, this.data.isComputerThinking),
      currentPlayer: this.state.currentPlayer,
      forcedBoard: this.state.forcedBoard,
      forcedBoardName:
        this.state.forcedBoard === null ? "" : BOARD_NAMES[this.state.forcedBoard],
      moveHistory,
      displayedHistory,
      undoStack: this.undoStack,
      winner: this.state.winner,
      draw: this.state.draw,
      gameOver: Boolean(this.state.winner || this.state.draw),
      statusTitle: getStatusTitle(this.state, this.data),
      statusDetail: getStatusDetail(this.state, this.data),
    });
  },

  showFeedback(message) {
    this.setData({ feedback: message });
  },

  getBoardDisabledReason(boardIndex, cellIndex) {
    if (this.data.isComputerThinking) {
      return "电脑思考中，请稍候。";
    }

    if (this.data.gameMode === MODES.COMPUTER && this.state.currentPlayer === PLAYERS.O) {
      return "当前轮到电脑。";
    }

    if (this.state.winner || this.state.draw) {
      return "本局已经结束，请重新开始。";
    }

    const board = this.state.boards[boardIndex];
    if (board.full) {
      return "这个小棋盘已经下满。";
    }

    if (board.cells[cellIndex]) {
      return "这个格子已经有棋子了。";
    }

    if (!getAvailableBoards(this.state).includes(boardIndex)) {
      return this.state.forcedBoard === null
        ? "请选择一个未满的小棋盘。"
        : `当前必须下在${BOARD_NAMES[this.state.forcedBoard]}区域。`;
    }

    return "";
  },
});

function buildBoardViews(state, availableBoards, lastMove, isComputerThinking) {
  return state.boards.map((board, boardIndex) => {
    const playableBoard = availableBoards.includes(boardIndex);
    const boardClasses = [
      "small-board",
      playableBoard ? "is-playable" : "",
      board.full ? "is-full" : "",
      board.winner ? `owner-${board.winner.toLowerCase()}` : "",
    ]
      .filter(Boolean)
      .join(" ");

    return {
      boardIndex,
      name: BOARD_NAMES[boardIndex],
      winner: board.winner,
      full: board.full,
      playable: playableBoard,
      classes: boardClasses,
      cells: board.cells.map((cell, cellIndex) => {
        const disabled =
          isComputerThinking ||
          state.winner ||
          state.draw ||
          !playableBoard ||
          board.full ||
          Boolean(cell);
        const isWinningCell =
          board.winningLine && board.winningLine.includes(cellIndex);
        const isLatest =
          lastMove &&
          lastMove.boardIndex === boardIndex &&
          lastMove.cellIndex === cellIndex;

        return {
          cellIndex,
          value: cell || "",
          disabled,
          classes: [
            "cell",
            cell ? `mark-${cell.toLowerCase()}` : "",
            cell ? "is-filled" : "",
            disabled ? "is-disabled" : "",
            isWinningCell ? "is-winning" : "",
            isLatest ? "is-latest" : "",
          ]
            .filter(Boolean)
            .join(" "),
        };
      }),
    };
  });
}

function getStatusTitle(state, data) {
  if (state.winner) {
    return `${state.winner} 获胜`;
  }

  if (state.draw) {
    return "平局";
  }

  if (data.isComputerThinking) {
    return "电脑思考中";
  }

  if (data.gameMode === MODES.COMPUTER && state.currentPlayer === PLAYERS.O) {
    return "轮到电脑";
  }

  return `轮到 ${state.currentPlayer}`;
}

function getStatusDetail(state, data) {
  if (state.winner) {
    return "大棋盘三连完成。";
  }

  if (state.draw) {
    return "所有小棋盘都已下满。";
  }

  if (data.isComputerThinking) {
    return "电脑正在选择一个合法落点。";
  }

  if (state.forcedBoard === null) {
    return "目标小棋盘已满或当前自由选择，请选择任意未满小棋盘。";
  }

  const targetBoard = state.boards[state.forcedBoard];
  if (targetBoard.winner && !targetBoard.full) {
    return `必须下在${BOARD_NAMES[state.forcedBoard]}。这个小棋盘已被赢下，但仍可落子控制走位。`;
  }

  return `必须下在${BOARD_NAMES[state.forcedBoard]}。`;
}

function formatMove(move) {
  const boardName = BOARD_NAMES[move.boardIndex];
  const cellName = BOARD_NAMES[move.cellIndex];
  const parts = [`${boardName} / ${cellName}`];

  if (move.wonSmallBoard) {
    parts.push(`赢下${boardName}`);
  }

  if (move.wonGame) {
    parts.push("赢下整局");
  }

  if (move.drewGame) {
    parts.push("形成平局");
  }

  return parts.join("，");
}
