/**
 * Dev-only render and event tracing hooks.
 *
 * ROLE IN SYSTEM:
 * Lightweight instrumentation for diagnosing React render churn and event
 * handler firing patterns during local development. NOT used in production
 * builds — the `DEBUG_RENDER_LOG` flag below short-circuits both functions
 * to no-ops when false (which is the committed default).
 *
 * USAGE PATTERN:
 *   1. Flip `DEBUG_RENDER_LOG` to `true` locally.
 *   2. Sprinkle `useRenderLog('MyComponent')` at the top of any component
 *      whose render frequency you want to count.
 *   3. Sprinkle `logEvent('addPull.submit', { moduleId })` inside event
 *      handlers you want to trace.
 *   4. Filter the browser devtools console by `[RENDER]` or `[EVENT]`.
 *   5. **Flip `DEBUG_RENDER_LOG` back to `false` before committing.**
 *
 * GOTCHAS:
 *   - The render counter increments BEFORE the early-return on
 *     `DEBUG_RENDER_LOG`, so the count keeps progressing even when logging
 *     is disabled. This is intentional — toggling the flag mid-session
 *     gives you a meaningful count from the moment the component mounted,
 *     not "1" forever.
 *   - `useRenderLog` calls `useRef`, so the rules of hooks apply: only
 *     call from the top level of a function component or another hook,
 *     never inside conditionals.
 *   - These are deliberately simple `console.log`s, not a structured
 *     logger. Keep it that way — adding deps here would put a dev-only
 *     utility in the production bundle path.
 */

import { useRef } from "react";

/**
 * Master toggle for render/event tracing.
 *
 * Flip to `true` to re-enable render/event tracing in the browser console.
 * Filter the console by `[RENDER]` or `[EVENT]` when enabled.
 *
 * INVARIANT: This MUST be `false` on `main`. Leaving it `true` would spam
 * every user's console in production builds.
 */
const DEBUG_RENDER_LOG = false;

/**
 * Hook that counts and (optionally) logs each render of a component.
 *
 * @param name Stable label for the component, used as the log prefix.
 * @param extra Optional arbitrary payload printed alongside the render
 *   count. Useful for snapshotting props/state at render time.
 *
 * BEHAVIOR:
 *   - Increments an internal ref-backed counter on every render. The
 *     counter persists across renders (closure via `useRef`) but resets
 *     on remount.
 *   - When `DEBUG_RENDER_LOG` is `false`, this is effectively
 *     `useRef(0)` + an integer increment — cheap enough to leave in
 *     committed code without measurable cost.
 *
 * GOTCHA: The increment runs unconditionally before the disabled-flag
 *   short-circuit (see file docblock). If you reorder, you'll change
 *   the meaning of the counter when toggling the flag at runtime.
 */
export function useRenderLog(name: string, extra?: Record<string, unknown>) {
  const count = useRef(0);
  count.current += 1;
  if (!DEBUG_RENDER_LOG) return;
  // eslint-disable-next-line no-console
  console.log(`[RENDER] ${name} #${count.current}`, extra ?? "");
}

/**
 * Log an arbitrary named event when render-tracing is enabled.
 *
 * @param name Event label (e.g. `'addPull.submit'`, `'modal.close'`).
 * @param detail Optional payload for context (event args, ids, etc.).
 *
 * BEHAVIOR: No-op when `DEBUG_RENDER_LOG` is `false`. Otherwise emits a
 *   single `console.log` prefixed with `[EVENT]`.
 *
 * USE WHEN: you want to confirm an event handler is wiring up correctly
 *   or trace the order of user-driven events. Prefer this over ad-hoc
 *   `console.log`s in handlers so the disable flag turns them all off.
 */
export function logEvent(name: string, detail?: Record<string, unknown>) {
  if (!DEBUG_RENDER_LOG) return;
  // eslint-disable-next-line no-console
  console.log(`[EVENT] ${name}`, detail ?? "");
}
