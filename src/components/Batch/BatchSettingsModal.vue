<template>
  <n-modal
    v-model:show="show"
    preset="card"
    title="任务设置"
    class="batch-settings-modal"
    style="width: 90%; max-width: 700px"
  >
    <div class="settings-content">
      <n-grid cols="1 s:2" :x-gap="24" :y-gap="24">
        <!-- 左列：批量操作设置 -->
        <n-grid-item>
          <n-divider title-placement="left" style="margin: 1px 0 8px 0"
            >批量操作设置</n-divider
          >
          <div class="settings-grid">
            <div
              class="setting-item"
              style="
                flex-direction: row;
                justify-content: space-between;
                align-items: center;
              "
            >
              <label class="setting-label">开箱数量(10倍)</label>
              <n-input-number
                v-model:value="batchSettings.boxCount"
                :min="10"
                :max="10000"
                :step="10"
                size="small"
                style="width: 100px"
              />
            </div>
            <div
              class="setting-item"
              style="
                flex-direction: row;
                justify-content: space-between;
                align-items: center;
              "
            >
              <label class="setting-label">钓鱼数量(10倍)</label>
              <n-input-number
                v-model:value="batchSettings.fishCount"
                :min="10"
                :max="10000"
                :step="10"
                size="small"
                style="width: 100px"
              />
            </div>
            <div
              class="setting-item"
              style="
                flex-direction: row;
                justify-content: space-between;
                align-items: center;
              "
            >
              <label class="setting-label">招募数量(10倍)</label>
              <n-input-number
                v-model:value="batchSettings.recruitCount"
                :min="10"
                :max="10000"
                :step="10"
                size="small"
                style="width: 100px"
              />
            </div>
            <div
              class="setting-item"
              style="
                flex-direction: row;
                justify-content: space-between;
                align-items: center;
              "
            >
              <label class="setting-label">默认宝箱类型</label>
              <n-select
                v-model:value="batchSettings.defaultBoxType"
                :options="boxTypeOptions"
                size="small"
                style="width: 100px"
              />
            </div>
            <div
              class="setting-item"
              style="
                flex-direction: row;
                justify-content: space-between;
                align-items: center;
              "
            >
              <label class="setting-label">默认鱼竿类型</label>
              <n-select
                v-model:value="batchSettings.defaultFishType"
                :options="fishTypeOptions"
                size="small"
                style="width: 100px"
              />
            </div>
            <div
              class="setting-item"
              style="
                flex-direction: row;
                justify-content: space-between;
                align-items: center;
              "
            >
              <label class="setting-label">按积分开箱目标</label>
              <n-input-number
                v-model:value="batchSettings.targetBoxPoints"
                :min="1"
                :max="1000000"
                :step="100"
                size="small"
                style="width: 100px"
              />
            </div>
            <div
              class="setting-item"
              style="
                flex-direction: row;
                justify-content: space-between;
                align-items: center;
              "
            >
              <label class="setting-label">梦境商品购买配置</label>
              <n-button size="small" @click="$emit('open-dream-buy')"
                >点击配置</n-button
              >
            </div>
          </div>
          <n-divider title-placement="left" style="margin: 12px 0 8px 0"
            >功法赠送设置</n-divider
          >
          <div class="settings-grid">
            <div
              class="setting-item"
              style="
                flex-direction: row;
                justify-content: space-between;
                align-items: center;
              "
            >
              <label class="setting-label">接收者ID</label>
              <n-input-number
                v-model:value="batchSettings.receiverId"
                placeholder="ID"
                size="small"
                style="width: 100px"
                :show-button="false"
              />
            </div>
            <div
              class="setting-item"
              style="
                flex-direction: row;
                justify-content: space-between;
                align-items: center;
              "
            >
              <label class="setting-label">密码</label>
              <n-input
                v-model:value="batchSettings.password"
                type="password"
                placeholder="密码"
                size="small"
                style="width: 100px"
              />
            </div>
          </div>
        </n-grid-item>
        <!-- 右列：延迟与连接设置 -->
        <n-grid-item>
          <n-divider title-placement="left" style="margin: 1px 0 8px 0"
            >延迟设置(ms)</n-divider
          >
          <div class="settings-grid">
            <div
              class="setting-item"
              style="
                flex-direction: row;
                justify-content: space-between;
                align-items: center;
              "
            >
              <label class="setting-label">命令延迟</label>
              <n-input-number
                v-model:value="batchSettings.commandDelay"
                :min="100"
                :max="2000"
                :step="100"
                size="small"
                style="width: 100px"
              />
            </div>
            <div
              class="setting-item"
              style="
                flex-direction: row;
                justify-content: space-between;
                align-items: center;
              "
            >
              <label class="setting-label">任务间延迟</label>
              <n-input-number
                v-model:value="batchSettings.taskDelay"
                :min="100"
                :max="2000"
                :step="100"
                size="small"
                style="width: 100px"
              />
            </div>
            <div
              class="setting-item"
              style="
                flex-direction: row;
                justify-content: space-between;
                align-items: center;
              "
            >
              <label class="setting-label">操作延迟</label>
              <n-input-number
                v-model:value="batchSettings.actionDelay"
                :min="100"
                :max="2000"
                :step="100"
                size="small"
                style="width: 100px"
              />
            </div>
            <div
              class="setting-item"
              style="
                flex-direction: row;
                justify-content: space-between;
                align-items: center;
              "
            >
              <label class="setting-label">战斗延迟</label>
              <n-input-number
                v-model:value="batchSettings.battleDelay"
                :min="100"
                :max="2000"
                :step="100"
                size="small"
                style="width: 100px"
              />
            </div>
            <div
              class="setting-item"
              style="
                flex-direction: row;
                justify-content: space-between;
                align-items: center;
              "
            >
              <label class="setting-label">刷新延迟</label>
              <n-input-number
                v-model:value="batchSettings.refreshDelay"
                :min="500"
                :max="3000"
                :step="100"
                size="small"
                style="width: 100px"
              />
            </div>
            <div
              class="setting-item"
              style="
                flex-direction: row;
                justify-content: space-between;
                align-items: center;
              "
            >
              <label class="setting-label">长延迟</label>
              <n-input-number
                v-model:value="batchSettings.longDelay"
                :min="1000"
                :max="10000"
                :step="500"
                size="small"
                style="width: 100px"
              />
            </div>
          </div>
          <n-divider title-placement="left" style="margin: 12px 0 8px 0"
            >连接设置</n-divider
          >
          <div class="settings-grid">
            <div
              class="setting-item"
              style="
                flex-direction: row;
                justify-content: space-between;
                align-items: center;
              "
            >
              <label class="setting-label">最大并发数</label>
              <n-input-number
                v-model:value="batchSettings.maxActive"
                :min="1"
                :max="20"
                :step="1"
                size="small"
                style="width: 100px"
              />
            </div>
            <div
              class="setting-item"
              style="
                flex-direction: row;
                justify-content: space-between;
                align-items: center;
              "
            >
              <label class="setting-label">连接超时(ms)</label>
              <n-input-number
                v-model:value="batchSettings.connectionTimeout"
                :min="1000"
                :max="30000"
                :step="1000"
                size="small"
                style="width: 100px"
              />
            </div>
            <div
              class="setting-item"
              style="
                flex-direction: row;
                justify-content: space-between;
                align-items: center;
              "
            >
              <label class="setting-label">重连等待(ms)</label>
              <n-input-number
                v-model:value="batchSettings.reconnectDelay"
                :min="100"
                :max="5000"
                :step="100"
                size="small"
                style="width: 100px"
              />
            </div>
          </div>
          <n-divider title-placement="left" style="margin: 12px 0 8px 0"
            >系统设置</n-divider
          >
          <div class="settings-grid">
            <div
              class="setting-item"
              style="
                flex-direction: row;
                justify-content: space-between;
                align-items: center;
              "
            >
              <label class="setting-label">列表每行数量</label>
              <n-input-number
                v-model:value="batchSettings.tokenListColumns"
                :min="1"
                :max="10"
                :step="1"
                size="small"
                style="width: 100px"
              />
            </div>
            <div
              class="setting-item"
              style="
                flex-direction: row;
                justify-content: space-between;
                align-items: center;
              "
            >
              <label class="setting-label">最大日志条目</label>
              <n-input-number
                v-model:value="batchSettings.maxLogEntries"
                :min="100"
                :max="5000"
                :step="100"
                size="small"
                style="width: 100px"
              />
            </div>
            <div
              class="setting-item"
              style="
                flex-direction: row;
                justify-content: space-between;
                align-items: center;
              "
            >
              <label class="setting-label">定时刷新页面</label>
              <n-switch v-model:value="batchSettings.enableRefresh" />
            </div>
            <div
              class="setting-item"
              style="
                flex-direction: row;
                justify-content: space-between;
                align-items: center;
              "
              v-if="batchSettings.enableRefresh"
            >
              <label class="setting-label">刷新间隔(分钟)</label>
              <n-input-number
                v-model:value="batchSettings.refreshInterval"
                :min="10"
                :max="1440"
                :step="30"
                size="small"
                style="width: 100px"
              />
            </div>
          </div>
        </n-grid-item>
      </n-grid>
      <div class="modal-actions" style="margin-top: 20px; text-align: right">
        <n-button @click="show = false" style="margin-right: 12px"
          >取消</n-button
        >
        <n-button type="primary" @click="$emit('save')">保存设置</n-button>
      </div>
    </div>
  </n-modal>
</template>

<script setup>
defineProps({
  // 批量设置对象（batchSettings reactive），字段在此就地编辑
  batchSettings: { type: Object, required: true },
});

defineEmits(["save", "open-dream-buy"]);

const show = defineModel("show", { type: Boolean, default: false });
</script>
