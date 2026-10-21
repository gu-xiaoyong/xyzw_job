<template>
  <n-modal
    v-model:show="show"
    preset="card"
    title="批量申请俱乐部"
    style="width: 90%; max-width: 720px"
  >
    <div class="settings-content">
      <div class="settings-grid" style="display: block">
        <div
          style="
            margin-bottom: 16px;
            display: flex;
            align-items: center;
            gap: 12px;
            flex-wrap: wrap;
          "
        >
          <span style="font-size: 16px">俱乐部ID:</span>
          <n-input-number
            v-model:value="targetId"
            placeholder="请输入俱乐部ID"
            :min="1"
            clearable
            style="width: 180px"
          />
          <n-button @click="$emit('fetch')" :loading="applyLegionLoading">
            查询俱乐部
          </n-button>
          <n-button
            type="primary"
            @click="$emit('apply')"
            :disabled="!applyLegionPreview?.id || isRunning"
          >
            发起申请
          </n-button>
        </div>

        <div
          style="
            margin-bottom: 12px;
            padding: 12px;
            border-radius: 8px;
            background: #f8f9fa;
            border: 1px solid #e9ecef;
            color: #666;
          "
        >
          仅会对当前未加入俱乐部的账号发申请，已加入任意俱乐部的账号会自动跳过。
        </div>

        <n-alert
          v-if="applyLegionError"
          type="error"
          :show-icon="true"
          style="margin-bottom: 16px"
        >
          {{ applyLegionError }}
        </n-alert>

        <div
          v-if="applyLegionPreview"
          style="
            display: flex;
            gap: 16px;
            align-items: flex-start;
            padding: 16px;
            border: 1px solid #e5e7eb;
            border-radius: 10px;
            background: white;
          "
        >
          <img
            :src="applyLegionPreview.logo || ''"
            alt="俱乐部头像"
            style="
              width: 64px;
              height: 64px;
              border-radius: 50%;
              object-fit: cover;
              background: #f3f4f6;
              border: 1px solid #e5e7eb;
            "
          />
          <div style="flex: 1; min-width: 0">
            <div
              style="
                display: flex;
                justify-content: space-between;
                gap: 12px;
                flex-wrap: wrap;
                margin-bottom: 8px;
              "
            >
              <div style="font-size: 18px; font-weight: 600">
                {{ applyLegionPreview.name }}
              </div>
              <n-tag type="info">ID: {{ applyLegionPreview.id }}</n-tag>
            </div>
            <div style="display: flex; gap: 16px; flex-wrap: wrap; color: #666">
              <span>等级: {{ applyLegionPreview.level || 0 }}</span>
              <span>成员数: {{ applyLegionPreview.memberCount || 0 }}</span>
              <span v-if="applyLegionPreview.chairmanName">
                会长: {{ applyLegionPreview.chairmanName }}
              </span>
            </div>
            <div
              v-if="applyLegionPreview.notice"
              style="margin-top: 10px; color: #666; line-height: 1.5"
            >
              公告: {{ applyLegionPreview.notice }}
            </div>
          </div>
        </div>
      </div>
      <div class="modal-actions" style="margin-top: 20px; text-align: right">
        <n-button @click="show = false">关闭</n-button>
      </div>
    </div>
  </n-modal>
</template>
<script setup>
defineProps({
  applyLegionPreview: { type: Object, default: null },
  applyLegionLoading: { type: Boolean, default: false },
  applyLegionError: { type: String, default: "" },
  isRunning: { type: Boolean, default: false },
});

defineEmits(["fetch", "apply"]);

const show = defineModel("show", { type: Boolean, default: false });
const targetId = defineModel("targetId", { type: Number, default: null });
</script>
