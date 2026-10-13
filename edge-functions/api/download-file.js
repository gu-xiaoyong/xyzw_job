// EdgeOne Edge Functions: /api/download-file?n=<name>&d=<base64url>
// 移植自 worker.js:无状态文件中继,数据编码在 URL 里,原样下载为附件。
// 供无法保存 blob 下载的 App WebView 环境使用。/api/bin-file 是其旧别名。

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Requested-With",
};

function corsResponse(body, init = {}) {
  const headers = new Headers(init.headers || {});
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    headers.set(key, value);
  }
  return new Response(body, { ...init, headers });
}

function jsonError(message, status) {
  return corsResponse(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function handleDownload(request) {
  try {
    const url = new URL(request.url);
    const name = (url.searchParams.get("n") || "token.bin").slice(0, 120);
    const data = url.searchParams.get("d") || "";
    if (!data || data.length > 90000) {
      throw new Error("file data missing or too large");
    }
    const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    const bin = Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
    const asciiName = name.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_");
    return corsResponse(bin, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(name)}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return jsonError(e.message || "invalid data", 400);
  }
}

export async function onRequest(context) {
  const request = context.request ?? context;
  if (request.method === "OPTIONS") {
    return corsResponse(null, { status: 204 });
  }
  return handleDownload(request);
}
