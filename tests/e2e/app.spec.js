import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("page opens with the board and main controls", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "终极井字棋" })).toBeVisible();
  await expect(page.getByTestId("game-board")).toBeVisible();
  await expect(page.getByTestId("rules-button")).toBeVisible();
  await expect(page.getByTestId("undo-button")).toBeDisabled();
  await expect(page.getByTestId("restart-button")).toBeVisible();
  await expect(page.getByTestId("reset-score-button")).toBeVisible();
  await expect(page.getByTestId("move-history")).toContainText("还没有落子");
});

test("rules dialog opens and closes", async ({ page }) => {
  await page.getByTestId("rules-button").click();
  await expect(page.getByTestId("rules-dialog")).toBeVisible();
  await expect(page.getByRole("dialog", { name: "游戏规则" })).toBeVisible();

  await page.getByTestId("rules-close-button").click();
  await expect(page.getByTestId("rules-dialog")).toBeHidden();
});

test("two-player mode records X and O moves in history", async ({ page }) => {
  await playCell(page, 4, 0);
  await playCell(page, 0, 4);

  await expect(filledCells(page)).toHaveCount(2);
  await expect(historyItems(page)).toHaveCount(2);
  await expect(page.getByTestId("move-history")).toContainText("第 1 步：X");
  await expect(page.getByTestId("move-history")).toContainText("第 2 步：O");
});

test("two-player undo removes the latest move", async ({ page }) => {
  await playCell(page, 4, 0);
  await playCell(page, 0, 4);

  await page.getByTestId("undo-button").click();

  await expect(page.getByTestId("cell-4-0")).toContainText("X");
  await expect(page.getByTestId("cell-0-4")).toHaveText("");
  await expect(historyItems(page)).toHaveCount(1);
  await expect(page.getByTestId("move-history")).toContainText("第 1 步：X");
});

test("claimed small boards remain playable until full", async ({ page }) => {
  await playCell(page, 4, 0);
  await playCell(page, 0, 4);
  await playCell(page, 4, 1);
  await playCell(page, 1, 4);
  await playCell(page, 4, 2);

  await expect(page.getByTestId("small-board-4")).toHaveClass(/owner-x/);
  await playCell(page, 2, 4);
  await expect(page.getByTestId("cell-4-3")).toHaveAttribute("aria-disabled", "false");

  await playCell(page, 4, 3);

  await expect(page.getByTestId("cell-4-3")).toContainText("X");
  await expect(page.getByTestId("small-board-4")).toHaveClass(/owner-x/);
});

test("restart clears the board and move history", async ({ page }) => {
  await playCell(page, 4, 0);
  await playCell(page, 0, 4);

  await page.getByTestId("restart-button").click();

  await expect(filledCells(page)).toHaveCount(0);
  await expect(historyItems(page)).toHaveCount(0);
  await expect(page.getByTestId("move-history")).toContainText("还没有落子");
  await expect(page.getByTestId("undo-button")).toBeDisabled();
});

test("computer mode makes an automatic AI move", async ({ page }) => {
  await switchToComputerMode(page);
  await playCell(page, 4, 0);

  await expect(filledCells(page)).toHaveCount(2);
  await expect(historyItems(page)).toHaveCount(2);
  await expect(page.getByTestId("move-history")).toContainText("第 2 步：O");
});

test("computer-mode undo removes the player and AI round", async ({ page }) => {
  await switchToComputerMode(page);
  await playCell(page, 4, 0);
  await expect(filledCells(page)).toHaveCount(2);

  await page.getByTestId("undo-button").click();

  await expect(filledCells(page)).toHaveCount(0);
  await expect(historyItems(page)).toHaveCount(0);
  await expect(page.getByTestId("move-history")).toContainText("还没有落子");
  await expect(page.getByTestId("cell-4-0")).toBeEnabled();
});

test("hard AI responds without page errors", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(message.text());
    }
  });

  await switchToComputerMode(page);
  await page.getByTestId("difficulty-select").getByRole("button", { name: "困难" }).click();
  await playCell(page, 4, 0);

  await expect(filledCells(page)).toHaveCount(2);
  expect(errors).toEqual([]);
});

test("reset score clears persisted scoreboard values", async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem(
      "ultimate-tic-tac-toe-score",
      JSON.stringify({ X: 3, O: 2, draw: 1 }),
    );
  });
  await page.reload();

  await expect(page.getByTestId("score-x-value")).toHaveText("3");
  await expect(page.getByTestId("score-o-value")).toHaveText("2");
  await expect(page.getByTestId("score-draw-value")).toHaveText("1");

  await page.getByTestId("reset-score-button").click();

  await expect(page.getByTestId("score-x-value")).toHaveText("0");
  await expect(page.getByTestId("score-o-value")).toHaveText("0");
  await expect(page.getByTestId("score-draw-value")).toHaveText("0");
});

test("move history can expand and collapse", async ({ page }) => {
  for (let moveCount = 1; moveCount <= 10; moveCount += 1) {
    await playFirstAvailableCell(page);
    await expect(historyItems(page)).toHaveCount(Math.min(moveCount, 9));
  }

  await expect(page.getByTestId("history-toggle")).toHaveText("展开全部");
  await page.getByTestId("history-toggle").click();
  await expect(historyItems(page)).toHaveCount(10);
  await expect(page.getByTestId("history-toggle")).toHaveText("收起");

  await page.getByTestId("history-toggle").click();
  await expect(historyItems(page)).toHaveCount(9);
  await expect(page.getByTestId("history-toggle")).toHaveText("展开全部");
});

test("mobile viewport opens without horizontal overflow and rules still work", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await expect(page.getByTestId("game-board")).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(2);

  await page.getByTestId("rules-button").click();
  await expect(page.getByTestId("rules-dialog")).toBeVisible();
  await page.getByTestId("rules-confirm-button").click();
  await expect(page.getByTestId("rules-dialog")).toBeHidden();
});

test("online mode shows the mock room panel", async ({ page }) => {
  await switchToOnlineMode(page);

  await expect(page.getByTestId("online-panel")).toBeVisible();
  await expect(page.getByTestId("online-panel")).toContainText("Mock 联机预览");
  await expect(page.getByTestId("create-room-button")).toBeVisible();
  await expect(page.getByTestId("join-room-input")).toBeVisible();
  await expect(page.getByTestId("join-room-button")).toBeVisible();
  await expect(page.getByTestId("sync-status")).toHaveText("Mock disconnected");
});

test("online mode creates a mock room as X", async ({ page }) => {
  await switchToOnlineMode(page);

  await page.getByTestId("create-room-button").click();

  await expect(page.getByTestId("room-code-display")).toHaveText(/^[A-Z0-9]{6}$/);
  await expect(page.getByTestId("online-role-display")).toHaveText("X");
  await expect(page.getByTestId("opponent-status")).toHaveText("等待加入");
  await expect(page.getByTestId("sync-status")).toHaveText("Mock connected");
});

test("online mode can mock join an existing room as O", async ({ page }) => {
  await switchToOnlineMode(page);
  await page.getByTestId("create-room-button").click();
  const roomCode = await page.getByTestId("room-code-display").innerText();

  await page.getByTestId("leave-room-button").click();
  await page.getByTestId("join-room-input").fill(roomCode);
  await page.getByTestId("join-room-button").click();

  await expect(page.getByTestId("room-code-display")).toHaveText(roomCode);
  await expect(page.getByTestId("online-role-display")).toHaveText("O");
  await expect(page.getByTestId("opponent-status")).toHaveText("已加入");
  await expect(page.getByTestId("sync-status")).toHaveText("Mock connected");
});

test("online mode clears room state after leaving", async ({ page }) => {
  await switchToOnlineMode(page);
  await page.getByTestId("create-room-button").click();
  await expect(page.getByTestId("online-role-display")).toHaveText("X");

  await page.getByTestId("leave-room-button").click();

  await expect(page.getByTestId("room-code-display")).toHaveText("未创建");
  await expect(page.getByTestId("online-role-display")).toHaveText("未加入");
  await expect(page.getByTestId("opponent-status")).toHaveText("未加入");
  await expect(page.getByTestId("sync-status")).toHaveText("Mock disconnected");
});

test("online mode disables board before joining a room", async ({ page }) => {
  await switchToOnlineMode(page);

  await expect(page.getByTestId("cell-4-0")).toHaveAttribute("aria-disabled", "true");
  await expect(page.getByTestId("cell-4-0")).toHaveClass(/is-disabled/);

  await expect(filledCells(page)).toHaveCount(0);
  await expect(page.getByTestId("move-history")).toContainText("还没有落子");
});

async function switchToComputerMode(page) {
  await page.getByTestId("mode-select").getByRole("button", { name: "人机对战" }).click();
  await expect(page.getByTestId("move-history")).toContainText("还没有落子");
}

async function switchToOnlineMode(page) {
  await page.getByTestId("mode-select").getByRole("button", { name: "远程对战" }).click();
  await expect(page.getByTestId("online-panel")).toBeVisible();
}

async function playCell(page, boardIndex, cellIndex) {
  await page.getByTestId(`cell-${boardIndex}-${cellIndex}`).click();
}

async function playFirstAvailableCell(page) {
  await page.locator('[data-testid^="cell-"].cell:not(.is-disabled):not(.is-filled)').first().click();
}

function filledCells(page) {
  return page.locator('[data-testid^="cell-"].is-filled');
}

function historyItems(page) {
  return page.getByTestId("move-history").locator("li");
}
