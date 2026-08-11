import http from "node:http";

const upstreamBase = process.env.UPSTREAM_BASE_URL?.replace(/\/$/, "");
const port = Number(process.env.ADAPTER_PORT || 8787);

if (!upstreamBase) {
  throw new Error("UPSTREAM_BASE_URL is required");
}

function sendEvent(response, event, data) {
  response.write(`event: ${event}\n`);
  response.write(`data: ${JSON.stringify(data)}\n\n`);
}

function streamMessage(response, message) {
  const usage = message.usage || {};
  sendEvent(response, "message_start", {
    type: "message_start",
    message: {
      id: message.id,
      type: "message",
      role: message.role || "assistant",
      model: message.model,
      content: [],
      stop_reason: null,
      stop_sequence: null,
      usage: {
        input_tokens: usage.input_tokens || 0,
        output_tokens: 0,
        cache_creation_input_tokens: usage.cache_creation_input_tokens,
        cache_read_input_tokens: usage.cache_read_input_tokens,
      },
    },
  });

  for (const [index, block] of (message.content || []).entries()) {
    if (block.type === "text") {
      sendEvent(response, "content_block_start", {
        type: "content_block_start",
        index,
        content_block: { type: "text", text: "" },
      });
      sendEvent(response, "content_block_delta", {
        type: "content_block_delta",
        index,
        delta: { type: "text_delta", text: block.text || "" },
      });
    } else if (block.type === "tool_use") {
      sendEvent(response, "content_block_start", {
        type: "content_block_start",
        index,
        content_block: {
          type: "tool_use",
          id: block.id,
          name: block.name,
          input: {},
        },
      });
      sendEvent(response, "content_block_delta", {
        type: "content_block_delta",
        index,
        delta: {
          type: "input_json_delta",
          partial_json: JSON.stringify(block.input || {}),
        },
      });
    } else {
      sendEvent(response, "content_block_start", {
        type: "content_block_start",
        index,
        content_block: block,
      });
    }

    sendEvent(response, "content_block_stop", {
      type: "content_block_stop",
      index,
    });
  }

  sendEvent(response, "message_delta", {
    type: "message_delta",
    delta: {
      stop_reason: message.stop_reason,
      stop_sequence: message.stop_sequence || null,
    },
    usage: { output_tokens: usage.output_tokens || 0 },
  });
  sendEvent(response, "message_stop", { type: "message_stop" });
  response.end();
}

const server = http.createServer(async (request, response) => {
  if (request.method === "GET" && request.url === "/health") {
    response.writeHead(200, { "content-type": "text/plain" });
    response.end("ok");
    return;
  }

  if (request.method !== "POST" || !request.url.startsWith("/v1/messages")) {
    console.log(`adapter_reject method=${request.method} url=${request.url}`);
    response.writeHead(404).end();
    return;
  }

  try {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    const wantsStream = payload.stream === true;
    console.log(`adapter_request model=${payload.model} stream=${wantsStream}`);
    payload.stream = false;

    const headers = {
      "content-type": "application/json",
      "x-api-key": request.headers["x-api-key"] || "",
      "anthropic-version": request.headers["anthropic-version"] || "2023-06-01",
    };
    if (request.headers["anthropic-beta"]) {
      headers["anthropic-beta"] = request.headers["anthropic-beta"];
    }

    const upstream = await fetch(`${upstreamBase}/v1/messages`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(180_000),
    });
    const body = await upstream.text();
    console.log(`adapter_upstream status=${upstream.status} bytes=${Buffer.byteLength(body)}`);

    if (!upstream.ok) {
      response.writeHead(upstream.status, { "content-type": "application/json" });
      response.end(body);
      return;
    }

    if (!wantsStream) {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(body);
      return;
    }

    response.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "close",
    });
    streamMessage(response, JSON.parse(body));
  } catch (error) {
    if (!response.headersSent) {
      response.writeHead(502, { "content-type": "application/json" });
    }
    response.end(JSON.stringify({ type: "error", error: { type: "adapter_error", message: String(error) } }));
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Anthropic adapter listening on 127.0.0.1:${port}`);
});
