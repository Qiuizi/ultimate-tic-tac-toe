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
- 远程对战房间码 MVP：默认 Mock 预览，配置 Supabase 后可跨设备同步。
- 页面里有游戏规则说明，新玩家不用先去 README 找玩法。
- 会提示当前该谁下、必须下哪个小棋盘，以及什么时候可以自由选择。
- 当前能下的小棋盘会高亮。
- 点错位置时会给一个简单提示。
- 会记录完整落子历史，默认显示最近几步，也可以展开查看全部。
- 支持撤销当前对局步骤；双人模式撤销一步，人机模式通常撤销玩家和 AI 的一轮。
- 小棋盘胜利和大棋盘胜利高亮。
- 计分板：`X` 胜、`O` 胜、平局。
- 分数会存在 `localStorage`，刷新后还在。
- 重新开始只重置当前局，不清空比分。
- 响应式布局，手机上也能玩。

## 远程对战状态

v1.3.0 开始加入远程对战架构。当前代码包含：

- 远程对战模式入口。
- 创建房间 / 加入房间 / 退出房间 UI。
- 6 位房间码、房间状态结构和本地远程 session 状态。
- 默认 Mock adapter，用内存对象模拟房间创建、加入、订阅和版本冲突。
- Supabase Realtime adapter，用 `rooms` 表保存权威房间状态，并通过 Postgres Changes 同步棋盘。

没有 Supabase 配置时，远程模式会继续显示 Mock 联机预览，不会访问外网，也不会影响本地双人或人机模式。

### Supabase 配置

远程对战真实跨设备联机需要一个 Supabase project：

1. 在 Supabase Dashboard 创建项目。
2. 打开 SQL Editor，执行 [docs/supabase.sql](./docs/supabase.sql)。
3. 在 Dashboard 的 Database Publications / Realtime 设置里确认 `public.rooms` 已开启 Postgres Changes。
4. 使用项目的前端公开 key 配置构建变量：

```bash
ONLINE_PROVIDER=supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=your-public-browser-key
```

这是静态站，不使用 Vite / Webpack。`npm run build` 会把这些公开配置写入 `dist/src/config.js`。GitHub Pages 可以在 workflow 中从 GitHub Actions variables 或 secrets 注入这些值；这些值会进入前端产物，所以只能使用 publishable / anon public key，不能放任何服务端特权 key 或 secret key。

当前 MVP 边界：

- 支持创建房间、加入房间、复制房间码、轮到自己时落子、棋局同步、游戏结束同步、退出房间。
- 没有账号系统、好友、自动匹配、聊天、排行榜、观战或完整断线重连。
- 没有服务端裁判；只靠前端规则和数据库版本控制，不能强防作弊。
- 页面刷新后的房间恢复暂未实现，刷新后需要重新创建或加入房间。

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
- Playwright
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

浏览器端到端测试：

```bash
npm run test:e2e
```

Playwright 测试覆盖页面加载、规则弹窗、双人模式、人机模式、撤销、历史记录和移动端冒烟检查。

也可以单独检查 JS 语法：

```bash
node --check src/game.js
node --check src/app.js
node --check src/room.js
node --check src/online.js
node --check src/online-supabase.js
```

## 构建

```bash
npm run build
```

构建后的文件在 `dist/`。如果设置了 `ONLINE_PROVIDER`、`SUPABASE_URL`、`SUPABASE_PUBLISHABLE_KEY`，构建脚本会生成公开配置；没有设置时远程模式使用 Mock adapter。

## 部署

这是一个普通静态站，不是 Vite 项目。

- GitHub Pages：可以用仓库里的 GitHub Actions workflow 部署 `dist/`。
- Vercel：构建命令填 `npm run build`，输出目录填 `dist`。

## 项目结构

```txt
.
├── index.html
├── package.json
├── docs/
│   └── supabase.sql # Supabase rooms 表和 MVP RLS 策略
├── scripts/
│   ├── build.mjs
│   └── dev-server.mjs
├── src/
│   ├── app.js        # 页面渲染、交互、模式、历史、撤销和比分
│   ├── config.js     # 默认空在线配置，构建时可注入公开 Supabase 配置
│   ├── game.js       # 规则、胜负判断、AI
│   ├── online.js     # 在线 adapter 选择入口：Supabase 已配置时启用，否则回退 Mock
│   ├── online-mock.js
│   ├── online-supabase.js
│   ├── room.js       # 房间码、房间状态和远程 session 纯函数
│   └── styles.css
├── tests/
│   └── e2e/
│       └── app.spec.js
└── test/
    └── game.test.js
```

## 之后可以继续做

- 困难 AI 现在只是浅层搜索，后面可以继续调评估函数，让它少犯一些“送棋盘”的错误。
- 给远程模式增加页面刷新恢复和更明确的断线提示。
- 如果 AI 搜索继续加深，可以考虑放到 Web Worker 里，避免影响页面操作。
- 后面可以给完整落子历史增加更细的复盘或回放视图。

## 作者

Qiuizi
