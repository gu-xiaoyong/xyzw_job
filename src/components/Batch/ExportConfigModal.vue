<template>
  <n-modal
    v-model:show="show"
    preset="card"
    title="导出配置内容"
    style="width: 92%; max-width: 600px"
  >
    <n-space vertical>
      <template v-if="relayUrl">
        <div style="font-size: 13px; color: #666">
          手机上无法直接下载?复制下方链接,用系统浏览器(如 Chrome)打开即可下载
          .json 文件:
        </div>
        <n-input :value="relayUrl" type="textarea" readonly :rows="3" />
        <n-space>
          <n-button type="primary" @click="$emit('copy-link')">
            复制链接
          </n-button>
          <n-button @click="$emit('open-link')"> 尝试下载 </n-button>
        </n-space>
        <n-divider style="margin: 4px 0">
          <span style="font-size: 12px; color: #999">或复制文本内容</span>
        </n-divider>
      </template>
      <div style="font-size: 13px; color: #666">
        也可复制以下内容,自行粘贴保存为 .json 文件,之后可通过"导入配置"恢复。
      </div>
      <n-input :value="jsonText" type="textarea" readonly :rows="10" />
      <n-button type="primary" @click="$emit('copy-text')">
        复制全部内容
      </n-button>
    </n-space>
  </n-modal>
</template>
<script setup>
defineProps({
  relayUrl: { type: String, default: "" },
  jsonText: { type: String, default: "" },
});

defineEmits(["copy-link", "open-link", "copy-text"]);

const show = defineModel("show", { type: Boolean, default: false });
</script>
