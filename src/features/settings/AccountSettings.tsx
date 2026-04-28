/**
 * AccountSettings — sub-panel inside the Settings modal for account management.
 *
 * Role in the broader feature:
 *   The signed-in counterpart to AuthModal. Lets users change email, change password,
 *   toggle cloud sync on/off, and log out. Renders inside SettingsPanel and is
 *   conditionally a "Set Up Cloud Sync" CTA when no user is present.
 *
 * User flows supported:
 *   - Logged-out: shows a CTA that closes Settings, sets storageChoice="cloud", which
 *     causes the auth flow to surface (StorageChoiceModal returns null since choice is
 *     set; whichever component opens AuthModal on cloud-without-user will take over).
 *   - Logged-in:
 *       change email: requires current password, server validates + reissues JWT, we
 *                     refresh the in-store email from the new token.
 *       change password: requires current + new password, validated client-side first.
 *       toggle sync: flips syncEnabled. Disabling cancels any pending push and resets
 *                    sync status; data stays in localStorage.
 *       logout: cancels pending push, calls authService.logout (clears JWT), clears
 *               user/syncEnabled/syncStatus.
 *
 * Key state interactions:
 *   - `user` from store — drives whether the form or the CTA is shown.
 *   - `syncEnabled` — toggles the sync pipeline without losing the cloud account.
 *     Useful for users who want to stop syncing temporarily without logging out.
 *   - `setStorageChoice("cloud")` — used in the CTA path. Note we close Settings first
 *     so the StorageChoiceModal/AuthModal doesn't render UNDER the open Settings modal.
 *
 * Gotchas:
 *   - We use only ONE `error` and ONE `success` state, shared across email/password
 *     forms. That's intentional — only one form is open at a time. We clear both when
 *     opening either form so stale messages don't carry over.
 *   - `cancelPendingPush()` MUST be called before logout(). If we cleared the JWT first,
 *     a queued push would fire with a now-empty token and the server would reject it
 *     with 401 — triggering the auth-expired callback at exactly the wrong moment.
 *   - The change-email flow re-reads the email from the NEW token (server reissues on
 *     email change). Without this the in-store email would stay stale until a refresh.
 */
import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { useStore } from "../../store";
import * as authService from "../../services/auth";
import { getEmailFromToken } from "../../services/api";
import { ApiError } from "../../services/api";
import { cancelPendingPush } from "../../services/sync";

export function AccountSettings() {
  // Store subscriptions — kept granular so this component re-renders only on the
  // specific slices it cares about.
  const user = useStore((s) => s.user);
  const syncEnabled = useStore((s) => s.syncEnabled);
  const setUser = useStore((s) => s.setUser);
  const setSyncEnabled = useStore((s) => s.setSyncEnabled);
  const setSyncStatus = useStore((s) => s.setSyncStatus);
  const setStorageChoice = useStore((s) => s.setStorageChoice);
  const closeSettings = useStore((s) => s.closeSettings);

  // Form-visibility flags — only one form is open at a time. Toggling one closes
  // the other (see button onClicks below) for a cleaner UX.
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  // Email change requires re-confirmation via current password.
  const [newEmail, setNewEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  // Password change requires both current and new (with confirm).
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  // Single error/success pair shared across forms — cleared when toggling forms so
  // stale messages don't carry over.
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const inputClass =
    "w-full px-3 py-2 rounded-lg bg-[var(--color-navy-800)] border border-[var(--color-navy-500)] text-gray-200 text-base focus:outline-none focus:border-[var(--color-accent-gold)] transition-colors";

  // Change email: server validates current password, reissues JWT bound to new email,
  // we refresh the in-store user record from the new token.
  const handleChangeEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      await authService.changeEmail(newEmail, emailPassword);
      // Critical: read email from the NEW token, not from the form input. Avoids
      // displaying a stale email if the server normalized/canonicalized the input.
      const email = getEmailFromToken();
      if (email) setUser({ email });
      setSuccess("Email updated successfully");
      // Close the form and clear inputs so a re-open starts clean.
      setShowEmailForm(false);
      setNewEmail("");
      setEmailPassword("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update email");
    } finally {
      setLoading(false);
    }
  };

  // Change password: client-side validation mirrors the server rules so users get
  // immediate feedback. Server still validates independently.
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      await authService.changePassword(currentPassword, newPassword);
      setSuccess("Password updated successfully");
      // Clear all fields after success — passwords MUST not persist in DOM state.
      setShowPasswordForm(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update password");
    } finally {
      setLoading(false);
    }
  };

  // Logout sequence MATTERS:
  //   1. cancelPendingPush() FIRST so any debounced push doesn't fire with a soon-to-be
  //      cleared token (which would 401 and trigger the auth-expired path mid-logout).
  //   2. logout() clears the JWT in services/api.
  //   3. Local state cleanup so the UI reflects logged-out immediately.
  const handleLogout = () => {
    cancelPendingPush();
    authService.logout();
    setUser(null);
    setSyncEnabled(false);
    setSyncStatus("idle");
  };

  // Toggle pause/resume of cloud sync without logging out. When pausing we cancel any
  // pending push and reset the badge to idle. When resuming we just flip the flag —
  // SyncInitializer effect 2 will re-engage on the next mutation.
  const handleToggleSync = () => {
    const next = !syncEnabled;
    setSyncEnabled(next);
    if (!next) {
      cancelPendingPush();
      setSyncStatus("idle");
    }
  };

  // Logged-out branch: show a CTA to begin cloud onboarding.
  // Order of the onClick steps matters: closeSettings() FIRST so the StorageChoiceModal
  // / AuthModal don't render under the still-open Settings modal.
  if (!user) {
    return (
      <div>
        <h3 className="text-sm font-medium text-gray-300 mb-2">Cloud Sync</h3>
        <Button
          variant="secondary"
          onClick={() => { closeSettings(); setStorageChoice("cloud"); }}
          className="w-full"
        >
          Set Up Cloud Sync
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-gray-300 mb-2">Account</h3>

      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-400">Email</span>
        <span className="text-gray-200">{user.email}</span>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {success && <p className="text-sm text-green-400">{success}</p>}

      {showEmailForm ? (
        <form onSubmit={handleChangeEmail} className="space-y-2">
          <input type="email" placeholder="New email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className={inputClass} required />
          <input type="password" placeholder="Current password" value={emailPassword} onChange={(e) => setEmailPassword(e.target.value)} className={inputClass} required />
          <div className="flex gap-2">
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? "Saving..." : "Save"}
            </Button>
            <Button variant="ghost" onClick={() => { setShowEmailForm(false); setError(null); }}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <Button variant="secondary" onClick={() => { setShowEmailForm(true); setShowPasswordForm(false); setError(null); setSuccess(null); }} className="w-full">
          Change Email
        </Button>
      )}

      {showPasswordForm ? (
        <form onSubmit={handleChangePassword} className="space-y-2">
          <input type="password" placeholder="Current password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className={inputClass} required />
          <input type="password" placeholder="New password (min 8 characters)" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={inputClass} required minLength={8} />
          <input type="password" placeholder="Confirm new password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={inputClass} required />
          <div className="flex gap-2">
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? "Saving..." : "Save"}
            </Button>
            <Button variant="ghost" onClick={() => { setShowPasswordForm(false); setError(null); }}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <Button variant="secondary" onClick={() => { setShowPasswordForm(true); setShowEmailForm(false); setError(null); setSuccess(null); }} className="w-full">
          Change Password
        </Button>
      )}

      <div className="flex items-center justify-between py-1">
        <span className="text-sm text-gray-400">Cloud Sync</span>
        <button
          onClick={handleToggleSync}
          className={`relative w-10 h-5 rounded-full transition-colors duration-200 ${
            syncEnabled ? "bg-[var(--color-accent-gold)]" : "bg-[var(--color-navy-500)]"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-200 ${
              syncEnabled ? "translate-x-5" : ""
            }`}
          />
        </button>
      </div>

      <Button variant="ghost" onClick={handleLogout} className="w-full text-gray-400">
        Log Out
      </Button>
    </div>
  );
}
