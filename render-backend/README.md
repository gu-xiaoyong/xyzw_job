# XYZW 云端定时后端

服务端定时执行批量任务，**无需保持手机页面打开**。网页端「云端定时」面板一键把
Token 与定时任务同步到云端，由本服务按计划自动连游戏服务器执行。

## 架构

```
手机页面 ──同步(Token+定时任务)──▶ 本服务(Express) ──▶ Supabase(存储)
                                     ▲
                              node-cron 到点触发
                                     │
                                     ▼
                        GameClient(wss) ──▶ 咸鱼之王游戏服务器
```

## 部署步骤

### 1. 创建 Supabase 项目并建表

在 Supabase SQL Editor 执行：

```sql
create table if not exists tokens (
  id text primary key,
  name text,
  token text not null,
  enabled boolean default true,
  ws_url text,
  created_at timestamptz default now()
);

create table if not exists cron_tasks (
  id uuid primary key default gen_random_uuid(),
  name text,
  cron_expr text,
  selected_tasks jsonb default '[]',
  selected_tokens jsonb default '[]',
  enabled boolean default true,
  last_run_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists task_logs (
  id bigserial primary key,
  task_id uuid,
  token_name text,
  task_type text,
  status text,
  message text,
  created_at timestamptz default now()
);

alter table tokens enable row level security;
alter table cron_tasks enable row level security;
alter table task_logs enable row level security;
-- 不建任何 policy：anon key 无法绕过后端读写（后端用 service_role key）
```

### 2. 部署到 Render（或任意 Node 平台）

- 新建 Web Service，仓库路径选 `render-backend/`
- Build: `npm install`，Start: `npm start`
- 环境变量：
  - `SUPABASE_URL` / `SUPABASE_KEY`：Supabase 项目的 URL 与 **service_role key**
  - `BACKEND_KEY`：自定义访问密钥（网页端同步时填写）
  - `PORT`：Render 自动注入，无需设置

> ⚠️ **免费实例会休眠**：Render 免费档 15 分钟无访问即休眠，node-cron 随之停止。
> 解决：① 升级付费实例（常驻）；② 用 UptimeRobot 等每 5 分钟 ping 一次
> `https://<你的域名>/health` 保活（免费可用，但仍有偶发重启）。

### 3. 网页端配置

批量日常任务页 → 定时任务卡片 → **云端定时**：

1. 填后端服务地址与 BACKEND_KEY
2. 「测试连接」确认通
3. 「同步 Token 与定时任务」上传（全量替换式）
4. 「测试Token有效性」逐个验证 Token 是否有效
5. 「刷新云端日志」查看云端执行记录

## 云端支持的任务类型

| 页面任务 | 云端实现 |
| --- | --- |
| 日常任务 | dailyBundle（签到+挂机+日常奖励+爬塔+邮件+功法） |
| 领取挂机 | system_claimhangupreward |
| 一键爬塔 | tower_getinfo + tower_claimreward |
| 一键爬怪异塔 | evotower_getinfo + evotower_claimreward |
| 一键答题 | study_startgame |
| 一键俱乐部签到 | legion_getinfo + legion_signin |
| 一键扫荡灯神 | genie_sweep |
| 免费领取珍宝阁 | collection_claimfreereward |
| 批量领取功法残卷 | legacy_claimhangup |
| 一键活跃度奖励 | 每日任务1~10 + 每日/每周活跃度宝箱 |
| 逐鹿盐山任务 | apex_taskclaim confId 1~7 |

其余复杂任务（战斗循环/梦境/竞技场等）云端暂不支持，同步时自动跳过。

## 安全须知

- Token 明文存储在 Supabase，**务必保管好 service_role key**，不要提交到仓库
- 所有 API 均要求 `x-backend-key` 与 `BACKEND_KEY` 一致，`/health` 除外
- 云端出口 IP 为机房 IP，与手机日常 IP 不同，理论上存在风控风险，请自行评估
