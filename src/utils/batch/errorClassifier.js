/**
 * 批量任务共享错误码分类器
 *
 * 背景：dailyTaskRunner 已有 INFO_ERROR_CODES 分级管线，但各 batch 任务模块
 * 各自为政——同一个"无事可做"类暂态码，有的记 info、有的直接红色 error，
 * 定时任务每天重复执行时反复虚报失败（如 12400160 功法残卷、2300190 已签到）。
 *
 * 本模块收录无歧义的暂态码字典与统一分级，供各 batch 任务的 catch 兜底：
 *   import { classifyBusinessError } from "@/utils/batch/errorClassifier";
 *   const { code, level } = classifyBusinessError(error);
 *   if (level !== "error") { /* info/warning 日志 + completed，跳过本轮 * / }
 *
 * err.code 已由 xyzwWebSocket 在业务拒绝时挂上（L1411-1413），无需解析 message；
 * extractErrorCode 仅作 message 兜底（兼容部分包装错误）。
 */

/** info 级：无事可做/暂态，不算失败，等下轮定时重试 */
export const TRANSIENT_INFO_CODES = new Set([
  200020, // 暂无可领取 / 已在进行中（通用"出了点小问题"观察为正常）
  12400000, // 挂机奖励领取过于频繁（间隔未到）
  12400160, // 挂机模块暂态不可操作（探索已结束/未开启等）
  2300190, // 今天已经签到过了
  1000020, // 今天已经领取过奖励了
  12000116, // 今日已领取免费奖励
  3500020, // 没有可领取的奖励
  700020, // 已经领取过这个任务
  400190, // 没有可领取的签到奖励
  1500010, // 已经全部通关
  400000, // 物品不存在（无免费次数/资源耗尽的观察常态）
  700010, // 任务未达成完成条件
  3300060, // 扫荡条件不满足
  2600040, // 暂无可执行操作（咸王梦境等）
  200160, // 模块未开启（小号未解锁）
  1300040, // 未知错误（黑市等，实测为正常无货态）
  12300040, // 没有空格子了
  12300080, // 未达到解锁条件
  2300250, // 俱乐部BOSS今日攻打次数已用完
  4800080, // 不在规定时间内或未到报名阶段
  4800040, // 俱乐部没有报名
  2100010, // 活动未开放
  7900023, // 已达到使用次数上限
]);

/** warning 级：限流暂态，稍后重试即可 */
export const RATE_LIMIT_CODES = new Set([200400, 400340]);

/** 从错误对象提取业务错误码：优先 err.code，兜底解析 message */
export const extractErrorCode = (error) => {
  if (error?.code !== undefined && error?.code !== null) return error.code;
  const match = /服务器错误: (\d+)/.exec(error?.message || "");
  return match ? Number(match[1]) : null;
};

/**
 * 分类业务错误
 * @returns {{ code: number|null, level: "info"|"warning"|"error", isTransient: boolean }}
 *   - info:    无事可做类暂态 → 记 info 日志、账号标 completed、等下轮重试
 *   - warning: 限流类暂态     → 计 warning 日志、本轮中止/稍后重试
 *   - error:   真实失败       → 保持红色 error
 */
export const classifyBusinessError = (error) => {
  const code = extractErrorCode(error);
  if (code !== null && TRANSIENT_INFO_CODES.has(code)) {
    return { code, level: "info", isTransient: true };
  }
  if (code !== null && RATE_LIMIT_CODES.has(code)) {
    return { code, level: "warning", isTransient: true };
  }
  return { code, level: "error", isTransient: false };
};
