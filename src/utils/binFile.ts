import { g_utils } from "@/utils/bonProtocol";

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
    window.alert(
      "已尝试下载。如果没有生成文件(常见于 App 内置浏览器),请复制本页地址到系统浏览器打开后重新下载。",
    );
  }
  return "downloaded";
}
