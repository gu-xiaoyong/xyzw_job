<template>
  <n-modal
    v-model:show="show"
    preset="card"
    title="梦境商品购买配置"
    style="width: 90%; max-width: 600px"
  >
    <div class="settings-content">
      <div class="settings-grid">
        <n-alert type="info" show-icon style="margin-bottom: 12px">
          请勾选需要购买的商品。只会购买列表中存在的商品。
        </n-alert>

        <div style="display: flex; gap: 12px; margin-bottom: 12px">
          <n-button size="small" type="warning" @click="$emit('select-gold')">
            一键勾选金币商品
          </n-button>
          <n-button size="small" @click="$emit('select-all')">
            全选所有
          </n-button>
          <n-button size="small" @click="$emit('clear')"> 清空选择 </n-button>
        </div>

        <div
          v-for="(merchant, id) in merchantConfig"
          :key="id"
          style="margin-bottom: 16px"
        >
          <div style="font-weight: bold; margin-bottom: 8px">
            {{ merchant.name }}
          </div>
          <n-grid :cols="3" :x-gap="12" :y-gap="8">
            <n-grid-item
              v-for="(item, itemIndex) in merchant.items"
              :key="itemIndex"
            >
              <n-checkbox
                :value="`${id}-${itemIndex}`"
                :checked="selectedKeys.includes(`${id}-${itemIndex}`)"
                @update:checked="
                  (checked) => $emit('toggle', `${id}-${itemIndex}`, checked)
                "
              >
                {{ item }}
              </n-checkbox>
            </n-grid-item>
          </n-grid>
        </div>
      </div>
      <div class="modal-actions" style="margin-top: 20px; text-align: right">
        <n-button @click="show = false" style="margin-right: 12px"
          >取消</n-button
        >
        <n-button type="primary" @click="$emit('save')">保存配置</n-button>
      </div>
    </div>
  </n-modal>
</template>
<script setup>
import { merchantConfig } from "@/utils/dreamConstants";

defineEmits(["toggle", "select-gold", "select-all", "clear", "save"]);

const show = defineModel("show", { type: Boolean, default: false });
const selectedKeys = defineModel("selectedKeys", {
  type: Array,
  default: () => [],
});
</script>
