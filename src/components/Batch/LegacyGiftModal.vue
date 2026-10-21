<template>
  <n-modal
    v-model:show="show"
    preset="card"
    title="批量功法残卷赠送"
    style="width: 90%; max-width: 600px"
  >
    <div class="settings-content">
      <div class="settings-grid">
        <!-- 接收者ID输入 -->
        <div class="setting-item">
          <label class="setting-label">接收者ID</label>
          <n-space>
            <n-input-number
              v-model:value="recipientIdInput"
              placeholder="ID"
              :show-button="false"
              @update:value="$emit('clear-error')"
              style="width: 180px"
            />
            <n-input
              v-model:value="securityPassword"
              placeholder="请输入安全密码"
              type="password"
              @input="$emit('clear-error')"
              style="width: 180px"
            />
            <n-button
              type="primary"
              @click="$emit('query')"
              :disabled="
                !recipientIdInput || isQueryingRecipient || !securityPassword
              "
            >
              查询
            </n-button>
          </n-space>
          <n-text
            v-if="recipientIdError"
            type="error"
            style="margin-top: 5px; display: block"
          >
            {{ recipientIdError }}
          </n-text>
        </div>

        <!-- 接收者信息展示 -->
        <div class="setting-item" v-if="recipientInfo">
          <label class="setting-label">接收者信息</label>
          <div
            class="recipient-info"
            style="
              background: #f7f8fa;
              padding: 16px;
              border-radius: 8px;
              border: 1px solid #e5e7eb;
              display: flex;
              align-items: flex-start;
              gap: 16px;
              transition: all 0.3s ease;
            "
          >
            <!-- 头像部分 -->
            <div
              class="avatar-container"
              style="
                position: relative;
                width: 80px;
                height: 80px;
                border-radius: 50%;
                overflow: hidden;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.3s ease;
              "
            >
              <img
                v-if="recipientInfo.avatarUrl && !avatarLoadError"
                :src="recipientInfo.avatarUrl"
                alt="角色头像"
                style="
                  width: 100%;
                  height: 100%;
                  object-fit: cover;
                  transition: all 0.3s ease;
                "
                @error="$emit('avatar-error')"
                @load="$emit('avatar-load')"
              />
              <!-- 头像加载失败或未设置时的 fallback -->
              <div
                v-else
                class="avatar-fallback"
                style="
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  width: 100%;
                  height: 100%;
                  color: white;
                  font-size: 24px;
                  font-weight: bold;
                  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
                "
              >
                {{ (recipientInfo.name || "未知角色")[0] || "?" }}
              </div>
              <!-- 加载指示器 -->
              <div
                v-if="isAvatarLoading"
                class="avatar-loading"
                style="
                  position: absolute;
                  top: 0;
                  left: 0;
                  width: 100%;
                  height: 100%;
                  background: rgba(0, 0, 0, 0.5);
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  border-radius: 50%;
                "
              >
                <div
                  class="loading-spinner"
                  style="
                    width: 30px;
                    height: 30px;
                    border: 3px solid rgba(255, 255, 255, 0.3);
                    border-top: 3px solid white;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                  "
                ></div>
              </div>
            </div>

            <!-- 角色信息部分 -->
            <div class="role-info" style="flex: 1; min-width: 0">
              <div
                style="
                  margin-bottom: 12px;
                  font-size: 18px;
                  font-weight: bold;
                  color: #1d2129;
                  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
                "
              >
                {{ recipientInfo.name || "未知角色" }}
              </div>
              <div
                class="role-info-grid"
                style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px"
              >
                <div class="info-item">
                  <div
                    class="info-label"
                    style="font-size: 12px; color: #86909c; margin-bottom: 2px"
                  >
                    角色ID
                  </div>
                  <div
                    class="info-value"
                    style="font-size: 14px; font-weight: 500; color: #1d2129"
                  >
                    {{ recipientInfo.roleId }}
                  </div>
                </div>
                <div class="info-item">
                  <div
                    class="info-label"
                    style="font-size: 12px; color: #86909c; margin-bottom: 2px"
                  >
                    服务器
                  </div>
                  <div
                    class="info-value"
                    style="font-size: 14px; font-weight: 500; color: #1d2129"
                  >
                    {{ recipientInfo.serverName }}
                  </div>
                </div>
                <div class="info-item">
                  <div
                    class="info-label"
                    style="font-size: 12px; color: #86909c; margin-bottom: 2px"
                  >
                    战力
                  </div>
                  <div
                    class="info-value"
                    style="font-size: 16px; font-weight: 600; color: #667eea"
                  >
                    {{ recipientInfo.power }} {{ recipientInfo.powerUnit }}
                  </div>
                </div>
                <div class="info-item">
                  <div
                    class="info-label"
                    style="font-size: 12px; color: #86909c; margin-bottom: 2px"
                  >
                    军团
                  </div>
                  <div
                    class="info-value"
                    style="font-size: 14px; font-weight: 500; color: #1d2129"
                  >
                    {{ recipientInfo.legionName || "无" }}
                  </div>
                </div>
                <div class="info-item" style="grid-column: 1 / -1">
                  <div
                    class="info-label"
                    style="font-size: 12px; color: #86909c; margin-bottom: 2px"
                  >
                    军团ID
                  </div>
                  <div
                    class="info-value"
                    style="font-size: 14px; font-weight: 500; color: #1d2129"
                  >
                    {{ recipientInfo.legionId || "无" }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 赠送数量 -->
        <div class="setting-item">
          <label class="setting-label">赠送数量</label>
          <n-input-number
            v-model:value="giftQuantity"
            :min="1"
            :max="1000"
            :step="1"
            placeholder="请输入赠送数量"
          />
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="modal-actions" style="margin-top: 20px; text-align: right">
        <n-button @click="show = false" style="margin-right: 12px"
          >取消</n-button
        >
        <n-button
          type="primary"
          @click="$emit('confirm')"
          :disabled="!recipientIdInput || !recipientInfo"
        >
          开始赠送
        </n-button>
      </div>
    </div>
  </n-modal>
</template>
<script setup>
defineProps({
  recipientInfo: { type: Object, default: null },
  recipientIdError: { type: String, default: "" },
  isAvatarLoading: { type: Boolean, default: false },
  avatarLoadError: { type: Boolean, default: false },
});

defineEmits(["query", "confirm", "clear-error", "avatar-load", "avatar-error"]);

const show = defineModel("show", { type: Boolean, default: false });
const recipientIdInput = defineModel("recipientIdInput", {
  type: String,
  default: "",
});
const giftQuantity = defineModel("giftQuantity", { type: Number, default: 10 });
const securityPassword = defineModel("securityPassword", {
  type: String,
  default: "",
});
</script>
