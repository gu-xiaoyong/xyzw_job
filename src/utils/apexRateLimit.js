/**
 * 逐鹿盐山（APEX）请求限流。
 *
 * 服务器对 apex_* 命令有频控，超限返回业务码 200400「操作太快，请稍后再试」。
 * 固定 sleep 治标不治本（写快了照样被打回、写慢了白白浪费时间），因此沿用仓库
 * 既有的 AIMD 自适应冷却思路（与其它高频操作模块的冷却实现同源）：
 *   · 被 200400 打回 → 间隔估计值「乘性放大」est *= EST_GROW
 *   · 连续成功 N 次  → 估计值「加性下调」est -= EST_SHRINK（有下限）
 * 估计值会收敛到服务器真实冷却：既不更快（避免 200400），也不更慢（不浪费时间）。
 *
 * 在此之上再加一层「全局串行 + 最小间隔」：所有 apex 命令排队发送。分页拉取、
 * 30s 轮询与批量任务同时发起时最容易触发 200400，串行化可彻底消除这类突发。
 *
 * ⚠️ 排队耗时不计入响应超时
 * 上层 sendMessageWithPromise 的超时是从「被调用那一刻」起算的，而排队发生在此之前
 * （本模块的冷却等待 + WebSocket 发送队列积压）。若不处理，排在队尾的请求会带着
 * 已被吃光的时间预算发出，还没等到响应就报「请求超时」——这正是「连接不稳定」的成因。
 * 因此 task 会收到第二个参数 queuedMs：调用方应把它叠加到自己的超时上。
 */

/** 限流动作类型：查询类（只读拉取）/ 竞猜（apex_guess）/ 助威（apex_vote）/ 任务领取（apex_taskclaim） */
export const ApexAction = {
  READ: "read",
  GUESS: "guess",
  VOTE: "vote",
  CLAIM: "claim",
};

/** 各动作间隔估计值下限（ms）：低于此值基本必被服务器打回 */
const EST_FLOOR = { read: 300, guess: 1200, vote: 1200, claim: 1000 };

/** 间隔估计值上限（ms）：超过 15s 多为异常/全局限流，不再无脑拉长 */
const EST_CEIL = 15000;

/** 间隔估计初始值（ms）：竞猜/助威对齐服务器实测冷却（约 3~5s）；
 * 任务领取对齐游戏客户端实测连领间隔（抓包 1.3s/个未限流），整体提速 */
const EST_DEFAULT = { read: 600, guess: 3000, vote: 3000, claim: 1500 };

/** 排期余量（ms）：避免贴边触发 200400 */
const EST_MARGIN = 200;

/** 200400 后的乘性放大系数 */
const EST_GROW = 1.5;

/** 连续成功后每次下调的步长（ms） */
const EST_SHRINK = 200;

/** 连续成功多少次才下调一次（避免在边界上反复抖动） */
const OK_BEFORE_SHRINK = 3;

/** 任意两条 apex 命令之间的最小间隔（ms，全局跨账号）：claim 交错 500ms 防并发突发 */
const MIN_CMD_GAP = { read: 200, guess: 200, vote: 200, claim: 500 };

/** 单条命令遇到 200400 后的最大自动重试次数 */
const MAX_RETRY = 3;

/** 估计值持久化键（跨会话沿用学习结果）；调低 claim 初始间隔后升版作废旧学习值 */
const STORE_KEY = "apex:estCooldown:v3";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 将间隔估计值限制在 [下限, 上限] 区间内。
 * @param {string} key 动作类型（ApexAction）
 * @param {number} val 待收敛的估计值（ms）
 * @returns {number} 收敛后的估计值（ms）
 */
const clampEst = (key, val) =>
  Math.min(EST_CEIL, Math.max(EST_FLOOR[key] ?? 300, Math.round(val)));

/**
 * 读取持久化的间隔估计值；不可用时退回初始值。
 * @returns {Record<string, number>} 各动作的间隔估计值（ms）
 */
const loadEst = () => {
  const est = { ...EST_DEFAULT };
  try {
    if (typeof localStorage === "undefined") {
      return est;
    }
    const saved = JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
    for (const key of Object.keys(est)) {
      if (Number.isFinite(saved[key])) {
        est[key] = clampEst(key, saved[key]);
      }
    }
  } catch {
    /* localStorage 不可用时退回初始值 */
  }
  return est;
};

const persistEst = () => {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORE_KEY, JSON.stringify({ ...est }));
    }
  } catch {
    /* ignore */
  }
};

const est = loadEst();
/** 各动作(按 scope 细分到账号)下一次允许发送的时刻（时间戳，ms） */
const nextAllowedAt = {};
/** 各动作(按 scope 细分到账号)连续成功次数 */
const okStreak = {};
/** 最近一条 apex 命令的发出时刻（全局最小间隔基准） */
let lastSentAt = 0;

/**
 * 判断错误是否为服务器限流（200400）。
 * @param {unknown} e 捕获到的异常
 * @returns {boolean} 是 200400「操作太快」时为 true
 */
export const isApexRateLimited = (e) =>
  /200400|操作太快/.test(e && e.message ? e.message : String(e));

/**
 * 距离该动作下一次可发送还需等待的毫秒数。
 * @param {string} key 动作类型（ApexAction）
 * @param {string} [scope] 账号维度（如 tokenId）；claim 类动作按账号独立排期
 * @returns {number} 等待毫秒数，0 表示可立即发送
 */
export const apexCooldownLeft = (key, scope = "") => {
  const sk = scope ? `${key}:${scope}` : key;
  const now = Date.now();
  return Math.max(
    0,
    (nextAllowedAt[sk] ?? 0) - now,
    lastSentAt + (MIN_CMD_GAP[key] ?? 200) - now,
  );
};

/**
 * 当前学习到的发送间隔（ms）。
 * @param {string} key 动作类型（ApexAction）
 * @returns {number} 间隔估计值（ms）
 */
export const apexEstMs = (key) => est[key] ?? 0;

/** 自适应限流概览文案（证明间隔是学习出来的，而非写死的常量） */
export const apexEstText = () =>
  `自适应限流：查询 ${(est.read / 1000).toFixed(1)}s · 竞猜 ${(est.guess / 1000).toFixed(1)}s · 助威 ${(est.vote / 1000).toFixed(1)}s · 领取 ${(est.claim / 1000).toFixed(1)}s`;

/**
 * 按当前估计值排定下一次可发送时刻。
 * @param {string} sk 排期键（动作或 动作:账号）
 * @param {string} key 动作类型（ApexAction），学习值按动作共享
 */
const scheduleNext = (sk, key) => {
  nextAllowedAt[sk] = Date.now() + est[key] + EST_MARGIN;
};

/**
 * 发送成功：连续成功达阈值则下调估计值，向服务器真实冷却收敛。
 * @param {string} sk 排期键（动作或 动作:账号）
 * @param {string} key 动作类型（ApexAction）
 */
const onSuccess = (sk, key) => {
  okStreak[sk] = (okStreak[sk] ?? 0) + 1;
  if (okStreak[sk] >= OK_BEFORE_SHRINK) {
    est[key] = clampEst(key, est[key] - EST_SHRINK);
    okStreak[sk] = 0;
    persistEst();
  }
};

/**
 * 被限流（200400）：乘性放大估计值——针对真实限流的关键一步。
 * @param {string} sk 排期键（动作或 动作:账号）
 * @param {string} key 动作类型（ApexAction）
 */
const onRateLimited = (sk, key) => {
  okStreak[sk] = 0;
  est[key] = clampEst(key, est[key] * EST_GROW);
  persistEst();
};

/** 全局串行队列：同一时刻只允许一条 apex 命令在途，杜绝并发突发 */
let chain = Promise.resolve();
const serialize = (task) => {
  const run = chain.then(task, task);
  chain = run.then(
    () => {},
    () => {},
  );
  return run;
};

/** 允许按账号并行发送的动作（各自排期，不进全局串行链）；其余动作全局串行 */
const PARALLEL_ACTIONS = new Set([ApexAction.CLAIM]);

/**
 * 发送一条 apex 命令。
 *
 * 两种模式：
 *  · 默认（批量/轮询）：先等自适应冷却再发，被 200400 打回则放大间隔重试。
 *    用于分页拉取、30s 轮询、批量任务——这些是「我们自己发起」的。
 *  · immediate（用户手动点击）：**不等冷却、不进串行链**，立即发送，让服务器的冷却窗口
 *    自己裁决。手动操作本来就受服务器 3~5s 冷却限制，
 *    客户端再叠加一层排队只会让点击「没反应」，而不会让服务器放得更快。
 *
 * 并发策略：claim 类动作带 scope（账号）时不进全局串行链，各账号按学习间隔
 * 独立排期、多账号并行；跨账号仍受全局最小间隔约束。学习值 est 按动作全局
 * 共享——服务器冷却的唯一真值，任一账号被 200400 都会全局退避，自收敛。
 *
 * @param {string} key 动作类型（ApexAction）
 * @param {Function} task 实际发送函数，返回 Promise；入参为 queuedMs（排队耗时）
 * @param {object} [opt] 选项
 * @param {number} [opt.maxRetry] 200400 最大自动重试次数
 * @param {Function} [opt.onWait] 等待冷却时的回调，参数为等待毫秒数（用于 UI 倒计时 / 日志）
 * @param {boolean} [opt.immediate] 用户手动触发：跳过排队与冷却等待，直接发送
 * @param {string} [opt.scope] 账号维度（如 tokenId），claim 类动作并行排期的粒度
 * @returns {Promise<*>} task 的返回值
 * @throws {Error} 重试耗尽或遇到非限流错误时抛出原始异常
 */
export const runApexAction = async (
  key,
  task,
  { maxRetry, onWait, immediate = false, scope = "" } = {},
) => {
  // 手动操作只自动重试 1 次：多试几次会让点击「卡住」很久，不如明确告知用户稍后再点
  const retries = maxRetry ?? (immediate ? 1 : MAX_RETRY);
  const sk = scope ? `${key}:${scope}` : key;
  const run = async () => {
    for (let attempt = 0; ; attempt += 1) {
      // 记录本次排队实际耗时（冷却等待 + 进入串行链的等待）
      const queuedAt = Date.now();
      if (!immediate) {
        const wait = apexCooldownLeft(key, scope);
        if (wait > 0) {
          onWait?.(wait);
          await sleep(wait);
        }
      }
      const waitedMs = Date.now() - queuedAt;
      lastSentAt = Date.now();
      try {
        const res = await task(waitedMs);
        onSuccess(sk, key);
        scheduleNext(sk, key);
        return res;
      } catch (e) {
        if (!isApexRateLimited(e)) {
          okStreak[sk] = 0;
          scheduleNext(sk, key);
          throw e;
        }
        // 服务器冷却自「上次放行」起算，本次被打回后从当前时刻重新排期
        onRateLimited(sk, key);
        scheduleNext(sk, key);
        if (attempt >= retries) {
          throw e;
        }
        // 手动模式下退避一段时间再试，避免连续硬撞服务器冷却窗口
        if (immediate) {
          const backoff = Math.min(est[key] + EST_MARGIN, EST_CEIL);
          onWait?.(backoff);
          await sleep(backoff);
        }
      }
    }
  };

  // claim 类动作带账号 scope：不进全局串行链，多账号并行、各按各的间隔排期
  if (!immediate && PARALLEL_ACTIONS.has(key) && scope) return run();
  return immediate ? run() : serialize(run);
};
