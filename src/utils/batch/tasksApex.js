/**
 * 逐鹿盐山竞猜任务
 * 包含: 一键批量竞猜（自动选助威最高队伍，限流自适应）、一键批量助威（跟助威榜第一名）、一键批量领取活跃度任务
 *
 * 开放判定复用 utils/apexRules.js（1:1 移植客户端规则）：
 *   · 仅淘汰赛阶段（stage 4~10）且状态为 Unlocked / Locked 的场次可押；
 *   · 每阶段可押队伍数上限 = 该阶段 advanceNum（季军赛恒为 1）；
 *   · 分页 idx = 已加载条数，以响应 last 终止。
 */

import {
  ApexScheduleStatus,
  ApexStageType,
  calibrateServerTime,
  checkNowInSeason,
  getAdvanceNum,
  getAvailableRounds,
  getCurrentRounds,
  getCurrentSeason,
  getGuessTabs,
  getScheduleIdByStage,
  getSupportGroupId,
  checkSupportInTime,
} from "@/utils/apexRules";
import {
  ApexAction,
  apexCooldownLeft,
  isApexRateLimited,
  runApexAction,
} from "@/utils/apexRateLimit";

/** 单次请求超时（ms） */
const TIMEOUT_MS = 8000;

/** 单阶段分页拉取的最大页数（防御 last 异常导致死循环） */
const MAX_PAGES = 12;

/** 只读拉取遇到 200400 时的自动重试次数 */
const READ_MAX_RETRY = 1;

/**
 * 经自适应限流器发送一条 apex 命令。
 *
 * 服务器对 apex_* 有频控（200400「操作太快」），固定 sleep 无法适配真实冷却，
 * 统一走 utils/apexRateLimit.js：串行排队 + AIMD 自适应间隔。
 * @param {string} action 动作类型（ApexAction）
 * @param {Function} task 实际发送函数；入参为排队耗时（ms），应叠加到响应超时上
 * @param {number} [maxRetry] 200400 自动重试次数
 * @returns {Promise<*>} 命令响应
 */
const sendApex = (action, task, maxRetry) => runApexAction(action, task, { maxRetry });

/**
 * 解析当前赛季「竞猜开放中」的阶段页签。
 *
 * 逐期扫描所有「进行中」的期（历史期已全部结束，不含开放场次）：
 * 报名期与淘汰赛期在时间上是重叠的，只取默认一期会漏掉另一期已开押的阶段
 * （例：第 5 期报名中、第 4 期淘汰赛已开押）。期号与阶段全部由配置推导。
 *
 * @param {number} nowMs 服务端时间
 * @returns {{season: number, round: number, tabs: Array}|null} 无开放场次时为 null
 */
const resolveOpenGuesses = (nowMs) => {
  const season = getCurrentSeason(nowMs);
  if (season <= 0) return null;
  for (const round of getCurrentRounds(season, nowMs)) {
    const tabs = getGuessTabs(round, season, nowMs).filter(
      (t) =>
        t.state === ApexScheduleStatus.Unlocked ||
        t.state === ApexScheduleStatus.Locked,
    );
    if (tabs.length) return { season, round, tabs };
  }
  return null;
};

/**
 * 创建逐鹿盐山竞猜任务执行器
 * @param {object} deps - 依赖项
 * @returns {object} 任务函数集合
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
  const batchApexGuess = async () => {
    if (selectedTokens.value.length === 0) return;

    isRunning.value = true;
    shouldStop.value = false;

    // 运行标识：用于确认前端加载的是修复后的代码
    addLog({
      time: new Date().toLocaleTimeString(),
      message: "=== 逐鹿盐山竞猜 v3：限流自适应 + 票数跟投，已竞猜队伍自动跳过 ===",
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

        // 1. 获取角色信息（resetTime.day 用于服务端时间校准）
        const roleResp = await sendApex(
          ApexAction.READ,
          // 排队耗时补偿进超时：本命令排在串行链尾时，冷却等待会吃掉预算，
          // 不补偿就会出现「还没等到响应先报超时」的假故障
          (queuedMs) =>
            tokenStore.sendMessageWithPromise(
              tokenId,
              "apex_getroleinfo",
              {},
              TIMEOUT_MS + queuedMs,
            ),
          READ_MAX_RETRY,
        );
        const apexInfo = roleResp?.apexRoleInfo || {};
        const guessMap = apexInfo.guessMap || {};

        // 2. 依据真实规则解析当前开放的竞猜阶段
        const open = resolveOpenGuesses(
          calibrateServerTime(Date.now(), apexInfo.resetTime?.day),
        );
        if (!open) {
          addLog({
            time: new Date().toLocaleTimeString(),
            message: `${token.name} 当前无开放的竞猜阶段（竞猜仅在淘汰赛段开放）`,
            type: "warning",
          });
          tokenStatus.value[tokenId] = "completed";
          return;
        }
        addLog({
          time: new Date().toLocaleTimeString(),
          message: `${token.name} 第${open.season}赛季 第${open.round}期，开放竞猜 ${open.tabs.length} 个阶段`,
          type: "info",
        });

        // 3. 逐阶段分页拉取对阵并竞猜
        let successCount = 0;
        let skipCount = 0;
        let failCount = 0;
        /** 连续被 200400 打回后置位：中止该账号剩余竞猜，避免持续轰炸服务器 */
        let abortedByRateLimit = false;
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

        for (const tab of open.tabs) {
          if (shouldStop.value) break;
          if (abortedByRateLimit) break;

          const advanceNum = getAdvanceNum(open.round, open.season, tab.stage);
          // 已竞猜队伍 ID（统一转字符串，避免数字/字符串类型不一致导致匹配失效）
          const guessedTeamIds = new Set(
            (guessMap[tab.scheduleId] || []).map((id) => String(id)),
          );
          if (advanceNum > 0 && guessedTeamIds.size >= advanceNum) {
            skipCount++;
            addLog({
              time: new Date().toLocaleTimeString(),
              message: `${token.name} ${tab.title} 已押满 ${advanceNum} 队，跳过`,
              type: "info",
            });
            continue;
          }

          // 分页拉取该阶段全部对阵：idx = 已加载条数，以 last 终止
          const allGroups = [];
          let last = false;
          for (let p = 0; p < MAX_PAGES && !last; p++) {
            if (shouldStop.value) break;
            const resp = await sendApex(
              ApexAction.READ,
              // 同上：分页循环每页都要重新等冷却，补偿后才不会误判超时
              (queuedMs) =>
                tokenStore.sendMessageWithPromise(
                  tokenId,
                  "apex_getguesslist",
                  { scheduleId: tab.scheduleId, idx: allGroups.length },
                  TIMEOUT_MS + queuedMs,
                ),
              READ_MAX_RETRY,
            );
            const groups = resp?.apexGuessList || [];
            if (groups.length === 0) break;
            allGroups.push(...groups);
            last = resp?.last === true;
          }

          if (allGroups.length === 0) {
            addLog({
              time: new Date().toLocaleTimeString(),
              message: `${token.name} ${tab.title} 没有对阵数据`,
              type: "warning",
            });
            continue;
          }
          addLog({
            time: new Date().toLocaleTimeString(),
            message: `${token.name} ${tab.title} 共 ${allGroups.length} 组对阵`,
            type: "info",
          });

          for (const group of allGroups) {
            if (shouldStop.value) break;
            if (abortedByRateLimit) break;
            if (advanceNum > 0 && guessedTeamIds.size >= advanceNum) break;

            const [team0, team1] = group;
            if (!team0 || !team1) continue;

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
                message: `${token.name} ${tab.title} ${alreadyGuessedTeam.name} 已竞猜过，该场跳过（${team0.name} vs ${team1.name}）`,
                type: "info",
              });
              continue;
            }

            // 跟随票数多的一边(票数相同取主队)；票数字段自适应，无法识别时不盲猜
            const vote0 = getVoteCount(team0);
            const vote1 = getVoteCount(team1);
            let pick;
            if (vote0 !== undefined && vote1 !== undefined) {
              pick = vote0 >= vote1 ? team0 : team1;
            } else {
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
              await runApexAction(
                ApexAction.GUESS,
                (queuedMs) =>
                  tokenStore.sendMessageWithPromise(
                    tokenId,
                    "apex_guess",
                    { teamId: pick.teamId },
                    TIMEOUT_MS + queuedMs,
                  ),
                {
                  // 等待服务器冷却时给出可见反馈，避免界面像卡死
                  onWait: (ms) =>
                    addLog({
                      time: new Date().toLocaleTimeString(),
                      message: `${token.name} 竞猜遇到服务器限流，等待 ${Math.ceil(ms / 1000)}s 后重试`,
                      type: "warning",
                    }),
                },
              );
              guessedTeamIds.add(String(pick.teamId));
              successCount++;
              addLog({
                time: new Date().toLocaleTimeString(),
                message: `${token.name} ${tab.title} 竞猜 ${pick.name}(${pickVote ?? "?"}票) 胜过 ${other.name}(${otherVote ?? "?"}票) ✓`,
                type: "success",
              });
            } catch (err) {
              const msg = err.message || "未知错误";
              if (msg.includes("12800040")) {
                // 服务器规则：同一队伍每个账号只能竞猜一次，重复投注按跳过处理
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
                  message: `${token.name} ${tab.title} 竞猜 ${pick.name} 失败: ${msg}${codeHint}`,
                  type: "error",
                });
              }
              if (isApexRateLimited(err)) {
                // 重试仍被限流：停止该账号后续竞猜，等待自适应间隔恢复
                abortedByRateLimit = true;
                addLog({
                  time: new Date().toLocaleTimeString(),
                  message: `${token.name} 连续被服务器限流（200400），约 ${Math.ceil(apexCooldownLeft(ApexAction.GUESS) / 1000)}s 后可继续，本次中止剩余竞猜`,
                  type: "warning",
                });
              }
            }
          }
        }

        if (abortedByRateLimit) {
          addLog({
            time: new Date().toLocaleTimeString(),
            message: `${token.name} 因服务器限流提前结束，未完成部分稍后重跑即可续押`,
            type: "warning",
          });
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

  // 逐鹿盐山活跃度任务协议（2026-09-21 抓包确认）：
  //   · 领取：apex_taskclaim，参数 { confId }，confId 取值 1~7（共 7 个任务）
  //   · 已领取状态：apex_getroleinfo 响应的 apexRoleInfo.taskClaimedMap（键为 confId）
  //   · 服务端无任务列表接口（重进任务页仅发 apex_getroleinfo），
  //     未达成的 confId 由服务器报状态类错误，按跳过处理
  const APEX_TASK_CONF_MAX = 7;

  /**
   * 一键批量领取逐鹿盐山活跃度任务
   */
  const batchApexClaimTask = async () => {
    if (selectedTokens.value.length === 0) return;

    isRunning.value = true;
    shouldStop.value = false;

    selectedTokens.value.forEach((id) => {
      tokenStatus.value[id] = "waiting";
    });

    addLog({
      time: new Date().toLocaleTimeString(),
      message: "=== 逐鹿盐山任务领取 v3：间隔对齐客户端实测(1.3s)，已领取跳过 ===",
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
          message: `=== 开始领取逐鹿盐山任务: ${token.name} ===`,
          type: "info",
        });

        // 1. 取角色信息：taskClaimedMap 记录已领取的 confId
        const roleResp = await sendApex(
          ApexAction.READ,
          (queuedMs) =>
            tokenStore.sendMessageWithPromise(
              tokenId,
              "apex_getroleinfo",
              {},
              TIMEOUT_MS + queuedMs,
            ),
          READ_MAX_RETRY,
        );
        const apexRoleInfo = roleResp?.apexRoleInfo || {};
        const claimedMap = apexRoleInfo.taskClaimedMap || {};
        const claimedIds = new Set(
          Object.keys(claimedMap)
            .filter((key) => claimedMap[key] === true)
            .map(Number),
        );

        // 2. 逐个领取 confId 1~7：已领跳过，未达成/不存在的由服务器报状态类错误跳过
        let claimedCount = 0;
        let skippedCount = 0;
        let failCount = 0;
        let abortedByRateLimit = false;

        for (let confId = 1; confId <= APEX_TASK_CONF_MAX; confId++) {
          if (shouldStop.value) break;
          if (abortedByRateLimit) break;
          if (claimedIds.has(confId)) {
            skippedCount++;
            continue;
          }

          try {
            await runApexAction(
              ApexAction.CLAIM,
              (queuedMs) =>
                tokenStore.sendMessageWithPromise(
                  tokenId,
                  "apex_taskclaim",
                  { confId },
                  TIMEOUT_MS + queuedMs,
                ),
              { maxRetry: READ_MAX_RETRY },
            );
            claimedCount++;
            addLog({
              time: new Date().toLocaleTimeString(),
              message: `${token.name} 领取任务(confId=${confId})奖励成功 ✓`,
              type: "success",
            });
          } catch (err) {
            const msg = err.message || "未知错误";
            if (isApexRateLimited(err)) {
              // 重试仍被限流：停止该账号后续领取，等待自适应间隔恢复
              abortedByRateLimit = true;
              addLog({
                time: new Date().toLocaleTimeString(),
                message: `${token.name} 连续被服务器限流（200400），约 ${Math.ceil(apexCooldownLeft(ApexAction.CLAIM) / 1000)}s 后可继续，本次中止剩余领取`,
                type: "warning",
              });
            } else if (/服务器错误: 200\d{3}\b/.test(msg)) {
              // 状态类错误（未达成/已领取/不存在等）：正常情况，静默计数不刷日志
              skippedCount++;
            } else {
              failCount++;
              addLog({
                time: new Date().toLocaleTimeString(),
                message: `${token.name} 领取任务(confId=${confId})失败: ${msg}`,
                type: "warning",
              });
            }
          }
        }

        if (abortedByRateLimit) {
          addLog({
            time: new Date().toLocaleTimeString(),
            message: `${token.name} 因服务器限流提前结束，未领取部分稍后重跑即可`,
            type: "warning",
          });
        }

        tokenStatus.value[tokenId] = "completed";
        addLog({
          time: new Date().toLocaleTimeString(),
          message: `=== ${token.name} 任务领取完成: 成功${claimedCount} 跳过${skippedCount} 失败${failCount}（已领${claimedIds.size}/共${APEX_TASK_CONF_MAX}个任务） ===`,
          type: claimedCount > 0 ? "success" : "info",
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
            message: `${token.name} 领取逐鹿盐山任务失败: ${error.message}`,
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
    message.success("批量领取逐鹿盐山任务结束");
  };

  return {
    batchApexGuess,
    batchApexVote,
    batchApexClaimTask,
  };
}
