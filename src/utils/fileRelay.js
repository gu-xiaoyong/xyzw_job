import { toBase64Url } from "./encoding";

/**
 * 生成 /api/download-file 中转下载链接(数据编码在 URL 里,适合小文件)。
 * 超过 maxBytes 或环境不允许时返回 ""。
 */
export function buildFileRelayUrl(fileName, buffer, maxBytes = 60 * 1024) {
  try {
    if (!location.protocol.startsWith("http")) return "";
    if (!buffer || buffer.byteLength > maxBytes) return "";
    if (typeof btoa !== "function") return "";
    return `${location.origin}/api/download-file?n=${encodeURIComponent(fileName)}&d=${toBase64Url(buffer)}`;
  } catch (e) {
    return "";
  }
}

/**
 * 大文件兜底:把文件 POST 到 /api/upload-file,
 * 服务端缓存约 30 分钟并返回一个普通 https 下载链接(适合图片等大文件)。
 * 失败返回 ""。
 */
export async function uploadForRelayUrl(fileName, blob) {
  try {
    if (!location.protocol.startsWith("http")) return "";
    if (!blob || blob.size > 8 * 1024 * 1024) return "";
    const resp = await fetch(
      `/api/upload-file?n=${encodeURIComponent(fileName)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: blob,
      },
    );
    if (!resp.ok) return "";
    const data = await resp.json();
    const u = data && data.url;
    return u ? new URL(u, location.origin).href : "";
  } catch (e) {
    return "";
  }
}

/**
 * 在用户手势内同步复制的通用实现(WebView 的 async clipboard 常被拒绝,必须先走 execCommand)。
 */
export function copyTextSyncFirst(text) {
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "-9999px";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    let copied = false;
    try {
      ta.focus();
      ta.select();
      ta.setSelectionRange(0, text.length);
      copied = document.execCommand("copy");
    } catch (e) {
      copied = false;
    } finally {
      document.body.removeChild(ta);
    }
    if (copied) return true;
  } catch (e) {
    // fallthrough
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard
      .writeText(text)
      .then(() => true)
      .catch(() => false);
  }
  return false;
}

export const isMobileEnv = () =>
  /Android|iPhone|iPad|Mobi/i.test(navigator.userAgent);
