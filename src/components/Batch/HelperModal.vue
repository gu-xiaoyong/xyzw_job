<template>
  <n-modal
    v-model:show="show"
    preset="card"
    :title="title"
    style="width: 90%; max-width: 400px"
  >
    <div class="settings-content">
      <div class="settings-grid">
        <div class="setting-item" v-if="helperType === 'box'">
          <label class="setting-label">宝箱类型</label>
          <n-select
            v-model:value="helperSettings.boxType"
            :options="boxTypeOptions"
            size="small"
          />
        </div>
        <div class="setting-item" v-if="helperType === 'fish'">
          <label class="setting-label">鱼竿类型</label>
          <n-select
            v-model:value="helperSettings.fishType"
            :options="fishTypeOptions"
            size="small"
          />
        </div>
        <div class="setting-item" v-if="helperType === 'pointsBox'">
          <label class="setting-label">目标积分</label>
          <n-input-number
            v-model:value="helperSettings.targetPoints"
            :min="1"
            :max="1000000"
            :step="100"
            size="small"
            style="width: 100%"
          />
        </div>
        <n-alert
          v-if="helperType === 'pointsBox'"
          type="info"
          style="margin-bottom: 12px"
        >
          开箱优先级: 木质宝箱(保留200个) → 青铜宝箱 → 黄金宝箱 → 铂金宝箱<br />
          积分: 木质=1分, 青铜=10分, 黄金=20分, 铂金=50分
        </n-alert>
        <div class="setting-item" v-if="helperType !== 'pointsBox'">
          <label class="setting-label">消耗数量（10的倍数）</label>
          <n-input-number
            v-model:value="helperSettings.count"
            :min="10"
            :max="10000"
            :step="10"
            size="small"
          />
        </div>
      </div>
      <div class="modal-actions" style="margin-top: 20px; text-align: right">
        <n-button @click="show = false" style="margin-right: 12px"
          >取消</n-button
        >
        <n-button type="primary" @click="$emit('execute')">开始执行</n-button>
      </div>
    </div>
  </n-modal>
</template>
<script setup>
import { boxTypeOptions, fishTypeOptions } from "@/utils/batch/constants";

defineProps({
  title: { type: String, default: "批量助手" },
  helperType: { type: String, default: "box" },
  helperSettings: { type: Object, required: true },
});

defineEmits(["execute"]);

const show = defineModel("show", { type: Boolean, default: false });
</script>
