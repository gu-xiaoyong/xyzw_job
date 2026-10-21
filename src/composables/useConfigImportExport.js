import { ref } from "vue";
import { useMessage } from "naive-ui";
import { uploadForRelayUrl } from "@/utils/fileRelay";
import { toBase64Url } from "@/utils/encoding";

/**
 * 配置导入/导出 composable
 * 导出 token+定时任务配置（文件下载+中转链接兜底）、导入恢复、剪贴板复制。
 * @param {object} deps
 * @param {object} deps.batchSettings 批量设置 reactive
 * @param {import("vue").Ref<Array>} deps.scheduledTasks 定时任务列表
 * @param {Function} deps.saveScheduledTasks 定时任务写盘
 * @param {import("vue").ComputedRef<Array>} deps.tokens 账号列表
 */
export function useConfigImportExport(deps) {
  const { batchSettings, scheduledTasks, saveScheduledTasks, tokens } = deps;
  const message = useMessage();

  // 导出配置兜底:无法下载文件时展示文本供复制
  const showExportTextModal = ref(false);
  const exportJsonText = ref("");
  // 中转下载链接(真正的 https 附件下载,可复制到系统浏览器打开)
  const exportRelayUrl = ref("");

  // ======================

  // Export all tokens and scheduled tasks configuration
  const exportConfig = async () => {
    try {
      // Get all valid token IDs
      const validTokenIds = new Set(tokens.value.map((t) => t.id));

      // Filter scheduled tasks: remove invalid token IDs from selectedTokens
      const filteredScheduledTasks = scheduledTasks.value
        .map((task) => ({
          ...task,
          selectedTokens:
            task.selectedTokens?.filter((tokenId) =>
              validTokenIds.has(tokenId),
            ) || [],
        }))
        .filter((task) => task.selectedTokens.length > 0); // Remove tasks with no valid tokens

      // Gather token settings
      const tokenSettings = [];
      tokens.value.forEach((token) => {
        const settings = localStorage.getItem(`daily-settings:${token.id}`);
        if (settings) {
          try {
            tokenSettings.push({
              tokenId: token.id,
              settings: JSON.parse(settings),
            });
          } catch (e) {
            console.warn(`Failed to parse settings for token ${token.id}`, e);
          }
        }
      });

      const exportData = {
        version: "1.1",
        exportTime: new Date().toISOString(),
        tokens: tokens.value.map((t) => ({
          id: t.id,
          name: t.name,
          token: t.token,
          server: t.server,
          wsUrl: t.wsUrl,
          remark: t.remark,
          importMethod: t.importMethod,
          sourceUrl: t.sourceUrl,
          upgradedToPermanent: true,
          upgradedAt: t.upgradedAt,
          updatedAt: t.updatedAt,
        })),
        scheduledTasks: filteredScheduledTasks,
        batchSettings: {
          boxCount: batchSettings.boxCount,
          fishCount: batchSettings.fishCount,
          recruitCount: batchSettings.recruitCount,
          defaultBoxType: batchSettings.defaultBoxType,
          defaultFishType: batchSettings.defaultFishType,
          blackMarketPurchaseList: batchSettings.blackMarketPurchaseList,
          commandDelay: batchSettings.commandDelay,
          taskDelay: batchSettings.taskDelay,
          actionDelay: batchSettings.actionDelay,
          battleDelay: batchSettings.battleDelay,
          refreshDelay: batchSettings.refreshDelay,
          longDelay: batchSettings.longDelay,
          maxActive: batchSettings.maxActive,
          tokenListColumns: batchSettings.tokenListColumns,
        },
        tokenSettings,
      };

      const json = JSON.stringify(exportData, null, 2);
      const filename = `xyzw_config_${new Date().toISOString().slice(0, 10)}.json`;
      const blob = new Blob([json], { type: "application/json" });

      // 生成中转下载链接:小文件直接编码进 URL,大文件走上传中转
      exportRelayUrl.value = "";
      try {
        if (
          location.protocol.startsWith("http") &&
          typeof btoa === "function"
        ) {
          if (blob.size <= 60 * 1024) {
            exportRelayUrl.value = `${location.origin}/api/download-file?n=${encodeURIComponent(filename)}&d=${toBase64Url(await blob.arrayBuffer())}`;
          } else if (blob.size <= 8 * 1024 * 1024) {
            exportRelayUrl.value = await uploadForRelayUrl(filename, blob);
          }
        }
      } catch (e) {
        exportRelayUrl.value = "";
      }

      // 手机/APK 的 WebView 无法把 blob 下载落盘:
      // 优先调起系统分享(可"保存到文件"),不支持时展示文本供复制
      const file = new File([blob], filename, { type: "application/json" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: filename });
          message.success("已调起系统分享,可选择保存到文件或发送给其他设备");
        } catch (e) {
          if (e && e.name === "AbortError") return;
          exportJsonText.value = json;
          showExportTextModal.value = true;
        }
        return;
      }

      if (/Android|iPhone|iPad|Mobi/i.test(navigator.userAgent)) {
        exportJsonText.value = json;
        showExportTextModal.value = true;
        return;
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      message.success(
        `导出成功: ${exportData.tokens.length} 个账号, ${exportData.scheduledTasks.length} 个定时任务`,
      );
    } catch (error) {
      console.error("Export failed:", error);
      message.error(`导出失败: ${error.message}`);
    }
  };

  // 复制文本到剪贴板(先同步 execCommand——必须在用户手势内执行;WebView 的 async clipboard 常被拒绝)
  const copyTextWithFeedback = async (text) => {
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
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        return await navigator.clipboard
          .writeText(text)
          .then(() => true)
          .catch(() => false);
      }
    } catch (e) {
      // ignore
    }
    return false;
  };

  const copyExportText = async () => {
    const ok = await copyTextWithFeedback(exportJsonText.value);
    if (ok) {
      message.success("配置内容已复制到剪贴板");
    } else {
      message.info("自动复制失败,请长按文本框手动全选复制");
    }
  };

  const copyExportLink = async () => {
    const ok = await copyTextWithFeedback(exportRelayUrl.value);
    if (ok) {
      message.success("链接已复制,请用系统浏览器打开下载");
    } else {
      message.info("自动复制失败,请长按链接手动复制");
    }
  };

  const openExportLink = () => {
    location.href = exportRelayUrl.value;
  };

  // Import tokens and scheduled tasks configuration
  const importConfig = async ({ file }) => {
    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const importData = JSON.parse(e.target.result);

          // Validate structure
          if (
            !importData.version ||
            !importData.tokens ||
            !importData.scheduledTasks
          ) {
            message.error("无效的配置文件格式");
            return;
          }

          let importedTokens = 0;
          let importedTasks = 0;

          // Import tokens
          if (Array.isArray(importData.tokens)) {
            importData.tokens.forEach((token) => {
              // Check if token already exists
              const exists = gameTokens.value.some(
                (t) => t.token === token.token || t.id === token.id,
              );
              if (!exists && token.token) {
                // Add new token directly to gameTokens (useLocalStorage)
                gameTokens.value.push({
                  id:
                    token.id ||
                    `token_${Date.now()}${Math.random().toString(36).slice(2)}`,
                  name: token.name || "",
                  token: token.token,
                  server: token.server || "",
                  wsUrl: token.wsUrl || null,
                  remark: token.remark || "",
                  importMethod: "import",
                  sourceUrl: token.sourceUrl || null,
                  upgradedToPermanent: true,
                  upgradedAt: token.upgradedAt || null,
                  updatedAt: token.updatedAt || new Date().toISOString(),
                  createdAt: new Date().toISOString(),
                  lastUsed: new Date().toISOString(),
                });
                importedTokens++;
              }
            });
          }

          // Import scheduled tasks
          if (Array.isArray(importData.scheduledTasks)) {
            importData.scheduledTasks.forEach((task) => {
              // Check if task already exists
              const exists = scheduledTasks.value.some((t) => t.id === task.id);
              if (!exists && task.id) {
                scheduledTasks.value.push(task);
                importedTasks++;
              }
            });
            saveScheduledTasks();
          }

          // Import batch settings if provided
          if (importData.batchSettings) {
            Object.assign(batchSettings, importData.batchSettings);
            batchSettings.blackMarketPurchaseList =
              normalizeBlackMarketPurchaseList(
                batchSettings.blackMarketPurchaseList?.length
                  ? batchSettings.blackMarketPurchaseList
                  : createDefaultBlackMarketPurchaseList(),
              );
            saveBatchSettings();
          }

          // Import token settings
          if (Array.isArray(importData.tokenSettings)) {
            importData.tokenSettings.forEach((item) => {
              if (item.tokenId && item.settings) {
                localStorage.setItem(
                  `daily-settings:${item.tokenId}`,
                  JSON.stringify(item.settings),
                );
              }
            });
          }

          message.success(
            `导入成功: ${importedTokens} 个新账号, ${importedTasks} 个新定时任务`,
          );
        } catch (parseError) {
          console.error("Parse error:", parseError);
          message.error("解析配置文件失败");
        }
      };
      reader.readAsText(file.file);
    } catch (error) {
      console.error("Import failed:", error);
      message.error(`导入失败: ${error.message}`);
    }
  };

  return {
    showExportTextModal,
    exportJsonText,
    exportRelayUrl,
    exportConfig,
    copyExportText,
    copyExportLink,
    openExportLink,
    importConfig,
    copyTextWithFeedback,
  };
}
