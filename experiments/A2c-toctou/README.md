# A2c — TOCTOU:trigger SHA ≠ checkout SHA

## 1. Surface
- 编号:A2c / Trigger / 主图 (5)
- 名称:Time-Of-Check ≠ Time-Of-Use for checkout content

## 2. Root cause
Workflow trigger 时的 SHA 与 `actions/checkout` 拉到的 SHA 之间存在时间窗口。攻击者在窗口内 push 新 commit,checkout 拉到修改版。

## 3. Preconditions
L3 fork PR 作者,workflow `on: pull_request_target` + `actions/checkout` 用默认 ref。

## 4. Setup
复用 `claude-pr-review.yml`。

## 5. Attacker action
1. 开 PR(SHA₁,无害)
2. workflow 排队时(通常 5–30s)push force,SHA 变 SHA₂(恶意)
3. checkout 拉 SHA₂

## 6. Success signal
- [ ] Actions run log 中 checkout 的 SHA ≠ event.pull_request.head.sha
- [ ] agent 读到的代码是恶意版

## 7. Failure signal
- workflow 用 `ref: ${{ github.event.pull_request.head.sha }}` 固定 SHA(常见 mitigation)

## 8. Result
待复现。
