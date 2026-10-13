// EdgeOne Edge Functions: /api/weixin/* → https://open.weixin.qq.com/*
// 移植自 worker.js 同名代理。/api/weixin-long/ 是独立目录,不会被本路由遮蔽。

const TARGET = "https://open.weixin.qq.com";
const PREFIX = "/api/weixin/";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Requested-With",
};

const EXTRA_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Linux; Android 7.0; Mi-4c Build/NRD90M; wv) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Version/4.0 Chrome/53.0.2785.49 Mobile MQQBrowser/6.2 TBS/043632 " +
    "Safari/537.36 MicroMessenger/6.6.1.1220(0x26060135) NetType/WIFI Language/zh_CN",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
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
