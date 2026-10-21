<template>
  <n-modal
    v-model:show="show"
    preset="card"
    title="分组管理"
    style="width: 90%; max-width: 800px"
  >
    <div class="settings-content">
      <!-- 创建新分组 -->
      <n-divider title-placement="left" style="margin: 0 0 16px 0">
        创建新分组
      </n-divider>
      <div style="margin-bottom: 24px">
        <div
          style="
            display: flex;
            gap: 12px;
            align-items: center;
            margin-bottom: 12px;
            flex-wrap: wrap;
          "
        >
          <n-input
            v-model:value="newGroupName"
            placeholder="输入分组名称"
            style="width: 200px"
            size="small"
          />
          <div style="display: flex; gap: 8px; align-items: center">
            <span style="font-size: 12px">选择颜色:</span>
            <div style="display: flex; gap: 6px">
              <div
                v-for="slotColor in groupColors"
                :key="slotColor"
                :style="{
                  width: '24px',
                  height: '24px',
                  backgroundColor: slotColor,
                  borderRadius: '4px',
                  border:
                    newGroupColor === slotColor
                      ? '3px solid #000'
                      : '2px solid #ddd',
                  cursor: 'pointer',
                  transition: 'transform 0.2s',
                }"
                @click="newGroupColor = slotColor"
                @mouseover="$event.target.style.transform = 'scale(1.1)'"
                @mouseleave="$event.target.style.transform = 'scale(1)'"
              />
            </div>
          </div>
          <n-button type="primary" size="small" @click="createNewGroup">
            创建分组
          </n-button>
        </div>

        <!-- 选择包含的账号 -->
        <div
          style="
            background: #f9f9f9;
            padding: 12px;
            border-radius: 8px;
            border: 1px solid #eee;
          "
        >
          <div
            style="
              display: flex;
              justify-content: space-between;
              margin-bottom: 8px;
            "
          >
            <span style="font-size: 13px; font-weight: bold"
              >包含账号 ({{ newGroupSelectedTokens.length }})</span
            >
            <n-space size="small">
              <n-button size="tiny" @click="selectAllNewGroup">全选</n-button>
              <n-button size="tiny" @click="deselectAllNewGroup"
                >全不选</n-button
              >
            </n-space>
          </div>
          <div style="max-height: 150px; overflow-y: auto">
            <n-checkbox-group v-model:value="newGroupSelectedTokens">
              <n-grid :cols="3" :x-gap="12" :y-gap="8">
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
      </div>

      <!-- 分组列表 -->
      <n-divider title-placement="left" style="margin: 0 0 16px 0">
        分组列表
      </n-divider>
      <div
        style="
          max-height: 500px;
          overflow-y: auto;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 12px;
        "
      >
        <div
          v-for="group in tokenGroups"
          :key="group.id"
          style="
            padding: 12px;
            border: 1px solid #e5e7eb;
            border-radius: 6px;
            margin-bottom: 12px;
            background: #fafafa;
          "
        >
          <div
            style="
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              gap: 12px;
            "
          >
            <div style="flex: 1">
              <!-- 编辑模式 -->
              <div
                v-if="editingGroupId === group.id"
                style="display: flex; gap: 8px"
              >
                <n-input
                  v-model:value="editingGroupName"
                  placeholder="分组名称"
                  size="small"
                  style="width: 150px"
                />
                <div style="display: flex; gap: 6px; align-items: center">
                  <div
                    v-for="slotColor in groupColors"
                    :key="slotColor"
                    :style="{
                      width: '20px',
                      height: '20px',
                      backgroundColor: slotColor,
                      borderRadius: '4px',
                      border:
                        editingGroupColor === slotColor
                          ? '3px solid #000'
                          : '2px solid #ddd',
                      cursor: 'pointer',
                    }"
                    @click="editingGroupColor = slotColor"
                  />
                </div>
                <n-button
                  size="small"
                  type="primary"
                  @click="saveEditGroup"
                  style="width: 60px"
                >
                  保存
                </n-button>
                <n-button
                  size="small"
                  @click="cancelEditGroup"
                  style="width: 60px"
                >
                  取消
                </n-button>
              </div>
              <!-- 显示模式 -->
              <div v-else>
                <div
                  style="
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin-bottom: 8px;
                  "
                >
                  <div
                    :style="{
                      width: '16px',
                      height: '16px',
                      backgroundColor: group.color,
                      borderRadius: '3px',
                    }"
                  />
                  <span style="font-weight: 500; font-size: 14px">
                    {{ group.name }}
                  </span>
                  <n-tag size="small" type="info">
                    {{ getValidGroupTokenIds(group.id).length }} 个账号
                  </n-tag>
                </div>
                <div
                  style="
                    display: flex;
                    gap: 4px;
                    flex-wrap: wrap;
                    margin-bottom: 8px;
                  "
                >
                  <div
                    v-for="tokenId in getValidGroupTokenIds(group.id)"
                    :key="tokenId"
                    style="
                      padding: 2px 8px;
                      background: white;
                      border: 1px solid #ddd;
                      border-radius: 4px;
                      font-size: 12px;
                      display: flex;
                      align-items: center;
                      gap: 4px;
                    "
                  >
                    {{ tokens.find((t) => t.id === tokenId)?.name }}
                    <n-button
                      size="tiny"
                      type="error"
                      text
                      @click="removeTokenFromSelectedGroup(group.id, tokenId)"
                    >
                      ×
                    </n-button>
                  </div>
                </div>
                <!-- 添加token到分组 -->
                <div style="margin-bottom: 8px">
                  <n-select
                    placeholder="添加账号到分组"
                    size="small"
                    filterable
                    :options="
                      tokens
                        .filter(
                          (t) =>
                            !getValidGroupTokenIds(group.id).includes(t.id),
                        )
                        .map((t) => ({ label: t.name, value: t.id }))
                    "
                    @update:value="
                      (tokenId) => {
                        if (tokenId) {
                          addTokenToSelectedGroup(group.id, tokenId);
                        }
                      }
                    "
                  />
                </div>
              </div>
            </div>

            <!-- 操作按钮 -->
            <div
              style="display: flex; gap: 8px"
              v-if="editingGroupId !== group.id"
            >
              <n-button size="small" @click="startEditGroup(group.id)">
                编辑
              </n-button>
              <n-button
                size="small"
                type="error"
                @click="deleteGroup(group.id)"
              >
                删除
              </n-button>
            </div>
          </div>
        </div>

        <div
          v-if="tokenGroups.length === 0"
          style="text-align: center; padding: 24px; color: #86909c"
        >
          暂无分组，请创建一个新分组
        </div>
      </div>

      <!-- 关闭按钮 -->
      <div class="modal-actions" style="margin-top: 20px; text-align: right">
        <n-button @click="show = false">关闭</n-button>
      </div>
    </div>
  </n-modal>
</template>
<script setup>
import { computed, ref } from "vue";
import { useMessage } from "naive-ui";
import { useTokenStore } from "@/stores/tokenStore";

const props = defineProps({
  tokens: { type: Array, default: () => [] },
  sortedTokens: { type: Array, default: () => [] },
});
const show = defineModel("show", { type: Boolean, default: false });

const tokenStore = useTokenStore();
const message = useMessage();
const tokenGroups = computed(() => tokenStore.tokenGroups);

const newGroupName = ref("");
const newGroupColor = ref("#1677ff");
const newGroupSelectedTokens = ref([]); // 新建分组时选中的Token ID列表
const editingGroupId = ref(null);
const editingGroupName = ref("");
const editingGroupColor = ref("");
const groupColors = [
  "#1677ff", // 蓝色
  "#52c41a", // 绿色
  "#faad14", // 橙色
  "#f5222d", // 红色
  "#722ed1", // 紫色
  "#13c2c2", // 青色
  "#eb2f96", // 粉色
  "#fa8c16", // 赤红色
];

/**
 * 创建新分组
 */
const createNewGroup = () => {
  if (!newGroupName.value.trim()) {
    message.warning("请输入分组名称");
    return;
  }

  const newGroup = tokenStore.createTokenGroup(
    newGroupName.value.trim(),
    newGroupColor.value,
  );

  // 添加选中的Token到新分组
  if (newGroupSelectedTokens.value.length > 0) {
    newGroupSelectedTokens.value.forEach((tokenId) => {
      tokenStore.addTokenToGroup(newGroup.id, tokenId);
    });
  }

  message.success("分组创建成功");
  newGroupName.value = "";
  newGroupColor.value = "#1677ff";
  newGroupSelectedTokens.value = [];
};

const selectAllNewGroup = () => {
  newGroupSelectedTokens.value = props.sortedTokens.map((t) => t.id);
};

const deselectAllNewGroup = () => {
  newGroupSelectedTokens.value = [];
};

/**
 * 删除分组
 */
const deleteGroup = (groupId) => {
  // eslint-disable-next-line no-alert -- Preserve the existing native notification or confirmation flow.
  if (confirm("确定要删除这个分组吗？分组中的token不会被删除。")) {
    tokenStore.deleteTokenGroup(groupId);
    message.success("分组已删除");
  }
};

/**
 * 保存编辑的分组
 */
const saveEditGroup = () => {
  if (!editingGroupId.value) return;

  if (!editingGroupName.value.trim()) {
    message.warning("请输入分组名称");
    return;
  }

  tokenStore.updateTokenGroup(editingGroupId.value, {
    name: editingGroupName.value.trim(),
    color: editingGroupColor.value,
  });

  message.success("分组已更新");
  editingGroupId.value = null;
  editingGroupName.value = "";
  editingGroupColor.value = "";
};

/**
 * 开始编辑分组
 */
const startEditGroup = (groupId) => {
  const group = tokenGroups.value.find((g) => g.id === groupId);
  if (group) {
    editingGroupId.value = groupId;
    editingGroupName.value = group.name;
    editingGroupColor.value = group.color;
  }
};

/**
 * 取消编辑分组
 */
const cancelEditGroup = () => {
  editingGroupId.value = null;
  editingGroupName.value = "";
  editingGroupColor.value = "";
};

/**
 * 添加token到分组
 */
const addTokenToSelectedGroup = (groupId, tokenId) => {
  tokenStore.addTokenToGroup(groupId, tokenId);
  message.success("已将token添加到分组");
};

/**
 * 从分组移除token
 */
const removeTokenFromSelectedGroup = (groupId, tokenId) => {
  tokenStore.removeTokenFromGroup(groupId, tokenId);
  message.success("已将token从分组移除");
};

/**
 * 获取分组中有效的token ID列表（用于模板中展示）
 */
const getValidGroupTokenIds = (groupId) => {
  return tokenStore.getValidGroupTokenIds(groupId);
};
</script>
