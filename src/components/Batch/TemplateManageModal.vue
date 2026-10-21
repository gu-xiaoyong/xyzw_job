<template>
  <n-modal
    v-model:show="show"
    preset="card"
    title="任务模板管理"
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
          <n-button type="primary" @click="$emit('create')">新增模板</n-button>
          <n-button
            @click="$emit('open-apply')"
            type="success"
            style="margin-left: 8px"
            >应用模板</n-button
          >
          <n-button
            @click="$emit('open-references')"
            type="info"
            style="margin-left: 8px"
            >查看账号模板引用</n-button
          >
        </div>
        <n-input placeholder="搜索模板" size="small" style="width: 200px" />
      </div>

      <!-- Template List -->
      <div
        class="template-list"
        style="max-height: 400px; overflow-y: auto; margin-bottom: 16px"
      >
        <n-card
          v-for="template in filteredTaskTemplates"
          :key="template.id"
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
              <h4 style="margin: 0; margin-bottom: 8px">
                {{ template.name }}
              </h4>
              <div style="font-size: 12px; color: #86909c">
                创建时间: {{ new Date(template.createdAt).toLocaleString() }}
                <span v-if="template.updatedAt"
                  >, 更新时间:
                  {{ new Date(template.updatedAt).toLocaleString() }}</span
                >
              </div>
            </div>
            <div style="display: flex; gap: 8px">
              <n-button size="small" @click="$emit('edit', template)"
                >编辑</n-button
              >
              <n-button
                size="small"
                type="error"
                @click="$emit('delete', template.id)"
                >删除</n-button
              >
            </div>
          </div>
        </n-card>
        <div
          v-if="filteredTaskTemplates.length === 0"
          style="text-align: center; padding: 24px; color: #86909c"
        >
          暂无模板
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
  filteredTaskTemplates: { type: Array, default: () => [] },
});

defineEmits(["delete", "open-references", "open-apply", "edit", "create"]);

const show = defineModel("show", { type: Boolean, default: false });
</script>
