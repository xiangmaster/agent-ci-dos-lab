# Experiments

本目录存放攻击实验的 payload、运行记录和截图。

## 仓库结构

```
.github/workflows/
  summary.yml               L1 真实模板（GitHub 官方 starter-workflows a041377 漏洞原版）
  claude-issue-triage.yml   L1 真实模板（Anthropic 官方 examples，经 yunwu 中转）
  claude-pr-review.yml      L1 真实模板（Anthropic 官方 examples，经 yunwu 中转）
  triage-pipeline.yml       L1 真实模板（Google run-gemini-cli@v0 官方 action，结构沿用 TaintAWI Case #1）
  normal-ci.yml             配合 triage-pipeline 演示 V3 共享 concurrency
.github/scripts/
  parse_plan.py             triage-pipeline 用的最小 plan parser
```

**所有 7 个 V 都已部署到 L1 真实模板上。**没有 toy lab，没有 minimal reproducer。

## V_i → workflow 映射

| V | 名称 | Workflow | 真实性背书 |
|---|---|---|---|
| V1 | Matrix Inflation | triage-pipeline.yml `validate-components` | Google `run-gemini-cli@v0` 官方 action（TaintAWI Case #1 1974★） |
| V2 | Round/Loop Amplification | triage-pipeline.yml `deep-review` | 同上 |
| V3 | Concurrency Hijack | triage-pipeline.yml `release-gate` + normal-ci.yml | 同上 + GitHub Actions concurrency 原生 |
| V4 | Self-Cascade | claude-issue-triage.yml | Anthropic claude-code-action 官方 issue-triage 示例 |
| V7 | Shell Quote Break | summary.yml `gh issue comment --body '...'` | GitHub starter-workflows a041377（TaintAWI Case #2，93 fork 仍受影响） |
| V8 | Command Substitution | summary.yml（同 V7 sink + escape 链） | 同上 |
| V14 | Persistent Config Pollution | claude-pr-review.yml + PR adds CLAUDE.md | Anthropic claude-code-action 官方 PR review 模板 + auto-load CLAUDE.md 行为 |

未在今天范围内的 V：V5（tool spam）、V6（timeout inflation）、V9（YAML parse break）、V10（expression re-eval）、V11（encoding bypass）、V12（oversize payload）、V13（filename hostile）。这些列为 future work。

## 三个 vendor 的实际 LLM 来源

- **Anthropic**（claude-code-action）：claude-sonnet-4-6，经 yunwu.ai 中转
- **Google**（run-gemini-cli）：gemini-2.5-flash，Google AI Studio API key 直连
- **OpenAI**（GitHub Models inside summary.yml）：openai/gpt-4o-mini 自带

三家模型同时在线，体现"vendor-agnostic"的攻击面。

## 文件

- [attack-payloads.md](attack-payloads.md)：每个 V 对应的攻击 issue / PR 文本
- [results.md](results.md)：每次实验的运行记录、截图清单、放大比
- [test_yunwu.sh](test_yunwu.sh)：验证中转站 endpoint 可用性的脚本
