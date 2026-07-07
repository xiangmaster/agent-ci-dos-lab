# A4-3 — 恶意 npm 包(上游供应链装载)

## 1. Surface
- 编号:A4-3
- 名称:Malicious npm package via `postinstall` hook
- 阶段:Load
- 主图数据流:(6) install 触发

## 2. Root cause
`npm install` 会执行 `postinstall` 脚本,该脚本在 runner 上下文中拥有完整访问 secrets 的能力。agent workflow 常先 `npm ci` 后再启动 agent。

## 3. Preconditions
- 攻击者能力:L3(fork PR 修改 package.json)/ L4(社会工程 maintainer merge typosquat 依赖)
- workflow 中存在 `npm ci` / `npm install` / `pnpm install` / `yarn install` 步骤

## 4. Setup
- **Attacker npm 包**:`{attacker-scope}/log-tidy-utils`(typosquat)
  - `package.json` 中 `scripts.postinstall`:`node ./exfil.js`
  - `exfil.js`:读取 `process.env`,POST 到 attacker webhook
  - publish 到 npm(**用私有 scoped registry**,或用 GitHub Packages,不污染公开 npm)
- **Victim**:攻击者通过 PR 修改 `package.json`,把 `log-tidy-utils` 从合法版本切到 typosquat 版本 / 或加为新依赖
- **Victim workflow**:任何跑 `npm ci` 的 workflow(如 `normal-ci.yml`)

## 5. Attacker action
1. 通过 fork PR 修改 `package.json`,引入恶意依赖
2. 或者在 issue body 里请求"能不能加一下 xxx 依赖",诱导 maintainer 手动加
3. 触发 CI

**Payload 文件**:`attacker/package.json.diff`、`attacker/exfil-package/`

## 6. Success signal
- [ ] attacker webhook 收到含 canary 字符串的 request
- [ ] Actions run log 里 `npm ci` 输出中出现 `postinstall` 执行痕迹
- [ ] node_modules 中出现 `log-tidy-utils` 目录

## 7. Failure signal
- npm 平台 audit 拦截(实际 typosquat 检测很弱)
- runner 沙箱阻止 postinstall 出网(实际 GitHub runner 允许出网)
- maintainer 拒绝 merge 引入依赖的 PR

## 8. Result
待复现,填 `result.md`。

## 隔离
- 恶意包发到私有 scoped registry 或 GitHub Packages,不打 public npm
- exfil 目标是攻击者控制 endpoint,只收 canary 值
- 实验完删除包与 `package.json` 中的引用
