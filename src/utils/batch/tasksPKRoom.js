/**
 * 比赛房间类任务
 * 包含: batchBookPKMatch
 */

/**
 * 创建比赛房间类任务执行器
 * @param {Object} deps - 依赖项
 * @returns {Object} 任务函数集合
 */
export function createTasksPKRoom(deps) {
  const {
    selectedTokens,
    tokens,
    tokenStatus,
    isRunning,
    shouldStop,
    ensureConnection,
    releaseConnectionSlot,
    connectionQueue,
    batchSettings,
    tokenStore,
    addLog,
    message,
    currentRunningTokenId,
    delayConfig,
  } = deps;

  // 预约比赛命令候选(按 PKRoom 命名规律推测; 若全部未被服务器接受,
  // 请抓包爱心点击的「发送」指令后替换)。命令不存在只会超时, 无副作用。
  const PK_BOOK_CMD_CANDIDATES = [
    "pkroom_bookfight",
    "pkroom_bookfightroom",
    "pkroom_bookmatch",
  ];

  /**
   * 尝试为当前账号预约比赛
   * @returns {boolean} 是否预约成功(或已预约过/无可预约)
   */
  const tryBookMatch = async (tokenId, tokenName) => {
    for (const cmd of PK_BOOK_CMD_CANDIDATES) {
      try {
        await tokenStore.sendMessageWithPromise(tokenId, cmd, {}, 4000);
        addLog({
          time: new Date().toLocaleTimeString(),
          message: `${tokenName} 预约比赛成功(${cmd})，开赛后可领取奖励`,
          type: "success",
        });
        return true;
      } catch (err) {
        const msg = err.message || "";
        // 11900050 = 预约成功(服务器以错误码携带感谢提示)
        if (err.code === 11900050 || msg.includes("11900050") || msg.includes("感谢您预约")) {
          addLog({
            time: new Date().toLocaleTimeString(),
            message: `${tokenName} 预约比赛成功：感谢您预约本场比赛，开赛后可领取奖励`,
            type: "success",
          });
          return true;
        }
        // 200020 = 已预约过/当前无可预约
        if (msg.includes("200020")) {
          addLog({
            time: new Date().toLocaleTimeString(),
            message: `${tokenName} 当前无可预约的比赛或已预约过，跳过`,
            type: "info",
          });
          return true;
        }
        // 命令不存在(响应超时)或其它错误 → 尝试下一个候选
      }
    }
    addLog({
      time: new Date().toLocaleTimeString(),
      message: `${tokenName} 未能确认预约结果(候选命令均未被服务器接受)，请在游戏内抓包爱心按钮的「发送」指令后反馈`,
      type: "warning",
    });
    return false;
  };

  /**
   * 一键预约比赛（四圣王等赛事详情页的爱心按钮）
   * 预约成功时服务器以 11900050 错误码携带「感谢您预约本场比赛，开赛后可领取奖励」
   */
  const batchBookPKMatch = async () => {
    if (selectedTokens.value.length === 0) return;

    isRunning.value = true;
    shouldStop.value = false;

    selectedTokens.value.forEach((id) => {
      tokenStatus.value[id] = "waiting";
    });

    const taskPromises = selectedTokens.value.map(async (tokenId) => {
      if (shouldStop.value) return;

      tokenStatus.value[tokenId] = "running";

      const token = tokens.value.find((t) => t.id === tokenId);

      try {
        addLog({
          time: new Date().toLocaleTimeString(),
          message: `=== 开始预约比赛: ${token.name} ===`,
          type: "info",
        });

        await ensureConnection(tokenId);

        const booked = await tryBookMatch(tokenId, token.name);
        if (booked) {
          tokenStatus.value[tokenId] = "completed";
        } else {
          tokenStatus.value[tokenId] = "failed";
          return;
        }

        await new Promise((r) => setTimeout(r, delayConfig.action));

        tokenStatus.value[tokenId] = "completed";
      } catch (error) {
        console.error(error);
        tokenStatus.value[tokenId] = "failed";
        addLog({
          time: new Date().toLocaleTimeString(),
          message: `${token.name} 预约比赛过程出错: ${error.message || "未知错误"}`,
          type: "error",
        });
      } finally {
        tokenStore.closeWebSocketConnection(tokenId);
        releaseConnectionSlot();
        addLog({
          time: new Date().toLocaleTimeString(),
          message: `${token.name} 连接已关闭  (队列: ${connectionQueue.active}/${batchSettings.maxActive})`,
          type: "info",
        });
      }
    });

    await Promise.all(taskPromises);

    isRunning.value = false;
    currentRunningTokenId.value = null;
    message.success("批量预约比赛结束");
  };

  return {
    batchBookPKMatch,
  };
}
