<template>
  <span
    :style="{
      fontWeight: 'bold',
      color: isNearExecution ? '#ff4d4f' : '#1677ff',
    }"
  >
    {{ task.enabled ? formatted || "计算中..." : "已禁用" }}
  </span>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from "vue";
import {
  calculateNextExecutionTime,
  formatTimeDifference,
} from "@/utils/batch";

// 每秒刷新的倒计时文本被隔离在本组件内，
// 避免父级巨型组件因倒计时数据每秒变化而整体重渲染
const props = defineProps({
  task: {
    type: Object,
    required: true,
  },
});

const now = ref(Date.now());
const nextExecutionTime = ref(0);

let tickTimer = null;

const startTick = () => {
  if (tickTimer) clearInterval(tickTimer);
  tickTimer = setInterval(() => {
    now.value = Date.now();
  }, 1000);
};

watch(
  () => props.task,
  (task) => {
    nextExecutionTime.value = task?.enabled
      ? calculateNextExecutionTime(task) || 0
      : 0;
  },
  { immediate: true, deep: true },
);

// 任务启用状态变化时重建定时器，禁用任务不空转
watch(
  () => props.task?.enabled,
  (enabled) => {
    if (enabled) {
      now.value = Date.now();
      startTick();
    } else if (tickTimer) {
      clearInterval(tickTimer);
      tickTimer = null;
    }
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  if (tickTimer) clearInterval(tickTimer);
});

const remainingTime = computed(() =>
  nextExecutionTime.value
    ? Math.max(0, nextExecutionTime.value - now.value)
    : 0,
);

const formatted = computed(() => formatTimeDifference(remainingTime.value));
const isNearExecution = computed(
  () => nextExecutionTime.value > 0 && remainingTime.value < 5 * 60 * 1000,
);
</script>
