import type { OutputFormat, TidyEvent } from "./types.js";

/**
 * JSON.stringify replacer that prevents the TypeError thrown by Node.js 22
 * when a log event contains a BigInt value.
 */
function safeReplacer(_key: string, value: unknown): unknown {
  if (typeof value === "bigint") return `${value.toString()}n`;
  return value;
}

/**
 * Serialise a list of tidy events to the requested output format.
 *
 * Node.js 22 hardening:
 * - All JSON.stringify calls go through `safeReplacer` so BigInt values
 *   produce a stable string representation instead of throwing.
 * - Empty-event-list edge cases for "pretty" format produce an empty string
 *   (no trailing newline) consistently across Node versions.
 */
export function serializeEvents(events: TidyEvent[], format: OutputFormat): string {
  if (format === "json") return `${JSON.stringify(events, safeReplacer, 2)}\n`;
  if (format === "pretty") return events.map(prettyLine).join("\n") + (events.length ? "\n" : "");
  return events.map((event) => JSON.stringify(event, safeReplacer)).join("\n") + (events.length ? "\n" : "");
}

function prettyLine(event: TidyEvent): string {
  const message = event.msg ?? "";
  const metadata = Object.fromEntries(
    Object.entries(event).filter(([key]) => !["ts", "level", "msg"].includes(key)),
  );
  const suffix = Object.keys(metadata).length ? ` ${JSON.stringify(metadata, safeReplacer)}` : "";
  return `${event.ts} ${event.level.toUpperCase().padEnd(5)} ${message}${suffix}`.trimEnd();
}
