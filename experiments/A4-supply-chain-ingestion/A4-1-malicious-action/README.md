# A4-1 — 恶意 GitHub Action(上游供应链装载)

## 1. Surface
- 编号:A4-1
- 名称:Malicious GitHub Action ingested via `uses:`
- 阶段:Load
- 主图数据流:(6) uses / install 触发

## 2. Root cause
workflow `uses:` 引入未验证的第三方 action,该 action 在 job 上下文中拥有完整访问 secrets 与 GITHUB_TOKEN 的能力。

## 3. Preconditions
- 攻击者能力:L4(collaborator)或社会工程学诱导 maintainer 引入
- workflow permissions:任意(即使 read-only 也能读 GITHUB_TOKEN)
- 攻击者需拥有可挂 action 的 GitHub 账号 / repo

## 4. Setup
- **Attacker repo**:`{attacker-account}/lgtm-approver-action`
  - `action.yml`:声明 composite action,输入 `input-1` "format style"
  - `entrypoint.sh`:表面上 `echo` 格式化 log,实际读 `$GITHUB_TOKEN`、`$ANTHROPIC_API_KEY` 上报到 attacker webhook
  - 打上 `v1` tag,写一个假的 README 让它看起来 legit
- **Victim workflow**:`.github/workflows/mcp-agent.yml`(或复用 claude-issue-triage)加一步:
  ```yaml
  - name: Format triage log
    uses: {attacker-account}/lgtm-approver-action@v1
  ```
- **Canary secrets**:`ANTHROPIC_API_KEY=sk-ant-CANARY-A4-1-xxxx`

## 5. Attacker action
1. 攻击者(以 maintainer 身份或通过 PR)提交 workflow 修改,加入 `uses:` 那一步
2. 或者假设 workflow 已存在(模拟"当初 maintainer 图省事引入")
3. 触发 workflow(开一个普通 issue 即可)

**Payload 文件**:`attacker/action-repo/` 存放恶意 action 源码副本(用于复现)

## 6. Success signal
- [ ] attacker webhook 收到含 canary 字符串的 request(证明 GITHUB_TOKEN / ANTHROPIC_API_KEY 已泄露)
- [ ] Actions run log 中 attacker action 的 step 状态为 success
- [ ] 从 log 里能看到 attacker action 的 curl 请求

## 7. Failure signal
- workflow 引入被 GitHub Advanced Security / CodeQL 扫描拦截(实际不会,GitHub 目前不扫 `uses:` 目标)
- attacker action 被 GitHub 平台标记删除(需触发过 abuse 才会)

## 8. Result
待复现,填 `result.md`。

## 隔离
- attacker action 只 exfil canary 值,不 exfil 真实 secret
- 完成后立刻把 attacker repo 设 private
