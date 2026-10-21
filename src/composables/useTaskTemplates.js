import { computed, reactive, ref } from "vue";
import { useMessage } from "naive-ui";
import { dailySettingsDefaults } from "@/utils/dailyTaskState";

/**
 * 任务模板管理 composable
 * 模板 CRUD / 应用到账号 / 账号模板引用查看，状态与逻辑自包含。
 * @param {object} deps
 * @param {import("vue").ComputedRef<Array>} deps.sortedTokens 排序后的账号列表
 */
export function useTaskTemplates(deps) {
  const { sortedTokens } = deps;
  const message = useMessage();

  // Task Template State
  const showTaskTemplateModal = ref(false);
  const showApplyTemplateModal = ref(false);
  const showTemplateManagerModal = ref(false);
  const showAccountTemplateModal = ref(false);
  const taskTemplates = ref([]);
  const selectedTemplateId = ref(null);
  const selectedTokensForApply = ref([]);
  const currentTemplateName = ref("");
  const currentTemplateId = ref(null); // 用于编辑现有模板
  const currentTemplate = reactive({
    ...dailySettingsDefaults,
    // 爬塔阵容一次性迁移标记：新建/编辑的模板视为已迁移
    formationMigrated: true,
  });

  // Account Template References
  const accountTemplateReferences = ref([]);
  const filteredAccountTemplates = ref([]);
  const selectedTemplateForFilter = ref(null);

  // Computed for Apply Template
  const isAllSelectedForApply = computed(() => {
    return (
      selectedTokensForApply.value.length === sortedTokens.value.length &&
      sortedTokens.value.length > 0
    );
  });

  const isIndeterminateForApply = computed(() => {
    return (
      selectedTokensForApply.value.length > 0 &&
      selectedTokensForApply.value.length < sortedTokens.value.length
    );
  });

  // Computed for Template Manager
  const filteredTaskTemplates = computed(() => {
    return taskTemplates.value;
  });

  const loadTaskTemplates = () => {
    const templates = localStorage.getItem("task-templates");
    const parsed = templates ? JSON.parse(templates) : [];
    // 一次性迁移：旧模板的爬塔阵容统一改为"当前阵容"(0)，迁移后不再覆盖
    let migrated = false;
    for (const template of parsed) {
      if (template.settings && !template.settings.formationMigrated) {
        template.settings.towerFormation = 0;
        template.settings.formationMigrated = true;
        migrated = true;
      }
    }
    if (migrated) {
      try {
        localStorage.setItem("task-templates", JSON.stringify(parsed));
      } catch (e) {
        // 存储失败不影响本次使用
      }
    }
    taskTemplates.value = parsed;
    return parsed;
  };

  const openApplyTemplateModal = () => {
    // 加载模板列表
    loadTaskTemplates();
    // 重置选择
    selectedTemplateId.value = null;
    selectedTokensForApply.value = [];
    showApplyTemplateModal.value = true;
  };

  const handleSelectAllForApply = (checked) => {
    if (checked) {
      selectedTokensForApply.value = sortedTokens.value.map(
        (token) => token.id,
      );
    } else {
      selectedTokensForApply.value = [];
    }
  };

  const applyTemplate = () => {
    if (
      !selectedTemplateId.value ||
      selectedTokensForApply.value.length === 0
    ) {
      message.error("请选择模板和要应用的账号");
      return;
    }

    // 找到选中的模板
    const templates = loadTaskTemplates();
    const template = templates.find((t) => t.id === selectedTemplateId.value);
    if (!template) {
      message.error("模板不存在");
      return;
    }

    // 应用模板到选中的账号
    let successCount = 0;
    selectedTokensForApply.value.forEach((tokenId) => {
      // 保存账号设置时同时保存模板ID
      const accountSettings = {
        ...template.settings,
        templateId: template.id, // 记录模板ID
      };
      localStorage.setItem(
        `daily-settings:${tokenId}`,
        JSON.stringify(accountSettings),
      );
      successCount++;
    });

    message.success(`已成功应用模板到 ${successCount} 个账号`);
    showApplyTemplateModal.value = false;
  };

  // Template Manager Functions
  const openTemplateManagerModal = () => {
    // 加载模板列表
    loadTaskTemplates();
    showTemplateManagerModal.value = true;
  };

  const openEditTemplateModal = (template) => {
    // 加载模板数据到当前编辑模板
    currentTemplateId.value = template.id;
    currentTemplateName.value = template.name;
    Object.assign(currentTemplate, template.settings);
    showTaskTemplateModal.value = true;
  };

  const updateTaskTemplate = () => {
    if (!currentTemplateName.value.trim()) {
      message.error("请输入模板名称");
      return;
    }

    // 找到并更新模板
    const templates = loadTaskTemplates();
    const templateIndex = templates.findIndex(
      (t) => t.id === currentTemplateId.value,
    );
    if (templateIndex === -1) {
      message.error("模板不存在");
      return;
    }

    // 更新模板
    templates[templateIndex] = {
      ...templates[templateIndex],
      name: currentTemplateName.value.trim(),
      settings: {
        ...currentTemplate,
      },
      updatedAt: new Date().toISOString(),
    };

    // 保存模板到localStorage
    localStorage.setItem("task-templates", JSON.stringify(templates));

    // 更新模板列表
    taskTemplates.value = templates;

    message.success(`已更新模板 "${templates[templateIndex].name}"`);
    showTaskTemplateModal.value = false;

    // 重置编辑状态
    resetTemplateForm();
  };

  const deleteTaskTemplate = (templateId) => {
    // 确认删除
    // eslint-disable-next-line no-alert -- Preserve the existing native notification or confirmation flow.
    if (confirm("确定要删除这个模板吗？")) {
      // 找到并删除模板
      const templates = loadTaskTemplates();
      const filteredTemplates = templates.filter((t) => t.id !== templateId);

      // 保存模板到localStorage
      localStorage.setItem("task-templates", JSON.stringify(filteredTemplates));

      // 更新模板列表
      taskTemplates.value = filteredTemplates;

      message.success("模板已删除");
    }
  };

  const resetTemplateForm = () => {
    currentTemplateId.value = null;
    currentTemplateName.value = "";
    Object.assign(currentTemplate, {
      ...dailySettingsDefaults,
      formationMigrated: true,
    });
  };

  const openAccountTemplateModal = () => {
    // 加载账号模板引用关系
    loadAccountTemplateReferences();
    showAccountTemplateModal.value = true;
  };

  const loadAccountTemplateReferences = () => {
    const templates = loadTaskTemplates();
    const references = [];

    // 遍历所有账号，获取其模板引用
    sortedTokens.value.forEach((token) => {
      const settingsStr = localStorage.getItem(`daily-settings:${token.id}`);
      if (settingsStr) {
        try {
          const settings = JSON.parse(settingsStr);
          const templateId = settings.templateId;
          const template = templates.find((t) => t.id === templateId);

          references.push({
            tokenId: token.id,
            tokenName: token.name,
            templateId,
            templateName: template ? template.name : "未引用模板",
          });
        } catch (e) {
          console.error(`解析账号 ${token.name} 的设置失败:`, e);
        }
      } else {
        // 没有设置的账号
        references.push({
          tokenId: token.id,
          tokenName: token.name,
          templateId: null,
          templateName: "未引用模板",
        });
      }
    });

    accountTemplateReferences.value = references;
    filteredAccountTemplates.value = references;
  };

  const filterAccountTemplates = () => {
    if (!selectedTemplateForFilter.value) {
      filteredAccountTemplates.value = accountTemplateReferences.value;
    } else {
      filteredAccountTemplates.value = accountTemplateReferences.value.filter(
        (item) => item.templateId === selectedTemplateForFilter.value,
      );
    }
  };

  const openNewTemplateModal = () => {
    // 重置表单，准备创建新模板
    resetTemplateForm();
    showTaskTemplateModal.value = true;
  };

  // 修改saveTaskTemplate函数，支持新增和编辑
  const saveTaskTemplate = () => {
    if (!currentTemplateName.value.trim()) {
      message.error("请输入模板名称");
      return;
    }

    const templates = loadTaskTemplates();

    if (currentTemplateId.value) {
      // 更新现有模板
      updateTaskTemplate();
    } else {
      // 创建新模板
      const template = {
        id: Date.now().toString(),
        name: currentTemplateName.value.trim(),
        settings: {
          ...currentTemplate,
        },
        createdAt: new Date().toISOString(),
      };

      // 添加新模板
      templates.push(template);
      localStorage.setItem("task-templates", JSON.stringify(templates));

      // 更新模板列表
      taskTemplates.value = templates;

      message.success(`已保存模板 "${template.name}"`);
      showTaskTemplateModal.value = false;

      // 重置表单
      resetTemplateForm();
    }
  };

  return {
    showTaskTemplateModal,
    showApplyTemplateModal,
    showTemplateManagerModal,
    showAccountTemplateModal,
    taskTemplates,
    selectedTemplateId,
    selectedTokensForApply,
    currentTemplateName,
    currentTemplate,
    accountTemplateReferences,
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
    resetTemplateForm,
    openAccountTemplateModal,
    loadAccountTemplateReferences,
    filterAccountTemplates,
    openNewTemplateModal,
    saveTaskTemplate,
  };
}
