<template>
  <n-modal
    v-model:show="show"
    preset="card"
    :title="editingTask ? '编辑定时任务' : '新增定时任务'"
    style="width: 90%; max-width: 600px"
  >
    <div class="settings-content">
      <div class="settings-grid">
        <div class="setting-item">
          <label class="setting-label">任务名称</label>
          <n-input v-model:value="taskForm.name" placeholder="请输入任务名称" />
        </div>
        <div class="setting-item">
          <label class="setting-label">运行类型</label>
          <n-radio-group
            v-model:value="taskForm.runType"
            @update:value="$emit('reset-run-type')"
          >
            <n-radio value="daily">每天固定时间</n-radio>
            <n-radio value="cron">Cron表达式</n-radio>
          </n-radio-group>
        </div>
        <div class="setting-item" v-if="taskForm.runType === 'daily'">
          <label class="setting-label">运行时间</label>
          <n-time-picker v-model:value="taskForm.runTime" format="HH:mm" />
        </div>
        <div class="setting-item" v-if="taskForm.runType === 'cron'">
          <label class="setting-label">Cron表达式</label>
          <n-input
            v-model:value="taskForm.cronExpression"
            placeholder="请输入Cron表达式"
            @input="$emit('parse-cron')"
          />

          <!-- Cron表达式解析结果 -->
          <div class="cron-parser" v-if="taskForm.cronExpression">
            <div v-if="cronValidation.valid" class="cron-validation success">
              <n-text type="success">✓ {{ cronValidation.message }}</n-text>
            </div>
            <div v-else class="cron-validation error">
              <n-text type="error">✗ {{ cronValidation.message }}</n-text>
            </div>

            <!-- 未来执行时间 -->
            <div
              v-if="cronValidation.valid && cronNextRuns.length > 0"
              class="cron-next-runs"
            >
              <h4>未来5次执行时间：</h4>
              <ul>
                <li v-for="(run, runIndex) in cronNextRuns" :key="runIndex">
                  {{ run }}
                </li>
              </ul>
            </div>
          </div>
        </div>
        <div class="setting-item">
          <div
            style="
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 8px;
            "
          >
            <label class="setting-label">选择账号</label>
            <n-space size="small">
              <n-button size="small" @click="$emit('select-all-tokens')">
                全选
              </n-button>
              <n-button size="small" @click="$emit('deselect-all-tokens')">
                全不选
              </n-button>
            </n-space>
          </div>

          <!-- 分组快速选择 (仅在定时任务中显示) -->
          <div style="margin-bottom: 12px">
            <div
              style="
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 8px;
              "
            >
              <div style="font-size: 12px; color: #86909c">快速选择分组：</div>
              <n-button
                type="primary"
                size="tiny"
                text
                @click="$emit('open-groups')"
              >
                管理分组
              </n-button>
            </div>
            <div
              v-if="tokenGroups.length === 0"
              style="font-size: 12px; color: #ccc"
            >
              暂无分组
            </div>
            <div style="display: flex; gap: 6px; flex-wrap: wrap">
              <n-button
                v-for="group in tokenGroups"
                :key="group.id"
                size="small"
                :type="
                  taskScheduleSelectedGroupIds.includes(group.id)
                    ? 'primary'
                    : 'default'
                "
                @click="
                  () => {
                    const index = taskScheduleSelectedGroupIds.indexOf(
                      group.id,
                    );
                    const groupTokenIds = getValidGroupTokenIds(group.id);

                    if (index > -1) {
                      // 取消选择该分组
                      taskScheduleSelectedGroupIds.splice(index, 1);
                      taskForm.selectedTokens = taskForm.selectedTokens.filter(
                        (id) => !groupTokenIds.includes(id),
                      );
                    } else {
                      // 选择该分组
                      taskScheduleSelectedGroupIds.push(group.id);
                      groupTokenIds.forEach((id) => {
                        if (!taskForm.selectedTokens.includes(id)) {
                          taskForm.selectedTokens.push(id);
                        }
                      });
                    }
                  }
                "
                :style="{
                  borderColor: group.color,
                }"
              >
                {{ group.name }}
              </n-button>
            </div>
          </div>

          <n-checkbox-group v-model:value="taskForm.selectedTokens">
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
        <div class="setting-item">
          <div
            style="
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 8px;
            "
          >
            <label class="setting-label">选择任务</label>
            <n-space size="small">
              <n-button size="small" @click="$emit('select-all-tasks')">
                全选
              </n-button>
              <n-button size="small" @click="$emit('deselect-all-tasks')">
                全不选
              </n-button>
            </n-space>
          </div>

          <n-checkbox-group v-model:value="taskForm.selectedTasks">
            <n-tabs
              type="line"
              animated
              size="small"
              pane-style="padding-top: 12px;"
              default-value="daily"
            >
              <n-tab-pane
                v-for="group in taskGroupDefinitions"
                :key="group.name"
                :name="group.name"
                :tab="group.label"
              >
                <n-grid :cols="2" :x-gap="12" :y-gap="8">
                  <n-grid-item
                    v-for="task in groupedAvailableTasks[group.name]"
                    :key="task.value"
                  >
                    <n-checkbox :value="task.value">{{
                      task.label
                    }}</n-checkbox>
                  </n-grid-item>
                </n-grid>
              </n-tab-pane>

              <n-tab-pane
                v-if="
                  groupedAvailableTasks.other &&
                  groupedAvailableTasks.other.length > 0
                "
                name="other"
                tab="其他"
              >
                <n-grid :cols="2" :x-gap="12" :y-gap="8">
                  <n-grid-item
                    v-for="task in groupedAvailableTasks.other"
                    :key="task.value"
                  >
                    <n-checkbox :value="task.value">{{
                      task.label
                    }}</n-checkbox>
                  </n-grid-item>
                </n-grid>
              </n-tab-pane>
            </n-tabs>
          </n-checkbox-group>
        </div>
        <div
          v-if="taskForm.selectedTasks.includes('batchApplyLegion')"
          class="setting-item"
        >
          <label class="setting-label">目标俱乐部ID</label>
          <n-input-number
            v-model:value="taskForm.legionApplyTargetId"
            placeholder="请输入目标俱乐部ID"
            :min="1"
            clearable
          />
          <div style="font-size: 12px; color: #86909c">
            定时执行“批量申请俱乐部”时会对所有选中账号申请这个俱乐部。
          </div>
        </div>
      </div>
      <div class="modal-actions" style="margin-top: 20px; text-align: right">
        <n-button @click="show = false" style="margin-right: 12px"
          >取消</n-button
        >
        <n-button type="primary" @click="$emit('save')">保存</n-button>
      </div>
    </div>
  </n-modal>
</template>

<script setup>
defineProps({
  taskForm: { type: Object, required: true },
  editingTask: { type: Object, default: null },
  cronValidation: { type: Object, required: true },
  cronNextRuns: { type: Array, default: () => [] },
  sortedTokens: { type: Array, default: () => [] },
  taskScheduleSelectedGroupIds: { type: Array, default: () => [] },
  taskGroupDefinitions: { type: Array, required: true },
  groupedAvailableTasks: { type: Object, required: true },
});

defineEmits([
  "save",
  "reset-run-type",
  "parse-cron",
  "select-all-tokens",
  "deselect-all-tokens",
  "select-all-tasks",
  "deselect-all-tasks",
  "open-groups",
]);

import { computed } from "vue";
import { useTokenStore } from "@/stores/tokenStore";

const tokenStore = useTokenStore();
const tokenGroups = computed(() => tokenStore.tokenGroups);
const getValidGroupTokenIds = (groupId) =>
  tokenStore.getValidGroupTokenIds(groupId);

const show = defineModel("show", { type: Boolean, default: false });
</script>
