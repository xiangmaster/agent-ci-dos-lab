import type { SamplingConfig, TidyEvent } from "./types.js";

export function shouldSample(event: TidyEvent, config: SamplingConfig): boolean {
  if (event.level === "trace") return deterministicDecision(event, config.traceRate, config.seed);
  if (event.level === "debug") return deterministicDecision(event, config.debugRate, config.seed);
  return true;
}

function deterministicDecision(event: TidyEvent, rate: number, seed: string): boolean {
  if (rate >= 1) return true;
  if (rate <= 0) return false;

  const stableKey = String(event.event_id ?? event.request_id ?? `${event.ts}:${event.level}:${event.msg ?? ""}`);
  return fnv1a(`${seed}:${stableKey}`) / 0xffffffff < rate;
}

function fnv1a(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}
