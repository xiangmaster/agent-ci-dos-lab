# Agentic CI 攻击面 v2 实验总索引

本目录组织所有 PoC 实验,与 `xiangmaster/Agentic-CI-Survey` 仓库中定义的 v2 攻击面分类学一一对应。

## 组织原则

- **一 PoC 一目录**,严格按 `A{编号}[{子面}]-{slug}` 命名
- **一 PoC 只 illustrate 一个 A**,禁止跨面混合
- **每个 PoC 走标准 8 段结构**(见 `_template/README.md`)
- **命名与 v2 分类学对齐**,不再使用 V1–V14 旧编号

## 12 格状态总表

| 编号 | 攻击面 | 优先级 | 状态 | 最后运行 | 结果 | 备注 |
|---|---|---|---|---|---|---|
| A1 | 事件内容注入 | P2 | ⚪ 未开始 | — | — | 所有 PoC 公共入口,单独跑一个 baseline |
| A2a | `pull_request_target` 借权 | P1 | ⚪ 未开始 | — | — | fork PR 目标仓 write token 生效 |
| A2b | `issue_comment` 借状态 | P1 | ⚪ 未开始 | — | — | 编辑评论 TOCTOU |
| A2c | TOCTOU checkout | P1 | ⚪ 未开始 | — | — | trigger SHA ≠ checkout SHA |
| A3 | 配置信任提升 | P1 | ⚪ 未开始 | — | — | CLAUDE.md / GEMINI.md / AGENTS.md / .cursorrules |
| **A4-1** | 恶意 GitHub Action | **P0** | ⚪ 未开始 | — | — | 上游 `uses:` |
| **A4-2** | 恶意 MCP server | **P0** | ⚪ 未开始 | — | — | 返回值污染 agent context |
| **A4-3** | 恶意 npm 包 | **P0** | ⚪ 未开始 | — | — | postinstall hook exfil |
| A5 | Agent 上下文腐化 | P2 | ⚪ 未开始 | — | — | delimiter / 编码 / jailbreak 原语表 |
| A6a | 工具越权 | P2 | ⚪ 未开始 | — | — | prompt 诱导 Bash gh:* / WebFetch |
| **A6b** | 沙箱逃逸 | **P0** | ⚪ 未开始 | — | — | 重放 MS Claude Read 案例 |
| A7a | Output-as-Prompt | P0 | ⚪ 未开始 | — | — | cross-agent 链式扩散 |
| A7b | Output-as-Sink | P2 | ⚪ 未开始 | — | — | agent 输出→sink 埋雷 |
| **A7c** | 欺骗人类审核员 | **P0** | ⚪ 未开始 | — | — | 漏报 CVE / 误标 severity |
| A8 | Sink 解析破 | P1 | ⚪ 未开始 | — | — | shell / YAML / expression re-eval |
| **A9-1** | Token exfil | **P0** | ⚪ 未开始 | — | — | 泄露到 attacker webhook |
| **A9-2** | Cache poisoning | P1 | ⚪ 未开始 | — | — | actions/cache 污染 |
| **A9-3** | Auto-merge 传播 | P1 | ⚪ 未开始 | — | — | agent approve 恶意 PR |

图例:⚪ 未开始 / 🟡 进行中 / ✅ 复现成功 / ❌ 复现失败(被防御拦截) / 🔒 已受平台修复

## 优先级说明

- **P0(novelty 集中,必做)**:A4-1/A4-2/A4-3、A6b、A7a、A7c、A9-1 —— 论文的独有贡献
- **P1(强建议)**:A2a/A2b/A2c、A3、A8、A9-2、A9-3 —— 已知攻击面在 agentic 场景的验证
- **P2(代表性)**:A1、A5、A6a、A7b —— 有大量类似工作,做一个 baseline 即可

## 攻击者 / 受害者角色

| 角色 | 账号 | 用途 |
|---|---|---|
| Repo_victim | `xiangmaster/agent-ci-dos-lab` (public) | 挂载 agentic workflow,接受攻击 |
| User_attacker | 待定 (原 `xiang-super`) | fork / 发 issue / 开 PR |
| Attacker_repo | 待定 (`xiang-super/*`) | 承载 A4-1 恶意 action、A9 exfil endpoint |
| Attacker_webhook | 待定 (webhook.site / CF Worker) | 收 A9 泄露的 token |

## 复现流程

1. `cd experiments/A{X}-{...}/`
2. 读 `README.md` 的 Setup + Attacker action 章节
3. 按 attacker/ 下的 payload 文件在 GitHub UI 手动构造 issue/PR/comment
4. 观察 GitHub Actions run log,采集到 observed/
5. 填 `result.md` 记录 success/fail 判定与时间戳
6. 回来更新本文件顶部状态表

## 关联文档

- 主分类学:`../../Agentic-CI-Survey/docs/attack-surface-taxonomy.md`
- 威胁模型前置:`../../Agentic-CI-Survey/docs/threat-model-prerequisites.md`
- 主图:`../../Agentic-CI-Survey/assets/fig1-pipeline.pdf`
