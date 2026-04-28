/**
 * main.tsx — application bootstrap entry point.
 *
 * Role:
 *   - The single Vite entry referenced by index.html.
 *   - Mounts the root <App /> component into the #root DOM node.
 *
 * User flow:
 *   - This file does not implement a user flow itself; it is the wiring layer
 *     that gets the React tree on screen so every other feature can render.
 *
 * Wiring notes for future agents:
 *   - StrictMode is intentional. It double-invokes effects/reducers in dev to
 *     surface impure state mutations. Do NOT remove it to silence a warning —
 *     fix the underlying effect instead. (Zustand+Immer slices are designed
 *     to be safe under double-invocation.)
 *   - The non-null assertion on getElementById("root") is safe because
 *     index.html ships a <div id="root"> in the static markup. If you ever
 *     change the host id, update both places.
 *   - Global styles (Tailwind layer + CSS variables for navy/gold theme) come
 *     in via "./index.css" — keep this import at the top level so the cascade
 *     is established before any feature lazy-loads.
 *   - No providers are wrapped here: the Zustand store is module-scoped and
 *     accessed via the useStore hook, so there is no Provider component.
 *     If you add one (e.g. a router or i18n provider), wrap <App /> below.
 */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
