const FRIDAY_DAY = 5;
const DAYS_PER_WEEK = 7;

const getCycleFriday = (date) => {
  const cycleDate = new Date(date);
  const diff =
    (cycleDate.getDay() - FRIDAY_DAY + DAYS_PER_WEEK) % DAYS_PER_WEEK;

  cycleDate.setHours(0, 0, 0, 0);
  cycleDate.setDate(cycleDate.getDate() - diff);

  return cycleDate;
};

const formatYYMMDD = (date) => {
  const year = String(date.getFullYear()).slice(-2);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}${month}${day}`;
};

// 玄武赐福活动ID前缀（当天日期 YYMMDD，如 "260919"）
export const getXuanwuActBase = (date = new Date()) => formatYYMMDD(date);

// 换皮闯关活动ID前缀 = 本周期周五日期（活动随周五开启，如 "261016"）
export const getTowerActBase = (date = new Date()) =>
  formatYYMMDD(getCycleFriday(date));

// 活动ID后缀是期数，随开期递增，无法本地推导 —— 只能向服务器探测

/**
 * 从 towers_getinfo 响应中提取有效数据（必须同时含 actId 与 levelRewardMap）
 */
export const extractTowerData = (res) => {
  if (!res || typeof res !== "object") return null;

  const data =
    res.actId != null
      ? res
      : res.towerData && res.towerData.actId != null
        ? res.towerData
        : null;

  if (!data || !data.levelRewardMap || typeof data.levelRewardMap !== "object") {
    return null;
  }
  return data;
};

const probeTowerActId = async (send, prefixes, suffixes, timeout) => {
  const attempts = [];
  for (const prefix of prefixes) {
    for (const suffix of suffixes) {
      attempts.push(
        (async () => {
          const res = await send(
            "towers_getinfo",
            { actId: Number(`${prefix}${suffix}`) },
            timeout,
          );
          const data = extractTowerData(res);
          if (!data) throw new Error(`活动 ${prefix}${suffix} 数据无效`);
          return data;
        })(),
      );
    }
  }

  try {
    // 无效 actId 会 reject（服务端报错或超时），取首个有效响应
    return await Promise.any(attempts);
  } catch {
    return null;
  }
};

/**
 * 自动解析当前换皮闯关活动ID：并行探测本周期（失败再退上周）周五前缀 × 后缀1-9，
 * 返回首个有效响应（其 actId 为服务器认定的真实活动ID）
 * @param {(cmd: string, params: object, timeout?: number) => Promise<any>} send
 * @returns {Promise<object|null>} towers 数据（含真实 actId），全部探测失败返回 null
 */
export const resolveTowerActId = async (send, { timeout = 2500 } = {}) => {
  const thisWeek = getTowerActBase();
  const lastFriday = getCycleFriday(new Date());
  lastFriday.setDate(lastFriday.getDate() - 7);
  const lastWeek = formatYYMMDD(lastFriday);
  const suffixes = [1, 2, 3, 4, 5, 6, 7, 8, 9];

  const current = await probeTowerActId(send, [thisWeek], suffixes, timeout);
  if (current) return current;

  return probeTowerActId(send, [lastWeek], suffixes, timeout);
};
