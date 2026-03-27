/**
 * api.js — Axios-based API client for PinWay frontend.
 * All requests include the JWT token from localStorage.
 */

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getToken() {
  return localStorage.getItem("pinway_token");
}

async function request(method, path, body = null) {
  const headers = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(`${BASE_URL}${path}`, options);

  if (res.status === 401) {
    // Token expired or invalid — clear auth and redirect to login
    localStorage.removeItem("pinway_token");
    window.location.href = "/login";
    return;
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const message = data.error || data.errors?.[0]?.msg || `Request failed (${res.status})`;
    throw new Error(message);
  }

  return data;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const auth = {
  login: (email, password) => request("POST", "/auth/login", { email, password }),
  register: (name, email, password) => request("POST", "/auth/register", { name, email, password }),
  me: () => request("GET", "/auth/me"),
  changePassword: (currentPassword, newPassword) =>
    request("POST", "/auth/change-password", { currentPassword, newPassword }),
};

// ─── PINs ─────────────────────────────────────────────────────────────────────
export const pins = {
  list: () => request("GET", "/pins"),
  get: (id) => request("GET", `/pins/${id}`),
  create: (data) => request("POST", "/pins", data),
  freeze: (id) => request("PATCH", `/pins/${id}/freeze`),
  revoke: (id) => request("PATCH", `/pins/${id}/revoke`),
  rotate: (id) => request("POST", `/pins/${id}/rotate`),
};

// ─── Transactions ─────────────────────────────────────────────────────────────
export const transactions = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request("GET", `/transactions${qs ? "?" + qs : ""}`);
  },
  authorize: (data) => request("POST", "/transactions/authorize", data),
};

// ─── Contacts ─────────────────────────────────────────────────────────────────
export const contacts = {
  list: () => request("GET", "/contacts"),
  create: (data) => request("POST", "/contacts", data),
  update: (id, data) => request("PUT", `/contacts/${id}`, data),
  remove: (id) => request("DELETE", `/contacts/${id}`),
};

export default { auth, pins, transactions, contacts };
