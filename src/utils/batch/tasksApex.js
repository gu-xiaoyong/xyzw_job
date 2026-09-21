/**
 * 逐鹿盐山竞猜任务
 * 包含: 一键批量竞猜（自动选助威最高队伍）、一键批量助威（跟助威榜第一名）
 */

import {
  getCurrentSeason,
  checkNowInSeason,
  getAvailableRounds,
  checkSupportInTime,
  getScheduleIdByStage,
  getSupportGroupId,
  ApexStageType,
} from "@/utils/apexRules";

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

    // 运行标识：用于确认前端加载的是修复后的代码
    addLog({
      time: new Date().toLocaleTimeString(),
      message: "=== 逐鹿盐山竞猜 v2：已竞猜队伍自动跳过，重复投注只提示不报错 ===",
      type: "info",
    });

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

        // 3. 收集已竞猜的队伍 ID（统一转字符串，避免数字/字符串类型不一致导致匹配失效）
        const guessedTeamIds = new Set(
          (guessMap[scheduleId] || []).map((id) => String(id)),
        );

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

          // 任一边已竞猜过则整场跳过：该场已参与过，不能再去押另一边
          const alreadyGuessedTeam =
            guessedTeamIds.has(String(team0.teamId)) === true
              ? team0
              : guessedTeamIds.has(String(team1.teamId)) === true
                ? team1
                : null;
          if (alreadyGuessedTeam) {
            skipCount++;
            addLog({
              time: new Date().toLocaleTimeString(),
              message: `${token.name} ${alreadyGuessedTeam.name} 已竞猜过，该场跳过（${team0.name} vs ${team1.name}）`,
              type: "info",
            });
            continue;
          }

          let pick;
          if (vote0 !== undefined && vote1 !== undefined) {
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
            guessedTeamIds.add(String(pick.teamId));
            successCount++;
            addLog({
              time: new Date().toLocaleTimeString(),
              message: `${token.name} 竞猜 ${pick.name}(${pickVote ?? "?"}票) 胜过 ${other.name}(${otherVote ?? "?"}票) ✓`,
              type: "success",
            });
          } catch (err) {
            const msg = err.message || "未知错误";
            if (msg.includes("12800040")) {
              // 服务器规则：同一队伍每个账号只能竞猜一次，重复投注按跳过处理（失败数=开局已竞猜数已验证）
              skipCount++;
              addLog({
                time: new Date().toLocaleTimeString(),
                message: `${token.name} ${pick.name} 已竞猜过该队伍，跳过`,
                type: "info",
              });
            } else {
              failCount++;
              let codeHint = "";
              if (/服务器错误: 200000\b/.test(msg)) {
                codeHint = "（该场当前不可竞猜，可能未开始或已结束）";
              }
              addLog({
                time: new Date().toLocaleTimeString(),
                message: `${token.name} 竞猜 ${pick.name} 失败: ${msg}${codeHint}`,
                type: "error",
              });
            }
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
        if (/服务器错误: 200160\b/.test(error.message || "")) {
          // 活动模块未开启（如等级不足的小号），按跳过处理，不报错误
          tokenStatus.value[tokenId] = "completed";
          addLog({
            time: new Date().toLocaleTimeString(),
            message: `${token.name} 逐鹿盐山活动未开启，跳过`,
            type: "info",
          });
        } else {
          tokenStatus.value[tokenId] = "failed";
          addLog({
            time: new Date().toLocaleTimeString(),
            message: `${token.name} 逐鹿盐山竞猜失败: ${error.message}`,
            type: "error",
          });
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
    message.success("批量逐鹿盐山竞猜结束");
  };

  /**
   * 一键批量逐鹿盐山助威
   * 把账号持有的助威道具全部投给当前期助威榜第一名（跳过已淘汰队伍）
   */
  const batchApexVote = async () => {
    if (selectedTokens.value.length === 0) return;

    isRunning.value = true;
    shouldStop.value = false;

    selectedTokens.value.forEach((id) => {
      tokenStatus.value[id] = "waiting";
    });

    addLog({
      time: new Date().toLocaleTimeString(),
      message: "=== 逐鹿盐山助威 v1：助威道具全部投给助威榜第一名 ===",
      type: "info",
    });

    const taskPromises = selectedTokens.value.map(async (tokenId) => {
      if (shouldStop.value) return;

      tokenStatus.value[tokenId] = "running";
      const token = tokens.value.find((t) => t.id === tokenId);

      try {
        await ensureConnection(tokenId);

        addLog({
          time: new Date().toLocaleTimeString(),
          message: `=== 开始逐鹿盐山助威: ${token.name} ===`,
          type: "info",
        });

        // 1. 获取角色信息
        const roleResp = await tokenStore.sendMessageWithPromise(
          tokenId,
          "apex_getroleinfo",
          {},
          8000,
        );
        const apexRoleInfo = roleResp?.apexRoleInfo || {};
        const groupMap = apexRoleInfo.group || {};
        const voteItemCnt = Number(apexRoleInfo.voteItemCnt) || 0;

        // 2. 赛季/期号判定（走移植自游戏客户端的规则引擎）
        const now = Date.now();
        const season = getCurrentSeason(now);
        if (!season || !checkNowInSeason(now)) {
          addLog({
            time: new Date().toLocaleTimeString(),
            message: `${token.name} 当前不在逐鹿盐山赛季内，跳过`,
            type: "info",
          });
          tokenStatus.value[tokenId] = "completed";
          return;
        }

        // 3. 找助威开放中的期号（优先当前期，从后往前找）
        const rounds = getAvailableRounds(season, now);
        let round = 0;
        for (let i = rounds.length - 1; i >= 0; i--) {
          if (checkSupportInTime(rounds[i], season, now)) {
            round = rounds[i];
            break;
          }
        }
        if (!round) {
          addLog({
            time: new Date().toLocaleTimeString(),
            message: `${token.name} 当前没有助威开放的期次，跳过`,
            type: "info",
          });
          tokenStatus.value[tokenId] = "completed";
          return;
        }

        // 4. 助威道具数量
        if (voteItemCnt <= 0) {
          addLog({
            time: new Date().toLocaleTimeString(),
            message: `${token.name} 没有可用的助威道具，跳过`,
            type: "info",
          });
          tokenStatus.value[tokenId] = "completed";
          return;
        }

        // 5. 助威榜分组号：淘汰赛段优先，其次正式赛段，再回退竞猜活跃场次
        let scheduleId = getScheduleIdByStage(ApexStageType.TaoTai, round, season);
        if (scheduleId < 0) {
          scheduleId = getScheduleIdByStage(ApexStageType.ZhengShi, round, season);
        }
        if (scheduleId < 0) {
          const activeGuess = Object.keys(apexRoleInfo.guessClaimMap || {}).find(
            (key) => Object.keys(apexRoleInfo.guessClaimMap[key] || {}).length === 0,
          );
          if (activeGuess) scheduleId = Number(activeGuess);
        }
        const groupId = getSupportGroupId(groupMap, scheduleId);

        // 6. 拉取助威榜（分页）
        let voteList = [];
        let idx = 0;
        for (let page = 0; page < 10; page++) {
          const resp = await tokenStore.sendMessageWithPromise(
            tokenId,
            "apex_getvotelist",
            { groupId, round, idx },
            8000,
          );
          const rows = resp?.apexVoteList || [];
          voteList.push(...rows);
          if (rows.length === 0) break;
          idx += rows.length;
          await new Promise((r) => setTimeout(r, 500));
        }

        if (voteList.length === 0) {
          addLog({
            time: new Date().toLocaleTimeString(),
            message: `${token.name} 未获取到助威榜数据，跳过`,
            type: "warning",
          });
          tokenStatus.value[tokenId] = "completed";
          return;
        }

        // 7. 目标：榜单第一名（跳过已淘汰）
        const target = voteList.find((t) => t.isOut !== true);
        if (!target) {
          addLog({
            time: new Date().toLocaleTimeString(),
            message: `${token.name} 助威榜队伍均已淘汰，跳过`,
            type: "warning",
          });
          tokenStatus.value[tokenId] = "completed";
          return;
        }

        // 8. 一次性投出全部助威道具
        await tokenStore.sendMessageWithPromise(
          tokenId,
          "apex_vote",
          { teamId: target.teamId, round, voteCnt: voteItemCnt },
          8000,
        );
        addLog({
          time: new Date().toLocaleTimeString(),
          message: `${token.name} 助威 ${target.name}(${target.cheerCnt ?? "?"}助威) x${voteItemCnt} ✓`,
          type: "success",
        });

        tokenStatus.value[tokenId] = "completed";
      } catch (error) {
        console.error(error);
        if (/服务器错误: 200160\b/.test(error.message || "")) {
          // 活动模块未开启（如等级不足的小号），按跳过处理，不报错误
          tokenStatus.value[tokenId] = "completed";
          addLog({
            time: new Date().toLocaleTimeString(),
            message: `${token.name} 逐鹿盐山活动未开启，跳过`,
            type: "info",
          });
        } else if (/200400|操作太快/.test(error.message || "")) {
          tokenStatus.value[tokenId] = "failed";
          addLog({
            time: new Date().toLocaleTimeString(),
            message: `${token.name} 助威操作太快被限制，稍后再试: ${error.message}`,
            type: "warning",
          });
        } else {
          tokenStatus.value[tokenId] = "failed";
          addLog({
            time: new Date().toLocaleTimeString(),
            message: `${token.name} 逐鹿盐山助威失败: ${error.message}`,
            type: "error",
          });
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
    message.success("批量逐鹿盐山助威结束");
  };

  return {
    batchApexGuess,
    batchApexVote,
  };
}
