<template>
  <n-modal
    v-model:show="show"
    preset="card"
    title="月赛助威"
    style="width: 90%; max-width: 800px"
  >
    <div class="settings-content">
      <div class="settings-grid" style="display: block">
        <div
          style="
            margin-bottom: 16px;
            display: flex;
            align-items: center;
            gap: 12px;
          "
        >
          <span style="font-size: 16px">拍手器:</span>
          <n-input-number
            v-model:value="coin"
            placeholder="拍手器"
            :min="1"
            :max="20"
            style="width: 120px"
          >
          </n-input-number>
          <n-button
            type="primary"
            @click="$emit('cheer')"
            :disabled="!selectedWarGuessLegionId || isRunning"
          >
            助威
          </n-button>
          <n-button @click="$emit('fetch')" :loading="warGuessLoading">
            刷新数据
          </n-button>
        </div>

        <n-data-table
          :columns="warGuessColumns"
          :data="warGuessList"
          :loading="warGuessLoading"
          :row-key="(row) => row.id"
          :checked-row-keys="
            selectedWarGuessLegionId ? [selectedWarGuessLegionId] : []
          "
          @update:checked-row-keys="
            (keys) => (selectedWarGuessLegionId = keys[0])
          "
          :row-props="warGuessRowProps"
          style="height: 400px; flex: 1"
          flex-height
        />
      </div>
      <div class="modal-actions" style="margin-top: 20px; text-align: right">
        <n-button @click="show = false">关闭</n-button>
      </div>
    </div>
  </n-modal>
</template>
<script setup>
defineProps({
  warGuessList: { type: Array, default: () => [] },
  warGuessLoading: { type: Boolean, default: false },
  warGuessColumns: { type: Array, required: true },
  warGuessRowProps: { type: Function, required: true },
  isRunning: { type: Boolean, default: false },
});

defineEmits(["cheer", "fetch"]);

const show = defineModel("show", { type: Boolean, default: false });
const coin = defineModel("coin", { type: Number, default: 20 });
const selectedWarGuessLegionId = defineModel("selectedWarGuessLegionId", {
  type: Number,
  default: null,
});
</script>
