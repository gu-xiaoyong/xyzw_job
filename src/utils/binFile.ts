import { g_utils } from "@/utils/bonProtocol";
import { toBase64Url } from "@/utils/encoding";

type BinaryData = ArrayBuffer | Uint8Array;

export interface RoleBinFileInfo {
  serverId: string | number;
  roleId?: string | number;
  name?: string;
}

function toArrayBuffer(data: BinaryData): ArrayBuffer {
  if (data instanceof ArrayBuffer) return data;
  return data.buffer.slice(
    data.byteOffset,
    data.byteOffset + data.byteLength,
  ) as ArrayBuffer;
}

/**
 * WebView 内无法直接保存下载文件时的兜底弹层:
 * 提供一个真正的 https 下载链接(数据经 /api/bin-file 中转),
 * 可复制到系统浏览器打开下载,或尝试在当前环境直接下载。
 */
function showBinRelayDialog(fileName: string, relayUrl: string) {
  const existing = document.getElementById("bin-download-fallback");
  if (existing) existing.remove();

  const wrap = document.createElement("div");
  wrap.id = "bin-download-fallback";
  wrap.style.cssText =
    "position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:24px;";

  const card = document.createElement("div");
  card.style.cssText =
    "background:#fff;border-radius:12px;padding:18px;max-width:420px;width:100%;font-family:system-ui,sans-serif;font-size:14px;color:#333;box-sizing:border-box;";

  const title = document.createElement("div");
  title.textContent = "无法在当前环境直接保存文件";
  title.style.cssText = "font-weight:600;font-size:16px;margin-bottom:8px;";

  const desc = document.createElement("div");
  desc.style.cssText = "line-height:1.6;margin-bottom:10px;";
  desc.append(
    "可复制下方链接,用系统浏览器(如 Chrome)打开即可下载 ",
    Object.assign(document.createElement("b"), { textContent: fileName }),
    "。",
  );

  const input = document.createElement("textarea");
  input.value = relayUrl;
  input.readOnly = true;
  input.style.cssText =
    "width:100%;height:80px;box-sizing:border-box;font-size:12px;padding:8px;border-radius:8px;border:1px solid #ddd;resize:none;";

  const row = document.createElement("div");
  row.style.cssText = "display:flex;gap:8px;margin-top:12px;";

  const mkBtn = (text: string, bg: string, color: string) => {
    const b = document.createElement("button");
    b.textContent = text;
    b.style.cssText = `flex:1;padding:10px 0;border:none;border-radius:8px;font-size:14px;background:${bg};color:${color};`;
    return b;
  };

  const copyBtn = mkBtn("复制链接", "#18a058", "#fff");
  const openBtn = mkBtn("尝试下载", "#2080f0", "#fff");
  const closeBtn = mkBtn("关闭", "#eeeeee", "#555555");

  copyBtn.onclick = async () => {
    let copied = false;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(relayUrl);
        copied = true;
      }
    } catch (e) {
      // fallthrough
    }
    if (!copied) {
      input.select();
      copied = document.execCommand("copy");
    }
    copyBtn.textContent = copied ? "已复制" : "复制失败,请长按链接手动复制";
    setTimeout(() => (copyBtn.textContent = "复制链接"), 2000);
  };
  openBtn.onclick = () => {
    location.href = relayUrl;
  };
  const close = () => wrap.remove();
  closeBtn.onclick = close;
  wrap.onclick = (e) => {
    if (e.target === wrap) close();
  };

  row.append(copyBtn, openBtn, closeBtn);
  card.append(title, desc, input, row);
  wrap.appendChild(card);
  document.body.appendChild(wrap);
}

/** Extract the login envelope carried by a BIN file. */
export function getBinPayload(data: BinaryData): Record<string, any> {
  const message = g_utils.parse(toArrayBuffer(data));
  const payload = message.getData() || (message as any)._raw;
  if (!payload || typeof payload !== "object") {
    throw new Error("BIN 登录凭据解析为空");
  }
  return payload;
}

/** Build the LZ4 (`pl`) BIN format used by the game client for one role. */
export function buildRoleBin(
  payload: Record<string, any>,
  serverId: string | number,
): ArrayBuffer {
  return g_utils.encode(
    { ...payload, serverId: Number(serverId) },
    "lx",
  ) as ArrayBuffer;
}

/** Re-encodes an existing BIN as the game-compatible LZ4 (`pl`) format. */
export function normalizeBinForDownload(data: BinaryData): ArrayBuffer {
  const payload = getBinPayload(data);
  return buildRoleBin(payload, payload.serverId);
}

export function getRoleBinFileName({
  serverId,
  roleId,
  name,
}: RoleBinFileInfo): string {
  let normalizedServerId = Number(serverId);
  let roleIndex = 0;
  if (normalizedServerId >= 2000000) {
    roleIndex = 2;
    normalizedServerId -= 2000000;
  } else if (normalizedServerId >= 1000000) {
    roleIndex = 1;
    normalizedServerId -= 1000000;
  }

  const server = Number.isFinite(normalizedServerId)
    ? normalizedServerId - 27
    : "未知";
  const safeName = String(name || "未命名角色").replace(/[\\/:*?"<>|]/g, "_");
  const safeRoleId = String(roleId || "未知").replace(/[\\/:*?"<>|]/g, "_");
  return `bin-${server}服-${roleIndex}-${safeRoleId}-${safeName}.bin`;
}

export type BinDownloadResult = "shared" | "downloaded" | "cancelled";

/**
 * 下载 BIN 文件。
 * 手机/APK 的 WebView 不会处理 blob 下载(静默失败),因此优先调起系统分享
 * (分享面板中可"保存到文件"),不支持分享时退回普通下载,移动端附加提示。
 */
export async function downloadBinFile(
  fileName: string,
  data: BinaryData,
): Promise<BinDownloadResult> {
  const blob = new Blob([toArrayBuffer(data)], {
    type: "application/octet-stream",
  });

  const triggerDownload = () => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const nav = navigator as Navigator & {
    canShare?: (data: ShareData) => boolean;
  };
  if (nav.canShare) {
    const file = new File([blob], fileName, {
      type: "application/octet-stream",
    });
    if (nav.canShare({ files: [file] })) {
      try {
        await nav.share({ files: [file], title: fileName });
        return "shared";
      } catch (e: any) {
        if (e && e.name === "AbortError") return "cancelled";
        // 分享调起失败,退回普通下载
      }
    }
  }

  triggerDownload();

  if (/Android|iPhone|iPad|Mobi/i.test(navigator.userAgent)) {
    let relayUrl = "";
    try {
      if (
        location.protocol.startsWith("http") &&
        blob.size <= 64 * 1024 &&
        typeof btoa === "function"
      ) {
        relayUrl = `${location.origin}/api/bin-file?n=${encodeURIComponent(fileName)}&d=${toBase64Url(await blob.arrayBuffer())}`;
      }
    } catch (e) {
      relayUrl = "";
    }
    if (relayUrl) {
      showBinRelayDialog(fileName, relayUrl);
    } else {
      window.alert(
        "已尝试下载。如果没有生成文件(常见于 App 内置浏览器),请复制本页地址到系统浏览器打开后重新下载。",
      );
    }
  }
  return "downloaded";
}
