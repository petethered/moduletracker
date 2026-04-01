import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { useStore } from "../../store";
import * as authService from "../../services/auth";
import { getEmailFromToken } from "../../services/api";
import { ApiError } from "../../services/api";
import { cancelPendingPush } from "../../services/sync";

export function AccountSettings() {
  const user = useStore((s) => s.user);
  const syncEnabled = useStore((s) => s.syncEnabled);
  const setUser = useStore((s) => s.setUser);
  const setSyncEnabled = useStore((s) => s.setSyncEnabled);
  const setSyncStatus = useStore((s) => s.setSyncStatus);
  const setStorageChoice = useStore((s) => s.setStorageChoice);

  const [showEmailForm, setShowEmailForm] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const inputClass =
    "w-full px-3 py-2 rounded-lg bg-[var(--color-navy-800)] border border-[var(--color-navy-500)] text-gray-200 text-sm focus:outline-none focus:border-[var(--color-accent-gold)] transition-colors";

  const handleChangeEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      await authService.changeEmail(newEmail, emailPassword);
      const email = getEmailFromToken();
      if (email) setUser({ email });
      setSuccess("Email updated successfully");
      setShowEmailForm(false);
      setNewEmail("");
      setEmailPassword("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update email");
    } finally {
      setLoading(false);
    }
  };

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

  const handleLogout = () => {
    cancelPendingPush();
    authService.logout();
    setUser(null);
    setSyncEnabled(false);
    setSyncStatus("idle");
  };

  const handleToggleSync = () => {
    const next = !syncEnabled;
    setSyncEnabled(next);
    if (!next) {
      cancelPendingPush();
      setSyncStatus("idle");
    }
  };

  if (!user) {
    return (
      <div>
        <h3 className="text-sm font-medium text-gray-300 mb-2">Cloud Sync</h3>
        <Button
          variant="secondary"
          onClick={() => setStorageChoice("cloud")}
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
