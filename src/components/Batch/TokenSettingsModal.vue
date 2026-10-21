<template>
  <n-modal
    v-model:show="show"
    preset="card"
    :title="`任务设置 - ${tokenName}`"
    style="width: 90%; max-width: 400px"
  >
    <div class="settings-content">
      <div class="settings-grid">
        <div class="setting-item">
          <label class="setting-label">竞技场阵容</label>
          <n-select
            v-model:value="currentSettings.arenaFormation"
            :options="formationOptions"
            size="small"
          />
        </div>
        <div class="setting-item">
          <label class="setting-label">爬塔阵容</label>
          <n-select
            v-model:value="currentSettings.towerFormation"
            :options="towerFormationOptions"
            size="small"
          />
        </div>
        <div class="setting-item">
          <label class="setting-label">BOSS阵容</label>
          <n-select
            v-model:value="currentSettings.bossFormation"
            :options="formationOptions"
            size="small"
          />
        </div>
        <div class="setting-item">
          <label class="setting-label">BOSS次数</label>
          <n-select
            v-model:value="currentSettings.bossTimes"
            :options="bossTimesOptions"
            size="small"
          />
        </div>
        <div class="setting-switches">
          <div class="switch-row">
            <span class="switch-label">领罐子</span
            ><n-switch v-model:value="currentSettings.claimBottle" />
          </div>
          <div class="switch-row">
            <span class="switch-label">领挂机</span
            ><n-switch v-model:value="currentSettings.claimHangUp" />
          </div>
          <div class="switch-row">
            <span class="switch-label">竞技场</span
            ><n-switch v-model:value="currentSettings.arenaEnable" />
          </div>
          <div class="switch-row">
            <span class="switch-label">开宝箱</span
            ><n-switch v-model:value="currentSettings.openBox" />
          </div>
          <div class="switch-row">
            <span class="switch-label">领取邮件奖励</span
            ><n-switch v-model:value="currentSettings.claimEmail" />
          </div>
          <div class="switch-row">
            <span class="switch-label">黑市购买物品</span
            ><n-switch v-model:value="currentSettings.blackMarketPurchase" />
          </div>
          <div class="switch-row">
            <span class="switch-label">付费招募</span
            ><n-switch v-model:value="currentSettings.payRecruit" />
          </div>
        </div>
      </div>
      <div class="modal-actions" style="margin-top: 20px; text-align: right">
        <n-button type="primary" @click="$emit('save')">保存设置</n-button>
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
  // 父级的响应式设置对象，字段在此就地编辑（父级保存时统一写盘）
  currentSettings: { type: Object, required: true },
  tokenName: { type: String, default: "" },
});

defineEmits(["save"]);

const show = defineModel("show", { type: Boolean, default: false });
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
