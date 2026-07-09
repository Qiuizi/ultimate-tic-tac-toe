const SCORE_KEY = "ultimate-tic-tac-toe:scores";
const SETTINGS_KEY = "ultimate-tic-tac-toe:settings";

const DEFAULT_SCORES = {
  X: 0,
  O: 0,
  draw: 0,
};

const DEFAULT_SETTINGS = {
  gameMode: "twoPlayer",
  aiDifficulty: "normal",
};

function loadScores() {
  try {
    const value = wx.getStorageSync(SCORE_KEY);
    return normalizeScores(value);
  } catch (error) {
    return { ...DEFAULT_SCORES };
  }
}

function saveScores(scores) {
  const nextScores = normalizeScores(scores);
  wx.setStorageSync(SCORE_KEY, nextScores);
  return nextScores;
}

function resetScores() {
  wx.removeStorageSync(SCORE_KEY);
  return { ...DEFAULT_SCORES };
}

function loadSettings() {
  try {
    const value = wx.getStorageSync(SETTINGS_KEY);
    return {
      ...DEFAULT_SETTINGS,
      ...(value && typeof value === "object" ? value : {}),
    };
  } catch (error) {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(settings) {
  const nextSettings = {
    ...DEFAULT_SETTINGS,
    ...(settings && typeof settings === "object" ? settings : {}),
  };
  wx.setStorageSync(SETTINGS_KEY, nextSettings);
  return nextSettings;
}

function normalizeScores(scores) {
  const value = scores && typeof scores === "object" ? scores : {};
  return {
    X: Number.isFinite(value.X) ? value.X : DEFAULT_SCORES.X,
    O: Number.isFinite(value.O) ? value.O : DEFAULT_SCORES.O,
    draw: Number.isFinite(value.draw) ? value.draw : DEFAULT_SCORES.draw,
  };
}

module.exports = {
  DEFAULT_SCORES,
  DEFAULT_SETTINGS,
  loadScores,
  saveScores,
  resetScores,
  loadSettings,
  saveSettings,
};
