import { apiFetch, setToken, clearToken } from "./api";

interface AuthResponse {
  token: string;
}

export async function register(email: string, password: string): Promise<void> {
  const { token } = await apiFetch<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  setToken(token);
}

export async function login(email: string, password: string): Promise<void> {
  const { token } = await apiFetch<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  setToken(token);
}

export function logout() {
  clearToken();
}

export async function requestPasswordReset(email: string): Promise<void> {
  await apiFetch("/auth/reset-request", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function confirmPasswordReset(token: string, newPassword: string): Promise<void> {
  const { token: jwt } = await apiFetch<AuthResponse>("/auth/reset-confirm", {
    method: "POST",
    body: JSON.stringify({ token, newPassword }),
  });
  setToken(jwt);
}

export async function changeEmail(newEmail: string, password: string): Promise<void> {
  const { token } = await apiFetch<{ ok: boolean; token: string }>("/auth/email", {
    method: "PUT",
    body: JSON.stringify({ newEmail, password }),
  });
  setToken(token);
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await apiFetch("/auth/password", {
    method: "PUT",
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}
