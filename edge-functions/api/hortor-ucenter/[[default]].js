// EdgeOne Edge Functions: /api/hortor-ucenter/* → https://ucenter-app-server.hortorgames.com/*
// 移植自 worker.js 同名代理。ucenter 网关按 Host 路由,因此必须直连
// ucenter-app-server 域名(与 Cloudflare Workers 相同的限制:无法伪造上游 Host)。

const TARGET = "https://ucenter-app-server.hortorgames.com";
const PREFIX = "/api/hortor-ucenter/";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Requested-With",
};

const EXTRA_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Linux; Android 12; ALN-AL80 Build/HUAWEIALN-AL80; wv) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Version/4.0 Chrome/114.0.5735.196 Mobile Safari/537.36",
  Accept: "application/json",
  "Content-Type": "application/json; charset=utf-8",
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
