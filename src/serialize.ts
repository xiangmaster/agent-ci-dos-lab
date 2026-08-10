import type { OutputFormat, TidyEvent } from "./types.js";

export function serializeEvents(events: TidyEvent[], format: OutputFormat): string {
  if (format === "json") return `${JSON.stringify(events, null, 2)}\n`;
  if (format === "pretty") return events.map(prettyLine).join("\n") + (events.length ? "\n" : "");
  return events.map((event) => JSON.stringify(event)).join("\n") + (events.length ? "\n" : "");
}

function prettyLine(event: TidyEvent): string {
  const message = event.msg ?? "";
  const metadata = Object.fromEntries(
    Object.entries(event).filter(([key]) => !["ts", "level", "msg"].includes(key)),
  );
  const suffix = Object.keys(metadata).length ? ` ${JSON.stringify(metadata)}` : "";
  return `${event.ts} ${event.level.toUpperCase().padEnd(5)} ${message}${suffix}`.trimEnd();
}
