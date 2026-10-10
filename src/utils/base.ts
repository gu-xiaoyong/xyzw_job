// 判断当前时间是否在本周内（周一00点重置）
export const isInCurrentWeek = (timestamp: number) => {
  const now = new Date();
  // 周一为一周的开始：day 0=周一 … 6=周日
  const day = (now.getDay() + 6) % 7;
  const weekStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - day,
  );
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);
  return timestamp >= weekStart.getTime() && timestamp < weekEnd.getTime();
};

/** 生成 [min,max] 的随机整数 */
export const randInt = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

/** Promise 版 sleep */
export { sleep } from "./helperTaskRunner.js";
