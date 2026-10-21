<template>
  <n-modal
    v-model:show="show"
    preset="card"
    title="一键使用兑换码"
    style="width: 90%; max-width: 560px"
  >
    <div class="settings-content">
      <n-alert type="info" show-icon style="margin-bottom: 12px">
        每行填写一个兑换码，也支持用空格、逗号或分号分隔。执行时会先读取角色已兑换记录，已使用的兑换码会自动跳过。
      </n-alert>
      <div class="settings-grid">
        <div class="setting-item">
          <label class="setting-label">兑换码列表</label>
          <n-input
            v-model:value="cdkCodes"
            type="textarea"
            placeholder="例如：&#10;vip666&#10;VIP666&#10;happy666"
            :autosize="{ minRows: 7, maxRows: 14 }"
          />
        </div>
        <div class="setting-item">
          <label class="setting-label">平台类型</label>
          <n-input v-model:value="cdkPlatformType" placeholder="默认 h5" />
        </div>
      </div>
      <div class="modal-actions" style="margin-top: 20px; text-align: right">
        <n-button @click="show = false" style="margin-right: 12px">
          取消
        </n-button>
        <n-button @click="$emit('save')" style="margin-right: 12px">
          保存配置
        </n-button>
        <n-button
          type="primary"
          @click="$emit('execute')"
          :disabled="!cdkCodes?.trim()"
        >
          开始兑换
        </n-button>
      </div>
    </div>
  </n-modal>
</template>
<script setup>
defineEmits(["save", "execute"]);

const show = defineModel("show", { type: Boolean, default: false });
const cdkCodes = defineModel("cdkCodes", { type: String, default: "" });
const cdkPlatformType = defineModel("cdkPlatformType", {
  type: String,
  default: "h5",
});
</script>
