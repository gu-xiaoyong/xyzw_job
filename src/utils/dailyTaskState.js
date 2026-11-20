import { bon } from "./bonProtocol.js";

const configsByVersion = new Map();
const activeTokenRuns = new Set();

// The official HangUpInviteDialog exposes four help slots, independently of daily tasks.
const HANG_UP_HELP_SLOTS = 4;

// 日常任务共享设置默认值（存储键 daily-settings:<tokenId>，
// 批量页/单账号页/日常执行器统一从这里取，避免多份默认值漂移）
export const dailySettingsDefaults = {
  arenaFormation: 1,
  towerFormation: 0, // 0 = 使用当前阵容（不切换预设队伍）
  bossFormation: 1,
  bossTimes: 2,
  claimBottle: true,
  payRecruit: true,
  openBox: true,
  arenaEnable: true,
  claimHangUp: true,
  claimEmail: true,
  blackMarketPurchase: true,
  freeGachaEnable: true,
};

/**
 * Keep daily and hang-up operations for one account from overlapping.
 * @param {string} tokenId Account identity.
 * @param {Function} execute Operation to execute once.
 * @returns {Promise<*>} The operation result; the lock is always released.
 */
export async function runWithDailyTaskLock(tokenId, execute) {
  if (activeTokenRuns.has(tokenId))
    throw new Error("该账号的日常或挂机任务正在执行中");
  activeTokenRuns.add(tokenId);
  try {
    return await execute();
  } finally {
    activeTokenRuns.delete(tokenId);
  }
}

/**
 * Count unexpired help slots using the official client's checkFriendTimeout order.
 * @param {object} role Fresh role_getroleinfo data, including hangUp.helpFriend.
 * @param {number} serverTime Server response timestamp in milliseconds.
 * @returns {{active: number, remaining: number}} Occupied slots and slots to fill.
 * @throws {Error} When the server snapshot or server clock cannot be trusted.
 */
export function getHangUpState(role, serverTime) {
  const hangUp = role?.hangUp;
  const helpers = hangUp?.helpFriend;
  if (
    !Number.isFinite(serverTime) ||
    serverTime <= 0 ||
    !Number.isFinite(hangUp?.checkTime) ||
    hangUp.checkTime < 0 ||
    !Array.isArray(helpers) ||
    helpers.length > HANG_UP_HELP_SLOTS ||
    helpers.some(
      (helper) =>
        !Number.isInteger(helper?.helpTime) ||
        helper.helpTime <= 0 ||
        !Number.isInteger(helper.slot) ||
        helper.slot < 0 ||
        helper.slot >= HANG_UP_HELP_SLOTS,
    ) ||
    new Set(helpers.map((helper) => helper.slot)).size !== helpers.length
  ) {
    const error = new Error("服务器挂机槽位或时间不完整，不能判断加钟状态");
    error.hangUpStateUnavailable = true;
    throw error;
  }
  let elapsed = Math.max(serverTime / 1000 - hangUp.checkTime, 0);
  let active = 0;
  for (const helper of helpers) {
    if (elapsed >= helper.helpTime) elapsed -= helper.helpTime;
    else active++;
  }
  return { active, remaining: HANG_UP_HELP_SLOTS - active };
}

/**
 * Fill only the server's empty help slots, then verify with one fresh snapshot.
 * No local completion cache or automatic write retry is used.
 * @param {object} options Transport, account, cancellation, logging and read/send hooks.
 * @param {object} options.tokenStore Live account transport and connection state.
 * @param {string} options.tokenId Account to query and extend.
 * @param {Function} [options.readRole] Read a fresh role snapshot without retries.
 * @param {Function} [options.sendCommand] Send one hang-up share command.
 * @param {Function} [options.check] Check cancellation before another operation.
 * @param {Function} [options.onLog] Report execution and server verification.
 * @param {Function} [options.sleep] Await the requested delay.
 * @param {number} [options.delay] Delay after each share acknowledgement.
 * @returns {Promise<object>} Sent request count and server-confirmed remaining slots.
 * @throws {Error} On unavailable state, disconnect, cancellation or command failure.
 */
export async function fillHangUpTime({
  tokenStore,
  tokenId,
  readRole = () =>
    tokenStore.sendMessageWithPromise(tokenId, "role_getroleinfo", {}, 15000),
  sendCommand = () =>
    tokenStore.sendMessageWithPromise(
      tokenId,
      "system_mysharecallback",
      { isSkipShareCard: true, type: 2 },
      8000,
    ),
  check = () => {},
  onLog = () => {},
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  delay = 500,
}) {
  let snapshotClient;
  const assertConnected = () => {
    check();
    const status = tokenStore.getWebSocketStatus?.(tokenId);
    if (
      (status && status !== "connected") ||
      (snapshotClient &&
        snapshotClient !== tokenStore.wsConnections?.[tokenId]?.client)
    ) {
      const error = new Error(
        "WebSocket 已断开，停止加钟并等待重新读取服务器状态",
      );
      error.interrupted = true;
      throw error;
    }
  };
  const readState = async () => {
    assertConnected();
    // role_getroleinfo is limited independently of the share command.
    await sleep(1000);
    assertConnected();
    const client = tokenStore.wsConnections?.[tokenId]?.client;
    const response = await readRole();
    assertConnected();
    if (client !== tokenStore.wsConnections?.[tokenId]?.client) {
      const error = new Error("连接会话已变化，请重新读取服务器挂机状态");
      error.interrupted = true;
      throw error;
    }
    snapshotClient = client;
    return getHangUpState(response?.role, client?.serverTime);
  };
  const before = await readState();
  if (!before.remaining) {
    onLog("跳过挂机加钟：服务器确认助力槽位已满");
    return { sent: 0, ...before };
  }
  onLog(
    `服务器挂机槽位 ${before.active}/${HANG_UP_HELP_SLOTS}，补加钟 ${before.remaining} 次`,
  );
  for (let i = 0; i < before.remaining; i++) {
    assertConnected();
    onLog(`执行挂机加钟 ${i + 1}/${before.remaining}`);
    await sendCommand();
    assertConnected();
    await sleep(delay);
  }
  const after = await readState();
  onLog(
    after.remaining
      ? `加钟后服务器仍有 ${after.remaining} 个空槽位，保留待继续`
      : "服务器确认挂机加钟已补满",
  );
  return { sent: before.remaining, ...after };
}

const CONFIG_FETCH_TIMEOUT = 30000;

/**
 * 解压 cocos 压缩 uuid：前 2 位十六进制原样保留，其余 20 位 base64
 * 解出 15 字节 → 30 位 hex，按 8-4-4-4-12 加横线拼成完整 uuid。
 * @param {string} compressed bundle 清单 uuids 数组中的压缩形式。
 * @returns {string} 完整带横线 uuid（远程 bundle 落盘文件名用它）。
 */
function decodeCocosUuid(compressed) {
  let hex = "";
  const body = atob(compressed.slice(2));
  for (let i = 0; i < body.length; i++)
    hex += body.charCodeAt(i).toString(16).padStart(2, "0");
  const full = compressed.slice(0, 2) + hex;
  return `${full.slice(0, 8)}-${full.slice(8, 12)}-${full.slice(12, 16)}-${full.slice(16, 20)}-${full.slice(20)}`;
}

/**
 * 在 cocos bundle 清单里定位资产并给出其 native 文件的下载信息。
 * @param {object} manifest remote/config/config.{版本}.json 清单内容。
 * @param {string} assetName 资产路径名，如 "configc"。
 * @returns {{uuid: string, hash: string}|null} 压缩 uuid 与 native 版本号。
 */
function findBundleNativeAsset(manifest, assetName) {
  const entry = Object.entries(manifest?.paths ?? {}).find(
    ([, value]) => Array.isArray(value) && value[0] === assetName,
  );
  if (!entry) return null;
  const index = Number(entry[0]);
  const uuid = manifest.uuids?.[index];
  const hash = manifest.versions?.native?.[index * 2 + 1];
  return typeof uuid === "string" && typeof hash === "string"
    ? { uuid, hash }
    : null;
}

/**
 * 通过 cocos 远程 bundle 加载配置（官方 2026-11-20 起的主要发布路径）：
 * 先取 remote/config/config.{版本}.json 清单，再取 configc 资产的 native BON 文件。
 * @param {Function} fetchConfig Fetch implementation for the official CDN.
 * @param {string} host CDN host.
 * @param {string} version dataBundleVer.
 * @returns {Promise<object>} 解码后的配置对象。
 */
async function loadBundleConfig(fetchConfig, host, version) {
  const manifestResponse = await fetchConfig(
    `https://${host}/remote/config/config.${version}.json`,
    { signal: AbortSignal.timeout(CONFIG_FETCH_TIMEOUT) },
  );
  if (!manifestResponse.ok)
    throw new Error(`bundle清单 HTTP ${manifestResponse.status}`);
  const asset = findBundleNativeAsset(await manifestResponse.json(), "configc");
  if (!asset) throw new Error("bundle清单缺少configc资产");
  const dataResponse = await fetchConfig(
    `https://${host}/remote/config/native/${asset.uuid.slice(0, 2)}/${decodeCocosUuid(asset.uuid)}.${asset.hash}.bin`,
    { signal: AbortSignal.timeout(CONFIG_FETCH_TIMEOUT) },
  );
  if (!dataResponse.ok)
    throw new Error(`bundle数据 HTTP ${dataResponse.status}`);
  return bon.decode(new Uint8Array(await dataResponse.arrayBuffer()));
}

/**
 * 构造 /data/{版本}/{文件} 直链候选源（旧发布路径，2026-11-20 后新版本已不再发布）。
 */
function directSource(label, host, file, parse) {
  return {
    label,
    load: async (fetchConfig, version) => {
      const response = await fetchConfig(
        `https://${host}/data/${version}/${file}`,
        { signal: AbortSignal.timeout(CONFIG_FETCH_TIMEOUT) },
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return parse(response);
    },
  };
}

const RES_CDN = "xxz-xyzw-res.hortorgames.com";
const ALI_CDN = "xxz-xyzw-alires.hortorgames.com";

/**
 * 官方任务配置的候选下载源，按顺序尝试，全部失败才报错。
 *
 * 游戏客户端加载 "config" 资产有三条路径（见协议 dump loadConfig）：
 * 1. remote/config bundle：config.{版本}.json 清单 → configc native BON 文件
 *    （cocos 远程 bundle，2026-11-20 起官方新版本只发布到这里）；
 * 2. /data/{版本}/config.json —— 纯 JSON（旧直链路径）；
 * 3. /data/{版本}/configc.bin —— BON 二进制（旧直链路径）。
 * json 与 BON 内容一致，BON 用 bon.decode 解码；两台 CDN 域名取自游戏自身的多 CDN 切换表。
 */
export const DAILY_CONFIG_SOURCES = [
  {
    label: "主CDN(bundle)",
    load: (fetchConfig, version) =>
      loadBundleConfig(fetchConfig, RES_CDN, version),
  },
  {
    label: "备CDN(bundle)",
    load: (fetchConfig, version) =>
      loadBundleConfig(fetchConfig, ALI_CDN, version),
  },
  directSource("主CDN(config.json)", RES_CDN, "config.json", (response) =>
    response.json(),
  ),
  directSource("主CDN(configc.bin)", RES_CDN, "configc.bin", async (response) =>
    bon.decode(new Uint8Array(await response.arrayBuffer())),
  ),
  directSource("备CDN(config.json)", ALI_CDN, "config.json", (response) =>
    response.json(),
  ),
  directSource("备CDN(configc.bin)", ALI_CDN, "configc.bin", async (response) =>
    bon.decode(new Uint8Array(await response.arrayBuffer())),
  ),
];

/**
 * Load task targets from the official data version returned by the game server.
 * Only immutable configuration is cached; role progress is never cached here.
 * @param {object} tokenStore Live command transport.
 * @param {string} tokenId Selected account identity.
 * @param {Function} [fetchConfig] Fetch implementation for the official CDN.
 * @returns {Promise<object>} Validated task definitions and point-reward thresholds.
 */
export async function loadDailyTaskConfig(
  tokenStore,
  tokenId,
  fetchConfig = globalThis.fetch,
) {
  const response = await tokenStore.sendMessageWithPromise(
    tokenId,
    "system_getdatabundlever",
    {},
    15000,
  );
  const version = response?.dataBundleVer;
  if (typeof version !== "string" || !/^[\w-]+$/.test(version))
    throw new Error("服务器未提供有效的任务配置版本");
  if (!configsByVersion.has(version)) {
    const loading = (async () => {
      // 依次尝试各下载源；单个源失败（非 2xx / 网络错误 / 解码或校验失败）换下一个。
      const failures = [];
      for (const source of DAILY_CONFIG_SOURCES) {
        try {
          return validateDailyTaskConfig(
            await source.load(fetchConfig, version),
          );
        } catch (error) {
          failures.push(`${source.label}: ${error.message}`);
        }
      }
      throw new Error(
        `官方任务配置读取失败（版本 ${version}）：${failures.join("；")}`,
      );
    })();
    configsByVersion.set(version, loading);
    loading.catch(() => {
      if (configsByVersion.get(version) === loading)
        configsByVersion.delete(version);
    });
    for (const key of configsByVersion.keys()) {
      if (key !== version) configsByVersion.delete(key);
    }
  }
  return configsByVersion.get(version);
}

/**
 * Validate official task IDs separately from their completion-condition IDs.
 * @param {object} config Official configuration response.
 * @returns {object} Minimal task and reward configuration.
 * @throws {Error} When targets or reward thresholds cannot be trusted.
 */
export function validateDailyTaskConfig(config) {
  const tasks = Object.values(config?.DailyTaskConf ?? {});
  const dailyRewards = Object.values(config?.DayLimitConf ?? {});
  const weeklyRewards = Object.values(config?.WeekLimitConf ?? {});
  if (
    !tasks.length ||
    !dailyRewards.length ||
    !weeklyRewards.length ||
    tasks.some(
      (task) =>
        !Number.isInteger(task.id) ||
        task.id <= 0 ||
        !Number.isInteger(task.completeCondition) ||
        task.completeCondition <= 0 ||
        !Number.isInteger(task.completeValue) ||
        task.completeValue <= 0,
    ) ||
    new Set(tasks.map((task) => task.id)).size !== tasks.length ||
    new Set(tasks.map((task) => task.completeCondition)).size !==
      tasks.length ||
    [dailyRewards, weeklyRewards].some(
      (rewards) =>
        new Set(rewards.map((reward) => reward.id)).size !== rewards.length,
    ) ||
    [...dailyRewards, ...weeklyRewards].some(
      (reward) =>
        !Number.isInteger(reward.id) ||
        reward.id <= 0 ||
        !Number.isFinite(reward.limit) ||
        reward.limit < 0,
    )
  )
    throw new Error("官方每日任务配置无效，停止执行");
  const claimSeconds = config?.ConstantConf?.stayRewardTime;
  return {
    tasks,
    dailyRewards,
    weeklyRewards,
    ...(Number.isFinite(claimSeconds) && claimSeconds > 0
      ? { hangUpClaimInterval: claimSeconds * 1000 }
      : {}),
  };
}

/**
 * Decode a freshly fetched role's daily progress, including unclaimed completion.
 * Missing counters in an otherwise valid server map represent zero progress.
 * @param {object} role Role returned by the live role_getroleinfo response.
 * @param {object} config Validated official definitions.
 * @returns {Array<object>} Pending, claimable or claimed tasks with remaining counts.
 * @throws {Error} When the server snapshot is incomplete or malformed.
 */
export function getDailyTaskStates(role, config) {
  const daily = role?.dailyTask;
  if (
    !Number.isFinite(daily?.dailyTime) ||
    daily.dailyTime <= 0 ||
    !daily.complete ||
    typeof daily.complete !== "object" ||
    Array.isArray(daily.complete)
  )
    throw new Error("服务器任务列表不完整，不能判断完成状态");
  return config.tasks.map((task) => {
    const value = Object.hasOwn(daily.complete, task.completeCondition)
      ? daily.complete[task.completeCondition]
      : 0;
    if (!Number.isInteger(value) || value < -1)
      throw new Error("服务器任务进度无效，停止执行");
    const claimed = value === -1;
    const progress = claimed ? task.completeValue : value;
    return {
      id: task.id,
      condition: task.completeCondition,
      required: task.completeValue,
      progress,
      remaining: Math.max(task.completeValue - progress, 0),
      status: claimed
        ? "claimed"
        : progress >= task.completeValue
          ? "claimable"
          : "pending",
    };
  });
}

/**
 * Determine point rewards from the server's point total and claimed-reward map.
 * @param {object} daily Server dailyTask data.
 * @param {Array<object>} definitions Official reward IDs and thresholds.
 * @param {boolean} [weekly] Select weekPoint/weekReward instead of daily fields.
 * @returns {Array<number>} Only eligible, unclaimed server reward IDs.
 */
export function getClaimablePointRewards(daily, definitions, weekly = false) {
  const points = daily?.[weekly ? "weekPoint" : "dailyPoint"];
  const claimed = daily?.[weekly ? "weekReward" : "dailyReward"];
  if (
    !Number.isFinite(points) ||
    !claimed ||
    typeof claimed !== "object" ||
    Array.isArray(claimed) ||
    Object.values(claimed).some((value) => typeof value !== "boolean")
  )
    throw new Error("服务器积分奖励状态不完整");
  return definitions
    .filter((reward) => points >= reward.limit && claimed[reward.id] !== true)
    .map((reward) => reward.id);
}
