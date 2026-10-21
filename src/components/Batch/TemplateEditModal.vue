<template>
  <n-modal
    v-model:show="show"
    preset="card"
    :title="isEditing ? '编辑任务模板' : '任务模板设置'"
    style="width: 90%; max-width: 400px"
  >
    <div class="settings-content">
      <div class="settings-grid">
        <div class="setting-item">
          <label class="setting-label">模板名称</label>
          <n-input
            v-model:value="templateName"
            placeholder="请输入模板名称"
            size="small"
          />
        </div>
        <div class="setting-item">
          <label class="setting-label">竞技场阵容</label>
          <n-select
            v-model:value="currentTemplate.arenaFormation"
            :options="formationOptions"
            size="small"
          />
        </div>
        <div class="setting-item">
          <label class="setting-label">爬塔阵容</label>
          <n-select
            v-model:value="currentTemplate.towerFormation"
            :options="towerFormationOptions"
            size="small"
          />
        </div>
        <div class="setting-item">
          <label class="setting-label">BOSS阵容</label>
          <n-select
            v-model:value="currentTemplate.bossFormation"
            :options="formationOptions"
            size="small"
          />
        </div>
        <div class="setting-item">
          <label class="setting-label">BOSS次数</label>
          <n-select
            v-model:value="currentTemplate.bossTimes"
            :options="bossTimesOptions"
            size="small"
          />
        </div>
        <div class="setting-switches">
          <div class="switch-row">
            <span class="switch-label">领罐子</span
            ><n-switch v-model:value="currentTemplate.claimBottle" />
          </div>
          <div class="switch-row">
            <span class="switch-label">领挂机</span
            ><n-switch v-model:value="currentTemplate.claimHangUp" />
          </div>
          <div class="switch-row">
            <span class="switch-label">竞技场</span
            ><n-switch v-model:value="currentTemplate.arenaEnable" />
          </div>
          <div class="switch-row">
            <span class="switch-label">开宝箱</span
            ><n-switch v-model:value="currentTemplate.openBox" />
          </div>
          <div class="switch-row">
            <span class="switch-label">领取邮件奖励</span
            ><n-switch v-model:value="currentTemplate.claimEmail" />
          </div>
          <div class="switch-row">
            <span class="switch-label">黑市购买物品</span
            ><n-switch v-model:value="currentTemplate.blackMarketPurchase" />
          </div>
          <div class="switch-row">
            <span class="switch-label">付费招募</span
            ><n-switch v-model:value="currentTemplate.payRecruit" />
          </div>
        </div>
      </div>
      <div class="modal-actions" style="margin-top: 20px; text-align: right">
        <n-button @click="show = false" style="margin-right: 12px"
          >取消</n-button
        >
        <n-button @click="$emit('save')" type="primary">保存模板</n-button>
      </div>
    </div>
  </n-modal>
</template>
<script setup>
import {
  bossTimesOptions,
  formationOptions,
  towerFormationOptions,
} from "@/utils/batch/constants";

defineProps({
  // 模板编辑对象（currentTemplate reactive），字段在此就地编辑
  currentTemplate: { type: Object, required: true },
  isEditing: { type: Boolean, default: false },
});

defineEmits(["save"]);

const show = defineModel("show", { type: Boolean, default: false });
const templateName = defineModel("templateName", {
  type: String,
  default: "",
});
</script>

<style scoped lang="scss">
.settings-grid {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.setting-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.setting-label {
  font-size: 14px;
  color: #666;
}

.setting-switches {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.switch-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #eee;

  &:last-child {
    border-bottom: none;
  }
}

.switch-label {
  font-size: 14px;
  color: #666;
}
</style>
