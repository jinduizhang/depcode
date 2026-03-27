/**
 * DatabaseAdapterFactory
 * 
 * 数据库适配器工厂，自动选择最佳的数据库后端。
 * 优先尝试 better-sqlite3（原生高性能），失败则回退到 sql.js（WASM）。
 */

import type { 
  DatabaseAdapter, 
  DatabaseAdapterType, 
  DatabaseAdapterConfig 
} from './interface.js';
import { BetterSqliteAdapter, createBetterSqliteAdapter } from './better-sqlite-adapter.js';
import { SqlJsAdapter, createSqlJsAdapter } from './sqljs-adapter.js';

/**
 * 创建数据库适配器
 * 
 * @param config 配置选项
 * @returns 数据库适配器实例
 */
export async function createDatabaseAdapter(
  config: DatabaseAdapterConfig
): Promise<DatabaseAdapter> {
  const { dbPath, type, readonly, verbose } = config;

  // 如果强制指定了类型
  if (type === 'sql.js') {
    if (verbose) {
      console.log('[DatabaseAdapterFactory] Forcing sql.js adapter');
    }
    return createSqlJsAdapter(dbPath, { verbose });
  }

  if (type === 'better-sqlite3') {
    if (verbose) {
      console.log('[DatabaseAdapterFactory] Forcing better-sqlite3 adapter');
    }
    return createBetterSqliteAdapter(dbPath, { readonly });
  }

  // 自动选择：优先尝试 better-sqlite3
  try {
    if (verbose) {
      console.log('[DatabaseAdapterFactory] Trying better-sqlite3 adapter...');
    }
    const adapter = await createBetterSqliteAdapter(dbPath, { readonly });
    if (verbose) {
      console.log('[DatabaseAdapterFactory] ✓ Using better-sqlite3 (native)');
    }
    return adapter;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // 检测是否是 Node 模块版本不匹配
    if (errorMessage.includes('NODE_MODULE_VERSION') || 
        errorMessage.includes('was compiled for a different Node.js version')) {
      console.warn('[DatabaseAdapterFactory] better-sqlite3 native module version mismatch');
    } else {
      console.warn(`[DatabaseAdapterFactory] better-sqlite3 failed: ${errorMessage}`);
    }
    
    if (verbose) {
      console.log('[DatabaseAdapterFactory] Falling back to sql.js (WASM)...');
    }
  }

  // 回退到 sql.js
  try {
    const adapter = await createSqlJsAdapter(dbPath, { verbose });
    if (verbose) {
      console.log('[DatabaseAdapterFactory] ✓ Using sql.js (WASM)');
    }
    return adapter;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to initialize any database adapter: ${errorMessage}`);
  }
}

/**
 * 检查 better-sqlite3 是否可用
 */
export async function isBetterSqlite3Available(): Promise<boolean> {
  try {
    await import('better-sqlite3');
    return true;
  } catch {
    return false;
  }
}

/**
 * 检查 sql.js 是否可用
 */
export async function isSqlJsAvailable(): Promise<boolean> {
  try {
    require.resolve('sql.js');
    return true;
  } catch {
    return false;
  }
}

/**
 * 获取可用的适配器类型列表
 */
export async function getAvailableAdapters(): Promise<DatabaseAdapterType[]> {
  const adapters: DatabaseAdapterType[] = [];
  
  if (await isBetterSqlite3Available()) {
    adapters.push('better-sqlite3');
  }
  
  if (await isSqlJsAvailable()) {
    adapters.push('sql.js');
  }
  
  return adapters;
}

// 重新导出类型和实现
export { BetterSqliteAdapter, createBetterSqliteAdapter } from './better-sqlite-adapter.js';
export { SqlJsAdapter, createSqlJsAdapter } from './sqljs-adapter.js';