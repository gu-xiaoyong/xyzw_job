// EdgeOne Edge Functions: /api/hortor/* → https://comb-platform.hortorgames.com/*
// 移植自 worker.js 同名代理(Host 由 fetch 目标地址决定,无法也不需要伪造;
// Connection 属逐跳头,由边缘与上游自行管理)。

const TARGET = "https://comb-platform.hortorgames.com";
const PREFIX = "/api/hortor/";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Requested-With",
};

const EXTRA_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Linux; Android 12; 23117RK66C Build/V417IR; wv) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Version/4.0 Chrome/95.0.4638.74 Mobile Safari/537.36",
  Accept: "*/*",
  "Content-Type": "text/plain; charset=utf-8",
  Origin: "https://open.weixin.qq.com",
  Referer: "https://open.weixin.qq.com/",
};

function corsResponse(body, init = {}) {
  const headers = new Headers(init.headers || {});
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    headers.set(key, value);
  }
  return new Response(body, { ...init, headers });
}

async function proxy(request) {
  const url = new URL(request.url);
  const target = TARGET + url.pathname.slice(PREFIX.length - 1) + url.search;

  const headers = new Headers(request.headers);
  for (const [key, value] of Object.entries(EXTRA_HEADERS)) {
    headers.set(key, value);
  }
  headers.delete("Host");

  const init = { method: request.method, headers, redirect: "follow" };
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = request.body;
  }

  try {
    const response = await fetch(target, init);
    return corsResponse(response.body, response);
  } catch (e) {
    return corsResponse(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export async function onRequest(context) {
  const request = context.request ?? context;
  if (request.method === "OPTIONS") {
    return corsResponse(null, { status: 204 });
  }
  return proxy(request);
}
