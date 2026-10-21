import { computed, reactive, ref } from "vue";
import { useMessage } from "naive-ui";

/**
 * 定时任务管理 composable
 * 定时任务的表单/校验/存储/手动执行/批量选择，状态与逻辑自包含。
 * @param {object} deps
 * @param {import("vue").Ref<Array>} deps.tokens 账号列表
 * @param {import("vue").Ref<boolean>} deps.isRunning 批量执行状态
 * @param {import("vue").Ref<boolean>} deps.shouldStop 停止标志
 * @param {Function} deps.executeScheduledTask 执行单个定时任务（父级编排，依赖全部 runner）
 * @param {Function} deps.addLog 批量日志
 */
export function useScheduledTasks(deps) {
  const { executeScheduledTask, tokens, isRunning, shouldStop, addLog } = deps;
  const message = useMessage();

  // ======================
  // Scheduled Tasks Feature
  // ======================

  // Scheduled Tasks State Management
  const scheduledTasks = ref([]); // List of all scheduled tasks
  const showTaskModal = ref(false); // Control the visibility of the add/edit task modal
  const showTasksModal = ref(false); // Control the visibility of the tasks list modal
  const editingTask = ref(null); // Currently editing task
  const taskForm = reactive({
    name: "", // Task name
    runType: "daily", // 'daily' or 'cron'
    runTime: null, // Daily run time (HH:mm format)
    cronExpression: "", // Cron expression for complex scheduling
    selectedTokens: [], // Selected token IDs
    selectedTasks: [], // Selected task function names
    legionApplyTargetId: null, // Target legion for batchApplyLegion
    enabled: true, // Whether the task is enabled
  });

  // 任务分组定义
  const taskGroupDefinitions = [
    {
      name: "daily",
      label: "日常",
      tasks: [
        "startBatch",
        "claimHangUpRewards",
        "batchAddHangUpTime",
        "resetBottles",
        "batchlingguanzi",
        "batchclubsign",
        "batchApplyLegion",
        "batchStudy",
        "batcharenafight",
        "batchCampChallenge",
        "batchCampClaimTasks",
        "store_syncpurchaseconfig",
        "store_purchase",
        "batchBookPKMatch",
        "collection_claimfreereward",
        "batchClaimMail",
        "batchClaimActivity",
        "batchGenieSweep",
        "batchXuanwuBlessing",
      ],
    },
    {
      name: "dungeon",
      label: "副本",
      tasks: [
        "climbTower",
        "batchmengjing",
        "skinChallenge",
        "batchClaimPeachTasks",
        "batchBuyDreamItems",
      ],
    },
    {
      name: "apex",
      label: "逐鹿盐山",
      tasks: [
        "batchApexGuess",
        "batchApexVote",
        "batchApexClaimTask",
        "batchApexClaimGuess",
      ],
    },
    {
      name: "weirdTower",
      label: "怪异塔",
      tasks: [
        "climbWeirdTower",
        "batchUseItems",
        "batchMergeItems",
        "batchClaimFreeEnergy",
      ],
    },
    {
      name: "resource",
      label: "资源",
      tasks: [
        "batchOpenBox",
        "batchOpenBoxByPoints",
        "batchClaimBoxPointReward",
        "batchFish",
        "batchRecruit",
        "batchRedeemCodes",
        "legion_storebuygoods",
      ],
    },
    {
      name: "legacy",
      label: "功法",
      tasks: ["batchLegacyClaim", "batchLegacyGiftSendEnhanced"],
    },
    {
      name: "monthly",
      label: "月度",
      tasks: ["batchTopUpFish", "batchTopUpArena"],
    },
  ];

  // 计算属性，根据 taskGroupDefinitions 将 availableTasks 分组
  const groupedAvailableTasks = computed(() => {
    const groups = {};
    taskGroupDefinitions.forEach((group) => {
      groups[group.name] = availableTasks.filter((task) =>
        group.tasks.includes(task.value),
      );
    });

    // 处理未分组的任务
    const groupedTaskValues = taskGroupDefinitions.flatMap((g) => g.tasks);
    const otherTasks = availableTasks.filter(
      (task) => !groupedTaskValues.includes(task.value),
    );
    if (otherTasks.length > 0) {
      groups.other = otherTasks;
    }

    return groups;
  });

  // Cron表达式解析相关变量
  const cronValidation = ref({ valid: true, message: "" });
  const cronNextRuns = ref([]);

  // 注: availableTasks, taskColumns 已从 @/utils/batch 导入

  // ======================
  // Scheduled Tasks Storage
  // ======================

  // Track executing tasks for UI loading state
  const executingTaskIds = ref([]);

  // Manual execute task
  const manualExecuteTask = async (task) => {
    if (executingTaskIds.value.includes(task.id)) return;

    // Reset stop flag if not running, to allow manual execution
    if (!isRunning.value && shouldStop.value) {
      shouldStop.value = false;
    }

    executingTaskIds.value.push(task.id);
    try {
      message.info(`开始执行任务: ${task.name}`);
      await executeScheduledTask(task);
      message.success(`任务 ${task.name} 执行完成`);
    } catch (e) {
      console.error(`执行任务 ${task.name} 失败:`, e);
      message.error(`任务 ${task.name} 执行失败`);
    } finally {
      executingTaskIds.value = executingTaskIds.value.filter(
        (id) => id !== task.id,
      );
    }
  };

  // Load scheduled tasks from localStorage
  const loadScheduledTasks = () => {
    try {
      const saved = localStorage.getItem("scheduledTasks");

      if (saved) {
        const parsed = JSON.parse(saved);

        // Ensure we have an array
        scheduledTasks.value = Array.isArray(parsed) ? parsed : [];

        // 清理已下线任务"营地挑战宠物"的残留引用，避免定时任务校验失败
        let cleaned = false;
        for (const task of scheduledTasks.value) {
          if (
            Array.isArray(task.selectedTasks) &&
            task.selectedTasks.includes("batchCampChallengePet")
          ) {
            task.selectedTasks = task.selectedTasks.filter(
              (name) => name !== "batchCampChallengePet",
            );
            cleaned = true;
          }
        }
        if (cleaned) saveScheduledTasks();
      } else {
        scheduledTasks.value = [];
      }
    } catch (error) {
      console.error("Failed to load scheduled tasks:", error);
      scheduledTasks.value = [];
    }
  };

  // Save scheduled tasks to localStorage
  const saveScheduledTasks = () => {
    try {
      const dataToSave = JSON.stringify(scheduledTasks.value);

      localStorage.setItem("scheduledTasks", dataToSave);
      // Verify save was successful
      localStorage.getItem("scheduledTasks");
    } catch (error) {
      console.error("Failed to save scheduled tasks:", error);
    }
  };

  // Open task modal for adding new task
  const openTaskModal = () => {
    editingTask.value = null;
    Object.assign(taskForm, {
      name: "",
      runType: "daily",
      runTime: undefined,
      cronExpression: "",
      selectedTokens: [],
      selectedTasks: [],
      legionApplyTargetId: null,
      enabled: true,
    });
    taskScheduleSelectedGroupIds.value = [];
    showTaskModal.value = true;
  };

  // Edit existing task
  const editTask = (task) => {
    editingTask.value = task;
    const taskData = { ...task };
    if (
      task.runType === "daily" &&
      task.runTime &&
      typeof task.runTime === "string"
    ) {
      const [hours, minutes] = task.runTime.split(":").map(Number);
      const now = new Date();
      taskData.runTime = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        hours,
        minutes,
      );
    }
    Object.assign(taskForm, {
      name: "",
      runType: "daily",
      runTime: undefined,
      cronExpression: "",
      selectedTokens: [],
      selectedTasks: [],
      legionApplyTargetId: null,
      enabled: true,
    });
    Object.assign(taskForm, taskData);
    taskScheduleSelectedGroupIds.value = [];
    showTaskModal.value = true;
  };

  // 注: validateCronExpression 已从 @/utils/batch 导入

  // Parse cron expression and calculate next execution times
  const parseCronExpression = (expression) => {
    // Validate the expression first
    const validation = validateCronExpression(expression);
    cronValidation.value = validation;

    if (!validation.valid) {
      cronNextRuns.value = [];
      return;
    }

    // Parse the expression and calculate next runs
    const cronParts = expression.split(" ").filter(Boolean);
    const [
      minuteField,
      hourField,
      dayOfMonthField,
      monthField,
      dayOfWeekField,
    ] = cronParts;

    // Calculate next 5 execution times
    const nextRuns = calculateNextRuns(
      minuteField,
      hourField,
      dayOfMonthField,
      monthField,
      dayOfWeekField,
      5,
    );
    cronNextRuns.value = nextRuns;
  };

  // 注: calculateNextRuns 已从 @/utils/batch 导入

  // Save task (create or update)
  const saveTask = () => {
    if (!taskForm.name) {
      message.warning("请输入任务名称");
      return;
    }

    if (taskForm.runType === "daily" && !taskForm.runTime) {
      message.warning("请选择运行时间");
      return;
    }

    if (taskForm.runType === "cron") {
      if (!taskForm.cronExpression) {
        message.warning("请输入Cron表达式");
        return;
      }

      // Validate cron expression
      const validation = validateCronExpression(taskForm.cronExpression);
      if (!validation.valid) {
        message.warning(validation.message);
        return;
      }
    }

    if (taskForm.selectedTokens.length === 0) {
      message.warning("请选择至少一个账号");
      return;
    }

    if (taskForm.selectedTasks.length === 0) {
      message.warning("请选择至少一个任务");
      return;
    }

    if (
      taskForm.selectedTasks.includes("batchApplyLegion") &&
      !Number(taskForm.legionApplyTargetId)
    ) {
      message.warning("请为批量申请俱乐部任务填写目标俱乐部ID");
      return;
    }

    // Format runTime as string for storage
    let formattedRunTime = null;
    if (taskForm.runType === "daily" && taskForm.runTime) {
      const time = new Date(taskForm.runTime);
      formattedRunTime = time.toLocaleTimeString("zh-CN", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
      });
    }

    const taskData = {
      id: editingTask.value?.id || `task_${Date.now()}`,
      name: taskForm.name,
      runType: taskForm.runType,
      runTime: formattedRunTime,
      cronExpression:
        taskForm.runType === "cron" ? taskForm.cronExpression : "",
      selectedTokens: [...taskForm.selectedTokens],
      selectedTasks: [...taskForm.selectedTasks],
      legionApplyTargetId: Number(taskForm.legionApplyTargetId || 0) || null,
      enabled: taskForm.enabled,
    };

    const isNew = !editingTask.value;

    if (editingTask.value) {
      // Update existing task
      const index = scheduledTasks.value.findIndex(
        (t) => t.id === editingTask.value.id,
      );
      if (index !== -1) {
        scheduledTasks.value[index] = taskData;
      }
    } else {
      // Add new task
      scheduledTasks.value.push(taskData);
    }

    saveScheduledTasks();

    // Add log entry for task save
    addTaskSaveLog(taskData, isNew, addLog);

    showTaskModal.value = false;
    message.success("定时任务已保存");
  };

  // Delete task
  const deleteTask = (taskId) => {
    const task = scheduledTasks.value.find((t) => t.id === taskId);
    if (task) {
      scheduledTasks.value = scheduledTasks.value.filter(
        (t) => t.id !== taskId,
      );
      saveScheduledTasks();
      addLog({
        time: new Date().toLocaleTimeString(),
        message: `=== 定时任务 ${task.name} 已删除 ===`,
        type: "info",
      });
      message.success("定时任务已删除");
    }
  };

  // Toggle task enabled state
  const toggleTaskEnabled = (taskId, enabled) => {
    const task = scheduledTasks.value.find((t) => t.id === taskId);
    if (task) {
      task.enabled = enabled;
      saveScheduledTasks();
      message.success(`定时任务已${enabled ? "启用" : "禁用"}`);
      addLog({
        time: new Date().toLocaleTimeString(),
        message: `=== 定时任务 ${task.name} 已${enabled ? "启用" : "禁用"} ===`,
        type: "info",
      });
    }
  };

  // 注: addTaskSaveLog 已从 @/utils/batch 导入，调用时需传入 addLog

  // Reset run type related fields
  const resetRunType = () => {
    if (taskForm.runType === "daily") {
      taskForm.cronExpression = "";
    } else {
      taskForm.runTime = undefined;
    }
  };

  // Deselect all tokens
  const deselectAllTokens = () => {
    taskForm.selectedTokens = [];
  };

  // Select all tasks
  const selectAllTasks = () => {
    taskForm.selectedTasks = availableTasks.map((task) => task.value);
  };

  // Deselect all tasks
  const deselectAllTasks = () => {
    taskForm.selectedTasks = [];
  };

  // Select all tokens
  const selectAllTokens = () => {
    taskForm.selectedTokens = tokens.value.map((token) => token.id);
  };

  return {
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
  };
}
