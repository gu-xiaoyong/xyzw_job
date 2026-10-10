import type { DBSchema, IDBPDatabase } from "idb";
import { openDB } from "idb";
import { ref } from "vue";

// 数据库结构定义
interface ArrayBufferDB extends DBSchema {
  tokens: {
    key: string;
    value: {
      id: string;
      data: ArrayBuffer;
      createdAt: Date;
      updatedAt: Date;
      metadata?: Record<string, any>;
    };
    indexes: { "by-created": Date };
  };
}

// Hook 返回类型
interface UseIndexedDBReturn {
  // 状态
  isReady: Ref<boolean>;
  error: Ref<string | null>;

  // 操作方法
  storeArrayBuffer: (
    key: string,
    data: ArrayBuffer,
    metadata?: Record<string, any>,
  ) => Promise<boolean>;
  getArrayBuffer: (key: string) => Promise<ArrayBuffer | null>;
  getAllKeys: () => Promise<string[]>;
  deleteArrayBuffer: (key: string) => Promise<boolean>;
  clearAll: () => Promise<boolean>;
  getStorageInfo: () => Promise<{ totalSize: number; keyCount: number }>;
}

// 配置接口
interface DBConfig {
  dbName?: string;
  version?: number;
  storeName?: "tokens";
}

// 模块级共享连接：按 dbName@version 复用，避免每个 hook 实例各开一个从不关闭的连接
const dbCache = new Map<string, Promise<IDBPDatabase<ArrayBufferDB>>>();
// blocked/blocking 时机发生在 openDB 回调里，先记录下来由后续操作上报
let sharedDBWarning: string | null = null;

const openSharedDB = (
  dbName: string,
  version: number,
  storeName: string,
): Promise<IDBPDatabase<ArrayBufferDB>> => {
  const cacheKey = `${dbName}@${version}`;
  const cached = dbCache.get(cacheKey);
  if (cached) return cached;

  const promise = openDB<ArrayBufferDB>(dbName, version, {
    upgrade(db) {
      // 创建对象存储空间（如果不存在）
      if (!db.objectStoreNames.contains(storeName)) {
        const store = db.createObjectStore(storeName, { keyPath: "id" });
        // 创建创建时间索引
        store.createIndex("by-created", "createdAt");
        console.log(`✅ IndexedDB 存储空间 "${storeName}" 创建成功`);
      }
    },
    blocked() {
      sharedDBWarning =
        "数据库被其他标签页阻塞，请关闭其他使用相同数据库的标签页";
      console.warn(`⚠️ IndexedDB "${dbName}": ${sharedDBWarning}`);
    },
    blocking() {
      sharedDBWarning = "数据库需要升级，请关闭所有标签页后重试";
      console.warn(`⚠️ IndexedDB "${dbName}": ${sharedDBWarning}`);
    },
    terminated() {
      // 连接意外终止时移出缓存，后续操作会自动重开
      dbCache.delete(cacheKey);
      console.warn(`⚠️ IndexedDB "${dbName}" 连接意外终止`);
    },
  });

  // 打开失败时清掉缓存，允许下次重试
  promise.catch(() => dbCache.delete(cacheKey));
  dbCache.set(cacheKey, promise);
  return promise;
};

/**
 * Vue3 Hook for IndexedDB ArrayBuffer storage
 */
export function useIndexedDB(config: DBConfig = {}): UseIndexedDBReturn {
  const { dbName = "xyzw", version = 1, storeName = "tokens" } = config;

  // 响应式状态
  const isReady = ref(false);
  const error = ref<string | null>(null);

  const withDB = async <T>(
    opName: string,
    fallback: T,
    op: (db: IDBPDatabase<ArrayBufferDB>) => Promise<T>,
  ): Promise<T> => {
    try {
      const db = await openSharedDB(dbName, version, storeName);
      if (sharedDBWarning) {
        error.value = sharedDBWarning;
      } else {
        error.value = null;
        isReady.value = true;
      }
      return await op(db);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "未知错误";
      error.value = `${opName}: ${errorMessage}`;
      console.error(`❌ IndexedDB ${opName}错误:`, err);
      return fallback;
    }
  };

  /**
   * 存储 ArrayBuffer 数据
   */
  const storeArrayBuffer = async (
    key: string,
    data: ArrayBuffer,
    metadata?: Record<string, any>,
  ): Promise<boolean> => {
    return withDB("存储数据", false, async (db) => {
      const item = {
        id: key,
        data,
        metadata,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await db.put(storeName, item);
      console.log(
        `✅ ArrayBuffer 存储成功，键: ${key}, 大小: ${data.byteLength} 字节`,
      );
      return true;
    });
  };

  /**
   * 获取 ArrayBuffer 数据
   */
  const getArrayBuffer = async (key: string): Promise<ArrayBuffer | null> => {
    return withDB("读取数据", null, async (db) => {
      const result = await db.get(storeName, key);

      if (!result) {
        console.warn(`⚠️ 未找到键为 "${key}" 的数据`);
        return null;
      }

      console.log(
        `✅ ArrayBuffer 读取成功，键: ${key}, 大小: ${result.data.byteLength} 字节`,
      );
      return result.data;
    });
  };

  /**
   * 获取所有存储的键
   */
  const getAllKeys = async (): Promise<string[]> => {
    return withDB("获取键列表", [] as string[], (db) =>
      db.getAllKeys(storeName),
    );
  };

  /**
   * 删除指定的 ArrayBuffer 数据
   */
  const deleteArrayBuffer = async (key: string): Promise<boolean> => {
    return withDB("删除数据", false, async (db) => {
      await db.delete(storeName, key);
      console.log(`✅ ArrayBuffer 删除成功，键: ${key}`);
      return true;
    });
  };

  /**
   * 清空所有数据
   */
  const clearAll = async (): Promise<boolean> => {
    return withDB("清空数据", false, async (db) => {
      await db.clear(storeName);
      console.log("✅ 所有 ArrayBuffer 数据已清空");
      return true;
    });
  };

  /**
   * 获取存储信息
   */
  const getStorageInfo = async (): Promise<{
    totalSize: number;
    keyCount: number;
  }> => {
    return withDB("获取存储信息", { totalSize: 0, keyCount: 0 }, async (db) => {
      const allItems = await db.getAll(storeName);
      const totalSize = allItems.reduce(
        (size, item) => size + item.data.byteLength,
        0,
      );
      const keyCount = allItems.length;

      return { totalSize, keyCount };
    });
  };

  return {
    // 状态
    isReady,
    error,

    // 方法
    storeArrayBuffer,
    getArrayBuffer,
    getAllKeys,
    deleteArrayBuffer,
    clearAll,
    getStorageInfo,
  };
}

export default useIndexedDB;
