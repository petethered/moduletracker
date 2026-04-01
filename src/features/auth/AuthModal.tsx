import { useState, useEffect } from "react";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import { useStore } from "../../store";
import * as authService from "../../services/auth";
import { getEmailFromToken } from "../../services/api";
import { ApiError } from "../../services/api";

type AuthView = "login" | "register" | "reset-request" | "reset-confirm";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialView?: AuthView;
  resetToken?: string;
}

export function AuthModal({ isOpen, onClose, initialView = "login", resetToken = "" }: AuthModalProps) {
  const [view, setView] = useState<AuthView>(initialView);

  useEffect(() => {
    if (isOpen) setView(initialView);
  }, [isOpen, initialView]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const setUser = useStore((s) => s.setUser);
  const setSyncEnabled = useStore((s) => s.setSyncEnabled);

  const clearForm = () => {
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setNewPassword("");
    setError(null);
    setResetSent(false);
  };

  const switchView = (v: AuthView) => {
    clearForm();
    setView(v);
  };

  const handleSuccess = () => {
    const userEmail = getEmailFromToken();
    if (userEmail) {
      setUser({ email: userEmail });
      setSyncEnabled(true);
    }
    clearForm();
    onClose();
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await authService.login(email, password);
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

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
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
      setResetSent(true);
    } catch {
      setError("Connection failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
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

  const inputClass =
    "w-full px-3 py-2 rounded-lg bg-[var(--color-navy-800)] border border-[var(--color-navy-500)] text-gray-200 text-sm focus:outline-none focus:border-[var(--color-accent-gold)] transition-colors";

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
