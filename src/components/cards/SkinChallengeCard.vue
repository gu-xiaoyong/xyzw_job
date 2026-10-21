<template>
  <MyCard class="skin-challenge" :status-class="statusClass">
    <template #icon>
      <img src="/icons/1733492491706152.png" alt="换皮闯关" />
    </template>
    <template #title>
      <h3>换皮闯关</h3>
      <p>挑战关卡赢取奖励</p>
    </template>
    <template #badge>
      <NTag v-if="season > 0" type="info" size="small" round>
        第 {{ season }} 赛季
      </NTag>
    </template>
    <template #default>
      <div class="header-info">
        <span class="challenge-count">今日挑战 {{ dailyFightNum }}/10</span>
        <span class="daily-target" v-if="isActivityValid"
          >今日可挑战 {{ todayInfo }}</span
        >
        <span class="daily-target" v-else-if="loadError"
          >活动获取失败，请刷新重试</span
        >
        <span class="daily-target" v-else>活动已结束</span>
        <span class="act-id" v-if="actId">活动ID: {{ actId }}</span>
      </div>

      <div v-if="!isActivityValid" class="expired-mask">
        {{ loadError ? "活动获取失败，请刷新重试" : "当前活动已结束" }}
      </div>
      <div class="boss-grid" :class="{ disabled: !isActivityValid }">
        <div
          v-for="type in 6"
          :key="type"
          class="boss-card"
          :class="{
            active: isTowerOpen(type),
            cleared: isTowerCleared(type),
            locked: !isTowerOpen(type),
          }"
        >
          <div class="boss-title">BOSS {{ type }}</div>
          <div class="boss-level">第 {{ getTowerLevel(type) }} 层</div>

          <div class="boss-status">
            <span v-if="isTowerCleared(type)" class="status-text cleared"
              >已通关</span
            >
            <span v-else-if="!isTowerOpen(type)" class="status-text locked"
              >未开放</span
            >
            <span v-else class="status-text active">进行中</span>
          </div>

          <button
            class="challenge-btn"
            :disabled="!canChallenge(type) || isFighting"
            @click="challengeSingle(type)"
          >
            挑战
          </button>
        </div>
      </div>

      <div class="action-row">
        <button
          class="action-button secondary"
          :disabled="isFighting"
          @click="refreshInfo"
        >
          {{ isFighting ? "刷新中..." : "刷新进度" }}
        </button>
      </div>
    </template>
  </MyCard>
</template>

<script setup>
import { NTag, useMessage } from "naive-ui";
import { computed, ref, watch } from "vue";
import { useTokenStore } from "@/stores/tokenStore";
import { extractTowerData, resolveTowerActId } from "@/utils/towerActId.js";
import MyCard from "../Common/MyCard.vue";

const tokenStore = useTokenStore();
const message = useMessage();

const isFighting = ref(false);
const actId = ref(null);
const loadError = ref(false);
const season = ref(0); // 服务端赛季号（resetTime.season，仅取一次）
const isActivityValid = computed(() => {
  if (!actId.value) return false;

  const idStr = String(actId.value);
  if (idStr.length < 6) return false;

  // Format: YYMMDDX -> 20YY-MM-DD
  const year = `20${idStr.substring(0, 2)}`;
  const month = idStr.substring(2, 4);
  const day = idStr.substring(4, 6);

  const startDate = new Date(`${year}-${month}-${day}T00:00:00`);
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 7);

  const now = new Date();
  return now >= startDate && now < endDate;
});

const levelRewardMap = ref({});
const dailyFightNum = ref(0); // Mock or real data
const finishedCount = computed(() => Object.keys(levelRewardMap.value).length);

const statusClass = computed(() => {
  if (finishedCount.value >= 48) return "completed";
  return "active";
});

// Calculate today's open boss
const todayWeekDay = new Date().getDay(); // 0-6 (Sun-Sat)
const openTowerMap = {
  5: [1], // Friday
  6: [2], // Saturday
  0: [3], // Sunday
  1: [4], // Monday
  2: [5], // Tuesday
  3: [6], // Wednesday
  4: [1, 2, 3, 4, 5, 6], // Thursday (All open)
};

const todayOpenTowers = computed(() => {
  return openTowerMap[todayWeekDay] || [];
});

const todayInfo = computed(() => {
  const weekDays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  const dayName = weekDays[todayWeekDay];
  const towers = todayOpenTowers.value;
  if (towers.length === 6) return `${dayName} - 全部开放`;
  if (towers.length > 0) return `${dayName} - BOSS ${towers.join(",")}`;
  return `${dayName} - 无活动`;
});

const isTowerOpen = (type) => {
  return (
    todayOpenTowers.value.includes(type) ||
    (todayOpenTowers.value.includes(6) && todayWeekDay === 4)
  ); // Special case for Thursday if map is correct
};

const isTowerCleared = (type) => {
  const key1 = `${type}008`;
  const key2 = Number(key1);
  return !!(levelRewardMap.value[key1] || levelRewardMap.value[key2]);
};

const getTowerLevel = (type) => {
  // Find highest cleared level
  for (let i = 8; i >= 1; i--) {
    const key1 = `${type}00${i}`;
    const key2 = Number(key1);
    if (levelRewardMap.value[key1] || levelRewardMap.value[key2]) {
      // If 8 is cleared, return 8
      if (i === 8) return 8;
      // Else return next level
      return i + 1;
    }
  }
  return 1;
};

const canChallenge = (type) => {
  return isActivityValid.value && isTowerOpen(type) && !isTowerCleared(type);
};

const getInfo = async () => {
  if (!tokenStore.selectedToken) return;
  const tokenId = tokenStore.selectedToken.id;
  if (tokenStore.getWebSocketStatus(tokenId) !== "connected") return;

  try {
    const send = (cmd, params, timeout) =>
      tokenStore.sendMessageWithPromise(tokenId, cmd, params, timeout);

    // 已知活动ID时先按原ID查询（快路径），失败或未知再全量探测
    let data = null;
    if (actId.value) {
      const res = await send(
        "towers_getinfo",
        { actId: Number(actId.value) },
        5000,
      ).catch(() => null);
      data = extractTowerData(res);
    }
    if (!data) {
      data = await resolveTowerActId(send);
      loadError.value = !data;
    } else {
      loadError.value = false;
    }

    if (data) {
      // 以服务器返回的真实 actId 为准
      actId.value = data.actId;
      levelRewardMap.value = data.levelRewardMap || {};

      // Try to find daily num if exists in response
      if (data.todayUseTickCnt !== undefined) {
        dailyFightNum.value = data.todayUseTickCnt;
      }
    }

    // 赛季号来自角色信息的 resetTime.season，失败不影响主流程
    if (!season.value) {
      try {
        const roleRes = await send("role_getroleinfo", {}, 8000);
        season.value = Number(roleRes?.resetTime?.season) || 0;
      } catch {
        // 下次刷新再取
      }
    }
  } catch (e) {
    // console.error(e);
  }
};

const refreshInfo = async () => {
  isFighting.value = true;
  await getInfo();
  message.success("进度已刷新");
  isFighting.value = false;
};

const challengeSingle = async (type) => {
  if (isFighting.value) return;

  isFighting.value = true;
  const tokenId = tokenStore.selectedToken.id;

  try {
    // 活动ID未知时先解析一次
    if (!actId.value) await getInfo();

    const currentActId = actId.value ? Number(actId.value) : null;
    if (!currentActId) {
      message.error("未获取到活动ID，请刷新进度后重试");
      return;
    }

    message.info(`开始挑战 BOSS ${type}`);

    let needStart = true;
    let loop = true;
    let failCount = 0;

    while (loop) {
      if (needStart) {
        await tokenStore.sendMessageWithPromise(
          tokenId,
          "towers_start",
          { actId: currentActId, towerType: type },
          5000,
        );
      }

      const fightRes = await tokenStore.sendMessageWithPromise(
        tokenId,
        "towers_fight",
        { actId: currentActId, towerType: type },
        5000,
      );
      const battleData = fightRes?.battleData;
      const curHP = battleData?.result?.accept?.ext?.curHP;

      if (curHP === 0) {
        // Get current level before updating info (it will be the level just cleared)
        const currentLevel = getTowerLevel(type);
        message.success(`BOSS ${type} 第 ${currentLevel} 层挑战成功`);

        // 挑战成功，不需要重新 start，直接继续 fight
        needStart = false;
        failCount = 0;

        // 检查是否通关（需要更新 levelRewardMap）
        await getInfo();
        if (isTowerCleared(type)) {
          loop = false;
          message.success(`BOSS ${type} 已全部通关`);
        } else {
          // 等待一下避免过快请求
          await new Promise((r) => setTimeout(r, 1000));
        }
      } else {
        const currentLevel = getTowerLevel(type);
        message.warning(`BOSS ${type} 第 ${currentLevel} 层挑战失败`);
        // 挑战失败，需要重新 start
        needStart = true;
        failCount++;

        if (failCount >= 3) {
          message.error(
            `BOSS ${type} 第 ${currentLevel} 层连续失败 3 次，停止挑战`,
          );
          loop = false;
        } else {
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
    }
  } catch (e) {
    message.error(`挑战出错: ${e.message}`);
  } finally {
    isFighting.value = false;
    await getInfo();
  }
};

watch(
  () => tokenStore.selectedToken,
  (newVal) => {
    // 切换账号时重置活动状态，避免沿用上一个账号的活动ID/赛季/进度
    actId.value = null;
    season.value = 0;
    loadError.value = false;
    levelRewardMap.value = {};
    dailyFightNum.value = 0;
    if (newVal) {
      setTimeout(getInfo, 1000);
    }
  },
  { immediate: true },
);

watch(
  () => tokenStore.getWebSocketStatus(tokenStore.selectedToken?.id),
  (status) => {
    if (status === "connected") {
      getInfo();
    }
  },
);
</script>

<style scoped lang="scss">
.header-info {
  display: flex;
  gap: var(--spacing-md);
  font-size: var(--font-size-sm);
  align-items: center;
  margin-bottom: var(--spacing-md);
  padding-bottom: var(--spacing-sm);
  border-bottom: 1px solid var(--border-color);
}

.challenge-count {
  font-weight: bold;
  color: var(--primary-color);
}

.daily-target {
  color: var(--text-secondary);
}

.act-id {
  margin-left: auto;
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
}

.boss-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-md);
}

.boss-card {
  background: var(--bg-secondary);
  border-radius: var(--border-radius-medium);
  padding: var(--spacing-sm);
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  border: 1px solid transparent;
  transition: all var(--transition-fast);

  &.active {
    background: #fff;
    border-color: var(--primary-color);
    box-shadow: var(--shadow-sm);
  }

  &.cleared {
    background: rgba(34, 197, 94, 0.05);
    border-color: var(--success-color);
  }

  &.locked {
    opacity: 0.7;
    background: var(--bg-tertiary);
  }
}

.expired-mask {
  text-align: center;
  color: var(--error-color);
  font-weight: bold;
  padding: var(--spacing-sm);
  background: rgba(239, 68, 68, 0.1);
  border-radius: var(--border-radius-medium);
  margin-bottom: var(--spacing-md);
}

.boss-grid.disabled {
  opacity: 0.5;
  pointer-events: none;
}

.boss-title {
  font-weight: bold;
  color: var(--primary-color);
  font-size: var(--font-size-md);
  margin-bottom: 4px;
}

.boss-level {
  font-size: var(--font-size-lg);
  font-weight: bold;
  margin-bottom: 8px;
}

.boss-status {
  margin-bottom: 8px;
}

.status-text {
  font-size: var(--font-size-sm);
  font-weight: bold;

  &.cleared {
    color: var(--success-color);
  }

  &.locked {
    color: var(--text-tertiary);
  }

  &.active {
    display: none; // Hide "进行中" text if button is there, or show it?
  }
}

.challenge-btn {
  background: var(--primary-color);
  color: white;
  border: none;
  border-radius: var(--border-radius-small);
  padding: 4px 12px;
  font-size: var(--font-size-xs);
  cursor: pointer;
  transition: background var(--transition-fast);

  &:disabled {
    background: var(--bg-tertiary);
    color: var(--text-tertiary);
    cursor: not-allowed;
  }

  &:not(:disabled):hover {
    background: var(--primary-color-hover);
  }
}

.action-row {
  margin-top: auto;
  display: flex;
  justify-content: flex-start;
}

.action-button {
  padding: var(--spacing-xs) var(--spacing-md);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  border: none;
  border-radius: var(--border-radius-medium);
  cursor: pointer;
  background: var(--bg-tertiary);
  color: var(--text-secondary);

  &:hover {
    background: var(--bg-secondary);
  }
}

@media (max-width: 640px) {
  .boss-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
