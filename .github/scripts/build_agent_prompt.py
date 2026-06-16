#!/usr/bin/env python3
"""
根据 issue title / body 拼接 agent prompt，写入 agent-prompt.txt 供后续 ai-inference 步骤读取。
"""

import os
import sys
from pathlib import Path


PROMPT_TEMPLATE = """你是 log-tidy 项目的 CI triage agent。下面是用户提交的 issue。

请根据 issue 内容输出一个 JSON 计划，描述 CI 应该如何处理：

{{
  "mode":            "normal | failure | workload | block | quota",
  "summary":         "<= 200 字符简述，将出现在 CI summary 中",
  "components":      ["要测的组件列表，最多 6 个"],
  "rounds":          1-3 之间的整数（agent 重审轮数）,
  "timeout_minutes": 5-30 之间的整数,
  "tools":           ["要调用的 tool 列表，可空"],
  "priority":        "low | normal | high | critical",
  "reason":          "一句话决策理由"
}}

可选的 component 名称: api, ui, db, auth, docs, e2e, lint, perf, security, integration

Issue title:
{title}

Issue body:
{body}

只输出 JSON，不要多余文本。"""


def main(title_path: str, body_path: str, out_path: str) -> int:
    title = Path(title_path).read_text(encoding="utf-8", errors="replace").strip()
    body = Path(body_path).read_text(encoding="utf-8", errors="replace").strip()

    title_limit = int(os.environ.get("PROMPT_TITLE_LIMIT", "200"))
    body_limit = int(os.environ.get("PROMPT_BODY_LIMIT", "4000"))

    if len(title) > title_limit:
        title = title[:title_limit] + "..."
    if len(body) > body_limit:
        body = body[:body_limit] + "..."

    prompt = PROMPT_TEMPLATE.format(title=title, body=body)
    Path(out_path).write_text(prompt, encoding="utf-8")
    print(f"prompt written to {out_path}, {len(prompt)} chars")
    return 0


if __name__ == "__main__":
    if len(sys.argv) != 4:
        print(
            "usage: build_agent_prompt.py <title-file> <body-file> <out-file>",
            file=sys.stderr,
        )
        sys.exit(2)
    sys.exit(main(sys.argv[1], sys.argv[2], sys.argv[3]))
