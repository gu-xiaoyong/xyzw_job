
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    };

    // Handle OPTIONS request
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Proxy configuration
    const proxies = [
      {
        prefix: '/api/hortor-ucenter',
        // ucenter 网关按 Host 路由：直连 ucenter 域名，前缀剥离后剩余的
        // /ucenter-app-server/... 即上游真实路径。Cloudflare Workers 的 fetch
        // 无法伪造 Host，因此不能借道 comb-platform
        target: 'https://ucenter-app-server.hortorgames.com',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Linux; Android 12; ALN-AL80 Build/HUAWEIALN-AL80; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/114.0.5735.196 Mobile Safari/537.36',
          'Accept': 'application/json',
          'Content-Type': 'application/json; charset=utf-8'
        }
      },
      {
        prefix: '/api/weixin-long',
        target: 'https://long.open.weixin.qq.com',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Linux; Android 7.0; Mi-4c Build/NRD90M; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/53.0.2785.49 Mobile MQQBrowser/6.2 TBS/043632 Safari/537.36 MicroMessenger/6.6.1.1220(0x26060135) NetType/WIFI Language/zh_CN',
          'Accept': '*/*',
          'Referer': 'https://open.weixin.qq.com/'
        }
      },
      {
        prefix: '/api/weixin',
        target: 'https://open.weixin.qq.com',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Linux; Android 7.0; Mi-4c Build/NRD90M; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/53.0.2785.49 Mobile MQQBrowser/6.2 TBS/043632 Safari/537.36 MicroMessenger/6.6.1.1220(0x26060135) NetType/WIFI Language/zh_CN',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Referer': 'https://open.weixin.qq.com/'
        }
      },
      {
        prefix: '/api/hortor',
        target: 'https://comb-platform.hortorgames.com',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Linux; Android 12; 23117RK66C Build/V417IR; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/95.0.4638.74 Mobile Safari/537.36',
          'Accept': '*/*',
          'Host': 'comb-platform.hortorgames.com',
          'Connection': 'keep-alive',
          'Content-Type': 'text/plain; charset=utf-8',
          'Origin': 'https://open.weixin.qq.com',
          'Referer': 'https://open.weixin.qq.com/'
        }
      }
    ].sort((a, b) => b.prefix.length - a.prefix.length); // Sort by length descending to match longest prefix first

    // Find matching proxy
    const proxy = proxies.find(p => url.pathname.startsWith(p.prefix));

    if (proxy) {
      // Construct new URL
      const targetUrl = new URL(proxy.target);
      targetUrl.pathname = url.pathname.replace(proxy.prefix, '') || '/';
      targetUrl.search = url.search;

      // Prepare request headers
      const newHeaders = new Headers(request.headers);
      
      // Override headers based on proxy config
      Object.entries(proxy.headers).forEach(([key, value]) => {
        newHeaders.set(key, value);
      });

      // Special handling for Host header (Cloudflare might override it, but good to set intention)
      if (proxy.headers.Host) {
        newHeaders.set('Host', proxy.headers.Host);
      }

      // Create new request
      const newRequest = new Request(targetUrl.toString(), {
        method: request.method,
        headers: newHeaders,
        body: request.body,
        redirect: 'follow'
      });

      try {
        const response = await fetch(newRequest);
        
        // Re-create response to add CORS headers
        const newResponse = new Response(response.body, response);
        Object.entries(corsHeaders).forEach(([key, value]) => {
          newResponse.headers.set(key, value);
        });
        
        return newResponse;
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }
    }

    // Stateless file relay: binary carried in query string (base64url),
    // served back as a standard attachment download. Used by App WebView
    // environments that cannot save blob/object-url downloads.
    // /api/bin-file is kept as a legacy alias of /api/download-file.
    if (url.pathname === '/api/download-file' || url.pathname === '/api/bin-file') {
      if (request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
      }
      try {
        const name = (url.searchParams.get('n') || 'token.bin').slice(0, 120);
        const data = url.searchParams.get('d') || '';
        if (!data || data.length > 90000) {
          throw new Error('file data missing or too large');
        }
        const normalized = data.replace(/-/g, '+').replace(/_/g, '/');
        const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
        const bin = Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
        const asciiName = name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
        return new Response(bin, {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/octet-stream',
            'Content-Disposition': `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(name)}`,
            'Cache-Control': 'no-store',
          },
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message || 'invalid data' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Temporary file relay: client POSTs bytes, worker caches them under a
    // random id (Cache API, ~30min TTL) and returns a plain https download URL.
    // Serves cases where the data exceeds URL-length limits (e.g. table images).
    if (url.pathname === '/api/upload-file' && request.method === 'POST') {
      try {
        const name = (url.searchParams.get('n') || 'file.bin').slice(0, 120);
        const body = await request.arrayBuffer();
        if (!body || body.byteLength === 0) throw new Error('empty body');
        if (body.byteLength > 8 * 1024 * 1024) {
          throw new Error('file too large (max 8MB)');
        }
        const id = (crypto.randomUUID && crypto.randomUUID()) ||
          String(Date.now()) + Math.random().toString(16).slice(2);
        const relayUrl = `${url.origin}/api/relay-file/${id}`;
        const asciiName = name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
        const cachedResponse = new Response(body, {
          headers: {
            'Content-Type': 'application/octet-stream',
            'Content-Disposition': `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(name)}`,
            'Cache-Control': 'public, max-age=1800',
          },
        });
        await caches.default.put(new Request(relayUrl), cachedResponse);
        return new Response(JSON.stringify({ url: relayUrl }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message || 'upload failed' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Serve relayed files cached by /api/upload-file (download as attachment).
    if (url.pathname.startsWith('/api/relay-file/') && request.method === 'GET') {
      const cached = await caches.default.match(request);
      if (cached) {
        const headers = new Headers(cached.headers);
        Object.entries(corsHeaders).forEach(([k, v]) => headers.set(k, v));
        return new Response(cached.body, { status: 200, headers });
      }
      return new Response('文件不存在或已过期,请重新生成下载链接', {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }

    // Serve static assets (Cloudflare Pages)
    // If env.ASSETS is available (e.g. in Cloudflare Pages Functions), use it to fetch static assets
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    // Default response for non-proxy paths
    return new Response('Not Found', { status: 404, headers: corsHeaders });
  }
};
