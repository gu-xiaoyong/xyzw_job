<template>
  <div class="batch-daily-tasks">
    <div class="main-layout">
      <!-- Left Column -->
      <div class="left-column">
        <!-- Header -->
        <div
          class="page-header"
          style="
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 12px;
          "
        >
          <div class="header-left">
            <h2>批量日常任务</h2>
            <div class="header-info-box">
              <div style="font-size: 14px; color: #495057">
                共 {{ scheduledTasks.length }} 个定时任务
              </div>
              <NextTaskBanner :tasks="scheduledTasks" />
              <div class="header-info-actions">
                <n-button type="primary" size="small" @click="openTaskModal">
                  新增定时任务
                </n-button>
                <n-button size="small" @click="showTasksModal = true">
                  查看定时任务
                </n-button>
                <n-button size="small" @click="exportConfig">
                  导出配置
                </n-button>
                <n-upload
                  :show-file-list="false"
                  accept=".json"
                  :custom-request="importConfig"
                >
                  <n-button size="small">导入配置</n-button>
                </n-upload>
                <n-button
                  size="small"
                  type="info"
                  @click="showCloudModal = true"
                >
                  云端定时
                </n-button>
              </div>
              <div
                class="setting-item"
                style="
                  flex-direction: row;
                  justify-content: space-between;
                  align-items: center;
                "
              >
                <label class="setting-label">黑市采购清单配置</label>
                <n-button size="small" @click="openBlackMarketPurchaseModal">
                  点击配置
                </n-button>
              </div>
            </div>
          </div>
          <div class="header-action-box">
            <n-button
              type="primary"
              @click="startBatch"
              :disabled="isRunning || selectedTokens.length === 0"
              size="medium"
            >
              {{ isRunning ? "执行中..." : "开始执行" }}
            </n-button>
            <n-button
              @click="stopBatch"
              :disabled="!isRunning"
              type="error"
              size="medium"
            >
              停止
            </n-button>
            <n-button
              @click="openTemplateManagerModal"
              type="info"
              size="medium"
            >
              任务模板
            </n-button>
            <n-button @click="openBatchSettings" type="default" size="medium">
              <template #icon>
                <n-icon>
                  <Settings />
                </n-icon>
              </template>
              设置
            </n-button>
          </div>
        </div>

        <!-- Token Selection -->
        <n-card title="账号列表" class="token-list-card">
          <div style="margin-bottom: 16px">
            <!-- 分组管理和选择 -->
            <n-space vertical style="width: 100%">
              <!-- 分组选择部分 -->
              <div
                v-if="tokenGroups.length > 0"
                class="group-selection-section"
              >
                <div
                  style="
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 12px;
                  "
                >
                  <label style="font-weight: 500; color: #333">分组选择</label>
                  <n-button
                    size="small"
                    type="error"
                    text
                    @click="clearAllGroupSelection"
                  >
                    一键清除所有分组选择
                  </n-button>
                </div>
                <div style="display: flex; gap: 8px; flex-wrap: wrap">
                  <div
                    v-for="group in tokenGroups"
                    :key="group.id"
                    @click="toggleGroupSelection(group.id)"
                    :style="{
                      padding: '8px 12px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      backgroundColor: isGroupSelected(group.id)
                        ? group.color
                        : 'transparent',
                      border: `2px solid ${group.color}`,
                      color: isGroupSelected(group.id) ? 'white' : group.color,
                      fontWeight: isGroupSelected(group.id) ? '600' : '400',
                      transition: 'all 0.3s ease',
                      userSelect: 'none',
                    }"
                  >
                    {{ group.name }} ({{
                      getValidGroupTokenIds(group.id).length
                    }})
                  </div>
                </div>
              </div>

              <!-- 分组管理按钮 -->
              <div
                style="
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
                "
              >
                <n-button
                  type="info"
                  size="small"
                  @click="showGroupManageModal = true"
                >
                  管理分组
                </n-button>
                <span
                  v-if="selectedGroups.length > 0"
                  style="font-size: 12px; color: #86909c"
                >
                  已选择 {{ selectedGroups.length }} 个分组，包含
                  {{ selectedTokens.length }} 个账号
                </span>
              </div>
            </n-space>
          </div>

          <!-- 排序按钮组 -->
          <div class="sort-buttons" style="margin-bottom: 12px">
            <n-space align="center">
              <n-button-group size="small">
                <n-button
                  @click="toggleSort('name')"
                  :type="sortConfig.field === 'name' ? 'primary' : 'default'"
                >
                  名称 {{ getSortIcon("name") }}
                </n-button>
                <n-button
                  @click="toggleSort('server')"
                  :type="sortConfig.field === 'server' ? 'primary' : 'default'"
                >
                  服务器 {{ getSortIcon("server") }}
                </n-button>
                <n-button
                  @click="toggleSort('createdAt')"
                  :type="
                    sortConfig.field === 'createdAt' ? 'primary' : 'default'
                  "
                >
                  创建时间 {{ getSortIcon("createdAt") }}
                </n-button>
                <n-button
                  @click="toggleSort('lastUsed')"
                  :type="
                    sortConfig.field === 'lastUsed' ? 'primary' : 'default'
                  "
                >
                  最后使用 {{ getSortIcon("lastUsed") }}
                </n-button>
              </n-button-group>
            </n-space>
          </div>

          <n-space vertical>
            <n-checkbox
              :checked="isAllSelected"
              :indeterminate="isIndeterminate"
              @update:checked="handleSelectAll"
            >
              全选
            </n-checkbox>
            <n-checkbox-group v-model:value="selectedTokens">
              <n-grid
                :x-gap="12"
                :y-gap="8"
                :cols="batchSettings.tokenListColumns"
              >
                <n-grid-item
                  v-for="gameToken in sortedTokens"
                  :key="gameToken.id"
                >
                  <div class="token-row">
                    <n-checkbox
                      :value="gameToken.id"
                      :label="gameToken.name"
                      style="flex: 1"
                    >
                      <div class="token-item">
                        <span>{{ gameToken.name }}</span>
                        <n-tag
                          size="small"
                          :type="getStatusType(gameToken.id)"
                          style="margin-left: 8px"
                        >
                          {{ getStatusText(gameToken.id) }}
                        </n-tag>
                        <!-- 显示token所属的分组 -->
                        <div
                          v-if="
                            tokenStore.getTokenGroups(gameToken.id).length > 0
                          "
                          style="
                            margin-left: 8px;
                            display: inline-flex;
                            gap: 4px;
                            flex-wrap: wrap;
                          "
                        >
                          <n-tag
                            v-for="group in tokenStore.getTokenGroups(
                              gameToken.id,
                            )"
                            :key="group.id"
                            size="small"
                            :color="{ color: group.color, textColor: 'white' }"
                            style="font-size: 11px"
                          >
                            {{ group.name }}
                          </n-tag>
                        </div>
                      </div>
                    </n-checkbox>
                    <n-button
                      size="tiny"
                      circle
                      @click.stop="openSettings(gameToken)"
                    >
                      <template #icon>
                        <n-icon>
                          <Settings />
                        </n-icon>
                      </template>
                    </n-button>
                  </div>
                </n-grid-item>
              </n-grid>
            </n-checkbox-group>
          </n-space>
        </n-card>

        <!-- Batch Functions -->
        <n-card
          title="批量功能列表"
          class="func-tabs-card"
          style="margin-top: 16px"
        >
          <n-tabs type="line" animated>
            <n-tab-pane name="daily" tab="日常">
              <n-space>
                <n-button
                  size="small"
                  @click="claimHangUpRewards"
                  :disabled="isRunning || selectedTokens.length === 0"
                >
                  领取挂机
                </n-button>
                <n-button
                  size="small"
                  @click="batchAddHangUpTime"
                  :disabled="isRunning || selectedTokens.length === 0"
                >
                  一键加钟
                </n-button>
                <n-button
                  size="small"
                  @click="resetBottles"
                  :disabled="isRunning || selectedTokens.length === 0"
                >
                  重置罐子
                </n-button>
                <n-button
                  size="small"
                  @click="batchlingguanzi"
                  :disabled="isRunning || selectedTokens.length === 0"
                >
                  一键领取罐子
                </n-button>
                <n-button
                  size="small"
                  @click="batchclubsign"
                  :disabled="isRunning || selectedTokens.length === 0"
                >
                  一键俱乐部签到
                </n-button>
                <n-button
                  size="small"
                  @click="openApplyLegionModal"
                  :disabled="isRunning || selectedTokens.length === 0"
                >
                  批量申请俱乐部
                </n-button>
                <n-button
                  size="small"
                  @click="batchStudy"
                  :disabled="isRunning || selectedTokens.length === 0"
                >
                  一键答题
                </n-button>
                <n-button
                  size="small"
                  @click="batcharenafight"
                  :disabled="
                    isRunning ||
                    selectedTokens.length === 0 ||
                    !isarenaActivityOpen
                  "
                >
                  一键竞技场战斗3次
                </n-button>
                <n-button
                  size="small"
                  @click="store_syncpurchaseconfig"
                  :disabled="isRunning || selectedTokens.length === 0"
                >
                  一键配置黑市清单
                </n-button>
                <n-button
                  size="small"
                  @click="store_purchase"
                  :disabled="isRunning || selectedTokens.length === 0"
                >
                  一键黑市采购
                </n-button>
                <n-button
                  size="small"
                  @click="batchClaimMail"
                  :disabled="isRunning || selectedTokens.length === 0"
                >
                  一键邮件领取
                </n-button>
                <n-button
                  size="small"
                  @click="batchClaimActivity"
                  :disabled="isRunning || selectedTokens.length === 0"
                >
                  一键活跃度奖励
                </n-button>
                <n-button
                  size="small"
                  @click="batchGenieSweep"
                  :disabled="isRunning || selectedTokens.length === 0"
                >
                  一键灯神扫荡
                </n-button>
                <n-button
                  size="small"
                  @click="batchBookPKMatch"
                  :disabled="isRunning || selectedTokens.length === 0"
                >
                  一键预约比赛
                </n-button>
                <n-popselect
                  :value="campChallengeMode"
                  :options="campChallengeModeOptions"
                  trigger="click"
                  @update:value="onCampChallengeModeChange"
                >
                  <n-button
                    size="small"
                    :disabled="isRunning || selectedTokens.length === 0"
                  >
                    营地挑战({{ campChallengeModeLabel }})
                  </n-button>
                </n-popselect>
              </n-space>
            </n-tab-pane>
            <n-tab-pane name="dungeon" tab="副本">
              <n-space>
                <n-button
                  size="small"
                  @click="climbTower"
                  :disabled="isRunning || selectedTokens.length === 0"
                >
                  一键爬塔
                </n-button>
                <n-button
                  size="small"
                  @click="batchmengjing"
                  :disabled="
                    isRunning ||
                    selectedTokens.length === 0 ||
                    !ismengjingActivityOpen
                  "
                >
                  一键梦境
                </n-button>
                <n-button
                  size="small"
                  @click="skinChallenge"
                  :disabled="isRunning || selectedTokens.length === 0"
                >
                  一键换皮闯关
                </n-button>
                <n-button
                  size="small"
                  @click="batchClaimPeachTasks"
                  :disabled="isRunning || selectedTokens.length === 0"
                >
                  一键领取蟠桃园任务
                </n-button>
                <n-button
                  size="small"
                  @click="batchBuyDreamItems"
                  :disabled="
                    isRunning ||
                    selectedTokens.length === 0 ||
                    !ismengjingActivityOpen
                  "
                >
                  一键购买梦境商品
                </n-button>
              </n-space>
            </n-tab-pane>
            <n-tab-pane name="apex" tab="逐鹿盐山">
              <n-space>
                <n-popselect
                  :value="footballPick"
                  :options="footballPickOptions"
                  trigger="click"
                  @update:value="onFootballPickChange"
                >
                  <n-button
                    size="small"
                    :disabled="isRunning || selectedTokens.length === 0"
                  >
                    一键竞猜({{ footballPickLabel }})
                  </n-button>
                </n-popselect>
                <n-button
                  size="small"
                  :disabled="isRunning || selectedTokens.length === 0"
                  @click="batchApexGuess()"
                >
                  逐鹿盐山竞猜
                </n-button>
                <n-button
                  size="small"
                  :disabled="isRunning || selectedTokens.length === 0"
                  @click="batchApexVote"
                >
                  逐鹿盐山助威
                </n-button>
                <n-button
                  size="small"
                  :disabled="isRunning || selectedTokens.length === 0"
                  @click="batchApexClaimTask"
                >
                  逐鹿盐山任务
                </n-button>
                <n-button
                  size="small"
                  :disabled="isRunning || selectedTokens.length === 0"
                  @click="batchApexClaimGuess"
                >
                  竞猜奖励领取
                </n-button>
              </n-space>
            </n-tab-pane>
            <n-tab-pane name="weirdTower" tab="怪异塔">
              <n-space>
                <n-input-number
                  v-model:value="weirdTowerMaxClimb"
                  class="weird-tower-count-input"
                  size="small"
                  :min="1"
                  :precision="0"
                  :show-button="false"
                  placeholder="次数"
                  :disabled="isRunning"
                />
                <span class="weird-tower-count-unit">次</span>
                <n-button
                  size="small"
                  @click="climbWeirdTower"
                  :disabled="
                    isRunning ||
                    selectedTokens.length === 0 ||
                    !isWeirdTowerActivityOpen
                  "
                >
                  一键爬怪异塔
                </n-button>
                <n-button
                  size="small"
                  @click="batchUseItems"
                  :disabled="
                    isRunning ||
                    selectedTokens.length === 0 ||
                    !isWeirdTowerActivityOpen
                  "
                >
                  一键使用怪异塔道具
                </n-button>
                <n-button
                  size="small"
                  @click="batchMergeItems"
                  :disabled="
                    isRunning ||
                    selectedTokens.length === 0 ||
                    !isWeirdTowerActivityOpen
                  "
                >
                  一键怪异塔合成
                </n-button>
                <n-button
                  size="small"
                  @click="batchClaimFreeEnergy"
                  :disabled="
                    isRunning ||
                    selectedTokens.length === 0 ||
                    !isWeirdTowerActivityOpen
                  "
                >
                  一键领取怪异塔免费道具
                </n-button>
              </n-space>
            </n-tab-pane>
            <n-tab-pane name="resource" tab="资源">
              <n-space>
                <n-button
                  size="small"
                  @click="openHelperModal('box')"
                  :disabled="isRunning || selectedTokens.length === 0"
                >
                  批量开箱
                </n-button>
                <n-button
                  size="small"
                  @click="openHelperModal('pointsBox')"
                  :disabled="isRunning || selectedTokens.length === 0"
                >
                  按积分开箱
                </n-button>
                <n-button
                  size="small"
                  @click="batchClaimBoxPointReward"
                  :disabled="isRunning || selectedTokens.length === 0"
                >
                  领取宝箱积分
                </n-button>
                <n-button
                  size="small"
                  @click="openHelperModal('fish')"
                  :disabled="isRunning || selectedTokens.length === 0"
                >
                  批量钓鱼
                </n-button>
                <n-button
                  size="small"
                  @click="openHelperModal('recruit')"
                  :disabled="isRunning || selectedTokens.length === 0"
                >
                  批量招募
                </n-button>
                <n-button
                  size="small"
                  @click="openRedeemCodeModal"
                  :disabled="isRunning || selectedTokens.length === 0"
                >
                  一键使用兑换码
                </n-button>
                <n-button
                  size="small"
                  @click="batchHeroUpgrade"
                  :disabled="isRunning || selectedTokens.length === 0"
                >
                  一键英雄升星
                </n-button>
                <n-button
                  size="small"
                  @click="batchBookUpgrade"
                  :disabled="isRunning || selectedTokens.length === 0"
                >
                  一键图鉴升星
                </n-button>
                <n-button
                  size="small"
                  @click="batchClaimStarRewards"
                  :disabled="isRunning || selectedTokens.length === 0"
                >
                  一键领取图鉴奖励
                </n-button>
                <n-button
                  size="small"
                  @click="legion_storebuygoods"
                  :disabled="isRunning || selectedTokens.length === 0"
                >
                  一键购买四圣碎片
                </n-button>
                <n-button
                  size="small"
                  @click="legionStoreBuySkinCoins"
                  :disabled="isRunning || selectedTokens.length === 0"
                >
                  一键购买俱乐部5皮肤币
                </n-button>
              </n-space>
            </n-tab-pane>
            <n-tab-pane name="legacy" tab="功法">
              <n-space align="center">
                <n-button
                  size="small"
                  @click="batchLegacyClaim"
                  :disabled="isRunning || selectedTokens.length === 0"
                >
                  批量功法残卷领取
                </n-button>
                <n-button
                  size="small"
                  @click="showLegacyGiftModal = true"
                  :disabled="isRunning || selectedTokens.length === 0"
                >
                  批量功法残卷赠送
                </n-button>
                <n-button
                  size="small"
                  @click="batchLegacyStartExplore"
                  :disabled="isRunning || selectedTokens.length === 0"
                >
                  批量功法残卷开启
                </n-button>
              </n-space>
            </n-tab-pane>
            <n-tab-pane name="monthly" tab="月度">
              <n-space>
                <n-button
                  size="small"
                  @click="batchTopUpFish"
                  :disabled="isRunning || selectedTokens.length === 0"
                >
                  一键钓鱼补齐
                </n-button>
                <n-button
                  size="small"
                  @click="batchTopUpArena"
                  :disabled="
                    isRunning ||
                    selectedTokens.length === 0 ||
                    !isarenaActivityOpen
                  "
                >
                  一键竞技场补齐
                </n-button>
                <n-button
                  size="small"
                  @click="openWarGuessModal"
                  :disabled="
                    isRunning ||
                    selectedTokens.length === 0 ||
                    !isWarGuessActivityOpen
                  "
                  :title="isWarGuessActivityOpen ? '' : warGuessActivityTip"
                >
                  月赛助威
                </n-button>
              </n-space>
            </n-tab-pane>
          </n-tabs>
        </n-card>
      </div>

      <!-- Right Column - Execution Log -->
      <div class="right-column">
        <n-card class="log-card">
          <template #header>
            <div class="custom-card-header">
              <div class="card-title">
                {{
                  currentRunningTokenName
                    ? `正在执行: ${currentRunningTokenName}`
                    : "执行日志"
                }}
                <span
                  style="margin-left: 12px; font-size: 12px; color: #86909c"
                >
                  {{ logs.length }}/{{ batchSettings.maxLogEntries || 1000 }}
                </span>
              </div>
              <div class="log-header-controls">
                <n-checkbox v-model:checked="autoScrollLog" size="small">
                  自动滚动
                </n-checkbox>
                <n-checkbox v-model:checked="filterErrorsOnly" size="small">
                  只看错误
                </n-checkbox>
                <n-tag v-if="errorCount > 0" type="error" size="small">
                  {{ errorCount }} 个错误
                </n-tag>
                <n-button size="small" @click="clearLogs"> 清空日志 </n-button>
                <n-button size="small" @click="copyLogs"> 复制日志 </n-button>
              </div>
            </div>
          </template>
          <n-progress
            type="line"
            :percentage="currentProgress"
            indicator-placement="inside"
            processing
          />
          <div class="log-container" ref="logContainer">
            <div
              v-for="(log, logIndex) in filteredLogs"
              :key="logIndex"
              class="log-item"
              :class="log.type"
            >
              <span class="time">{{ log.time }}</span>
              <span class="message">{{ log.message }}</span>
            </div>
          </div>
        </n-card>
      </div>
    </div>

    <!-- Settings Modal -->
    <TokenSettingsModal
      v-model:show="showSettingsModal"
      :current-settings="currentSettings"
      :token-name="currentSettingsTokenName"
      @save="saveSettings"
    />

    <!-- Task Template Modal -->
    <TemplateEditModal
      v-model:show="showTaskTemplateModal"
      :current-template="currentTemplate"
      v-model:template-name="currentTemplateName"
      :is-editing="!!currentTemplateId"
      @save="saveTaskTemplate"
    />

    <!-- Apply Template Modal -->
    <ApplyTemplateModal
      v-model:show="showApplyTemplateModal"
      v-model:selected-template-id="selectedTemplateId"
      v-model:selected-tokens-for-apply="selectedTokensForApply"
      :task-templates="taskTemplates"
      :sorted-tokens="sortedTokens"
      :is-all-selected-for-apply="isAllSelectedForApply"
      :is-indeterminate-for-apply="isIndeterminateForApply"
      @select-all="handleSelectAllForApply"
      @apply="applyTemplate"
    />

    <!-- Template Manager Modal -->
    <TemplateManageModal
      v-model:show="showTemplateManagerModal"
      :filtered-task-templates="filteredTaskTemplates"
      @delete="deleteTaskTemplate"
      @open-references="openAccountTemplateModal"
      @open-apply="openApplyTemplateModal"
      @edit="openEditTemplateModal"
      @create="openNewTemplateModal"
    />

    <!-- Account Template References Modal -->
    <AccountTemplateRefModal
      v-model:show="showAccountTemplateModal"
      v-model:selected-template-for-filter="selectedTemplateForFilter"
      :filtered-account-templates="filteredAccountTemplates"
      :task-templates="taskTemplates"
      @filter="filterAccountTemplates"
    />

    <!-- Legacy Gift Modal -->
    <LegacyGiftModal
      v-model:show="showLegacyGiftModal"
      v-model:recipient-id-input="recipientIdInput"
      v-model:security-password="securityPassword"
      v-model:gift-quantity="giftQuantity"
      :recipient-info="recipientInfo"
      :recipient-id-error="recipientIdError"
      :is-avatar-loading="isAvatarLoading"
      :avatar-load-error="avatarLoadError"
      @query="queryRecipientInfo"
      @confirm="confirmLegacyGift"
      @clear-error="clearRecipientError"
      @avatar-load="handleAvatarLoad"
      @avatar-error="handleAvatarError"
    />

    <!-- Helper Modal (开箱/钓鱼/招募/按积分开箱) -->
    <HelperModal
      v-model:show="showHelperModal"
      :title="helperModalTitle"
      :helper-type="helperType"
      :helper-settings="helperSettings"
      @execute="executeHelper"
    />

    <!-- Redeem Code Modal -->
    <RedeemCodeModal
      v-model:show="showRedeemCodeModal"
      v-model:cdk-codes="batchSettings.cdkCodes"
      v-model:cdk-platform-type="batchSettings.cdkPlatformType"
      @save="saveRedeemCodeConfig"
      @execute="executeRedeemCodes"
    />

    <!-- Dream Buy Modal -->
    <DreamShopModal
      v-model:show="showDreamBuyModal"
      v-model:selected-keys="dreamBuyList"
      @toggle="toggleDreamItem"
      @select-gold="selectGoldItems"
      @select-all="selectAllItems"
      @clear="clearAllItems"
      @save="saveDreamBuyConfig"
    />

    <!-- Black Market Purchase Modal -->
    <BlackMarketModal
      v-model:show="showBlackMarketPurchaseModal"
      v-model:list="blackMarketPurchaseList"
      :item-options="blackMarketItemOptions"
      @add="addBlackMarketPurchaseItem"
      @remove="removeBlackMarketPurchaseItem"
      @reset="resetBlackMarketPurchaseList"
      @save="saveBlackMarketPurchaseConfig"
      @apply-catalog="applyBlackMarketCatalogItem"
    />

    <!-- Tasks List Modal -->
    <ScheduledTaskListModal
      v-model:show="showTasksModal"
      :tasks="scheduledTasks"
      :executing-task-ids="executingTaskIds"
      @toggle="toggleTaskEnabled"
      @edit="editTask"
      @delete="deleteTask"
      @execute="manualExecuteTask"
    />

    <!-- 云端定时面板 -->
    <CloudCronModal
      v-model:show="showCloudModal"
      v-model:backend-url="cloudBackendUrl"
      v-model:backend-key="cloudBackendKey"
      :cloud-testing="cloudTesting"
      :cloud-syncing="cloudSyncing"
      :cloud-test-results-loading="cloudTestResultsLoading"
      :cloud-log-loading="cloudLogLoading"
      :cloud-status="cloudStatus"
      :cloud-status-ok="cloudStatusOk"
      :cloud-test-results="cloudTestResults"
      :cloud-logs="cloudLogs"
      @test="cloudTestConnection"
      @sync="cloudSync"
      @test-tokens="cloudTestAllTokens"
      @load-logs="cloudLoadLogs"
    />

    <!-- Task Modal -->
    <TaskFormModal
      v-model:show="showTaskModal"
      :task-form="taskForm"
      :editing-task="editingTask"
      :cron-validation="cronValidation"
      :cron-next-runs="cronNextRuns"
      :sorted-tokens="sortedTokens"
      :task-schedule-selected-group-ids="taskScheduleSelectedGroupIds"
      :task-group-definitions="taskGroupDefinitions"
      :grouped-available-tasks="groupedAvailableTasks"
      @save="saveTask"
      @reset-run-type="resetRunType"
      @parse-cron="parseCronExpression"
      @select-all-tokens="selectAllTokens"
      @deselect-all-tokens="deselectAllTokens"
      @select-all-tasks="selectAllTasks"
      @deselect-all-tasks="deselectAllTasks"
      @open-groups="showGroupManageModal = true"
    />

    <!-- Batch Settings Modal -->
    <BatchSettingsModal
      v-model:show="showBatchSettingsModal"
      :batch-settings="batchSettings"
      @save="saveBatchSettings"
      @open-dream-buy="openDreamBuyModal"
    />

    <!-- Export text fallback modal: APK/手机 WebView 无法直接保存 blob 下载文件 -->
    <ExportConfigModal
      v-model:show="showExportTextModal"
      :relay-url="exportRelayUrl"
      :json-text="exportJsonText"
      @copy-link="copyExportLink"
      @open-link="openExportLink"
      @copy-text="copyExportText"
    />

    <!-- War Guess Modal -->
    <WarGuessModal
      v-model:show="showWarGuessModal"
      v-model:coin="warGuessCoin"
      :war-guess-list="warGuessList"
      :war-guess-loading="warGuessLoading"
      :war-guess-columns="warGuessColumns"
      :war-guess-row-props="warGuessRowProps"
      v-model:selected-war-guess-legion-id="selectedWarGuessLegionId"
      :is-running="isRunning"
      @cheer="handleWarGuessCheer"
      @fetch="fetchWarGuessRank"
    />

    <!-- Batch Apply Legion Modal -->
    <ApplyLegionModal
      v-model:show="showApplyLegionModal"
      v-model:target-id="applyLegionTargetId"
      :apply-legion-preview="applyLegionPreview"
      :apply-legion-loading="applyLegionLoading"
      :apply-legion-error="applyLegionError"
      :is-running="isRunning"
      @fetch="fetchApplyLegionTargetInfo"
      @apply="handleBatchApplyLegion"
    />

    <!-- Token Group Management Modal -->
    <GroupManageModal
      v-model:show="showGroupManageModal"
      :tokens="tokens"
      :sorted-tokens="sortedTokens"
    />
  </div>
</template>

<script setup>
import { Settings } from "@vicons/ionicons5";
import { useLocalStorage } from "@vueuse/core";
import { useMessage } from "naive-ui";
// Import required dependencies
import {
  computed,
  h,
  nextTick,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch,
} from "vue";
import { $emit } from "@/stores/events/index.ts";
import { gameTokens, tokenGroups, useTokenStore } from "@/stores/tokenStore";
import GroupManageModal from "@/components/Batch/GroupManageModal.vue";
import { useTaskTemplates } from "@/composables/useTaskTemplates";
import { useScheduledTasks } from "@/composables/useScheduledTasks";
import { useConfigImportExport } from "@/composables/useConfigImportExport";
import LegacyGiftModal from "@/components/Batch/LegacyGiftModal.vue";
import RedeemCodeModal from "@/components/Batch/RedeemCodeModal.vue";
import ExportConfigModal from "@/components/Batch/ExportConfigModal.vue";
import WarGuessModal from "@/components/Batch/WarGuessModal.vue";
import ApplyLegionModal from "@/components/Batch/ApplyLegionModal.vue";
import AccountTemplateRefModal from "@/components/Batch/AccountTemplateRefModal.vue";
import DreamShopModal from "@/components/Batch/DreamShopModal.vue";
import BlackMarketModal from "@/components/Batch/BlackMarketModal.vue";
import TokenSettingsModal from "@/components/Batch/TokenSettingsModal.vue";
import HelperModal from "@/components/Batch/HelperModal.vue";
import ScheduledTaskListModal from "@/components/Batch/ScheduledTaskListModal.vue";
import CloudCronModal from "@/components/Batch/CloudCronModal.vue";
import TaskFormModal from "@/components/Batch/TaskFormModal.vue";
import BatchSettingsModal from "@/components/Batch/BatchSettingsModal.vue";
import TemplateEditModal from "@/components/Batch/TemplateEditModal.vue";
import ApplyTemplateModal from "@/components/Batch/ApplyTemplateModal.vue";
import TemplateManageModal from "@/components/Batch/TemplateManageModal.vue";
// Import batch task modules
import {
  addTaskSaveLog,
  availableTasks,
  bossTimesOptions,
  // Constants
  boxTypeOptions,
  calculateMonthProgress,
  calculateNextRuns,
  createTasksApex,
  createTasksArena,
  createTasksBottle,
  createTasksCampChallenge,
  createTasksDungeon,
  createTasksFootball,
  // Task factories
  createTasksHangUp,
  createTasksItem,
  createTasksLegacy,
  createTasksPKRoom,
  createTasksStore,
  createTasksTower,
  createTasksXuanwuBlessing,
  fishTypeOptions,
  formationOptions,
  towerFormationOptions,
  getTodayStartSec,
  isTodayAvailable,
  matchesCronExpression,
  pickArenaTargetId,
  validateCronExpression,
} from "@/utils/batch";
import {
  blackMarketItemCatalog,
  createBlackMarketPurchaseEntry,
  defaultBlackMarketPurchaseList,
  normalizeBlackMarketPurchaseList,
} from "@/utils/batch/blackMarketConfig";
import { DailyTaskRunner } from "@/utils/dailyTaskRunner";
import { dailySettingsDefaults } from "@/utils/dailyTaskState";
import { goldItemsConfig, merchantConfig } from "@/utils/dreamConstants";

import { toBase64Url } from "@/utils/encoding";
import { uploadForRelayUrl } from "@/utils/fileRelay";

import { DEFAULT_WEIRD_TOWER_MAX_CLIMB } from "@/utils/towerClimbLimit.js";

// Initialize token store, message service, and task runner
const tokenStore = useTokenStore();
const message = useMessage();
const weirdTowerMaxClimb = ref(DEFAULT_WEIRD_TOWER_MAX_CLIMB);

// 排序配置（从localStorage读取，与TokenImport共享）
const savedSortConfig = localStorage.getItem("tokenSortConfig");
const sortConfig = ref(
  savedSortConfig
    ? JSON.parse(savedSortConfig)
    : {
        field: "createdAt", // 排序字段：name, server, createdAt, lastUsed
        direction: "asc", // 排序方向：asc, desc
      },
);

// 计算属性 - 从gameData中获取塔相关信息

// 排序后的游戏角色Token列表
const sortedTokens = computed(() => {
  return [...tokenStore.gameTokens].sort((tokenA, tokenB) => {
    let valueA, valueB;

    // 根据排序字段获取比较值
    switch (sortConfig.value.field) {
      case "name":
        valueA = tokenA.name?.toLowerCase() || "";
        valueB = tokenB.name?.toLowerCase() || "";
        break;
      case "server":
        valueA = tokenA.server?.toLowerCase() || "";
        valueB = tokenB.server?.toLowerCase() || "";
        break;
      case "createdAt":
        valueA = new Date(tokenA.createdAt || 0).getTime();
        valueB = new Date(tokenB.createdAt || 0).getTime();
        break;
      case "lastUsed":
        valueA = new Date(tokenA.lastUsed || 0).getTime();
        valueB = new Date(tokenB.lastUsed || 0).getTime();
        break;
      default:
        valueA = tokenA.name?.toLowerCase() || "";
        valueB = tokenB.name?.toLowerCase() || "";
    }

    // 根据排序方向比较值
    if (valueA < valueB) {
      return sortConfig.value.direction === "asc" ? -1 : 1;
    }
    if (valueA > valueB) {
      return sortConfig.value.direction === "asc" ? 1 : -1;
    }
    return 0;
  });
});

// 切换排序
const toggleSort = (field) => {
  if (sortConfig.value.field === field) {
    // 如果点击的是当前排序字段，则切换排序方向
    sortConfig.value.direction =
      sortConfig.value.direction === "asc" ? "desc" : "asc";
  } else {
    // 如果点击的是新的排序字段，则默认升序
    sortConfig.value.field = field;
    sortConfig.value.direction = "asc";
  }

  // 保存排序设置到localStorage
  localStorage.setItem("tokenSortConfig", JSON.stringify(sortConfig.value));
};

// =====================
// 任务模板管理（composable）
// =====================
const {
  showTaskTemplateModal,
  showApplyTemplateModal,
  showTemplateManagerModal,
  showAccountTemplateModal,
  taskTemplates,
  selectedTemplateId,
  selectedTokensForApply,
  currentTemplateName,
  currentTemplate,
  filteredAccountTemplates,
  selectedTemplateForFilter,
  isAllSelectedForApply,
  isIndeterminateForApply,
  filteredTaskTemplates,
  loadTaskTemplates,
  openApplyTemplateModal,
  handleSelectAllForApply,
  applyTemplate,
  openEditTemplateModal,
  deleteTaskTemplate,
  openAccountTemplateModal,
  loadAccountTemplateReferences,
  filterAccountTemplates,
  openNewTemplateModal,
  saveTaskTemplate,
} = useTaskTemplates({ sortedTokens });

// 获取排序图标
const getSortIcon = (field) => {
  if (sortConfig.value.field !== field) return null;
  return sortConfig.value.direction === "asc" ? "↑" : "↓";
};

const tokens = computed(() => tokenStore.gameTokens);
const ismengjingActivityOpen = computed(() => {
  const day = new Date().getDay();
  return day === 0 || day === 1 || day === 3 || day === 4;
});
const isarenaActivityOpen = computed(() => {
  const hour = new Date().getHours();
  return hour >= 6 && hour < 22;
});
const getCurrentActivityWeek = computed(() => {
  const now = new Date();
  const start = new Date("2025-12-12T12:00:00"); // 起始时间：黑市周开始
  const weekDuration = 7 * 24 * 60 * 60 * 1000; // 一周毫秒数
  const cycleDuration = 3 * weekDuration; // 三周期毫秒数

  const elapsed = now - start;
  if (elapsed < 0) return null; // 活动开始前

  const cyclePosition = elapsed % cycleDuration;

  if (cyclePosition < weekDuration) {
    return "黑市周";
  } else if (cyclePosition < 2 * weekDuration) {
    return "招募周";
  } else {
    return "宝箱周";
  }
});

const isWeirdTowerActivityOpen = computed(() => {
  if (getCurrentActivityWeek.value !== "黑市周") return false;

  const now = new Date();
  const day = now.getDay();
  const hour = now.getHours();
  // 如果是周五，必须在12点之后
  if (day === 5) {
    return hour >= 12;
  }
  return true;
});

// 获取本月第四个周日的日期
const getFourthSundayOfMonth = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  // 当月第一天
  const firstDay = new Date(year, month, 1);
  const dayOfWeek = firstDay.getDay(); // 0-6

  // 计算第一个周日的日期 (1号是周日则为1，否则为 1 + 7 - dayOfWeek)
  let firstSundayDate = 1 + ((7 - dayOfWeek) % 7);

  // 仅针对2026年3月进行特殊处理
  if (year === 2026 && month === 2 && dayOfWeek === 0) {
    firstSundayDate = 8;
  }

  // 第四个周日 = 第一个周日 + 21天
  return new Date(year, month, firstSundayDate + 21);
};

const isWarGuessActivityOpen = computed(() => {
  const now = new Date();

  // 手动修正：2026年3月1日开放
  if (
    now.getFullYear() === 2026 &&
    now.getMonth() === 2 &&
    now.getDate() === 1
  ) {
    const hour = now.getHours();
    const minute = now.getMinutes();
    if (hour < 19 || (hour === 19 && minute <= 55)) return true;
  }

  const fourthSunday = getFourthSundayOfMonth();

  // 检查是否是今天
  if (now.getDate() !== fourthSunday.getDate()) return false;

  // 检查时间 00:00 - 19:55
  const hour = now.getHours();
  const minute = now.getMinutes();
  if (hour > 19 || (hour === 19 && minute > 55)) return false;

  return true;
});

const warGuessActivityTip = computed(() => {
  if (isWarGuessActivityOpen.value) return "";

  const fourthSunday = getFourthSundayOfMonth();
  const month = fourthSunday.getMonth() + 1;
  const date = fourthSunday.getDate();
  return `月赛助威仅在每月第四个周日 (${month}月${date}日) 00:00-19:55 开放`;
});

const selectedTokens = ref([]);
const tokenStatus = ref({}); // { tokenId: 'waiting' | 'running' | 'completed' | 'failed' | 'skipped' }
const isRunning = ref(false);
const shouldStop = ref(false);

// =====================
// Token分组管理状态（分组增删改 UI 已抽到 GroupManageModal.vue，
// 这里只保留分组选择相关的状态；分组数据与 CRUD 在 tokenStore）
// =====================
const showGroupManageModal = ref(false);

const selectedGroups = ref([]); // 选中的分组ID列表

// ======================
// War Guess Feature
// ======================
const showWarGuessModal = ref(false);
const warGuessList = ref([]);
const warGuessLoading = ref(false);
const warGuessCoin = ref(20);
const selectedWarGuessLegionId = ref(null);

const formatPower = (power) => {
  if (!power) return "0";
  if (power >= 100000000) {
    return `${(power / 100000000).toFixed(2)}亿`;
  }
  if (power >= 10000) {
    return `${(power / 10000).toFixed(2)}万`;
  }
  return power.toString();
};

const warGuessColumns = [
  {
    type: "selection",
    multiple: false,
  },
  { title: "ID", key: "id", width: 100 },
  {
    title: "头像",
    key: "logo",
    render(row) {
      return h("img", {
        src: row.logo,
        style: { width: "30px", height: "30px", borderRadius: "50%" },
      });
    },
    width: 60,
  },
  { title: "区服", key: "serverId", width: 80 },
  { title: "俱乐部", key: "name", width: 120 },
  {
    title: "战力",
    key: "power",
    render(row) {
      return formatPower(row.power);
    },
    width: 100,
  },
  { title: "红淬", key: "quenchNum" },
  { title: "已助威", key: "guessNum" },
  {
    title: "总热度",
    key: "totalNum",
    render(row) {
      return formatPower(row.totalNum || 0);
    },
    width: 100,
  },
];

const warGuessRowProps = (row) => {
  return {
    style: "cursor: pointer",
    onClick: () => {
      selectedWarGuessLegionId.value = row.id;
    },
  };
};

const openWarGuessModal = () => {
  showWarGuessModal.value = true;
  // Reset selection
  selectedWarGuessLegionId.value = null;
  warGuessList.value = [];

  // Auto fetch if tokens selected
  if (selectedTokens.value.length > 0) {
    fetchWarGuessRank();
  }
};

const fetchWarGuessRank = async () => {
  if (selectedTokens.value.length === 0) {
    message.warning("请先选择一个账号用于获取月赛助威数据");
    return;
  }

  const tokenId = selectedTokens.value[0];
  const token = tokens.value.find((t) => t.id === tokenId);

  warGuessLoading.value = true;
  try {
    addLog({
      time: new Date().toLocaleTimeString(),
      message: `正在使用 ${token.name} 获取月赛助威数据...`,
      type: "info",
    });

    // Ensure connection
    const status = tokenStore.getWebSocketStatus(tokenId);
    if (status !== "connected") {
      tokenStore.createWebSocketConnection(tokenId, token.token, token.wsUrl);
      await new Promise((r) => setTimeout(r, 2000)); // Wait for connection
    }

    // Fetch rank
    const res = await tokenStore.sendMessageWithPromise(
      tokenId,
      "warguess_getrank",
      { bfId: "" },
      5000,
    );

    if (res && res.list) {
      let list = [];
      if (Array.isArray(res.list)) {
        list = res.list;
      } else {
        list = Object.values(res.list);
      }

      // Sort by totalNum desc
      warGuessList.value = list
        .sort((a, b) => (b.totalNum || 0) - (a.totalNum || 0))
        .slice(0, 20);
    } else {
      message.warning("获取月赛助威数据为空");
    }
  } catch (error) {
    console.error("Fetch rank error:", error);
    message.error(`获取月赛助威数据失败: ${error.message}`);
    addLog({
      time: new Date().toLocaleTimeString(),
      message: `获取月赛助威数据失败: ${error.message}`,
      type: "error",
    });
  } finally {
    warGuessLoading.value = false;
  }
};

const handleWarGuessCheer = async () => {
  if (!selectedWarGuessLegionId.value) {
    message.warning("请先选择一个俱乐部");
    return;
  }
  // Close modal
  showWarGuessModal.value = false;
  // Call the batch function
  await batchWarGuessCheer(selectedWarGuessLegionId.value, warGuessCoin.value);
};

// ======================
// Batch Apply Legion Feature
// ======================
const showApplyLegionModal = ref(false);
const applyLegionTargetId = ref(null);
const applyLegionPreview = ref(null);
const applyLegionLoading = ref(false);
const applyLegionError = ref("");

const openApplyLegionModal = () => {
  showApplyLegionModal.value = true;
  applyLegionError.value = "";
  applyLegionPreview.value = null;
};

const fetchApplyLegionTargetInfo = async () => {
  if (selectedTokens.value.length === 0) {
    message.warning("请先选择一个账号用于查询俱乐部");
    return;
  }

  if (!applyLegionTargetId.value) {
    message.warning("请先输入俱乐部ID");
    return;
  }

  const tokenId = selectedTokens.value[0];
  const token = tokens.value.find((t) => t.id === tokenId);

  applyLegionLoading.value = true;
  applyLegionError.value = "";
  applyLegionPreview.value = null;

  try {
    addLog({
      time: new Date().toLocaleTimeString(),
      message: `正在使用 ${token.name} 查询俱乐部 ${applyLegionTargetId.value}...`,
      type: "info",
    });

    const status = tokenStore.getWebSocketStatus(tokenId);
    if (status !== "connected") {
      tokenStore.createWebSocketConnection(tokenId, token.token, token.wsUrl);
      await new Promise((r) => setTimeout(r, 2000));
    }

    applyLegionPreview.value = await queryLegionById(
      tokenId,
      applyLegionTargetId.value,
    );

    addLog({
      time: new Date().toLocaleTimeString(),
      message: `已查询到目标俱乐部: ${applyLegionPreview.value.name} (${applyLegionPreview.value.id})`,
      type: "success",
    });
  } catch (error) {
    console.error("Fetch legion info error:", error);
    applyLegionError.value = error.message || "查询俱乐部失败";
    addLog({
      time: new Date().toLocaleTimeString(),
      message: `查询俱乐部失败: ${applyLegionError.value}`,
      type: "error",
    });
    message.error(applyLegionError.value);
  } finally {
    applyLegionLoading.value = false;
  }
};

const handleBatchApplyLegion = async () => {
  if (!applyLegionPreview.value?.id) {
    message.warning("请先查询并确认目标俱乐部");
    return;
  }

  showApplyLegionModal.value = false;
  await batchApplyLegion(applyLegionPreview.value.id);
};

// Settings Modal State
const showSettingsModal = ref(false);
const currentSettingsTokenId = ref(null);
const currentSettingsTokenName = ref("");
const currentSettings = reactive({
  ...dailySettingsDefaults,
  // 爬塔阵容一次性迁移标记：旧数据迁移后置 true，避免再覆盖用户手动选择
  formationMigrated: true,
});

// Helper Modal State
const showHelperModal = ref(false);
const helperType = ref("box"); // 'box' | 'fish' | 'recruit'
const helperSettings = reactive({
  boxType: 2001,
  fishType: 1,
  count: 100,
  targetPoints: 1000,
});

const helperModalTitle = computed(() => {
  const titles = {
    box: "批量开宝箱",
    fish: "批量钓鱼",
    recruit: "批量招募",
    pointsBox: "按积分开箱",
  };
  return titles[helperType.value] || "批量助手";
});

// Batch Settings State
const showBatchSettingsModal = ref(false);

const defaultDreamPurchaseList = [];
for (const merchantId in goldItemsConfig) {
  goldItemsConfig[merchantId].forEach((index) => {
    defaultDreamPurchaseList.push(`${merchantId}-${index}`);
  });
}

const createDefaultBlackMarketPurchaseList = () =>
  defaultBlackMarketPurchaseList.map((item) => ({ ...item }));

const blackMarketItemOptions = blackMarketItemCatalog.map((item) => ({
  label: `${item.label} (${item.itemId})`,
  value: item.itemId,
}));

const batchSettings = reactive({
  dreamPurchaseList: defaultDreamPurchaseList,
  blackMarketPurchaseList: createDefaultBlackMarketPurchaseList(),
  boxCount: 100,
  fishCount: 100,
  recruitCount: 100,
  cdkCodes: "",
  cdkPlatformType: "h5",
  defaultBoxType: 2001,
  defaultFishType: 1,
  targetBoxPoints: 1000,
  receiverId: "",
  password: "",
  tokenListColumns: 2,
  // 延迟配置（毫秒）
  commandDelay: 500, // 命令间延迟
  taskDelay: 500, // 任务间延迟
  actionDelay: 300, // 一般操作延迟（开箱、钓鱼、招募等）
  battleDelay: 500, // 战斗延迟（宝库、竞技场等）
  refreshDelay: 1000, // 刷新延迟
  longDelay: 3000, // 长延迟（功法赠送等）
  // 其他配置
  maxActive: 2,
  connectionTimeout: 10000,
  reconnectDelay: 1000,
  maxLogEntries: 1000,
  // 页面刷新配置
  enableRefresh: false,
  refreshInterval: 360, // 分钟
});

// Load batch settings from localStorage
const loadBatchSettings = () => {
  try {
    const saved = localStorage.getItem("batchSettings");
    if (saved) {
      const parsed = JSON.parse(saved);
      Object.assign(batchSettings, parsed);
    }
    batchSettings.cdkCodes = batchSettings.cdkCodes || "";
    batchSettings.cdkPlatformType = batchSettings.cdkPlatformType || "h5";
    batchSettings.blackMarketPurchaseList = normalizeBlackMarketPurchaseList(
      batchSettings.blackMarketPurchaseList?.length
        ? batchSettings.blackMarketPurchaseList
        : createDefaultBlackMarketPurchaseList(),
    );
  } catch (error) {
    console.error("Failed to load batch settings:", error);
  }
};

// Save batch settings to localStorage
const saveBatchSettings = () => {
  try {
    localStorage.setItem("batchSettings", JSON.stringify(batchSettings));
    message.success("定时批量任务设置已保存");
    showBatchSettingsModal.value = false;
  } catch (error) {
    console.error("Failed to save batch settings:", error);
    message.error("保存设置失败");
  }
};

// Open batch settings modal
const openBatchSettings = () => {
  loadBatchSettings();
  showBatchSettingsModal.value = true;
};

// Load settings on component mount
loadBatchSettings();

// ======================
// Legacy Gift Feature
// ======================

// Legacy Gift Modal State
const showLegacyGiftModal = ref(false);
const recipientIdInput = ref("");
const recipientIdError = ref("");
const recipientInfo = ref(null);
const isQueryingRecipient = ref(false);
const giftQuantity = ref(10);
const securityPassword = ref(""); // 安全密码
// 头像加载状态
const isAvatarLoading = ref(false);
const avatarLoadError = ref(false);

const showRedeemCodeModal = ref(false); // Control the visibility of the redeem code modal
// ======================
// 云端定时（服务端执行）
// ======================

// 页面任务 → 云端 TASK_DEFINITIONS key 映射；未列入的复杂任务云端不支持
const CLOUD_TASK_MAP = {
  startBatch: "dailyBundle",
  claimHangUpRewards: "claimHangup",
  climbTower: "climbTower",
  climbWeirdTower: "climbWeirdTower",
  batchStudy: "studyGame",
  batchclubsign: "legionSignIn",
  batchGenieSweep: "genieSweep",
  collection_claimfreereward: "collectionClaim",
  store_purchase: "blackMarketPurchase",
  batchCampClaimTasks: "campTaskClaim",
  batchLegacyClaim: "legacyHangup",
  batchClaimActivity: "activity",
  batchApexClaimTask: "apexTask",
};

const showCloudModal = ref(false);
const cloudBackendUrl = useLocalStorage("cloudBackendUrl", "");
const cloudBackendKey = useLocalStorage("cloudBackendKey", "");
const cloudTesting = ref(false);
const cloudSyncing = ref(false);
const cloudLogLoading = ref(false);
const cloudTestResultsLoading = ref(false);
const cloudStatus = ref("");
const cloudStatusOk = ref(false);
const cloudTestResults = ref([]);
const cloudLogs = ref([]);

/** 与 tokenStore 的 parseBase64Token 相同的 actualToken 提取逻辑 */
const extractActualToken = (base64String) => {
  try {
    const clean = String(base64String || "")
      .replace(/^data:.*base64,/, "")
      .trim();
    if (!clean) return "";
    let decoded;
    try {
      decoded = atob(clean);
    } catch {
      decoded = clean;
    }
    try {
      const data = JSON.parse(decoded);
      return String(data.token || data.gameToken || decoded);
    } catch {
      return decoded;
    }
  } catch {
    return "";
  }
};

const cloudHeaders = () => ({
  "Content-Type": "application/json",
  "x-backend-key": cloudBackendKey.value,
});

const cloudTestConnection = async () => {
  if (!cloudBackendUrl.value || !cloudBackendKey.value) {
    cloudStatusOk.value = false;
    cloudStatus.value = "请先填写后端地址与访问密钥";
    return;
  }
  cloudTesting.value = true;
  cloudStatus.value = "";
  try {
    const resp = await fetch(
      `${cloudBackendUrl.value.replace(/\/$/, "")}/health`,
    );
    const data = await resp.json();
    cloudStatusOk.value = resp.ok;
    cloudStatus.value = resp.ok
      ? `连接成功，云端已注册 ${data.activeCrons} 个定时任务`
      : `连接失败: HTTP ${resp.status}`;
  } catch (err) {
    cloudStatusOk.value = false;
    cloudStatus.value = `连接失败: ${err.message}`;
  } finally {
    cloudTesting.value = false;
  }
};

const cloudSync = async () => {
  if (!cloudBackendUrl.value || !cloudBackendKey.value) {
    cloudStatusOk.value = false;
    cloudStatus.value = "请先填写后端地址与访问密钥";
    return;
  }

  const skippedTypes = new Set();
  let cronParseFailed = 0;
  const schedules = [];
  for (const task of scheduledTasks.value) {
    const selectedTasks = (task.selectedTasks || [])
      .map((v) => CLOUD_TASK_MAP[v])
      .filter(Boolean);
    (task.selectedTasks || []).forEach((v) => {
      if (!CLOUD_TASK_MAP[v]) skippedTypes.add(v);
    });
    const selectedTokens = (task.selectedTokens || []).filter((id) =>
      tokens.value.some((t) => t.id === id),
    );
    if (selectedTasks.length === 0 || selectedTokens.length === 0) continue;

    let cronExpr = task.cronExpression || "";
    if (task.runType === "daily") {
      // runTime 存的是 "00:10:00" 文本（toLocaleTimeString）或时间戳，统一提取时分
      const m = String(task.runTime || "").match(/(\d{1,2}):(\d{2})/);
      if (!m) {
        cronParseFailed += 1;
        continue;
      }
      const hh = String(Number(m[1])).padStart(2, "0");
      cronExpr = `0 ${m[2]} ${hh} * * *`;
    }
    if (!cronExpr) {
      cronParseFailed += 1;
      continue;
    }
    schedules.push({
      name: task.name,
      cron_expr: cronExpr,
      selected_tasks: selectedTasks,
      selected_tokens: selectedTokens,
      enabled: task.enabled !== false,
    });
  }

  const tokenRows = tokens.value
    .map((t) => ({
      id: t.id,
      name: t.name,
      token: extractActualToken(t.token),
    }))
    .filter((t) => t.token);

  if (schedules.length === 0) {
    cloudStatusOk.value = false;
    const hints = [];
    if (cronParseFailed)
      hints.push(
        `${cronParseFailed} 个任务的运行时间无法解析（请重新编辑保存一次定时任务）`,
      );
    if (skippedTypes.size)
      hints.push(
        `${[...skippedTypes]
          .map((v) => availableTasks.find((t) => t.value === v)?.label || v)
          .join("、")} 等复杂任务云端暂不支持`,
      );
    cloudStatus.value = `没有可同步的定时任务${hints.length ? `：${hints.join("；")}` : ""}`;
    return;
  }

  cloudSyncing.value = true;
  cloudStatus.value = "";
  try {
    const resp = await fetch(
      `${cloudBackendUrl.value.replace(/\/$/, "")}/api/sync`,
      {
        method: "POST",
        headers: cloudHeaders(),
        body: JSON.stringify({ tokens: tokenRows, schedules }),
      },
    );
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || `HTTP ${resp.status}`);
    cloudStatusOk.value = true;
    cloudStatus.value =
      `同步成功：${data.tokens} 个 Token、${data.schedules} 个定时任务已上传` +
      `，云端已注册 ${data.activeCrons} 个定时器`;
    if (data.failed?.length) {
      cloudStatus.value += `。注册失败：${data.failed
        .map((f) => `${f.name}（${f.reason}）`)
        .join("、")}`;
    }
    if (skippedTypes.size) {
      const labels = [...skippedTypes]
        .map((v) => availableTasks.find((t) => t.value === v)?.label || v)
        .join("、");
      cloudStatus.value += `。以下任务云端暂不支持已跳过：${labels}`;
    }
  } catch (err) {
    cloudStatusOk.value = false;
    cloudStatus.value = `同步失败: ${err.message}`;
  } finally {
    cloudSyncing.value = false;
  }
};

const cloudLoadLogs = async () => {
  cloudLogLoading.value = true;
  try {
    const resp = await fetch(
      `${cloudBackendUrl.value.replace(/\/$/, "")}/api/logs/db?limit=80`,
      { headers: cloudHeaders() },
    );
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || `HTTP ${resp.status}`);
    cloudLogs.value = Array.isArray(data) ? data : [];
    if (cloudLogs.value.length === 0) {
      cloudStatusOk.value = true;
      cloudStatus.value = "云端暂无执行日志（可能尚未到执行时间）";
    }
  } catch (err) {
    cloudStatusOk.value = false;
    cloudStatus.value = `日志获取失败: ${err.message}`;
  } finally {
    cloudLogLoading.value = false;
  }
};

// 批量测试云端所有 Token 的有效性
const cloudTestAllTokens = async () => {
  cloudTestResultsLoading.value = true;
  cloudTestResults.value = [];
  try {
    for (const t of tokens.value) {
      try {
        const resp = await fetch(
          `${cloudBackendUrl.value.replace(/\/$/, "")}/api/tokens/${t.id}/test`,
          { method: "POST", headers: cloudHeaders() },
        );
        const data = await resp.json();
        cloudTestResults.value.push({
          id: t.id,
          name: t.name,
          ok: data.ok,
          error: data.error,
          detail: data.ok ? `${data.name || "?"} Lv.${data.level ?? "?"}` : "",
        });
      } catch (err) {
        cloudTestResults.value.push({
          id: t.id,
          name: t.name,
          ok: false,
          error: err.message,
        });
      }
    }
  } finally {
    cloudTestResultsLoading.value = false;
  }
};

// ======================
// Import/Export Config

// ======================
// Scheduled Tasks Countdown
// ======================

// 注: 倒计时展示已隔离到 Daily/TaskCountdown.vue 与 Daily/NextTaskBanner.vue，
// 每秒刷新只在叶子组件内发生，避免本组件（约 7000 行）整体重渲染

// ======================
// Scheduled Tasks Scheduler
// ======================

// Initialize scheduled tasks from localStorage
loadScheduledTasks();

// 修复TimePicker的"Invalid time value"错误：确保runTime的初始值不是null
watch(
  () => showTaskModal.value,
  (isVisible) => {
    if (isVisible && !taskForm.runTime) {
      // 当模态框显示且runTime为null时，将其设置为undefined
      taskForm.runTime = undefined;
    }
  },
);

// Task scheduler variables - moved to component level scope
const intervalId = ref(null);
let lastTaskExecution = null;
let healthCheckInterval = null;
const pageLoadTime = Date.now();

// Health check for the scheduler
const healthCheck = () => {
  // If interval is not running, restart it
  if (!intervalId.value) {
    console.error(
      `[${new Date().toISOString()}] Task scheduler interval is not running, restarting...`,
    );
    startScheduler();
  }

  // Add a safety mechanism to prevent isRunning from being stuck
  if (isRunning.value) {
    const now = Date.now();
    const tenMinutesAgo = now - 10 * 60 * 1000; // 10 minutes ago
    if (lastTaskExecution && lastTaskExecution < tenMinutesAgo) {
      console.error(
        `[${new Date().toISOString()}] isRunning has been true for more than 10 minutes, resetting to false`,
      );
      isRunning.value = false;
      addLog({
        time: new Date().toLocaleTimeString(),
        message: "=== 检测到任务执行超时，已重置isRunning状态 ===",
        type: "warning",
      });
    }
  }

  // Check for page refresh
  if (batchSettings.enableRefresh && batchSettings.refreshInterval > 0) {
    const elapsedMinutes = (Date.now() - pageLoadTime) / 1000 / 60;
    if (elapsedMinutes >= batchSettings.refreshInterval) {
      if (!isRunning.value) {
        console.log(
          `[${new Date().toISOString()}] Refreshing page as scheduled (Interval: ${batchSettings.refreshInterval}m, Elapsed: ${elapsedMinutes.toFixed(1)}m)`,
        );
        window.location.reload();
      } else {
        console.log(
          `[${new Date().toISOString()}] Scheduled refresh postponed due to running task`,
        );
      }
    }
  }
};

// Start the scheduler
const startScheduler = () => {
  // Clear any existing interval first
  if (intervalId.value) {
    clearInterval(intervalId.value);
  }

  // Check every 10 seconds instead of 60 seconds for more timely task execution
  intervalId.value = setInterval(() => {
    try {
      const now = new Date();
      const currentTime = now.toLocaleTimeString("zh-CN", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });

      // Don't skip all tasks if isRunning is true, just skip individual task execution if already running
      const tasksToRun = scheduledTasks.value.filter((task) => task.enabled);

      if (tasksToRun.length === 0) {
        return;
      }

      tasksToRun.forEach((task) => {
        let shouldRun = false;

        if (task.runType === "daily") {
          // Check if current time matches the scheduled time
          const taskTime = task.runTime;
          const nowTime = now.toLocaleTimeString("zh-CN", {
            hour12: false,
            hour: "2-digit",
            minute: "2-digit",
          });
          shouldRun = nowTime === taskTime;
        } else if (task.runType === "cron") {
          // Improved cron expression parsing using shared utility
          try {
            shouldRun = matchesCronExpression(task.cronExpression, now);
          } catch (error) {
            console.error(
              `[${new Date().toISOString()}] Error parsing cron expression ${task.cronExpression}:`,
              error,
            );
            addLog({
              time: currentTime,
              message: `=== 解析定时任务 ${task.name} 的Cron表达式失败: ${error.message} ===`,
              type: "error",
            });
            return;
          }
        }

        if (shouldRun) {
          // Check if the task was already executed in the last minute to avoid duplicate execution
          const taskExecutionKey = `${task.id}_${now.getDate()}_${now.getHours()}_${now.getMinutes()}`;
          const lastExecutionKey = localStorage.getItem(
            `lastTaskExecution_${task.id}`,
          );

          if (lastExecutionKey !== taskExecutionKey) {
            // Update last execution time
            localStorage.setItem(
              `lastTaskExecution_${task.id}`,
              taskExecutionKey,
            );

            // Execute the task
            lastTaskExecution = Date.now();
            executeScheduledTask(task);
          } else {
            // Only log once per minute to avoid spamming logs
            // But since we check every 10s, this might log multiple times if we don't track logged state
            // For now, we can skip logging "already executed" to keep logs clean
          }
        }
      });
    } catch (error) {
      console.error(
        `[${new Date().toISOString()}] Error in task scheduler:`,
        error,
      );
      addLog({
        time: new Date().toLocaleTimeString(),
        message: `=== 定时任务调度服务发生错误: ${error.message} ===`,
        type: "error",
      });
    }
  }, 10000); // Check every 10 seconds
};

// Token刷新等待处理函数
const handleTokenRefreshWaiting = (data) => {
  addLog({
    time: new Date().toLocaleTimeString(),
    message: `Token刷新限流等待中，预计等待 ${data.waitSeconds} 秒（队列: ${data.queueSize}）`,
    type: "warning",
  });
};

// Debug: Log initial state when component mounts
onMounted(() => {
  // Start the task scheduler after all functions are initialized
  scheduleTaskExecution();
  loadTaskTemplates();
  // 监听Token刷新等待事件
  $emit.on("token:refresh:waiting", handleTokenRefreshWaiting);
});

onBeforeUnmount(() => {
  // 移除Token刷新等待事件监听
  $emit.off("token:refresh:waiting", handleTokenRefreshWaiting);

  // Cleanup task scheduler intervals
  if (intervalId.value) {
    clearInterval(intervalId.value);
    intervalId.value = null;
    addLog({
      time: new Date().toLocaleTimeString(),
      message: "=== 定时任务调度服务已停止 ===",
      type: "info",
    });
  }

  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
    healthCheckInterval = null;
  }
});

// Task scheduler - ensure it runs properly
const scheduleTaskExecution = () => {
  // Log the start of the scheduler
  addLog({
    time: new Date().toLocaleTimeString(),
    message: "=== 定时任务调度服务已启动 ===",
    type: "info",
  });

  // Start the scheduler
  startScheduler();

  // Health check every 5 minutes instead of 1 hour for more frequent safety checks
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
  }
  healthCheckInterval = setInterval(healthCheck, 5 * 60 * 1000);

  // Initial health check
  healthCheck();
};

/** Resolve a configured task without evaluating user-controlled source code.
 * @param {string} taskName Stored task identifier.
 * @returns {Function|undefined} The registered task, or undefined for unknown names.
 */
function getScheduledTask(taskName) {
  const tasks = {
    startBatch,
    claimHangUpRewards,
    batchAddHangUpTime,
    resetBottles,
    batchlingguanzi,
    climbTower,
    climbWeirdTower,
    batchStudy,
    batchOpenBox,
    batchOpenBoxByPoints,
    batchClaimBoxPointReward,
    batchFish,
    batchRecruit,
    batchRedeemCodes,
    batchmengjing,
    batchclubsign,
    batchCampChallenge,
    batchCampClaimTasks,
    batchApplyLegion,
    batcharenafight,
    batchTopUpFish,
    batchTopUpArena,
    batchClaimFreeEnergy,
    skinChallenge,
    legion_storebuygoods,
    store_syncpurchaseconfig,
    store_purchase,
    collection_claimfreereward,
    batchLegacyClaim,
    batchLegacyGiftSendEnhanced,
    batchUseItems,
    batchMergeItems,
    batchClaimPeachTasks,
    batchGenieSweep,
    batchBuyDreamItems,
    batchXuanwuBlessing,
    batchBookPKMatch,
    batchClaimMail,
  };
  return Object.hasOwn(tasks, taskName) ? tasks[taskName] : undefined;
}

// Verify task dependencies - 只验证基础依赖，WebSocket连接由具体任务函数处理
const verifyTaskDependencies = async (task) => {
  addLog({
    time: new Date().toLocaleTimeString(),
    message: `=== 开始验证定时任务 ${task.name} 的依赖 ===`,
    type: "info",
  });

  // Verify localStorage is available
  try {
    localStorage.setItem("test", "test");
    localStorage.removeItem("test");
    addLog({
      time: new Date().toLocaleTimeString(),
      message: "✅ localStorage可用",
      type: "info",
    });
  } catch (error) {
    addLog({
      time: new Date().toLocaleTimeString(),
      message: `❌ localStorage不可用: ${error.message}`,
      type: "error",
    });
    return false;
  }

  // Verify token store is available
  if (!tokenStore || !tokenStore.gameTokens) {
    addLog({
      time: new Date().toLocaleTimeString(),
      message: "❌ Token存储不可用",
      type: "error",
    });
    return false;
  }

  // Verify task functions exist
  for (const taskName of task.selectedTasks) {
    const taskFunction = getScheduledTask(taskName);
    if (typeof taskFunction !== "function") {
      addLog({
        time: new Date().toLocaleTimeString(),
        message: `❌ 任务函数不存在: ${taskName}`,
        type: "error",
      });
      return false;
    }
  }

  if (
    task.selectedTasks.includes("batchApplyLegion") &&
    !Number(task.legionApplyTargetId)
  ) {
    addLog({
      time: new Date().toLocaleTimeString(),
      message: `=== 定时任务 ${task.name} 缺少目标俱乐部ID ===`,
      type: "error",
    });
    return false;
  }

  // 直接使用所有选中的token，WebSocket连接由具体任务函数内部管理
  // ensureConnection函数会自动处理并行连接和连接池管理
  const connectedTokens = task.selectedTokens.map((tokenId) => {
    const tokenName =
      tokenStore.gameTokens.find((t) => t.id === tokenId)?.name || tokenId;
    return { id: tokenId, name: tokenName };
  });

  // Log connection status
  addLog({
    time: new Date().toLocaleTimeString(),
    message: `✅ 将使用 ${connectedTokens.length} 个账号执行任务`,
    type: "info",
  });

  // Store connected tokens for execution
  task.connectedTokens = connectedTokens.map((t) => t.id);

  addLog({
    time: new Date().toLocaleTimeString(),
    message: `=== 定时任务 ${task.name} 的依赖验证通过，将执行 ${connectedTokens.length} 个账号 ===`,
    type: "success",
  });
  return true;
};

// Execute a scheduled task with dependency verification
const executeScheduledTask = async (task) => {
  addLog({
    time: new Date().toLocaleTimeString(),
    message: `=== 开始执行定时任务: ${task.name} ===`,
    type: "info",
  });

  try {
    // Verify dependencies before executing task
    const dependenciesValid = await verifyTaskDependencies(task);
    if (!dependenciesValid) {
      addLog({
        time: new Date().toLocaleTimeString(),
        message: `=== 定时任务 ${task.name} 依赖验证失败，取消执行 ===`,
        type: "error",
      });
      return;
    }

    // Filter out tokens that don't exist in current tokens.value
    const availableTokens = (
      task.connectedTokens || task.selectedTokens
    ).filter((tokenId) => {
      return tokens.value.some((t) => t.id === tokenId);
    });

    const missingTokens = (task.connectedTokens || task.selectedTokens).filter(
      (tokenId) => {
        return !tokens.value.some((t) => t.id === tokenId);
      },
    );

    if (missingTokens.length > 0) {
      addLog({
        time: new Date().toLocaleTimeString(),
        message: `⚠️  跳过不存在的Token: ${missingTokens.join(", ")}`,
        type: "warning",
      });
    }

    if (availableTokens.length === 0) {
      addLog({
        time: new Date().toLocaleTimeString(),
        message: `=== 定时任务 ${task.name} 没有可用的Token，取消执行 ===`,
        type: "error",
      });
      return;
    }

    // Always use the latest selectedTokens from the task that exist in current tokens.value
    selectedTokens.value = [...availableTokens];

    // Task types share account connections and run state; account-level concurrency stays inside each task.
    for (const taskName of task.selectedTasks) {
      if (shouldStop.value) break;

      if (
        ["batchmengjing", "batchBuyDreamItems"].includes(taskName) &&
        !ismengjingActivityOpen.value
      ) {
        addLog({
          time: new Date().toLocaleTimeString(),
          message: `跳过任务: ${availableTasks.find((t) => t.value === taskName)?.label || taskName} (不在梦境开放时间)`,
          type: "warning",
        });
        continue;
      }

      if (
        ["batchTopUpArena", "batcharenafight"].includes(taskName) &&
        !isarenaActivityOpen.value
      ) {
        addLog({
          time: new Date().toLocaleTimeString(),
          message: `跳过任务: ${availableTasks.find((t) => t.value === taskName)?.label || taskName} (不在竞技场开放时间)`,
          type: "warning",
        });
        continue;
      }

      if (
        [
          "climbWeirdTower",
          "batchUseItems",
          "batchMergeItems",
          "batchClaimFreeEnergy",
        ].includes(taskName) &&
        !isWeirdTowerActivityOpen.value
      ) {
        addLog({
          time: new Date().toLocaleTimeString(),
          message: `跳过任务: ${availableTasks.find((t) => t.value === taskName)?.label || taskName} (不在怪异塔开放时间)`,
          type: "warning",
        });
        continue;
      }

      addLog({
        time: new Date().toLocaleTimeString(),
        message: `执行任务: ${availableTasks.find((t) => t.value === taskName)?.label || taskName}`,
        type: "info",
      });

      // Call the task function dynamically
      const taskFunction = getScheduledTask(taskName);
      if (typeof taskFunction === "function") {
        // For batch operations, pass isScheduledTask = true
        // 具体的batch任务函数内部会使用ensureConnection管理并行连接
        if (
          [
            "batchOpenBox",
            "batchOpenBoxByPoints",
            "batchFish",
            "batchRecruit",
            "batchLegacyGiftSendEnhanced",
          ].includes(taskName)
        ) {
          await taskFunction(true);
        } else if (taskName === "batchApplyLegion") {
          await taskFunction(task.legionApplyTargetId);
        } else {
          await taskFunction();
        }
      } else {
        addLog({
          time: new Date().toLocaleTimeString(),
          message: `任务函数不存在: ${taskName}`,
          type: "error",
        });
      }
    }

    addLog({
      time: new Date().toLocaleTimeString(),
      message: `=== 定时任务执行完成: ${task.name} ===`,
      type: "success",
    });
  } catch (error) {
    addLog({
      time: new Date().toLocaleTimeString(),
      message: `=== 定时任务执行失败: ${error.message} ===`,
      type: "error",
    });
    console.error(
      `[${new Date().toISOString()}] Error executing scheduled task ${task.name}:`,
      error,
    );
  }
};

// =====================
// 定时任务管理（composable）
// =====================
const {
  scheduledTasks,
  showTaskModal,
  showTasksModal,
  taskForm,
  editingTask,
  executingTaskIds,
  cronValidation,
  cronNextRuns,
  taskGroupDefinitions,
  groupedAvailableTasks,
  taskScheduleSelectedGroupIds,
  manualExecuteTask,
  loadScheduledTasks,
  saveScheduledTasks,
  openNewTaskModal,
  editTask,
  parseCronExpression,
  saveTask,
  deleteTask,
  toggleTaskEnabled,
  resetRunType,
  selectAllTokens,
  deselectAllTokens,
  selectAllTasks,
  deselectAllTasks,
} = useScheduledTasks({
  executeScheduledTask,
  tokens,
  isRunning,
  shouldStop,
  addLog,
});

// =====================
// 配置导入/导出（composable）
// =====================
const {
  showExportTextModal,
  exportJsonText,
  exportRelayUrl,
  exportConfig,
  copyExportText,
  copyExportLink,
  openExportLink,
  importConfig,
} = useConfigImportExport({
  batchSettings,
  scheduledTasks,
  saveScheduledTasks,
  tokens,
});

// 注: boxTypeOptions, fishTypeOptions 已从 @/utils/batch 导入

const openHelperModal = (type) => {
  helperType.value = type;
  showHelperModal.value = true;
};

// 批量功法残卷赠送相关方法
const clearRecipientError = () => {
  recipientIdError.value = "";
};

// 头像处理方法
const handleAvatarLoad = () => {
  isAvatarLoading.value = false;
  avatarLoadError.value = false;
};

const handleAvatarError = () => {
  isAvatarLoading.value = false;
  avatarLoadError.value = true;
};

const resetAvatarState = () => {
  isAvatarLoading.value = true;
  avatarLoadError.value = false;
};

const queryRecipientInfo = async () => {
  // 1. 输入验证
  if (!recipientIdInput.value || recipientIdInput.value === "") {
    recipientIdError.value = "请输入接收者ID";
    return;
  }

  const recipientId = Number(recipientIdInput.value);
  if (!Number.isInteger(recipientId) || recipientId <= 0) {
    recipientIdError.value = "请输入有效的数字ID";
    return;
  }

  // 2. 检查选中账号
  if (selectedTokens.value.length === 0) {
    recipientIdError.value = "请先选择要操作的角色";
    return;
  }

  // 3. 初始化状态
  isQueryingRecipient.value = true;
  recipientIdError.value = "";
  recipientInfo.value = null;
  // 重置头像状态
  resetAvatarState();

  const firstTokenId = selectedTokens.value[0];
  const token = tokens.value.find((t) => t.id === firstTokenId);

  // 记录开始查询
  addLog({
    time: new Date().toLocaleTimeString(),
    message: `=== 开始查询接收者信息: 使用账号 ${token.name} (ID: ${firstTokenId}) ===`,
    type: "info",
  });

  try {
    // 确保WebSocket连接
    addLog({
      time: new Date().toLocaleTimeString(),
      message: `正在建立WebSocket连接...`,
      type: "info",
    });

    // 使用现有的ensureConnection函数，它已经包含了重连机制
    await ensureConnection(firstTokenId);

    addLog({
      time: new Date().toLocaleTimeString(),
      message: `WebSocket连接成功`,
      type: "success",
    });

    // 发送查询命令
    addLog({
      time: new Date().toLocaleTimeString(),
      message: `正在发送查询命令，接收者ID: ${recipientId}`,
      type: "info",
    });

    // 延长超时时间到10秒，确保有足够时间处理
    const resp = await tokenStore.sendMessageWithPromise(
      firstTokenId,
      "rank_getroleinfo",
      {
        bottleType: 0,
        includeBottleTeam: false,
        isSearch: false,
        roleId: recipientId,
      },
      10000,
    );

    addLog({
      time: new Date().toLocaleTimeString(),
      message: `查询命令发送成功，正在处理响应...`,
      type: "info",
    });

    // 处理查询结果

    // 兼容不同的响应结构
    const roleData = resp?.role || resp?.roleInfo;

    if (roleData) {
      // 构建完整的角色信息，移除等级和VIP字段
      recipientInfo.value = {
        roleId: roleData.roleId || roleData.role?.roleId,
        name: roleData.name || roleData.role?.name,
        // 添加头像URL
        avatarUrl:
          resp?.roleInfo?.headImg ||
          roleData?.headImg ||
          roleData?.role?.headImg ||
          "",
        // 战力转换为亿为单位
        power: (function (p) {
          const billion = 100000000;
          return (p / billion).toFixed(2);
        })(roleData.power || roleData.role?.power || 0),
        powerUnit: "亿",
        // 扩展更多角色信息
        serverName: roleData.serverName || roleData.role?.serverName || "",
        legionName: resp?.legionInfo?.name || "",
        legionId: resp?.legionInfo?.id || 0,
      };

      // 格式化角色名，处理特殊字符
      const displayName = recipientInfo.value.name || "未知角色";

      addLog({
        time: new Date().toLocaleTimeString(),
        message: `=== 查询成功: 找到角色 ${displayName} (ID: ${recipientInfo.value.roleId})，战力: ${recipientInfo.value.power}${recipientInfo.value.powerUnit} ===`,
        type: "success",
      });

      message.success("查询成功");
    } else {
      const errorMsg = "未找到该角色信息";
      recipientIdError.value = errorMsg;

      addLog({
        time: new Date().toLocaleTimeString(),
        message: `=== 查询失败: ${errorMsg} ===`,
        type: "error",
      });

      message.error(errorMsg);
    }
  } catch (error) {
    // 详细的错误处理
    console.error("查询接收者信息失败:", error);

    let errorMsg = "查询失败";
    let logType = "error";

    // 根据错误类型提供更友好的错误信息
    if (error.message.includes("连接失败")) {
      errorMsg = "WebSocket连接失败，请检查网络或账号状态";
    } else if (
      error.message.includes("timeout") ||
      error.message.includes("超时")
    ) {
      errorMsg = "查询超时，请稍后重试";
      logType = "warning";
    } else if (error.message.includes("200160")) {
      errorMsg = "功法系统未开启";
    } else {
      errorMsg = `查询失败: ${error.message}`;
    }

    recipientIdError.value = errorMsg;

    // 记录错误日志
    addLog({
      time: new Date().toLocaleTimeString(),
      message: `=== ${errorMsg} ===`,
      type: logType,
    });

    // 显示用户友好的错误提示
    message.error(errorMsg);
  } finally {
    isQueryingRecipient.value = false;

    // 记录查询完成
    addLog({
      time: new Date().toLocaleTimeString(),
      message: `=== 查询操作完成 ===`,
      type: "info",
    });
  }
};

const confirmLegacyGift = async () => {
  if (!recipientIdInput.value || !recipientInfo.value) {
    message.error("请先查询并确认接收者信息");
    return;
  }

  if (!securityPassword.value) {
    message.error("请输入安全密码");
    return;
  }

  // 调用增强版批量赠送功能
  await batchLegacyGiftSendEnhanced();

  // 关闭模态框
  showLegacyGiftModal.value = false;
  // 清空安全密码
  securityPassword.value = "";
};

const executeHelper = () => {
  if (helperType.value !== "pointsBox") {
    if (helperSettings.count % 10 !== 0 || helperSettings.count < 10) {
      message.warning("消耗数量必须是10的整数倍，最小为10");
      return;
    }
  }
  showHelperModal.value = false;
  if (helperType.value === "box") {
    batchOpenBox();
  } else if (helperType.value === "fish") {
    batchFish();
  } else if (helperType.value === "recruit") {
    batchRecruit();
  } else if (helperType.value === "pointsBox") {
    batchOpenBoxByPoints();
  }
};

const openRedeemCodeModal = () => {
  loadBatchSettings();
  batchSettings.cdkCodes = batchSettings.cdkCodes || "";
  batchSettings.cdkPlatformType = batchSettings.cdkPlatformType || "h5";
  showRedeemCodeModal.value = true;
};

const saveRedeemCodeConfig = () => {
  batchSettings.cdkCodes = batchSettings.cdkCodes || "";
  batchSettings.cdkPlatformType = batchSettings.cdkPlatformType || "h5";
  localStorage.setItem("batchSettings", JSON.stringify(batchSettings));
  message.success("兑换码配置已保存");
};

const executeRedeemCodes = async () => {
  if (!batchSettings.cdkCodes?.trim()) {
    message.error("请先填写兑换码");
    return;
  }

  saveRedeemCodeConfig();
  showRedeemCodeModal.value = false;
  await batchRedeemCodes();
};

// Dream Buy Modal Logic
const showDreamBuyModal = ref(false);
const dreamBuyList = ref([]);

// Black Market Purchase Modal Logic
const showBlackMarketPurchaseModal = ref(false);
const blackMarketPurchaseList = ref(createDefaultBlackMarketPurchaseList());

const openBlackMarketPurchaseModal = () => {
  blackMarketPurchaseList.value = normalizeBlackMarketPurchaseList(
    batchSettings.blackMarketPurchaseList?.length
      ? batchSettings.blackMarketPurchaseList
      : createDefaultBlackMarketPurchaseList(),
  ).map((item) => ({ ...item }));

  showBlackMarketPurchaseModal.value = true;
};

const addBlackMarketPurchaseItem = () => {
  blackMarketPurchaseList.value.push(createBlackMarketPurchaseEntry());
};

const applyBlackMarketCatalogItem = (index, itemId) => {
  blackMarketPurchaseList.value[index] = {
    ...blackMarketPurchaseList.value[index],
    ...createBlackMarketPurchaseEntry(itemId),
  };
};

const removeBlackMarketPurchaseItem = (index) => {
  blackMarketPurchaseList.value.splice(index, 1);
};

const resetBlackMarketPurchaseList = () => {
  blackMarketPurchaseList.value = createDefaultBlackMarketPurchaseList();
};

const saveBlackMarketPurchaseConfig = () => {
  const normalized = normalizeBlackMarketPurchaseList(
    blackMarketPurchaseList.value,
  );

  if (normalized.length === 0) {
    message.error("请至少配置一项黑市采购条目");
    return;
  }

  batchSettings.blackMarketPurchaseList = normalized;
  saveBatchSettings();

  showBlackMarketPurchaseModal.value = false;
  message.success("黑市采购清单已保存");
};

const openDreamBuyModal = () => {
  // Load saved settings
  dreamBuyList.value = batchSettings.dreamPurchaseList || [];
  showDreamBuyModal.value = true;
};

const toggleDreamItem = (itemKey, checked) => {
  if (checked) {
    if (!dreamBuyList.value.includes(itemKey)) {
      dreamBuyList.value.push(itemKey);
    }
  } else {
    dreamBuyList.value = dreamBuyList.value.filter((k) => k !== itemKey);
  }
};

const saveDreamBuyConfig = () => {
  // Save settings
  batchSettings.dreamPurchaseList = [...dreamBuyList.value];
  saveBatchSettings();

  showDreamBuyModal.value = false;
  message.success("梦境购买配置已保存");
};

const selectGoldItems = () => {
  const newSelection = new Set(dreamBuyList.value);

  for (const merchantId in goldItemsConfig) {
    const items = goldItemsConfig[merchantId];
    items.forEach((index) => {
      newSelection.add(`${merchantId}-${index}`);
    });
  }

  dreamBuyList.value = Array.from(newSelection);
};

const selectAllItems = () => {
  const newSelection = new Set(dreamBuyList.value);

  for (const merchantId in merchantConfig) {
    const items = merchantConfig[merchantId].items;
    items.forEach((_, index) => {
      newSelection.add(`${merchantId}-${index}`);
    });
  }

  dreamBuyList.value = Array.from(newSelection);
};

const clearAllItems = () => {
  dreamBuyList.value = [];
};

// 注: formationOptions, bossTimesOptions 已从 @/utils/batch 导入

const loadSettings = (tokenId) => {
  try {
    const raw = localStorage.getItem(`daily-settings:${tokenId}`);
    // 一次性迁移：旧设置的爬塔阵容统一改为"当前阵容"(0)，迁移后手动选择的值不再覆盖
    if (!raw) return { ...dailySettingsDefaults };
    const saved = JSON.parse(raw);
    if (!saved.formationMigrated) {
      saved.towerFormation = 0;
      saved.formationMigrated = true;
      try {
        localStorage.setItem(
          `daily-settings:${tokenId}`,
          JSON.stringify(saved),
        );
      } catch (e) {
        // 存储失败不影响本次使用
      }
    }
    return { ...dailySettingsDefaults, ...saved };
  } catch (error) {
    console.error("Failed to load settings:", error);
    return null;
  }
};

const openSettings = (token) => {
  currentSettingsTokenId.value = token.id;
  currentSettingsTokenName.value = token.name;
  const saved = loadSettings(token.id);
  Object.assign(currentSettings, saved);
  showSettingsModal.value = true;
};

const saveSettings = () => {
  if (currentSettingsTokenId.value) {
    localStorage.setItem(
      `daily-settings:${currentSettingsTokenId.value}`,
      JSON.stringify(currentSettings),
    );
    message.success(`已保存 ${currentSettingsTokenName.value} 的设置`);
    showSettingsModal.value = false;
  }
};

// Task Template Functions

const currentRunningTokenId = ref(null);
const currentProgress = ref(0);
const logs = ref([]);
const logContainer = ref(null);
const autoScrollLog = ref(true);
const filterErrorsOnly = ref(false);
const errorCount = computed(() => {
  return logs.value.filter((log) => log.type === "error").length;
});

const filteredLogs = computed(() => {
  if (filterErrorsOnly.value) {
    return logs.value.filter((log) => log.type === "error");
  }
  return logs.value;
});

const currentRunningTokenName = computed(() => {
  const t = tokens.value.find((x) => x.id === currentRunningTokenId.value);
  return t ? t.name : "";
});

// Selection logic
const isAllSelected = computed(
  () =>
    selectedTokens.value.length === tokens.value.length &&
    tokens.value.length > 0,
);
const isIndeterminate = computed(
  () =>
    selectedTokens.value.length > 0 &&
    selectedTokens.value.length < tokens.value.length,
);

const handleSelectAll = (checked) => {
  if (checked) {
    selectedTokens.value = tokens.value.map((t) => t.id);
  } else {
    selectedTokens.value = [];
  }
};

const getStatusType = (tokenId) => {
  const status = tokenStatus.value[tokenId];
  if (status === "completed") return "success";
  if (status === "failed") return "error";
  if (status === "running") return "info";
  if (status === "skipped") return "warning";
  return "default";
};

const getStatusText = (tokenId) => {
  const status = tokenStatus.value[tokenId];
  if (status === "completed") return "已完成";
  if (status === "failed") return "失败";
  if (status === "stopped") return "已停止";
  if (status === "pending") return "待继续";
  if (status === "running") return "执行中";
  if (status === "skipped") return "已跳过";
  return "等待中";
};

// =====================
// Token分组选择相关方法（分组增删改 UI 在 GroupManageModal.vue）
// =====================

/**
 * 切换分组选择状态
 */
const toggleGroupSelection = (groupId) => {
  const index = selectedGroups.value.indexOf(groupId);
  if (index > -1) {
    selectedGroups.value.splice(index, 1);
  } else {
    selectedGroups.value.push(groupId);
  }

  // 更新selectedTokens
  updateSelectedTokensFromGroups();
};

/**
 * 判断分组是否被选中
 */
const isGroupSelected = (groupId) => {
  return selectedGroups.value.includes(groupId);
};

/**
 * 根据选中的分组更新selectedTokens
 */
const updateSelectedTokensFromGroups = () => {
  const tokenIds = new Set();

  selectedGroups.value.forEach((groupId) => {
    const validTokenIds = tokenStore.getValidGroupTokenIds(groupId);
    validTokenIds.forEach((id) => tokenIds.add(id));
  });

  selectedTokens.value = Array.from(tokenIds);
};

/**
 * 一键清除所有分组选择
 */
const clearAllGroupSelection = () => {
  selectedGroups.value = [];
  selectedTokens.value = [];
};

/**
 * 获取分组中有效的token ID列表（用于模板中展示）
 */
const getValidGroupTokenIds = (groupId) => {
  return tokenStore.getValidGroupTokenIds(groupId);
};

/**
 * 获取分组中的token列表
 */

// 注: pickArenaTargetId, FISH_TARGET, ARENA_TARGET, getTodayStartSec, isTodayAvailable, calculateMonthProgress 已从 @/utils/batch 导入

const addLog = (log) => {
  // 添加日志数据到数组
  logs.value.push(log);

  // 限制logs数组大小，防止内存占用过大
  const maxLogEntries = batchSettings.maxLogEntries || 1000;
  if (logs.value.length > maxLogEntries) {
    logs.value = logs.value.slice(-maxLogEntries);
  }

  // 尝试DOM操作，但不依赖nextTick确保日志显示
  // 在后台运行时，浏览器可能会限制DOM操作
  try {
    if (logContainer.value && autoScrollLog.value) {
      // 直接尝试滚动，不使用nextTick
      logContainer.value.scrollTop = logContainer.value.scrollHeight;
    }
  } catch (error) {
    // 忽略DOM操作错误，确保日志数据仍然被记录
    console.warn("Failed to scroll log container:", error);
  }

  // 同时使用nextTick作为后备，确保在页面回到前台时能正确滚动
  nextTick(() => {
    try {
      if (logContainer.value && autoScrollLog.value) {
        logContainer.value.scrollTop = logContainer.value.scrollHeight;
      }
    } catch (error) {
      // 忽略错误
    }
  });
};

watch(autoScrollLog, (newValue) => {
  if (newValue && logContainer.value) {
    nextTick(() => {
      try {
        logContainer.value.scrollTop = logContainer.value.scrollHeight;
      } catch (error) {
        // 忽略DOM操作错误
        console.warn("Failed to scroll log container:", error);
      }
    });
  }
});

const copyLogs = async () => {
  if (logs.value.length === 0) {
    message.warning("没有可复制的日志");
    return;
  }
  const logText = logs.value
    .map((log) => `${log.time} ${log.message}`)
    .join("\n");
  const ok = await copyTextWithFeedback(logText);
  if (ok) {
    message.success("日志已复制到剪贴板");
  } else {
    message.error("复制日志失败");
  }
};

const clearLogs = () => {
  logs.value = [];
  message.success("日志已清空");
};

const waitForConnection = async (
  tokenId,
  timeout = batchSettings.connectionTimeout,
) => {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const status = tokenStore.getWebSocketStatus(tokenId);
    if (status === "connected") return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
};

// 全局连接队列控制 - 限制并发连接数
const connectionQueue = { active: 0 };

const waitForConnectionSlot = async () => {
  while (connectionQueue.active >= batchSettings.maxActive) {
    if (shouldStop.value) break;
    await new Promise((r) => setTimeout(r, 1000));
  }
  if (shouldStop.value) {
    const error = new Error("批量任务已停止，取消等待连接槽位");
    error.interrupted = true;
    throw error;
  }
  connectionQueue.active++;
};

const releaseConnectionSlot = () => {
  if (connectionQueue.active > 0) {
    connectionQueue.active--;
  }
};

/**
 * Establish a connection and report whether this caller owns a queue slot.
 * @param {string} tokenId Account identity.
 * @param {number} maxRetries Whether connection retry is allowed.
 * @param {Function|null} onSlotChange Optional ownership notification.
 * @returns {Promise<boolean>} True after connection initialization.
 */
const ensureConnection = async (
  tokenId,
  maxRetries = 2,
  onSlotChange = null,
) => {
  const latestToken = tokens.value.find((t) => t.id === tokenId);
  if (!latestToken) {
    throw new Error(`Token not found: ${tokenId}`);
  }

  const status = tokenStore.getWebSocketStatus(tokenId);
  let connected = status === "connected";

  if (!connected) {
    // 等待连接槽位，限制并发连接数
    await waitForConnectionSlot();
    onSlotChange?.(true);

    addLog({
      time: new Date().toLocaleTimeString(),
      message: `正在连接... (队列: ${connectionQueue.active}/${batchSettings.maxActive})`,
      type: "info",
    });

    const connectClient = await tokenStore.createWebSocketConnection(
      tokenId,
      latestToken.token,
      latestToken.wsUrl,
    );
    connected = connectClient ? await waitForConnection(tokenId) : false;

    if (!connected && maxRetries > 0) {
      addLog({
        time: new Date().toLocaleTimeString(),
        message: connectClient
          ? `连接超时，尝试重连...`
          : `连接创建失败(${tokenStore.getConnectionFailureReason(tokenId) || "未知原因"})，尝试重连...`,
        type: "warning",
      });

      // 等待旧连接真正关完再重连：关闭过程会补发断开回调，
      // 释放被半途关闭的连接占用的连接锁，避免重连继续撞锁
      await tokenStore.closeWebSocketConnectionAsync(tokenId);
      await new Promise((r) => setTimeout(r, batchSettings.reconnectDelay));

      addLog({
        time: new Date().toLocaleTimeString(),
        message: `正在重连...`,
        type: "info",
      });

      const refreshedToken = tokens.value.find((t) => t.id === tokenId);
      const retryClient = await tokenStore.createWebSocketConnection(
        tokenId,
        refreshedToken.token,
        refreshedToken.wsUrl,
      );
      connected = retryClient ? await waitForConnection(tokenId) : false;
    }

    if (!connected) {
      // 连接失败，释放槽位
      try {
        await tokenStore.closeWebSocketConnectionAsync(tokenId);
      } finally {
        releaseConnectionSlot();
        onSlotChange?.(false);
      }
      const failureReason = tokenStore.getConnectionFailureReason(tokenId);
      throw new Error(
        failureReason
          ? `连接失败 (重试后仍超时): ${failureReason}`
          : "连接失败 (重试后仍超时)",
      );
    }
  }

  // 连接成功，槽位保持占用，直到任务完成后手动释放

  // Initialize Game Data (Critical for Battle Version and Session)
  try {
    // Fetch Role Info first (Standard flow)
    await tokenStore.sendMessageWithPromise(
      tokenId,
      "role_getroleinfo",
      {},
      5000,
    );

    // Fetch Battle Version
    const res = await tokenStore.sendMessageWithPromise(
      tokenId,
      "fight_startlevel",
      {},
      5000,
    );
    if (res?.battleData?.version) {
      tokenStore.setBattleVersion(res.battleData.version);
    }
  } catch (e) {
    addLog({
      time: new Date().toLocaleTimeString(),
      message: `初始化数据失败: ${e.message}`,
      type: "warning",
    });
  }

  return true;
};

const createTaskDeps = () => ({
  selectedTokens,
  tokens,
  tokenStatus,
  isRunning,
  shouldStop,
  ensureConnection,
  releaseConnectionSlot,
  connectionQueue,
  batchSettings,
  tokenStore,
  addLog,
  message,
  currentRunningTokenId,
  // 延迟配置
  delayConfig: {
    command: batchSettings.commandDelay,
    task: batchSettings.taskDelay,
    action: batchSettings.actionDelay,
    battle: batchSettings.battleDelay,
    refresh: batchSettings.refreshDelay,
    long: batchSettings.longDelay,
  },
  // 其他特定依赖
  logs,
  logContainer,
  autoScrollLog,
  nextTick,
  // 设置相关
  currentSettings,
  helperSettings,
  weirdTowerMaxClimb,
  // 功法赠送相关
  recipientIdInput,
  recipientInfo,
  securityPassword,
  giftQuantity,
  // 竞技场相关辅助函数
  pickArenaTargetId,
  getTodayStartSec,
  isTodayAvailable,
  calculateMonthProgress,
  // 配置加载函数
  loadSettings,
});

// 初始化任务模块
const tasksHangUp = createTasksHangUp(createTaskDeps());
const {
  claimHangUpRewards,
  batchAddHangUpTime,
  batchStudy,
  batchclubsign,
  batchApplyLegion,
  batchWarGuessCheer,
  queryLegionById,
} = tasksHangUp;

const tasksBottle = createTasksBottle(createTaskDeps());
const { resetBottles, batchlingguanzi } = tasksBottle;

const tasksTower = createTasksTower(createTaskDeps());
const {
  climbTower,
  climbWeirdTower,
  batchClaimFreeEnergy,
  skinChallenge,
  batchUseItems,
  batchMergeItems,
} = tasksTower;

const tasksItem = createTasksItem(createTaskDeps());
const {
  batchOpenBox,
  batchOpenBoxByPoints,
  batchClaimBoxPointReward,
  batchFish,
  batchRecruit,
  batchRedeemCodes,
  batchHeroUpgrade,
  batchBookUpgrade,
  batchClaimStarRewards,
  batchClaimPeachTasks,
  batchGenieSweep,
} = tasksItem;

const tasksDungeon = createTasksDungeon(createTaskDeps());
const { batchmengjing, batchBuyDreamItems } = tasksDungeon;

const tasksArena = createTasksArena(createTaskDeps());
const { batcharenafight, batchTopUpFish, batchTopUpArena } = tasksArena;

const tasksStore = createTasksStore(createTaskDeps());
const {
  legion_storebuygoods,
  legionStoreBuySkinCoins,
  store_syncpurchaseconfig,
  store_purchase,
  collection_claimfreereward,
  batchClaimActivity,
  batchClaimMail,
} = tasksStore;

const tasksLegacy = createTasksLegacy(createTaskDeps());
const {
  batchLegacyClaim,
  batchLegacyStartExplore,
  batchLegacyGiftSendEnhanced,
} = tasksLegacy;

const tasksFootball = createTasksFootball(createTaskDeps());
const { batchFootballBet } = tasksFootball;

const tasksApex = createTasksApex(createTaskDeps());
const {
  batchApexGuess,
  batchApexVote,
  batchApexClaimTask,
  batchApexClaimGuess,
} = tasksApex;

const tasksCampChallenge = createTasksCampChallenge(createTaskDeps());
const { batchCampChallenge, batchCampClaimTasks } = tasksCampChallenge;

const tasksXuanwuBlessing = createTasksXuanwuBlessing(createTaskDeps());
const { batchXuanwuBlessing } = tasksXuanwuBlessing;

const tasksPKRoom = createTasksPKRoom(createTaskDeps());
const { batchBookPKMatch } = tasksPKRoom;

// 营地挑战模式选择
const campChallengeMode = ref("random");
const campChallengeModeOptions = [
  { label: "随机挑战人员", value: "random" },
  { label: "领取任务奖励", value: "claim" },
];
const campChallengeModeLabel = computed(() => {
  return (
    campChallengeModeOptions.find((o) => o.value === campChallengeMode.value)
      ?.label || ""
  );
});
const onCampChallengeModeChange = async (val) => {
  campChallengeMode.value = val;
  if (val === "claim") {
    await batchCampClaimTasks();
  } else {
    await batchCampChallenge();
  }
};

// 盐杯竞猜 pick 选择
const footballPick = ref(3);
const footballPickOptions = [
  { label: "主胜", value: 1 },
  { label: "平局", value: 2 },
  { label: "客胜", value: 3 },
];
const footballPickLabel = computed(() => {
  return (
    footballPickOptions.find((o) => o.value === footballPick.value)?.label || ""
  );
});
const onFootballPickChange = async (val) => {
  footballPick.value = val;
  await batchFootballBet(val);
};

const startBatch = async () => {
  if (isRunning.value || selectedTokens.value.length === 0) return;

  isRunning.value = true;
  shouldStop.value = false;

  // Reset status
  selectedTokens.value.forEach((id) => {
    tokenStatus.value[id] = "waiting";
  });

  // 并行执行任务，但通过connectionQueue限制并发连接数
  const taskPromises = selectedTokens.value.map(async (tokenId) => {
    if (shouldStop.value) return;

    tokenStatus.value[tokenId] = "running";

    const token = tokens.value.find((t) => t.id === tokenId);
    if (!token) {
      tokenStatus.value[tokenId] = "failed";
      addLog({
        time: new Date().toLocaleTimeString(),
        message: "账号已移除，跳过执行",
        type: "error",
      });
      return;
    }
    let ownsSlot = false;
    try {
      addLog({
        time: new Date().toLocaleTimeString(),
        message: `=== 开始执行: ${token.name} ===`,
        type: "info",
      });
      await ensureConnection(tokenId, 2, (owned) => {
        ownsSlot = owned;
      });
      const runner = new DailyTaskRunner(tokenStore, {
        commandDelay: batchSettings.commandDelay,
        taskDelay: batchSettings.taskDelay,
      });
      const result = await runner.run(tokenId, {
        shouldStop: () => shouldStop.value,
        onLog: (log) =>
          addLog({ ...log, message: `${token.name}: ${log.message}` }),
        onProgress: (progress) =>
          addLog({
            time: new Date().toLocaleTimeString(),
            message: `${token.name}: 服务器每日任务完成并领奖 ${progress}%`,
            type: "info",
          }),
      });
      tokenStatus.value[tokenId] = result.incomplete ? "pending" : "completed";
      addLog({
        time: new Date().toLocaleTimeString(),
        message: result.incomplete
          ? `=== ${token.name} 本轮结束，${result.incomplete} 个步骤待继续 ===`
          : `=== ${token.name} 执行完成 ===`,
        type: result.incomplete ? "warning" : "success",
      });
    } catch (error) {
      tokenStatus.value[tokenId] = error.interrupted ? "stopped" : "failed";
      addLog({
        time: new Date().toLocaleTimeString(),
        message: `${token.name}: ${error.message}`,
        type: error.interrupted ? "warning" : "error",
      });
    } finally {
      if (ownsSlot) {
        try {
          await tokenStore.closeWebSocketConnectionAsync(tokenId);
        } finally {
          releaseConnectionSlot();
        }
      }
      addLog({
        time: new Date().toLocaleTimeString(),
        message: `${token.name} 连接清理结束  (队列: ${connectionQueue.active}/${batchSettings.maxActive})`,
        type: "info",
      });
    }
  });

  try {
    await Promise.all(taskPromises);
  } finally {
    isRunning.value = false;
    currentRunningTokenId.value = null;
  }
  if (shouldStop.value)
    message.info("批量任务已停止，再次开始将按服务器任务列表补差");
  else if (
    selectedTokens.value.some((id) =>
      ["failed", "pending", "stopped"].includes(tokenStatus.value[id]),
    )
  )
    message.warning("本轮结束，仍有未完成任务，可再次开始继续");
  else message.success("批量任务执行结束");
};

const stopBatch = () => {
  shouldStop.value = true;
  addLog({
    time: new Date().toLocaleTimeString(),
    message: "正在停止...",
    type: "warning",
  });
};
</script>

<style scoped>
.batch-daily-tasks {
  padding: 20px;
  height: 100vh;
  box-sizing: border-box;
  overflow: hidden;
}

.main-layout {
  display: flex;
  gap: 20px;
  height: 100%;
  overflow: hidden;
}

.left-column {
  flex: 1;
  overflow-y: auto;
  min-width: 0;
  padding-right: 8px;
}

.right-column {
  width: 400px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  height: 700px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
  min-width: 0;
}

.header-left h2 {
  white-space: nowrap;
}

.header-info-box,
.header-action-box {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  background-color: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e9ecef;
}

.header-info-actions {
  display: flex;
  gap: 8px;
}

.token-item {
  display: flex;
  align-items: center;
}

.log-card {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.custom-card-header {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.card-title {
  font-size: 16px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.log-header-controls {
  display: flex;
  align-items: center;
  gap: 12px;
  justify-content: flex-end;
  flex-wrap: nowrap;
}

/* Cron Parser Styles */
.cron-parser {
  margin-top: 12px;
  padding: 12px;
  background-color: var(--bg-tertiary);
  border-radius: 8px;
}

.cron-validation {
  margin-bottom: 12px;
  padding: 8px;
  border-radius: 4px;
}

.cron-validation.success {
  background-color: rgba(24, 160, 88, 0.12);
}

.cron-validation.error {
  background-color: rgba(235, 87, 87, 0.12);
}

.cron-next-runs h4 {
  margin: 0 0 8px 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.cron-next-runs ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.cron-next-runs li {
  padding: 6px 0;
  font-size: 13px;
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border-color);
}

.cron-next-runs li:last-child {
  border-bottom: none;
}

.log-card :deep(.n-card__content) {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.log-header-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.log-container {
  flex: 1;
  overflow-y: auto;
  background: #f5f5f5;
  padding: 10px;
  border-radius: 4px;
  margin-top: 10px;
  font-family: monospace;
  min-height: 200px;
}

.log-item {
  margin-bottom: 4px;
  font-size: 12px;
}

.log-item.error {
  color: #d03050;
}

.log-item.success {
  color: #18a058;
}

.log-item.warning {
  color: #f0a020;
}

.log-item.info {
  color: #333;
}

.time {
  color: #999;
  margin-right: 8px;
}

.token-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-right: 8px;
}

/* Settings Modal Styles */
.settings-grid {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.setting-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.setting-label {
  font-size: 14px;
  color: #666;
}

.setting-switches {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.switch-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #eee;
}

.switch-row:last-child {
  border-bottom: none;
}

.switch-label {
  font-size: 14px;
  color: #666;
}

.weird-tower-count-input {
  width: 86px;
  flex-shrink: 0;
}

.weird-tower-count-unit {
  display: inline-flex;
  align-items: center;
  height: 28px;
  color: #666;
  font-size: 14px;
}

/* Responsive Design */
@media (max-width: 1200px) {
  .right-column {
    width: 380px;
  }
}

@media (max-width: 992px) {
  .batch-daily-tasks {
    height: auto;
    overflow: visible;
  }

  .main-layout {
    flex-direction: column;
    height: auto;
    overflow: visible;
  }

  .left-column {
    overflow-y: visible;
    padding-right: 0;
  }

  .right-column {
    width: 100%;
    height: auto;
    flex-shrink: 0;
  }

  .log-container {
    height: 300px;
    min-height: 300px;
  }
}

@media (max-width: 768px) {
  .batch-daily-tasks {
    padding: 12px;
    height: 100vh;
    overflow-y: auto;
    overflow-x: auto;
  }

  .main-layout {
    height: auto;
    overflow: visible;
    flex-direction: column;
  }

  .left-column {
    overflow: visible;
    padding-right: 0;
    flex: none;
    height: auto;
  }

  .right-column {
    height: auto;
    width: 100%;
    flex: none;
  }

  .page-header {
    flex-direction: column;
    gap: 12px;
    align-items: stretch;
  }

  /* 手机端:工具条允许换行,避免内容被裁剪无法横向滑动 */
  .header-left {
    flex-wrap: wrap;
    gap: 8px;
  }

  .header-info-box,
  .header-action-box {
    flex-wrap: wrap;
    width: 100%;
    gap: 8px;
  }

  .header-info-actions {
    flex-wrap: wrap;
  }

  /* 手机端:页签改为紧凑按钮,流式排布放不下自动换行(七个一行放得下) */
  .func-tabs-card :deep(.n-card__content) {
    padding: 12px;
  }

  .func-tabs-card :deep(.n-tabs .n-tabs-wrapper) {
    flex-wrap: wrap;
    justify-content: center;
    row-gap: 8px;
    /* 占满整行,否则容器按内容收缩靠左,justify-content: center 不生效 */
    width: 100%;
  }

  /* 收紧页签间距,隐藏原生指示条与导航底边线,避免与按钮重叠 */
  .func-tabs-card :deep(.n-tabs .n-tabs-tab-pad) {
    width: 4px;
  }

  .func-tabs-card :deep(.n-tabs .n-tabs-scroll-padding),
  .func-tabs-card :deep(.n-tabs .n-tabs-bar) {
    display: none;
  }

  /* 页签已一排放下,隐藏两端滚动渐变遮罩(旧版滑动后的残留状态) */
  .func-tabs-card :deep(.n-tabs .n-tabs-nav-scroll-wrapper::before),
  .func-tabs-card :deep(.n-tabs .n-tabs-nav-scroll-wrapper::after) {
    display: none;
  }

  /* naive-ui 样式为运行时注入、晚于本文件加载,需 !important 才能覆盖其底边线 */
  .func-tabs-card :deep(.n-tabs .n-tabs-nav-scroll-content) {
    border-bottom: none !important;
  }

  .func-tabs-card :deep(.n-tabs .n-tabs-tab) {
    padding: 6px 3px;
    font-size: 13px;
    border: 1px solid var(--border-color, #efeff5);
    border-radius: 8px;
    background-color: var(--bg-tertiary, #f7f7fa);
  }

  .func-tabs-card :deep(.n-tabs .n-tabs-tab--active) {
    border-color: var(--n-bar-color, #18a058);
    background-color: var(--primary-color-light, rgba(24, 160, 88, 0.12));
  }

  /* 手机端:任务设置弹窗单列布局,输入框加宽,弹窗体内部滚动 */
  .batch-settings-modal {
    max-height: 92vh;
  }

  .batch-settings-modal :deep(.n-card__content) {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 12px 16px;
  }

  .batch-settings-modal :deep(.n-input-number),
  .batch-settings-modal :deep(.n-select) {
    width: 130px !important;
    flex-shrink: 0;
  }

  .page-header .actions {
    display: flex;
    gap: 8px;
  }

  .log-card {
    height: auto !important;
  }

  .log-card :deep(.n-card__content) {
    flex: none !important;
    overflow: visible !important;
    display: block !important;
  }

  .log-container {
    height: 300px;
    min-height: 300px;
    flex: none !important;
  }

  .log-header-controls {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }

  /* 批量功法残卷赠送样式 */
  .recipient-info:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.12);
  }

  /* 头像悬停效果 */
  .avatar-container:hover {
    transform: scale(1.05);
    box-shadow: 0 6px 16px rgba(102, 126, 234, 0.3);
  }

  /* 加载动画 */
  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }

    100% {
      transform: rotate(360deg);
    }
  }

  /* Token分组管理样式 */
  .group-selection-section {
    padding: 12px;
    background-color: #f5f7fa;
    border-radius: 8px;
    border: 1px solid #e5e7eb;
  }

  .group-tag {
    padding: 8px 12px;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.3s ease;
    user-select: none;
    text-align: center;
    font-weight: 500;
  }

  .group-tag:hover {
    transform: translateY(-2px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .group-tag-selected {
    color: white;
    font-weight: 600;
  }

  /* 响应式设计 */
  @media (max-width: 600px) {
    .recipient-info {
      flex-direction: column;
      align-items: center;
      text-align: center;
    }

    .avatar-container {
      margin-bottom: 12px;
    }
  }
}
</style>
