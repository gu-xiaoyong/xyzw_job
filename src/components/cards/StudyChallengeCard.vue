<template>
  <MyCard
    class="study"
    :status-class="{ weekly: true, completed: study.isCompleted }"
  >
    <template #icon>
      <img src="/icons/1736425783912140.png" alt="学习图标" />
    </template>
    <template #title>
      <h3>咸鱼大冲关</h3>
      <p>每日知识挑战</p>
    </template>
    <template #badge>
      <span>每周任务</span>
    </template>
    <template #default>
      <p class="description">没有什么可以阻挡我求知的欲望！</p>
    </template>
    <template #action>
      <a-button v-if="!study.thisWeek" status="primary" @click="startStudy">
        🎯 一键答题.
      </a-button>
      <a-button
        v-if="!study.thisWeek && isSameGameValue(study.status, 'starting')"
        status="warning"
        :disabled="true"
      >
        正在获取题库...
      </a-button>
      <a-button
        v-if="!study.thisWeek && isSameGameValue(study.status, 'answering')"
        status="warning"
        :disabled="true"
      >
        答题中...
      </a-button>
      <a-button
        v-if="
          !study.thisWeek && isSameGameValue(study.status, 'claiming_rewards')
        "
        status="warning"
        :disabled="true"
      >
        正在领取奖励...
      </a-button>
      <a-button
        v-if="!study.thisWeek && isSameGameValue(study.status, 'completed')"
        status="warning"
        :disabled="true"
      >
        答题完成
      </a-button>
      <a-button v-if="study.thisWeek" status="success" :disabled="true">
        ✅ 已完成无需作答
      </a-button>
    </template>
  </MyCard>
</template>

<script setup>
import { useMessage } from "naive-ui";
import { computed, watch } from "vue";
import { useTokenStore } from "@/stores/tokenStore";
import { isSameGameValue } from "@/utils/gameValue.js";
import {
  getQuestionCount,
  preloadQuestions,
} from "@/utils/studyQuestionsFromJSON.js";
import MyCard from "../Common/MyCard.vue";

const tokenStore = useTokenStore();
const message = useMessage();
const study = computed(() => tokenStore.gameData.studyStatus);

// 答题完成后弹出对错统计（仅单账号触发，批量任务在批量日志里看结果）
watch(
  () => study.value.status,
  (status) => {
    if (
      status === "completed" &&
      study.value.source === "single" &&
      study.value.correctCount != null
    ) {
      const total = study.value.questionCount || 10;
      message.success(
        `✅ 答题完成: 共${total}题, 答对${study.value.correctCount}题, 答错${study.value.wrongCount}题`,
      );
    }
  },
);

const startStudy = async () => {
  if (!tokenStore.selectedToken || study.value.thisWeek) return;
  if (
    !isSameGameValue(study.value.status, "") &&
    !isSameGameValue(study.value.status, "idel")
  )
    return;

  study.value.status = "starting";
  await preloadQuestions();
  study.value.status = "answering";
  const questionCount = await getQuestionCount();
  message.info(`🚀 开始一键答题... (题库包含 ${questionCount} 道题目)`);

  try {
    tokenStore.gameData.studyStatus = {
      ...tokenStore.gameData.studyStatus,
      isAnswering: true,
      questionCount: 0,
      answeredCount: 0,
      status: "starting",
      timestamp: Date.now(),
      baseCorrect: null,
      correctCount: null,
      wrongCount: null,
      source: "single",
    };
    const tokenId = tokenStore.selectedToken.id;
    tokenStore.sendMessage(tokenId, "study_startgame");
    setTimeout(() => {
      if (tokenStore.gameData.studyStatus.isAnswering) {
        tokenStore.gameData.studyStatus = {
          ...tokenStore.gameData.studyStatus,
          isAnswering: false,
          questionCount: 0,
          answeredCount: 0,
          status: "",
          timestamp: null,
        };
        message.warning("答题超时，已自动重置状态");
      }
    }, 40000);
  } catch (error) {
    console.error("启动答题失败:", error);
    message.error(`启动答题失败: ${error.message}`);
  }
};
</script>
