#!/usr/bin/env bash
# 验证 yunwu 中转站的 Claude (Anthropic Messages API) 和 GPT (OpenAI Responses API) 是否能用。
# 用法：在仓库根目录跑 `bash experiments/test_yunwu.sh`，会读 .env 然后分别测两个端点。

set -u
cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "[ERR] .env 不存在，先写好 .env 再跑" >&2
  exit 2
fi

# 加载 .env
set -a
# shellcheck disable=SC1091
. ./.env
set +a

ANTHROPIC_TOKEN="${ANTHROPIC_TOKEN:-${YUNWU_TOKEN:-}}"
OPENAI_TOKEN="${OPENAI_TOKEN:-${YUNWU_TOKEN:-}}"

if [ -z "$ANTHROPIC_TOKEN" ] && [ -z "$OPENAI_TOKEN" ]; then
  echo "[ERR] .env 里 YUNWU_TOKEN / ANTHROPIC_TOKEN / OPENAI_TOKEN 全空" >&2
  exit 2
fi

pass() { printf "\033[32m[PASS]\033[0m %s\n" "$1"; }
fail() { printf "\033[31m[FAIL]\033[0m %s\n" "$1"; }
info() { printf "\033[36m[INFO]\033[0m %s\n" "$1"; }

echo "============================================================"
echo "test 1: Claude via Anthropic Messages API"
echo "  endpoint: ${ANTHROPIC_BASE_URL}/v1/messages"
echo "  model:    ${ANTHROPIC_MODEL}"
echo "============================================================"

if [ -z "$ANTHROPIC_TOKEN" ]; then
  fail "ANTHROPIC_TOKEN 空，跳过 Claude 测试"
else
  resp=$(curl -sS -w "\n__HTTP_STATUS__:%{http_code}" \
    "${ANTHROPIC_BASE_URL}/v1/messages" \
    -H "Authorization: Bearer ${ANTHROPIC_TOKEN}" \
    -H "Content-Type: application/json" \
    -H "anthropic-version: 2023-06-01" \
    -d "{
      \"model\": \"${ANTHROPIC_MODEL}\",
      \"max_tokens\": 60,
      \"messages\": [{\"role\": \"user\", \"content\": \"Say hi in exactly 5 words.\"}]
    }")
  status=$(echo "$resp" | grep -o '__HTTP_STATUS__:.*' | cut -d: -f2)
  body=$(echo "$resp" | sed 's/__HTTP_STATUS__:.*//')

  echo "HTTP status: $status"
  echo "--- response body ---"
  echo "$body" | head -c 2000
  echo
  echo "---------------------"
  if [ "$status" = "200" ]; then
    text=$(echo "$body" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('content',[{}])[0].get('text',''))" 2>/dev/null || echo "")
    if [ -n "$text" ]; then
      pass "Claude OK — 模型回复: $text"
    else
      info "Claude HTTP 200 但解析不到 content[0].text，可能字段结构有差异"
    fi
  else
    fail "Claude 失败 (HTTP $status)"
  fi
fi

echo
echo "============================================================"
echo "test 2: GPT via OpenAI Responses API"
echo "  endpoint: ${OPENAI_BASE_URL}/responses"
echo "  model:    ${OPENAI_MODEL}"
echo "============================================================"

if [ -z "$OPENAI_TOKEN" ]; then
  fail "OPENAI_TOKEN 空，跳过 GPT 测试"
else
  resp=$(curl -sS -w "\n__HTTP_STATUS__:%{http_code}" \
    "${OPENAI_BASE_URL}/responses" \
    -H "Authorization: Bearer ${OPENAI_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{
      \"model\": \"${OPENAI_MODEL}\",
      \"input\": \"Say hi in exactly 5 words.\"
    }")
  status=$(echo "$resp" | grep -o '__HTTP_STATUS__:.*' | cut -d: -f2)
  body=$(echo "$resp" | sed 's/__HTTP_STATUS__:.*//')

  echo "HTTP status: $status"
  echo "--- response body ---"
  echo "$body" | head -c 2000
  echo
  echo "---------------------"
  if [ "$status" = "200" ]; then
    pass "GPT OK — HTTP 200 收到响应"
  else
    fail "GPT 失败 (HTTP $status)"
  fi
fi

GEMINI_TOKEN="${GEMINI_TOKEN:-${YUNWU_TOKEN:-}}"
GEMINI_BASE_URL="${GEMINI_BASE_URL:-https://yunwu.ai}"
GEMINI_MODEL="${GEMINI_MODEL:-gemini-3.5-flash}"

echo
echo "============================================================"
echo "test 3: Gemini via Google Native (yunwu generateContent)"
echo "  endpoint: ${GEMINI_BASE_URL}/v1beta/models/${GEMINI_MODEL}:generateContent"
echo "  model:    ${GEMINI_MODEL}"
echo "============================================================"

if [ -z "$GEMINI_TOKEN" ]; then
  fail "GEMINI_TOKEN 空，跳过 Gemini 测试"
else
  # 先用 Bearer auth（yunwu 文档说支持）
  echo "[try 1] Authorization: Bearer ..."
  resp=$(curl -sS -w "\n__HTTP_STATUS__:%{http_code}" \
    "${GEMINI_BASE_URL}/v1beta/models/${GEMINI_MODEL}:generateContent" \
    -H "Authorization: Bearer ${GEMINI_TOKEN}" \
    -H "Content-Type: application/json" \
    -d '{"contents":[{"parts":[{"text":"Say hi in exactly 5 words."}]}]}')
  status=$(echo "$resp" | grep -o '__HTTP_STATUS__:.*' | cut -d: -f2)
  body=$(echo "$resp" | sed 's/__HTTP_STATUS__:.*//')
  echo "HTTP status: $status"
  echo "$body" | head -c 1500
  echo

  if [ "$status" = "200" ]; then
    pass "Gemini (Bearer auth) OK"
  else
    fail "Gemini Bearer 失败 (HTTP $status)"
    # 退路：Google 标准 query string key=
    echo "[try 2] ?key= 查询参数（Google 标准）..."
    resp=$(curl -sS -w "\n__HTTP_STATUS__:%{http_code}" \
      "${GEMINI_BASE_URL}/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_TOKEN}" \
      -H "Content-Type: application/json" \
      -d '{"contents":[{"parts":[{"text":"Say hi in exactly 5 words."}]}]}')
    status=$(echo "$resp" | grep -o '__HTTP_STATUS__:.*' | cut -d: -f2)
    body=$(echo "$resp" | sed 's/__HTTP_STATUS__:.*//')
    echo "HTTP status: $status"
    echo "$body" | head -c 1500
    echo
    if [ "$status" = "200" ]; then
      pass "Gemini (?key= query) OK"
    else
      fail "Gemini ?key= 也失败 (HTTP $status)"
    fi

    # 再退路：x-goog-api-key header
    echo "[try 3] x-goog-api-key header（Google 标准 header）..."
    resp=$(curl -sS -w "\n__HTTP_STATUS__:%{http_code}" \
      "${GEMINI_BASE_URL}/v1beta/models/${GEMINI_MODEL}:generateContent" \
      -H "x-goog-api-key: ${GEMINI_TOKEN}" \
      -H "Content-Type: application/json" \
      -d '{"contents":[{"parts":[{"text":"Say hi in exactly 5 words."}]}]}')
    status=$(echo "$resp" | grep -o '__HTTP_STATUS__:.*' | cut -d: -f2)
    body=$(echo "$resp" | sed 's/__HTTP_STATUS__:.*//')
    echo "HTTP status: $status"
    echo "$body" | head -c 1500
    echo
    if [ "$status" = "200" ]; then
      pass "Gemini (x-goog-api-key header) OK"
    fi
  fi
fi

echo
echo "完成。三个 PASS 说明三条 vendor 路径都能用。"
