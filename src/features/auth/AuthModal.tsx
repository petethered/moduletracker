/**
 * AuthModal — single multi-view modal handling the entire unauthenticated auth surface.
 *
 * Role in the broader feature:
 *   This is the user-facing entry point for the email + JWT auth flow that backs cloud sync.
 *   It speaks to the Cloudflare Worker via `services/auth` (which wraps `services/api`).
 *   Tokens are stored/managed inside `services/api` (not here); this component only reads
 *   the email back out via `getEmailFromToken()` after a successful auth call.
 *
 * User flows supported (driven by the `view` state machine):
 *   login           → existing user signs in
 *   register        → create a new account
 *   reset-request   → request a password reset email (Postmark, sent from help@meezer.com)
 *   reset-confirm   → land here from the email link with a `resetToken` query param;
 *                     completes the reset and signs the user in
 *
 * Key state interactions (Zustand store):
 *   On any successful auth (login/register/reset-confirm) we:
 *     1. Read email from the freshly-stored JWT (`getEmailFromToken`)
 *     2. `setUser({ email })` so the rest of the app knows we're signed in
 *     3. `setSyncEnabled(true)` so SyncInitializer kicks in
 *   We do NOT set storageChoice here — that's already "cloud" by the time this modal opens
 *   (StorageChoiceModal is the upstream gate).
 *
 * Lifecycle / gotchas:
 *   - `useEffect` on [isOpen, initialView] resets the view when reopening so a stale
 *     "register" view doesn't persist after closing while in register mode.
 *   - `clearForm()` runs on every successful auth AND on every view switch so passwords
 *     don't leak across views (security hygiene + UX).
 *   - Reset-request intentionally shows the same success message regardless of whether the
 *     email exists (prevents account enumeration) — see the `resetSent` branch below.
 *   - `ApiError` gets its message surfaced verbatim (server-controlled); anything else falls
 *     back to a generic "Connection failed" so we don't leak stack traces or fetch internals.
 */
import { useState, useEffect } from "react";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import { useStore } from "../../store";
import * as authService from "../../services/auth";
import { getEmailFromToken } from "../../services/api";
import { ApiError } from "../../services/api";

// The four sub-views this modal can render. Kept as a string-literal union so the
// switch in the JSX body stays exhaustive and TS catches missing cases.
type AuthView = "login" | "register" | "reset-request" | "reset-confirm";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Allows callers to deep-link straight into a non-default view, e.g. when the user
  // arrives via a password reset email we open straight to "reset-confirm".
  initialView?: AuthView;
  // Only used by the "reset-confirm" view. Comes from the URL when the user clicks the
  // password reset link in their email. Empty string when not applicable.
  resetToken?: string;
}

export function AuthModal({ isOpen, onClose, initialView = "login", resetToken = "" }: AuthModalProps) {
  // Local view state — synced from props on each open so the modal honors `initialView`
  // even after it's been opened/closed previously.
  const [view, setView] = useState<AuthView>(initialView);
  // (view state above; useEffect below re-syncs it whenever the modal reopens
  // so a fresh `initialView` prop wins over stale internal state.)

  // Re-sync the view from props every time the modal is opened. Without this, closing
  // the modal mid-register and reopening for a reset would still show the register form.
  useEffect(() => {
    if (isOpen) setView(initialView);
  }, [isOpen, initialView]);

  // Form fields — kept as separate states (rather than one object) so individual inputs
  // re-render independently and can be cleared selectively.
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  // `error` carries server-provided messages (ApiError.message) OR a generic fallback.
  const [error, setError] = useState<string | null>(null);
  // `loading` disables the submit button + swaps its label while a request is in-flight.
  const [loading, setLoading] = useState(false);
  // `resetSent` hides the request form and shows the deliberately-vague success message
  // (see flow note above re: account enumeration).
  const [resetSent, setResetSent] = useState(false);
  // Store actions — both required to flip the app into "logged-in cloud-sync" mode.
  const setUser = useStore((s) => s.setUser);
  const setSyncEnabled = useStore((s) => s.setSyncEnabled);

  // Resets every form field + transient flags. Called on view switch and on success
  // close so passwords don't survive across renders.
  const clearForm = () => {
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setNewPassword("");
    setError(null);
    setResetSent(false);
  };

  // View-switch helper: always clear form first so error/inputs don't bleed between views.
  const switchView = (v: AuthView) => {
    clearForm();
    setView(v);
  };

  // Shared post-auth path for login / register / reset-confirm. Reads email from the
  // JWT that `services/auth` just persisted, flips the store into the signed-in state,
  // and closes the modal. SyncInitializer picks up from there to perform the initial sync.
  const handleSuccess = () => {
    const userEmail = getEmailFromToken();
    if (userEmail) {
      setUser({ email: userEmail });
      setSyncEnabled(true);
    }
    clearForm();
    onClose();
  };

  // --- Submit handlers --------------------------------------------------------------
  // All four follow the same pattern:
  //   1. preventDefault to suppress the browser's native form GET submit
  //   2. clear `error`, validate client-side where applicable
  //   3. set loading; call the service; on success run handleSuccess() (or the
  //      view-specific equivalent for reset-request)
  //   4. on ApiError surface server message; else generic connection error
  //   5. always clear loading in finally{}
  // The duplication is intentional: each handler has its own validation rules and
  // success path, so abstracting further would obscure the differences.

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await authService.login(email, password);
      handleSuccess();
    } catch (err) {
      if (err instanceof ApiError) {
        // Server-provided message (e.g. "Invalid credentials"). Safe to display verbatim.
        setError(err.message);
      } else {
        // Network failure / unexpected error — keep the message generic.
        setError("Connection failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    // Client-side validation runs before the request to give instant feedback and to
    // mirror the server's rules. Server still validates independently.
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      await authService.register(email, password);
      // Successful register also issues a JWT, so we can sign the user straight in.
      handleSuccess();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Connection failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await authService.requestPasswordReset(email);
      // Note: we treat any non-throw as success. Server intentionally returns 200
      // even for unknown emails to prevent account enumeration; we mirror that here
      // by showing the same vague success copy regardless.
      setResetSent(true);
    } catch {
      // Don't leak whether the email exists via error messaging — only show a generic
      // network error. ApiError vs other doesn't matter here, hence the bare catch.
      setError("Connection failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    // Same client-side rules as register so the UX feels consistent.
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      // `resetToken` came in via prop (originally from the email link's URL).
      // Server validates the token's freshness/signature; expired tokens throw ApiError.
      await authService.confirmPasswordReset(resetToken, newPassword);
      handleSuccess();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Connection failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Shared input styling — kept as a const (rather than a component) because every input
  // here has different `type`/`placeholder`/`onChange` and componentizing buys nothing.
  const inputClass =
    "w-full px-3 py-2 rounded-lg bg-[var(--color-navy-800)] border border-[var(--color-navy-500)] text-gray-200 text-base focus:outline-none focus:border-[var(--color-accent-gold)] transition-colors";

  // Single Modal with a per-view title, then four mutually-exclusive forms. Only one
  // form renders at a time; we don't unmount-on-switch via key because clearForm() in
  // switchView() already wipes state.
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={
      view === "login" ? "Log In" :
      view === "register" ? "Create Account" :
      view === "reset-request" ? "Reset Password" :
      "Set New Password"
    }>
      {view === "login" && (
        <form onSubmit={handleLogin} className="space-y-3">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
            required
            autoFocus
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
            required
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Logging in..." : "Log In"}
          </Button>
          <div className="flex justify-between text-xs">
            <button type="button" onClick={() => switchView("register")} className="text-gray-400 hover:text-[var(--color-accent-gold)] transition-colors">
              Create account
            </button>
            <button type="button" onClick={() => switchView("reset-request")} className="text-gray-400 hover:text-[var(--color-accent-gold)] transition-colors">
              Forgot password?
            </button>
          </div>
        </form>
      )}

      {view === "register" && (
        <form onSubmit={handleRegister} className="space-y-3">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
            required
            autoFocus
          />
          <input
            type="password"
            placeholder="Password (min 8 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
            required
            minLength={8}
          />
          <input
            type="password"
            placeholder="Confirm password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={inputClass}
            required
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Creating account..." : "Create Account"}
          </Button>
          <div className="text-xs text-center">
            <button type="button" onClick={() => switchView("login")} className="text-gray-400 hover:text-[var(--color-accent-gold)] transition-colors">
              Already have an account? Log in
            </button>
          </div>
        </form>
      )}

      {view === "reset-request" && (
        <form onSubmit={handleResetRequest} className="space-y-3">
          {resetSent ? (
            <div className="text-sm text-green-400 text-center py-2">
              If an account exists with that email, a reset link has been sent. Check your inbox.
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-400">
                Enter your email and we'll send you a link to reset your password.
              </p>
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
                required
                autoFocus
              />
              {error && <p className="text-sm text-red-400">{error}</p>}
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? "Sending..." : "Send Reset Link"}
              </Button>
            </>
          )}
          <div className="text-xs text-center">
            <button type="button" onClick={() => switchView("login")} className="text-gray-400 hover:text-[var(--color-accent-gold)] transition-colors">
              Back to login
            </button>
          </div>
        </form>
      )}

      {view === "reset-confirm" && (
        <form onSubmit={handleResetConfirm} className="space-y-3">
          <input
            type="password"
            placeholder="New password (min 8 characters)"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className={inputClass}
            required
            minLength={8}
            autoFocus
          />
          <input
            type="password"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={inputClass}
            required
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Setting password..." : "Set New Password"}
          </Button>
        </form>
      )}
    </Modal>
  );
}
