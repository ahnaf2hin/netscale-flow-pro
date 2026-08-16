// Drop-in replacement for the Base44 SDK client. Same call shapes as
// `base44.entities.X.list/filter/get/create/update/delete/bulkCreate/bulkUpdate`,
// `base44.auth.*`, `base44.functions.invoke`, `base44.integrations.Core.*` — backed by
// our own Express + MySQL API instead of the Base44 cloud, so no page/component code
// needed to change.

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";
const TOKEN_KEY = "netscale_token";

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request(path, { method = "GET", body, headers, isForm } = {}) {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      ...(isForm ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
  });

  const contentType = res.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await res.json().catch(() => ({})) : await res.text();

  if (!res.ok) {
    const message = (data && data.error) || `Request failed (${res.status})`;
    const err = new Error(message);
    err.response = { data, status: res.status };
    throw err;
  }
  return data;
}

function qs(params) {
  const parts = [];
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
  }
  return parts.length ? `?${parts.join("&")}` : "";
}

function entityClient(name) {
  return {
    list: (sort, limit) => request(`/api/entities/${name}${qs({ sort, limit })}`),
    filter: (query, sort, limit) =>
      request(`/api/entities/${name}${qs({ filter: JSON.stringify(query || {}), sort, limit })}`),
    get: (id) => request(`/api/entities/${name}/${id}`),
    create: (data) => request(`/api/entities/${name}`, { method: "POST", body: data }),
    update: (id, data) => request(`/api/entities/${name}/${id}`, { method: "PATCH", body: data }),
    delete: (id) => request(`/api/entities/${name}/${id}`, { method: "DELETE" }),
    bulkCreate: (records) => request(`/api/entities/${name}/bulk-create`, { method: "POST", body: records }),
    bulkUpdate: (records) => request(`/api/entities/${name}/bulk-update`, { method: "PATCH", body: records }),
    // No real-time push backend — callers already poll as a fallback, so this is a safe no-op.
    subscribe: () => () => {},
  };
}

export const base44 = {
  auth: {
    async me() {
      return request("/api/auth/me");
    },
    async loginViaEmailPassword(email, password) {
      const data = await request("/api/auth/login", { method: "POST", body: { email, password } });
      setToken(data.access_token);
      return data;
    },
    async register({ email, password, full_name }) {
      return request("/api/auth/register", { method: "POST", body: { email, password, full_name } });
    },
    async verifyOtp({ email, otpCode }) {
      const data = await request("/api/auth/verify-otp", { method: "POST", body: { email, otpCode } });
      if (data.access_token) setToken(data.access_token);
      return data;
    },
    async resendOtp(email) {
      return request("/api/auth/resend-otp", { method: "POST", body: { email } });
    },
    async resetPasswordRequest(email) {
      return request("/api/auth/forgot-password", { method: "POST", body: { email } });
    },
    async resetPassword({ resetToken, newPassword }) {
      return request("/api/auth/reset-password", { method: "POST", body: { resetToken, newPassword } });
    },
    setToken(token) {
      setToken(token);
    },
    logout(redirectUrl) {
      setToken(null);
      if (redirectUrl) window.location.href = redirectUrl;
    },
    redirectToLogin(fromUrl) {
      const target = fromUrl || window.location.href;
      window.location.href = `/login?redirect=${encodeURIComponent(target)}`;
    },
    loginWithProvider() {
      window.alert("Google sign-in isn't configured on this server. Please use email + password.");
    },
  },

  entities: new Proxy(
    {},
    {
      get: (_target, name) => entityClient(String(name)),
    }
  ),

  functions: {
    async invoke(name, payload) {
      const data = await request(`/api/functions/${name}`, { method: "POST", body: payload || {} });
      return { data };
    },
  },

  integrations: {
    Core: {
      async UploadFile({ file }) {
        const form = new FormData();
        form.append("file", file);
        return request("/api/integrations/upload-file", { method: "POST", body: form, isForm: true });
      },
      async ExtractDataFromUploadedFile({ file_url, json_schema }) {
        return request("/api/integrations/extract-data", { method: "POST", body: { file_url, json_schema } });
      },
      async SendEmail({ to, subject, body }) {
        return request("/api/integrations/send-email", { method: "POST", body: { to, subject, body } });
      },
    },
  },
};
