/**
 * 功法类任务
 * 包含: batchLegacyClaim, batchLegacyGiftSendEnhanced
 */

/**
 * 创建功法类任务执行器
 * @param {Object} deps - 依赖项
 * @returns {Object} 任务函数集合
 */
export function createTasksLegacy(deps) {
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
    recipientIdInput,
    recipientInfo,
    securityPassword,
    giftQuantity,
    delayConfig,
  } = deps;

  // 新赛季探索「开始」按钮的候选命令(仓库内无该模块协议, 按盐罐 bottlehelper_start/claim 命名规律推测)。
  // 依次尝试, 服务器接受其一即可; 全部失败时提示抓包确认真实命令。
  const EXPLORE_START_CANDIDATES = [
    "legacy_starthangup",
    "legacy_startexplore",
    "legacy_explore",
  ];

  /**
   * 尝试开始功法探索(等价于游戏内点「开始」)
   * @returns {boolean} 是否确认已开始(或已在探索中)
   */
  const tryStartExplore = async (tokenId, tokenName) => {
    for (const cmd of EXPLORE_START_CANDIDATES) {
      try {
        await tokenStore.sendMessageWithPromise(tokenId, cmd, {}, 4000);
        addLog({
          time: new Date().toLocaleTimeString(),
          message: `${token.name} 已发送开始探索指令(${cmd})，探索周期开始产出残卷`,
          type: "success",
        });
        return true;
      } catch (err) {
        const msg = err.message || "";
        // 200020 = 已在探索中/无可开始, 视为已开始
        if (msg.includes("200020")) {
          addLog({
            time: new Date().toLocaleTimeString(),
            message: `${token.name} 探索已在进行中`,
            type: "info",
          });
          return true;
        }
        // 命令不存在(响应超时)或其它错误 → 尝试下一个候选
      }
    }
    addLog({
      time: new Date().toLocaleTimeString(),
      message: `${token.name} 未能确认开始探索(候选命令均未被接受)，请在游戏内抓包「开始」按钮的发送指令后反馈`,
      type: "warning",
    });
    return false;
  };

  /**
   * 批量领取功法残卷
   */
  const batchLegacyClaim = async () => {
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
          message: `=== 开始领取功法残卷: ${token.name} ===`,
          type: "info",
        });
        await ensureConnection(tokenId);

        const LegacyClaimHangUpResp = await tokenStore.sendMessageWithPromise(
          tokenId,
          "legacy_claimhangup",
          {},
          5000,
        );
        addLog({
          time: new Date().toLocaleTimeString(),
          message: `=== ${token.name} 成功领取功法残卷${LegacyClaimHangUpResp.reward[0].value}，共有${LegacyClaimHangUpResp.role.items[37007].quantity}个`,
          type: "success",
        });
        tokenStatus.value[tokenId] = "completed";
      } catch (error) {
        console.error(error);
        // 200020 = 暂无可领取（挂机无积累），全员正常情况，降级 info 不算失败
        const codeMatch = /服务器错误: (\d+)/.exec(error.message || "");
        const errorCode = error?.code ?? (codeMatch ? Number(codeMatch[1]) : null);
        if (errorCode === 200020) {
          tokenStatus.value[tokenId] = "completed";
          // 新赛季探索未开始时挂机无积累: 开关开启则尝试批量"开始探索"
          if (batchSettings.legacyAutoOpen) {
            const started = await tryStartExplore(tokenId, token.name);
            addLog({
              time: new Date().toLocaleTimeString(),
              message: started
                ? `${token.name} 暂无可领取，已尝试开始探索，产出后再次运行即可领取`
                : `${token.name} 暂无可领取的功法残卷`,
              type: "info",
            });
          } else {
            addLog({
              time: new Date().toLocaleTimeString(),
              message: `${token.name} 暂无可领取的功法残卷`,
              type: "info",
            });
          }
        } else {
          // 小号（等级<4001）功法未解锁，领取失败属正常情况，不打印错误日志
          let isAltAccount = false;
          try {
            const roleInfo = await tokenStore.sendMessageWithPromise(
              tokenId,
              "role_getroleinfo",
              {},
              8000,
            );
            const level = roleInfo?.role?.level;
            if (level !== undefined && Number(level) < 4001) {
              isAltAccount = true;
            }
          } catch {
            // 取不到等级时按普通失败处理
          }
          if (isAltAccount) {
            tokenStatus.value[tokenId] = "completed";
          } else {
            tokenStatus.value[tokenId] = "failed";
            addLog({
              time: new Date().toLocaleTimeString(),
              message: `=== ${token.name} 领取功法残卷失败: ${error.message || "未知错误"}`,
              type: "error",
            });
          }
        }
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
    message.success("批量领取功法残卷结束");
  };

  /**
   * 增强版批量赠送功法残卷（含完善的验证和错误处理）
   */
  const batchLegacyGiftSendEnhanced = async (isScheduledTask = false) => {
    if (selectedTokens.value.length === 0) {
      message.warning("请先选择要操作的角色");
      return;
    }

    const recipientId = isScheduledTask
      ? batchSettings.receiverId
      : recipientIdInput.value;
    const password = isScheduledTask
      ? batchSettings.password
      : securityPassword.value;

    const giftConfig = {
      recipientId: Number(recipientId),
      itemId: 37007,
      quantity: Math.min(giftQuantity.value, 9999) || 0,
      serverName: recipientInfo.value?.serverName || "",
      name: recipientInfo.value?.name || "",
    };

    if (!isScheduledTask) {
      if (!giftConfig.recipientId || giftConfig.recipientId <= 0) {
        message.error("请输入有效的接收者ID");
        return;
      }

      if (giftConfig.quantity <= 0 || giftConfig.quantity > 9999) {
        message.error("赠送数量必须在1-9999之间");
        return;
      }
    }

    isRunning.value = true;
    shouldStop.value = false;

    selectedTokens.value.forEach((id) => {
      tokenStatus.value[id] = "waiting";
    });

    let totalSuccess = 0;
    let totalFailed = 0;

    const taskPromises = selectedTokens.value.map(async (tokenId) => {
      if (shouldStop.value) return;
      tokenStatus.value[tokenId] = "running";

      const token = tokens.value.find((t) => t.id === tokenId);
      let consecutiveErrors = 0;
      const maxRetries = 2;

      while (consecutiveErrors <= maxRetries && !shouldStop.value) {
        try {
          addLog({
            time: new Date().toLocaleTimeString(),
            message: `=== 开始赠送功法残卷: ${token.name} (尝试 ${consecutiveErrors + 1}/${maxRetries + 1}) ===`,
            type: "info",
          });

          await ensureConnection(tokenId);

          const roleInfo = await tokenStore.sendGetRoleInfo(tokenId);
          const legacyFragmentCount =
            Math.min(
              roleInfo?.role?.items?.[giftConfig.itemId]?.quantity,
              9999,
            ) || 0;
          if (isScheduledTask) {
            if (legacyFragmentCount === 0) {
              addLog({
                time: new Date().toLocaleTimeString(),
                message: `=== ${token.name} 功法残卷不足，当前拥有: 0 ===`,
                type: "error",
              });
              tokenStatus.value[tokenId] = "failed";
              totalFailed++;
              break;
            }
            const rankroleinfo = await tokenStore.sendMessageWithPromise(
              tokenId,
              "rank_getroleinfo",
              {
                bottleType: 0,
                includeBottleTeam: false,
                isSearch: false,
                roleId: giftConfig.recipientId,
              },
              5000,
            );
            giftConfig.serverName = rankroleinfo?.roleInfo?.serverName || "";
            giftConfig.name = rankroleinfo?.roleInfo?.name || "";
            if (!rankroleinfo?.roleInfo?.roleId) {
              addLog({
                time: new Date().toLocaleTimeString(),
                message: `=== ${token.name} 赠送功法残卷失败: 接收者${giftConfig.recipientId}不存在`,
                type: "error",
              });
              tokenStatus.value[tokenId] = "failed";
              totalFailed++;
              break;
            }
            giftConfig.quantity = legacyFragmentCount;
          }

          if (legacyFragmentCount < giftConfig.quantity) {
            addLog({
              time: new Date().toLocaleTimeString(),
              message: `=== ${token.name} 功法残卷不足，当前拥有: ${legacyFragmentCount}，需要: ${giftConfig.quantity} ===`,
              type: "error",
            });
            tokenStatus.value[tokenId] = "failed";
            totalFailed++;
            break;
          }

          addLog({
            time: new Date().toLocaleTimeString(),
            message: `=== 开始解除安全密码验证 ===`,
            type: "info",
          });

          const commitPasswordResp = await tokenStore.sendMessageWithPromise(
            tokenId,
            "role_commitpassword",
            {
              password: password,
              passwordType: 1,
            },
            5000,
          );

          if (!commitPasswordResp) {
            throw new Error("安全密码验证请求无响应");
          }
          if (!commitPasswordResp.role?.statistics?.["que:wh:tm"]) {
            addLog({
              time: new Date().toLocaleTimeString(),
              message: `${token.name} === 密码解除失败,请检查密码是否配置正确 ===`,
              type: "error",
            });
            tokenStatus.value[tokenId] = "failed";
            totalFailed++;
            break;
          }
          addLog({
            time: new Date().toLocaleTimeString(),
            message: `=== 安全密码验证成功 ===`,
            type: "success",
          });

          addLog({
            time: new Date().toLocaleTimeString(),
            message: `${token.name} === 开始赠送功法残卷${giftConfig.quantity}个,目标:[${giftConfig.serverName}] ID:${giftConfig.recipientId} ${giftConfig.name} ===`,
            type: "info",
          });

          const legacySendGiftResp = await tokenStore.sendMessageWithPromise(
            tokenId,
            "legacy_sendgift",
            {
              itemCnt: giftConfig.quantity,
              legacyUIds: [],
              targetId: giftConfig.recipientId,
            },
            5000,
          );

          if (!legacySendGiftResp) {
            throw new Error("赠送请求无响应");
          }

          await tokenStore.sendMessage(tokenId, "role_getroleinfo");

          addLog({
            time: new Date().toLocaleTimeString(),
            message: `=== ${token.name} 成功赠送功法残卷${giftConfig.quantity}个给[${giftConfig.serverName}] ID:${giftConfig.recipientId} ${giftConfig.name} ===`,
            type: "success",
          });

          tokenStatus.value[tokenId] = "completed";
          totalSuccess++;
          break;
        } catch (error) {
          consecutiveErrors++;
          console.error(`赠送失败: ${error.message}`);

          let errorMsg = error.message || "未知错误";
          let errorType = "error";

          if (errorMsg.includes("200160")) {
            errorMsg = "模块未开启";
          } else if (errorMsg.includes("timeout")) {
            errorMsg = "请求超时";
            errorType = "warning";
          } else if (errorMsg.includes("网络")) {
            errorMsg = "网络错误";
            errorType = "warning";
          }

          if (consecutiveErrors <= maxRetries && !shouldStop.value) {
            addLog({
              time: new Date().toLocaleTimeString(),
              message: `=== ${token.name} 赠送功法残卷失败: ${errorMsg}，将在3秒后重试 ===`,
              type: "warning",
            });
            await new Promise((r) => setTimeout(r, delayConfig.long));
          } else {
            addLog({
              time: new Date().toLocaleTimeString(),
              message: `=== ${token.name} 赠送功法残卷失败: ${errorMsg}，已达最大重试次数 ===`,
              type: "error",
            });
            tokenStatus.value[tokenId] = "failed";
            totalFailed++;
            break;
          }
        } finally {
          tokenStore.closeWebSocketConnection(tokenId);
          releaseConnectionSlot();
          addLog({
            time: new Date().toLocaleTimeString(),
            message: `${token.name} 连接已关闭  (队列: ${connectionQueue.active}/${batchSettings.maxActive})`,
            type: "info",
          });
        }
      }
    });

    await Promise.all(taskPromises);

    isRunning.value = false;
    currentRunningTokenId.value = null;

    addLog({
      time: new Date().toLocaleTimeString(),
      message: `=== 批量赠送功法残卷完成: 成功 ${totalSuccess} 个，失败 ${totalFailed} 个 ===`,
      type: "success",
    });

    message.success(
      `批量赠送功法残卷结束，成功 ${totalSuccess} 个，失败 ${totalFailed} 个`,
    );
  };

  return {
    batchLegacyClaim,
    batchLegacyGiftSendEnhanced,
  };
}
