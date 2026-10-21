<template>
  <n-modal
    v-model:show="show"
    preset="card"
    title="账号模板引用查看"
    style="width: 90%; max-width: 800px"
  >
    <div class="settings-content">
      <div
        class="modal-header-actions"
        style="
          margin-bottom: 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        "
      >
        <div>
          <span>共 {{ filteredAccountTemplates.length }} 个账号</span>
        </div>
        <div style="display: flex; gap: 8px; align-items: center">
          <label style="font-size: 12px; color: #86909c">按模板筛选:</label>
          <n-select
            v-model:value="selectedTemplateForFilter"
            :options="taskTemplates"
            label-field="name"
            value-field="id"
            placeholder="全部模板"
            size="small"
            @update:value="$emit('filter')"
            style="width: 180px"
          />
        </div>
      </div>

      <!-- Account Template List -->
      <div
        class="account-template-list"
        style="max-height: 400px; overflow-y: auto; margin-bottom: 16px"
      >
        <n-card
          v-for="item in filteredAccountTemplates"
          :key="item.tokenId"
          size="small"
          style="margin-bottom: 12px"
        >
          <div
            style="
              display: flex;
              justify-content: space-between;
              align-items: center;
            "
          >
            <div>
              <h4 style="margin: 0; margin-bottom: 4px">
                {{ item.tokenName }}
              </h4>
            </div>
            <div>
              <n-tag
                :type="item.templateId ? 'success' : 'default'"
                size="small"
              >
                {{ item.templateName }}
              </n-tag>
            </div>
          </div>
        </n-card>
        <div
          v-if="filteredAccountTemplates.length === 0"
          style="text-align: center; padding: 24px; color: #86909c"
        >
          暂无账号数据
        </div>
      </div>

      <!-- Actions -->
      <div class="modal-actions" style="margin-top: 20px; text-align: right">
        <n-button @click="show = false">关闭</n-button>
      </div>
    </div>
  </n-modal>
</template>
<script setup>
defineProps({
  filteredAccountTemplates: { type: Array, default: () => [] },
  taskTemplates: { type: Array, default: () => [] },
});

defineEmits(["filter"]);

const show = defineModel("show", { type: Boolean, default: false });
const selectedTemplateForFilter = defineModel("selectedTemplateForFilter", {
  type: Number,
  default: null,
});
</script>
