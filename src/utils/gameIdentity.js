/**
 * 助手会话对外声明的游戏客户端身份。
 *
 * 值来自 2026-11-21 实机抓包：官方 h5 网页客户端（loginPlatform hortor-h5）
 * 在 role_getroleinfo 请求中上报的身份。服务端会按会话的客户端身份拦截
 * 写操作（2026-11-20 更新后，旧的 "2.21.2-...-wx" 身份在 legacy_claimhangup
 * 等领取类命令上被 800040 拒绝，读操作不受限）。
 *
 * 游戏大版本更新后若批量任务再现大面积未知错误码，用抓包工具看真实客户端
 * role_getroleinfo 请求里的最新版本号，更新这里即可。
 */
export const GAME_CLIENT_VERSION = "1.90.2-h5web";
export const GAME_CLIENT_PLATFORM = "hortor";
export const GAME_CLIENT_PLATFORM_EXT = "h5";

/** role_getroleinfo 请求体的公共字段（调用方可再叠加 params 覆盖）。 */
export const GAME_CLIENT_INFO_BODY = {
  clientVersion: GAME_CLIENT_VERSION,
  inviteUid: 0,
  platform: GAME_CLIENT_PLATFORM,
  platformExt: GAME_CLIENT_PLATFORM_EXT,
  scene: "",
};
