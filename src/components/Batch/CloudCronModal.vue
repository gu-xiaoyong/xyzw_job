<template>
  <n-modal
    v-model:show="show"
    preset="card"
    title="云端定时（服务端自动执行，无需保持页面打开）"
    style="width: 92%; max-width: 640px"
  >
    <div class="settings-content">
      <div class="setting-item">
        <label class="setting-label">后端服务地址</label>
        <n-input
          v-model:value="backendUrl"
          placeholder="例如 https://xyzw-backend.onrender.com"
          clearable
        />
      </div>
      <div class="setting-item">
        <label class="setting-label">访问密钥（后端 BACKEND_KEY）</label>
        <n-input
          v-model:value="backendKey"
          type="password"
          show-password-on="click"
          placeholder="与后端环境变量 BACKEND_KEY 一致"
        />
      </div>
      <n-space>
        <n-button size="small" :loading="cloudTesting" @click="$emit('test')">
          测试连接
        </n-button>
        <n-button
          size="small"
          type="primary"
          :loading="cloudSyncing"
          @click="$emit('sync')"
        >
          同步 Token 与定时任务
        </n-button>
        <n-button
          size="small"
          :loading="cloudTestResultsLoading"
          @click="$emit('test-tokens')"
        >
          测试Token有效性
        </n-button>
        <n-button
          size="small"
          :loading="cloudLogLoading"
          @click="$emit('load-logs')"
        >
          刷新云端日志
        </n-button>
      </n-space>
      <div
        v-if="cloudStatus"
        class="cloud-status"
        :style="{ color: cloudStatusOk ? '#18a058' : '#d03050' }"
      >
        {{ cloudStatus }}
      </div>
      <div v-if="cloudTestResults.length" class="cloud-test-results">
        <div
          v-for="r in cloudTestResults"
          :key="r.id"
          style="font-size: 13px; line-height: 1.8"
        >
          {{ r.ok ? "✅" : "❌" }} {{ r.name }}:
          {{ r.ok ? `有效（${r.detail}）` : r.error }}
        </div>
      </div>
      <div v-if="cloudLogs.length" class="cloud-logs">
        <div v-for="(log, i) in cloudLogs" :key="i" class="cloud-log-line">
          <span
            :style="{
              color:
                log.status === 'success'
                  ? '#18a058'
                  : log.status === 'error'
                    ? '#d03050'
                    : '#6b7280',
            }"
          >
            [{{ log.created_at?.slice(5, 16).replace("T", " ") }}]
            {{ log.token_name }} {{ log.task_type }}: {{ log.status
            }}{{ log.message ? ` - ${log.message}` : "" }}
          </span>
        </div>
      </div>
      <n-alert type="warning" :show-icon="false" style="margin-top: 8px">
        同步会把 Token 明文上传到云端数据库、定时由服务端执行。仅支持领取类任务
        （日常礼包/挂机/爬塔/功法/活跃度/逐鹿盐山任务/珍宝阁/答题/签到/灯神），
        其余复杂任务会在同步时跳过。
      </n-alert>
    </div>
  </n-modal>
</template>

<script setup>
defineProps({
  cloudBackendUrl: { type: String, default: "" },
  cloudBackendKey: { type: String, default: "" },
  cloudTesting: { type: Boolean, default: false },
  cloudSyncing: { type: Boolean, default: false },
  cloudTestResultsLoading: { type: Boolean, default: false },
  cloudLogLoading: { type: Boolean, default: false },
  cloudStatus: { type: String, default: "" },
  cloudStatusOk: { type: Boolean, default: false },
  cloudTestResults: { type: Array, default: () => [] },
  cloudLogs: { type: Array, default: () => [] },
});

defineEmits(["test", "sync", "test-tokens", "load-logs"]);

const show = defineModel("show", { type: Boolean, default: false });
const backendUrl = defineModel("backendUrl", { type: String, default: "" });
const backendKey = defineModel("backendKey", { type: String, default: "" });
</script>
