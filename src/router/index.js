import { createRouter, createWebHistory } from "vue-router";
import * as autoRoutes from "vue-router/auto-routes";
import { useTokenStore } from "@/stores/tokenStore";
import { isNowInLegionWarTime } from "@/utils/clubBattleUtils";

const generatedRoutes = (autoRoutes.routes ?? []).filter(
  (route) => route.path.toLowerCase() !== "/link-games",
);

const my_routes = [
  {
    path: "/",
    name: "Home",
    component: () => import("@/views/Home.vue"),
    meta: {
      title: "首页",
      requiresToken: false,
    },
  },
  {
    path: "/tokens",
    name: "TokenImport",
    component: () => import("@/views/TokenImport/TokenImport.vue"),
    meta: {
      title: "Token管理",
      requiresToken: false,
    },
    props: (route) => ({
      token: route.query.token,
      name: route.query.name,
      server: route.query.server,
      wsUrl: route.query.wsUrl,
      api: route.query.api,
      auto: route.query.auto === "true",
    }),
  },
  {
    path: "/game",
    name: "GamePlayer",
    component: () => import("@/views/GamePlayer.vue"),
    meta: {
      title: "游戏",
      requiresToken: true,
    },
    props: (route) => ({
      bin_id: route.query.bin_id,
    }),
  },
  {
    path: "/multi-game",
    name: "GameMultiPlayer",
    component: () => import("@/views/GameMultiPlayer.vue"),
    meta: {
      title: "批量游戏",
      requiresToken: true,
    },
  },
  {
    name: "DefaultLayout",
    path: "/admin",
    component: () => import("@/layout/DefaultLayout.vue"),
    children: [
      {
        path: "dashboard",
        name: "Dashboard",
        component: () => import("@/views/Dashboard.vue"),
        meta: {
          title: "控制台",
          requiresToken: true,
        },
      },
      {
        path: "game-features",
        name: "GameFeatures",
        component: () => import("@/views/GameFeatures.vue"),
        meta: {
          title: "游戏功能",
          requiresToken: true,
        },
      },
      {
        path: "message-test",
        name: "MessageTest",
        component: () => import("@/components/Test/MessageTester.vue"),
        meta: {
          title: "消息测试",
          requiresToken: true,
        },
      },
      {
        // 临时实验台：验证十殿组队协议（matchteam_create/join/memberprepare）
        path: "nightmare-lab",
        name: "NightmareTeamLab",
        component: () => import("@/views/NightmareTeamLab.vue"),
        meta: {
          title: "十殿组队实验台",
          requiresToken: true,
        },
      },
      {
        path: "legion-war",
        name: "LegionWar",
        component: () => import("@/views/LegionWar.vue"),
        meta: {
          title: "实时盐场",
          requiresToken: true,
        },
      },
      {
        path: "profile",
        name: "Profile",
        component: () => import("@/views/Profile.vue"),
        meta: {
          title: "个人设置",
          requiresToken: true,
        },
      },
      // Full backup / restore page (export or import all accounts + config).
      {
        path: "backup",
        name: "BackupRestore",
        component: () => import("@/views/BackupRestore.vue"),
        meta: {
          title: "备份恢复",
          requiresToken: true,
        },
      },
      {
        path: "daily-tasks",
        name: "DailyTasks",
        component: () => import("@/views/DailyTasks.vue"),
        meta: {
          title: "日常任务",
          requiresToken: true,
        },
      },
      {
        path: "batch-daily-tasks",
        name: "BatchDailyTasks",
        component: () => import("@/views/BatchDailyTasks.vue"),
        meta: {
          title: "批量日常",
          requiresToken: true,
        },
      },
      {
        path: "PushingLevels",
        name: "PushingLevels",
        component: () => import("@/views/PushingLevels.vue"),
        meta: {
          title: "主线推关",
          requiresToken: true,
        },
      },
      {
        path: "Link-Games",
        name: "LinkGames",
        component: () => import("@/views/Link-Games.vue"),
        meta: { title: "在线游戏", requiresToken: false, linkGames: true },
      },
      // 增加自动路由引用
      ...generatedRoutes,
    ],
  },
  {
    path: "/websocket-test",
    name: "WebSocketTest",
    component: () => import("@/components/Test/WebSocketTester.vue"),
    meta: {
      title: "WebSocket测试",
      requiresToken: true,
    },
  },
  // 兼容旧路由，重定向到新的token管理页面
  {
    path: "/login",
    redirect: "/tokens",
  },
  {
    path: "/register",
    redirect: "/tokens",
  },
  {
    path: "/game-roles",
    redirect: "/tokens",
  },
  // 增加自动路由引用
  ...generatedRoutes,
  {
    path: "/:pathMatch(.*)*",
    name: "NotFound",
    component: () => import("@/views/NotFound.vue"),
    meta: {
      title: "页面不存在",
    },
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes: my_routes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) {
      return savedPosition;
    } else {
      return { top: 0 };
    }
  },
});

// 热更新路由
autoRoutes.handleHotUpdate?.(router);

// 懒加载页面 chunk 拉取失败（弱网下点击菜单触发的新请求被掐断，或站点更新后
// 旧 chunk 404）时给出可见反馈：不处理的话路由跳转无声卡死，用户只会觉得
// "点了没反应"。动态 import 失败的结果会被浏览器缓存，重试必须整页刷新绕开。
// 注意 Chrome 网络层失败只抛裸的 "Failed to fetch"，需单独匹配。
const CHUNK_ERROR_PATTERN =
  /dynamically imported module|importing a module script failed|loading(?: css)? chunk .* failed|failed to fetch/i;

function showChunkRetryOverlay(targetPath) {
  if (document.getElementById("chunk-retry-overlay")) return;
  const overlay = document.createElement("div");
  overlay.id = "chunk-retry-overlay";
  overlay.style.cssText =
    "position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.45);" +
    "display:flex;align-items:center;justify-content:center;padding:24px;";
  overlay.innerHTML = `
    <div style="max-width:360px;width:100%;background:#fff;border-radius:12px;padding:24px;text-align:center;">
      <div style="font-size:40px;line-height:1;">📡</div>
      <h3 style="margin:12px 0 8px;font-size:17px;color:#1f2329;">页面资源加载失败</h3>
      <p style="margin:0 0 4px;color:#4e5969;font-size:13px;line-height:1.6;">
        网络不稳定或站点刚更新，导致页面文件没下载下来。
      </p>
      <p style="margin:0 0 16px;color:#86909c;font-size:12px;">
        大陆访问 pages.dev 波动较大，可稍后重试或换网络
      </p>
      <button id="chunk-retry-reload" type="button"
        style="width:100%;padding:10px 0;margin-bottom:10px;border:none;border-radius:8px;background:#4f46e5;color:#fff;font-size:15px;cursor:pointer;">
        重新加载
      </button>
      <button id="chunk-retry-close" type="button"
        style="width:100%;padding:10px 0;border:none;border-radius:8px;background:#f2f3f5;color:#4e5969;font-size:14px;cursor:pointer;">
        暂不
      </button>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector("#chunk-retry-reload").addEventListener("click", () => {
    window.location.assign(targetPath);
  });
  overlay.querySelector("#chunk-retry-close").addEventListener("click", () => {
    overlay.remove();
  });
}

router.onError((error, to) => {
  if (!CHUNK_ERROR_PATTERN.test(error?.message || "")) return;
  showChunkRetryOverlay(to?.fullPath || "/");
});

// 导航守卫
router.beforeEach((to, from, next) => {
  const tokenStore = useTokenStore();

  // 设置页面标题
  document.title = to.meta.title
    ? `${to.meta.title} - XYZW 游戏管理系统`
    : "XYZW 游戏管理系统";
  if (to.name === "LegionWar" && !isNowInLegionWarTime()) {
    next("/admin/dashboard");
    return;
  }
  // 检查是否需要Token
  if (to.meta.requiresToken && !tokenStore.hasTokens) {
    next("/tokens");
  } else if (to.path === "/" && tokenStore.hasTokens) {
    // 首页重定向逻辑
    if (tokenStore.selectedToken) {
      next("/admin/dashboard");
    } else {
      next("/tokens");
    }
  } else {
    next();
  }
});

export default router;
