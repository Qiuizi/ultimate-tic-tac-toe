# 终极井字棋 Ultimate Tic-Tac-Toe

English version: [README.en.md](./README.en.md)

![Ultimate Tic-Tac-Toe Screenshot](./assets/screenshot.png)

在线演示：<https://qiuizi.github.io/ultimate-tic-tac-toe/>

这是一个用原生 HTML/CSS/JavaScript 写的 Ultimate Tic-Tac-Toe 小游戏。

它和普通井字棋不太一样：棋盘里有 9 个小棋盘，你下在哪个小格，会决定对手下一步要去哪个小棋盘。项目里做了双人模式、人机模式、计分板、比分保存，以及一个简单的困难 AI。

## 规则

- 棋盘由 9 个小井字棋组成，整体也是一个 3 × 3 大棋盘。
- 每个小棋盘内部有 9 个格子。
- 玩家落子后，对手下一步必须去对应位置的小棋盘。
- 如果目标小棋盘已经被占领或下满，对手可以自由选择其他未结束的小棋盘。
- 在小棋盘里三连，就占领这个小棋盘。
- 在大棋盘上占领三个连成一线的小棋盘，就赢下整局。
- 如果所有小棋盘都结束但没人完成大棋盘三连，就是平局。

## 功能

- 本地双人对战。
- 人机对战，玩家是 `X`，电脑是 `O`。
- 普通 / 困难 两档 AI。
- 页面里有游戏规则说明，新玩家不用先去 README 找玩法。
- 会提示当前该谁下、必须下哪个小棋盘，以及什么时候可以自由选择。
- 当前能下的小棋盘会高亮。
- 点错位置时会给一个简单提示。
- 会显示最近的落子历史，方便回看每一步下在哪个小棋盘。
- 小棋盘胜利和大棋盘胜利高亮。
- 计分板：`X` 胜、`O` 胜、平局。
- 分数会存在 `localStorage`，刷新后还在。
- 重新开始只重置当前局，不清空比分。
- 响应式布局，手机上也能玩。

## AI

这个项目是 Ultimate Tic-Tac-Toe，不是普通 3 × 3 井字棋，所以没有直接套普通井字棋的完整 Minimax。

普通 AI 是启发式评分，大致会看：

- 能不能马上赢大棋盘。
- 要不要挡住玩家的大棋盘胜利。
- 当前小棋盘有没有占领价值。
- 这一步会把对手送到哪个小棋盘。
- 中心、角落这些位置的基础价值。

困难 AI 在这个基础上加了浅层 Alpha-Beta 搜索：

- 搜索深度是 3 层。
- 叶子节点还是用同一套启发式评分。
- 有大约 950ms 的时间保护，避免浏览器卡住。

困难 AI 会比普通 AI 少犯一些明显错误，但它不是不败 AI。Ultimate Tic-Tac-Toe 的完整搜索空间很大，后续还有不少可以优化的地方。

## 技术栈

- HTML
- CSS
- JavaScript ES Modules
- Node.js `node:test`
- 无第三方前端框架

## 本地运行

```bash
npm run dev
```

然后打开：

```txt
http://localhost:3000
```

## 测试

```bash
npm test
```

也可以单独检查 JS 语法：

```bash
node --check src/game.js
node --check src/app.js
```

## 构建

```bash
npm run build
```

构建后的文件在 `dist/`。

## 部署

这是一个普通静态站，不是 Vite 项目。

- GitHub Pages：可以用仓库里的 GitHub Actions workflow 部署 `dist/`。
- Vercel：构建命令填 `npm run build`，输出目录填 `dist`。

## 项目结构

```txt
.
├── index.html
├── package.json
├── scripts/
│   ├── build.mjs
│   └── dev-server.mjs
├── src/
│   ├── app.js        # 页面渲染、交互、模式、历史和比分
│   ├── game.js       # 规则、胜负判断、AI
│   └── styles.css
└── test/
    └── game.test.js
```

## 之后可以继续做

- 补一个简短的玩法 GIF，让 README 更直观。
- 困难 AI 现在只是浅层搜索，后面可以继续调评估函数，让它少犯一些“送棋盘”的错误。
- 如果 AI 搜索继续加深，可以考虑放到 Web Worker 里，避免影响页面操作。
- 落子历史目前只显示最近几步，后面可以做成完整记录或回放。
- 后面可以补 Playwright 测试，主要测移动端布局、localStorage 和完整的人机流程。

## 作者

Qiuizi
