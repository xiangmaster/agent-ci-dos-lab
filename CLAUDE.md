# agent-ci-dos-lab

研究 agent-mediated CI-DoS 攻击的受害者仓库。GitHub 镜像：`xiangmaster/agent-ci-dos-lab`（public）。

## 项目角色

这是实验中的 `Repo_victim`：在 GitHub 上以公开仓库形态部署 agentic workflow，接受外部账号（`User_attacker`）通过 issue / PR 投放攻击载荷，触发 LLM agent 决策并被下游 workflow 放大。

## 技术栈

- GitHub Actions（issues / pull_request 触发）
- `actions/ai-inference@v1`（GitHub Models）
- Python 3 解析 agent JSON 计划
- Node + TypeScript 项目骨架（让仓库看起来像真实项目，仿 GitInject 做法）

## 启动方式

仓库本身不需要本地运行。所有实验通过 GitHub Actions 完成：

```bash
# attacker 账号在浏览器中发 issue，触发 workflow
# 或者 owner 端用 gh CLI 触发：
gh workflow run agent-ci-lab.yml
```

## 开发说明

- 主入口：`.github/workflows/agent-ci-lab.yml`
- agent 计划解析：`.github/scripts/parse_agent_plan.py`
- 上限通过环境变量控制（`MAX_COMPONENTS`、`MAX_ROUNDS`、`MAX_TIMEOUT`、`MAX_TOOLS`）
- `src/` 下是装饰性的 TS 项目骨架，无功能含义，仅为让仓库看起来真实

## 部署

`gh repo create xiangmaster/agent-ci-dos-lab --public --source=. --push`
