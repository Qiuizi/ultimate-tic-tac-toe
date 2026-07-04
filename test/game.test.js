import test from "node:test";
import assert from "node:assert/strict";

import {
  PLAYERS,
  applyMove,
  canPlayMove,
  createInitialState,
  getAvailableBoards,
  getWinner,
} from "../src/game.js";

test("first move can be played anywhere and forces the matching target board", () => {
  const state = createInitialState();

  assert.equal(canPlayMove(state, 4, 0), true);

  const next = applyMove(state, 4, 0);

  assert.equal(next.boards[4].cells[0], PLAYERS.X);
  assert.equal(next.currentPlayer, PLAYERS.O);
  assert.equal(next.forcedBoard, 0);
  assert.deepEqual(getAvailableBoards(next), [0]);
});

test("move is rejected outside the forced board", () => {
  const state = applyMove(createInitialState(), 4, 0);

  assert.equal(canPlayMove(state, 1, 1), false);
  assert.equal(applyMove(state, 1, 1), state);
});

test("player can choose freely when the target board is already won", () => {
  const state = createInitialState();
  state.boards[0].winner = PLAYERS.X;

  const next = applyMove(state, 4, 0);

  assert.equal(next.forcedBoard, null);
  assert.deepEqual(getAvailableBoards(next), [1, 2, 3, 4, 5, 6, 7, 8]);
});

test("small board win is recorded", () => {
  const state = createInitialState();
  state.boards[4].cells = [PLAYERS.X, PLAYERS.X, null, null, null, null, null, null, null];

  const next = applyMove(state, 4, 2);

  assert.equal(next.boards[4].winner, PLAYERS.X);
  assert.deepEqual(next.boards[4].winningLine, [0, 1, 2]);
});

test("macro board win ends the game", () => {
  const state = createInitialState();
  state.boards[0].winner = PLAYERS.X;
  state.boards[1].winner = PLAYERS.X;
  state.boards[2].cells = [PLAYERS.X, PLAYERS.X, null, null, null, null, null, null, null];

  const next = applyMove(state, 2, 2);

  assert.equal(next.winner, PLAYERS.X);
  assert.deepEqual(next.winningLine, [0, 1, 2]);
  assert.equal(getAvailableBoards(next).length, 0);
});

test("winner helper returns line details", () => {
  assert.deepEqual(
    getWinner([PLAYERS.O, null, null, PLAYERS.O, null, null, PLAYERS.O, null, null]),
    { winner: PLAYERS.O, line: [0, 3, 6] },
  );
});
