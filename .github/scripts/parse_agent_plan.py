#!/usr/bin/env python3
"""
解析 LLM agent 返回的 JSON 计划，并按环境变量上限做截断。

输入: agent-response.txt（模型的原始输出，期望是 JSON）
输出: parsed-plan.json + 写入 $GITHUB_OUTPUT 多个 step output

上限通过环境变量控制（实验时可调）：
  MAX_COMPONENTS  默认 6
  MAX_ROUNDS      默认 3
  MAX_TIMEOUT     默认 30   单位: 分钟
  MAX_TOOLS       默认 5

agent 计划 schema:
  mode:             normal | failure | workload | block | quota
  summary:          string，下游可能拼接到 shell / 评论
  components:       string 数组，每个元素一个组件名
  rounds:           int，下游 ai-inference 重复轮数
  timeout_minutes:  int，下游 job 的 timeout 上限提示
  tools:            string 数组，每个元素一个 tool 名
  priority:         low | normal | high | critical
  reason:           string
"""

import json
import os
import re
import sys
from pathlib import Path


def env_int(name: str, default: int) -> int:
    raw = os.environ.get(name)
    if not raw:
        return default
    try:
        return int(raw)
    except ValueError:
        return default


MAX_COMPONENTS = env_int("MAX_COMPONENTS", 6)
MAX_ROUNDS = env_int("MAX_ROUNDS", 3)
MAX_TIMEOUT = env_int("MAX_TIMEOUT", 30)
MAX_TOOLS = env_int("MAX_TOOLS", 5)

VALID_MODES = {"normal", "failure", "workload", "block", "quota"}
VALID_PRIORITIES = {"low", "normal", "high", "critical"}


def extract_json(text: str) -> dict:
    """容忍模型输出里包了一层 markdown code fence 或者前后多余文本。"""
    text = text.strip()
    fence = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if fence:
        text = fence.group(1)
    else:
        first = text.find("{")
        last = text.rfind("}")
        if first != -1 and last != -1 and last > first:
            text = text[first : last + 1]
    return json.loads(text)


def coerce_str_list(value, cap: int) -> list:
    if not isinstance(value, list):
        return []
    out = []
    for item in value:
        if isinstance(item, str) and item.strip():
            out.append(item.strip())
        if len(out) >= cap:
            break
    return out


def main(in_path: str, out_path: str) -> int:
    raw = Path(in_path).read_text(encoding="utf-8", errors="replace")
    try:
        plan = extract_json(raw)
    except Exception as exc:
        print(f"::warning::failed to parse agent JSON: {exc}", file=sys.stderr)
        plan = {}

    mode = plan.get("mode", "normal")
    if mode not in VALID_MODES:
        mode = "normal"

    summary = str(plan.get("summary", ""))
    components = coerce_str_list(plan.get("components"), MAX_COMPONENTS)
    rounds = max(1, min(int(plan.get("rounds", 1) or 1), MAX_ROUNDS))
    timeout_minutes = max(
        1, min(int(plan.get("timeout_minutes", 5) or 5), MAX_TIMEOUT)
    )
    tools = coerce_str_list(plan.get("tools"), MAX_TOOLS)
    priority = plan.get("priority", "normal")
    if priority not in VALID_PRIORITIES:
        priority = "normal"
    reason = str(plan.get("reason", ""))

    if not components:
        components = ["lint"]

    parsed = {
        "mode": mode,
        "summary": summary,
        "components": components,
        "rounds": rounds,
        "timeout_minutes": timeout_minutes,
        "tools": tools,
        "priority": priority,
        "reason": reason,
        "matrix": {"include": [{"component": c} for c in components]},
        "round_matrix": {"include": [{"round": r} for r in range(1, rounds + 1)]},
        "estimated_runner_seconds": timeout_minutes * 60 * len(components),
        "estimated_model_calls": rounds + len(tools),
    }

    Path(out_path).write_text(json.dumps(parsed, indent=2), encoding="utf-8")

    gh_out = os.environ.get("GITHUB_OUTPUT")
    if gh_out:
        with open(gh_out, "a", encoding="utf-8") as f:
            f.write(f"mode={mode}\n")
            f.write(f"summary<<EOF_SUMMARY\n{summary}\nEOF_SUMMARY\n")
            f.write(f"components={json.dumps(components)}\n")
            f.write(f"rounds={rounds}\n")
            f.write(f"timeout_minutes={timeout_minutes}\n")
            f.write(f"tools={json.dumps(tools)}\n")
            f.write(f"priority={priority}\n")
            f.write(f"reason={reason}\n")
            f.write(f"matrix={json.dumps(parsed['matrix'])}\n")
            f.write(f"round_matrix={json.dumps(parsed['round_matrix'])}\n")
            f.write(f"components_count={len(components)}\n")

    print(json.dumps(parsed, indent=2))
    return 0


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("usage: parse_agent_plan.py <input> <output>", file=sys.stderr)
        sys.exit(2)
    sys.exit(main(sys.argv[1], sys.argv[2]))
