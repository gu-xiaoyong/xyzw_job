<template>
  <n-modal
    v-model:show="show"
    preset="card"
    title="定时任务列表"
    style="width: 90%; max-width: 800px"
  >
    <div class="tasks-list" style="max-height: 600px; overflow-y: auto">
      <div
        v-for="task in tasks"
        :key="task.id"
        class="task-item"
        style="
          margin-bottom: 16px;
          padding: 12px;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
        "
      >
        <div
          style="
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
          "
        >
          <div style="font-weight: bold">{{ task.name }}</div>
          <n-switch
            v-model:value="task.enabled"
            @update:value="$emit('toggle', task.id, $event)"
          >
          </n-switch>
        </div>
        <div style="margin-bottom: 4px">
          <span style="color: #6b7280">运行类型：</span>
          <span>{{
            task.runType === "daily" ? "每天固定时间" : "Cron表达式"
          }}</span>
        </div>
        <div style="margin-bottom: 4px">
          <span style="color: #6b7280">运行时间：</span>
          <span>{{
            task.runType === "daily" ? task.runTime : task.cronExpression
          }}</span>
        </div>
        <div style="margin-bottom: 4px">
          <span style="color: #6b7280">下次执行：</span>
          <TaskCountdown :task="task" />
        </div>
        <div style="margin-bottom: 4px">
          <span style="color: #6b7280">选中账号：</span>
          <span>{{ task.selectedTokens.length }} 个</span>
        </div>
        <div style="margin-bottom: 8px">
          <span style="color: #6b7280">选中任务：</span>
          <span>{{ task.selectedTasks.length }} 个</span>
        </div>
        <div style="display: flex; gap: 8px">
          <n-button size="tiny" @click="$emit('edit', task)"> 编辑 </n-button>
          <n-button size="tiny" type="error" @click="$emit('delete', task.id)">
            删除
          </n-button>
          <n-button
            size="tiny"
            type="info"
            secondary
            :loading="executingTaskIds.includes(task.id)"
            @click="$emit('execute', task)"
          >
            立即执行
          </n-button>
        </div>
      </div>
      <div
        v-if="tasks.length === 0"
        style="text-align: center; padding: 24px; color: #6b7280"
      >
        暂无定时任务
      </div>
    </div>
  </n-modal>
</template>
<script setup>
import TaskCountdown from "@/components/Daily/TaskCountdown.vue";

defineProps({
  tasks: { type: Array, default: () => [] },
  executingTaskIds: { type: Array, default: () => [] },
});

defineEmits(["toggle", "edit", "delete", "execute"]);

const show = defineModel("show", { type: Boolean, default: false });
</script>
