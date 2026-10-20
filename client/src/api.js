const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4001/api";
const TOKEN_KEY = "gather-token";

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const saveToken = (token) => localStorage.setItem(TOKEN_KEY, token);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

async function request(path, { body, ...options } = {}) {
  const headers = new Headers(options.headers);
  const token = getToken();
  if (body !== undefined) headers.set("content-type", "application/json");
  if (token) headers.set("authorization", `Bearer ${token}`);
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.message ?? "Something went wrong. Please try again.");
  return result;
}

export const api = {
  register: (body) => request("/auth/register", { method: "POST", body }),
  login: (body) => request("/auth/login", { method: "POST", body }),
  me: () => request("/auth/me"),
  channels: () => request("/channels"),
  createChannel: (body) => request("/channels", { method: "POST", body }),
  adminMembers: () => request("/admin/members"),
  updateMemberRole: (memberId, role) => request(`/admin/members/${memberId}/role`, { method: "PATCH", body: { role } }),
  messages: (channelId, before) => {
    const query = new URLSearchParams({ limit: "50" });
    if (before) query.set("before", before);
    return request(`/channels/${channelId}/messages?${query}`);
  },
  search: (q) => request(`/messages/search?q=${encodeURIComponent(q)}`),
  editMessage: (id, content) => request(`/messages/${id}`, { method: "PATCH", body: { content } }),
  deleteMessage: (id) => request(`/messages/${id}`, { method: "DELETE" }),
  toggleReaction: (id, emoji) => request(`/messages/${id}/reactions`, { method: "PUT", body: { emoji } }),
  summarize: (channelId) => request(`/channels/${channelId}/ai/summary`, { method: "POST", body: {} }),
  suggest: (channelId, prompt) => request(`/channels/${channelId}/ai/suggestion`, { method: "POST", body: { prompt } }),
};
