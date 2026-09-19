/**
 * 逐鹿盐山竞猜任务
 * 包含: 一键批量竞猜（自动选助威最高队伍）
 */

/**
 * 创建逐鹿盐山竞猜任务执行器
 * @param {Object} deps - 依赖项
 * @returns {Object} 任务函数集合
 */
export function createTasksApex(deps) {
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
  } = deps;

  /**
   * 一键批量逐鹿盐山竞猜
   * 自动选每组对阵中助威数最高的队伍
   */
  const batchApexGuess = async (defaultScheduleId = 46) => {
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
        await ensureConnection(tokenId);

        addLog({
          time: new Date().toLocaleTimeString(),
          message: `=== 开始逐鹿盐山竞猜: ${token.name} ===`,
          type: "info",
        });

        // 1. 获取角色信息
        const roleResp = await tokenStore.sendMessageWithPromise(
          tokenId,
          "apex_getroleinfo",
          {},
          8000,
        );
        const apexInfo = roleResp?.apexRoleInfo || {};
        const guessMap = apexInfo.guessMap || {};
        const guessClaimMap = apexInfo.guessClaimMap || {};

        // 2. 确定当前活跃 scheduleId（guessClaimMap 中值为 {} 的 key）
        let scheduleId = Object.keys(guessClaimMap).find(
          (key) => Object.keys(guessClaimMap[key] || {}).length === 0,
        );

        if (!scheduleId) {
          scheduleId = String(defaultScheduleId);
          addLog({
            time: new Date().toLocaleTimeString(),
            message: `${token.name} 未找到活跃赛季，使用默认: ${scheduleId}`,
            type: "warning",
          });
        }

        // 3. 收集已竞猜的队伍 ID
        const guessedTeamIds = new Set(guessMap[scheduleId] || []);

        addLog({
          time: new Date().toLocaleTimeString(),
          message: `${token.name} 当前赛季: ${scheduleId}，已竞猜: ${guessedTeamIds.size} 队`,
          type: "info",
        });

        // 4. 分页获取所有对阵
        let allGroups = [];
        let idx = 0;
        while (true) {
          if (shouldStop.value) break;

          const resp = await tokenStore.sendMessageWithPromise(
            tokenId,
            "apex_getguesslist",
            { scheduleId: Number(scheduleId), idx },
            8000,
          );
          const groups = resp?.apexGuessList || [];
          if (groups.length === 0) break;
          allGroups.push(...groups);
          idx += 5;
        }

        if (allGroups.length === 0) {
          addLog({
            time: new Date().toLocaleTimeString(),
            message: `${token.name} 没有对阵数据`,
            type: "warning",
          });
          tokenStatus.value[tokenId] = "completed";
          return;
        }

        addLog({
          time: new Date().toLocaleTimeString(),
          message: `${token.name} 共 ${allGroups.length} 组对阵`,
          type: "info",
        });

        // 5. 遍历对阵，选助威/投票数更高的队伍竞猜
        let successCount = 0;
        let skipCount = 0;
        let failCount = 0;
        let dumpedRawGroup = false;

        // 票数字段自适应:不同阶段/版本字段名可能不同,字符串数字也兼容
        const VOTE_FIELDS = [
          "cheerCnt",
          "cheerNum",
          "cheerCount",
          "guessCnt",
          "guessNum",
          "guessCount",
          "voteCnt",
          "voteNum",
          "voteCount",
          "supportCnt",
          "betCnt",
        ];
        const getVoteCount = (team) => {
          if (!team) return undefined;
          for (const f of VOTE_FIELDS) {
            const v = team[f];
            if (typeof v === "number") return v;
            if (typeof v === "string" && v !== "" && !Number.isNaN(Number(v))) {
              return Number(v);
            }
          }
          return undefined;
        };

        for (const group of allGroups) {
          if (shouldStop.value) break;

          const [team0, team1] = group;
          if (!team0 || !team1) continue;

          const vote0 = getVoteCount(team0);
          const vote1 = getVoteCount(team1);

          // 两队都已竞猜则跳过
          if (guessedTeamIds.has(team0.teamId) && guessedTeamIds.has(team1.teamId)) {
            skipCount++;
            continue;
          }

          let pick;
          if (guessedTeamIds.has(team0.teamId)) {
            pick = team1;
          } else if (guessedTeamIds.has(team1.teamId)) {
            pick = team0;
          } else if (vote0 !== undefined && vote1 !== undefined) {
            // 跟随票数多的一边(票数相同取主队)
            pick = vote0 >= vote1 ? team0 : team1;
          } else {
            // 无法识别票数字段:打印原始数据便于排查,不盲猜
            if (!dumpedRawGroup) {
              dumpedRawGroup = true;
              addLog({
                time: new Date().toLocaleTimeString(),
                message: `${token.name} 对阵票数字段无法识别,原始数据: ${JSON.stringify(group).slice(0, 600)}`,
                type: "warning",
              });
            }
            addLog({
              time: new Date().toLocaleTimeString(),
              message: `${token.name} 无法识别 ${team0.name} 与 ${team1.name} 的票数,跳过该组`,
              type: "warning",
            });
            failCount++;
            continue;
          }

          const pickVote = pick === team0 ? vote0 : vote1;
          const other = pick === team0 ? team1 : team0;
          const otherVote = pick === team0 ? vote1 : vote0;

          try {
            await tokenStore.sendMessageWithPromise(
              tokenId,
              "apex_guess",
              { teamId: pick.teamId },
              8000,
            );
            guessedTeamIds.add(pick.teamId);
            successCount++;
            addLog({
              time: new Date().toLocaleTimeString(),
              message: `${token.name} 竞猜 ${pick.name}(${pickVote ?? "?"}票) 胜过 ${other.name}(${otherVote ?? "?"}票) ✓`,
              type: "success",
            });
          } catch (err) {
            failCount++;
            addLog({
              time: new Date().toLocaleTimeString(),
              message: `${token.name} 竞猜 ${pick.name} 失败: ${err.message}`,
              type: "error",
            });
          }

          // 竞猜间隔
          await new Promise((r) => setTimeout(r, 500));
        }

        tokenStatus.value[tokenId] = "completed";
        addLog({
          time: new Date().toLocaleTimeString(),
          message: `=== ${token.name} 竞猜完成: 成功${successCount} 跳过${skipCount} 失败${failCount} ===`,
          type: "success",
        });
      } catch (error) {
        console.error(error);
        tokenStatus.value[tokenId] = "failed";
        addLog({
          time: new Date().toLocaleTimeString(),
          message: `${token.name} 逐鹿盐山竞猜失败: ${error.message}`,
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
    message.success("批量逐鹿盐山竞猜结束");
  };

  return {
    batchApexGuess,
  };
}
