<template>
  <div
    v-if="shortest"
    style="font-size: 14px; font-weight: 500; color: #1677ff"
  >
    即将执行：{{ shortest.task.name }}（{{ shortest.formatted }}）
  </div>
  <div v-else style="font-size: 14px; color: #6c757d">暂无定时任务</div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from "vue";
import {
  calculateNextExecutionTime,
  formatTimeDifference,
} from "@/utils/batch";

// 每秒刷新的「即将执行」横幅被隔离在本组件内，
// 避免父级巨型组件因倒计时数据每秒变化而整体重渲染
const props = defineProps({
  tasks: {
    type: Array,
    default: () => [],
  },
});

const now = ref(Date.now());
let tickTimer = null;

const startTick = () => {
  if (tickTimer) clearInterval(tickTimer);
  tickTimer = setInterval(() => {
    now.value = Date.now();
  }, 1000);
};

watch(
  () => props.tasks.some((t) => t?.enabled),
  (anyEnabled) => {
    if (anyEnabled) startTick();
    else if (tickTimer) {
      clearInterval(tickTimer);
      tickTimer = null;
    }
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  if (tickTimer) clearInterval(tickTimer);
});

const shortest = computed(() => {
  let shortestTask = null;
  let shortestTime = Infinity;
  let shortestFormatted = "";

  for (const task of props.tasks) {
    if (!task?.enabled) continue;
    const next = calculateNextExecutionTime(task);
    if (!next) continue;
    const remaining = next - now.value;
    if (remaining < shortestTime) {
      shortestTime = remaining;
      shortestTask = task;
      shortestFormatted = formatTimeDifference(Math.max(0, remaining));
    }
  }

  return shortestTask
    ? { task: shortestTask, formatted: shortestFormatted }
    : null;
});
</script>
