export class ApiError extends Error {
  constructor(message, { status = 0, data = null, response = null } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
    this.response = response;
  }
}

const parseResponse = async (response) => {
  if (response.status === 204) return null;

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  const text = await response.text();
  return text || null;
};

export const apiRequest = async (path, options = {}) => {
  const headers = new Headers(options.headers || {});
  const hasBody = options.body !== undefined && options.body !== null;
  let body = options.body;

  if (hasBody && typeof body !== "string") {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(path, {
      ...options,
      body,
      credentials: "include",
      headers,
    });
  } catch (error) {
    throw new ApiError(error.message || "Unable to reach the API", { cause: error });
  }
  const data = await parseResponse(response);

  if (!response.ok) {
    const message =
      (data && typeof data === "object" && data.error) ||
      (typeof data === "string" && data) ||
      `Request failed with status ${response.status}`;
    throw new ApiError(message, { status: response.status, data, response });
  }

  return data;
};

export const apiClient = {
  request: apiRequest,
  get: (path, options = {}) => apiRequest(path, { ...options, method: "GET" }),
  post: (path, body, options = {}) =>
    apiRequest(path, { ...options, method: "POST", body }),
  patch: (path, body, options = {}) =>
    apiRequest(path, { ...options, method: "PATCH", body }),
  delete: (path, options = {}) => apiRequest(path, { ...options, method: "DELETE" }),
};

export default apiClient;
