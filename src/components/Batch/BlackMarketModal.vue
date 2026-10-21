<template>
  <n-modal
    v-model:show="show"
    preset="card"
    title="黑市采购清单配置"
    style="width: 90%; max-width: 760px"
  >
    <div class="settings-content">
      <n-alert type="info" show-icon style="margin-bottom: 12px">
        这里保存的是要下发到游戏服务器的黑市采购清单。每条填写 `itemId`
        和折扣，折扣范围
        1-10；保存后需手动执行“一键配置黑市清单”才会真正写入服务器。
      </n-alert>

      <div style="display: flex; gap: 12px; margin-bottom: 12px">
        <n-button size="small" type="primary" @click="$emit('add')">
          新增条目
        </n-button>
        <n-button size="small" @click="$emit('reset')"> 恢复默认 </n-button>
      </div>

      <n-alert type="warning" show-icon style="margin-bottom: 12px">
        优先从下拉框选择常用物品，系统会自动填入
        `itemId`、备注和推荐折扣；如果下拉里没有，再手动填写 `itemId`。
      </n-alert>

      <div
        v-for="(item, index) in list"
        :key="`${index}-${item.itemId ?? 'new'}`"
        class="purchase-row"
      >
        <n-select
          :value="item.itemId"
          :options="itemOptions"
          placeholder="选择常用物品"
          clearable
          filterable
          @update:value="(value) => $emit('apply-catalog', index, value)"
        />
        <n-input-number
          v-model:value="item.itemId"
          placeholder="itemId"
          :min="1"
          :show-button="false"
        />
        <n-input-number
          v-model:value="item.discount"
          placeholder="折扣"
          :min="1"
          :max="10"
        />
        <n-input v-model:value="item.note" placeholder="备注（可选）" />
        <n-button type="error" secondary @click="$emit('remove', index)">
          删除
        </n-button>
      </div>

      <div class="modal-actions" style="margin-top: 20px; text-align: right">
        <n-button @click="show = false" style="margin-right: 12px">
          取消
        </n-button>
        <n-button type="primary" @click="$emit('save')"> 保存配置 </n-button>
      </div>
    </div>
  </n-modal>
</template>
<script setup>
defineProps({
  itemOptions: { type: Array, default: () => [] },
});

defineEmits(["add", "remove", "reset", "save", "apply-catalog"]);

const show = defineModel("show", { type: Boolean, default: false });
const list = defineModel("list", { type: Array, default: () => [] });
</script>

<style scoped lang="scss">
.purchase-row {
  display: grid;
  grid-template-columns: 220px 120px 120px minmax(0, 1fr) 96px;
  gap: 12px;
  align-items: center;
  margin-bottom: 12px;
}

/* 窄屏（手机）下堆叠布局，避免固定列宽把弹窗撑出屏幕 */
@media (max-width: 640px) {
  .purchase-row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;

    > :first-child {
      grid-column: 1 / -1; /* 常用物品下拉占整行 */
    }

    > :nth-child(4) {
      grid-column: 1 / -1; /* 备注占整行 */
    }

    > :nth-child(5) {
      justify-self: end; /* 删除按钮靠右 */
    }
  }
}
</style>
