<template>
  <n-modal
    v-model:show="show"
    preset="card"
    title="应用任务模板"
    style="width: 90%; max-width: 600px"
  >
    <div class="settings-content">
      <div class="settings-grid">
        <div class="setting-item">
          <label class="setting-label">选择模板</label>
          <n-select
            v-model:value="selectedTemplateId"
            :options="taskTemplates"
            label-field="name"
            value-field="id"
            placeholder="请选择要应用的模板"
            size="small"
            style="width: 100%"
          />
        </div>
        <div class="setting-item">
          <label class="setting-label">选择账号</label>

          <!-- 分组快速选择 -->
          <div
            style="
              margin-bottom: 12px;
              border-bottom: 1px solid #eee;
              padding-bottom: 8px;
            "
          >
            <div style="font-size: 12px; color: #86909c; margin-bottom: 8px">
              快速选择分组：
            </div>
            <div style="display: flex; gap: 6px; flex-wrap: wrap">
              <n-button
                v-for="group in tokenGroups"
                :key="group.id"
                size="small"
                @click="
                  () => {
                    const groupTokenIds = getValidGroupTokenIds(group.id);
                    groupTokenIds.forEach((id) => {
                      if (!selectedTokensForApply.includes(id)) {
                        selectedTokensForApply.push(id);
                      }
                    });
                  }
                "
                :style="{
                  borderColor: group.color,
                  color: group.color,
                }"
                ghost
              >
                {{ group.name }}
              </n-button>
              <div
                v-if="tokenGroups.length === 0"
                style="font-size: 12px; color: #ccc"
              >
                暂无分组
              </div>
            </div>
          </div>

          <n-checkbox
            :checked="isAllSelectedForApply"
            :indeterminate="isIndeterminateForApply"
            @update:checked="$emit('select-all', $event)"
          >
            全选
          </n-checkbox>
          <n-checkbox-group
            v-model:value="selectedTokensForApply"
            style="margin-top: 8px"
          >
            <n-grid :cols="2" :x-gap="12" :y-gap="8">
              <n-grid-item
                v-for="gameToken in sortedTokens"
                :key="gameToken.id"
              >
                <n-checkbox :value="gameToken.id">{{
                  gameToken.name
                }}</n-checkbox>
              </n-grid-item>
            </n-grid>
          </n-checkbox-group>
        </div>
      </div>
      <div class="modal-actions" style="margin-top: 20px; text-align: right">
        <n-button @click="show = false">取消</n-button>
        <n-button
          @click="$emit('apply')"
          type="success"
          :disabled="!selectedTemplateId || selectedTokensForApply.length === 0"
          >应用模板</n-button
        >
      </div>
    </div>
  </n-modal>
</template>
<script setup>
import { computed } from "vue";
import { useTokenStore } from "@/stores/tokenStore";

const props = defineProps({
  taskTemplates: { type: Array, default: () => [] },
  tokenGroups: { type: Array, default: () => [] },
  isAllSelectedForApply: { type: Boolean, default: false },
  isIndeterminateForApply: { type: Boolean, default: false },
  applyDisabled: { type: Boolean, default: false },
  sortedTokens: { type: Array, default: () => [] },
});

const tokenStore = useTokenStore();
const tokenGroups = computed(() => tokenStore.tokenGroups);
const getValidGroupTokenIds = (groupId) =>
  tokenStore.getValidGroupTokenIds(groupId);

defineEmits(["apply", "select-all", "group-toggle"]);

const show = defineModel("show", { type: Boolean, default: false });
const selectedTemplateId = defineModel("selectedTemplateId", {
  type: Number,
  default: null,
});
const selectedTokensForApply = defineModel("selectedTokensForApply", {
  type: Array,
  default: () => [],
});
</script>
