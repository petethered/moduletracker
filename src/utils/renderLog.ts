import { useRef } from "react";

// Flip to `true` to re-enable render/event tracing in the browser console.
// Filter the console by `[RENDER]` or `[EVENT]` when enabled.
const DEBUG_RENDER_LOG = false;

export function useRenderLog(name: string, extra?: Record<string, unknown>) {
  const count = useRef(0);
  count.current += 1;
  if (!DEBUG_RENDER_LOG) return;
  // eslint-disable-next-line no-console
  console.log(`[RENDER] ${name} #${count.current}`, extra ?? "");
}

export function logEvent(name: string, detail?: Record<string, unknown>) {
  if (!DEBUG_RENDER_LOG) return;
  // eslint-disable-next-line no-console
  console.log(`[EVENT] ${name}`, detail ?? "");
}
