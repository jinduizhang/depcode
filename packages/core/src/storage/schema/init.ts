/**
 * Schema Initialization
 * 
 * 初始化数据库 Schema，创建所有表和索引。
 */

import type { DatabaseAdapter } from '../adapter/interface.js';
import { 
  CREATE_TABLES, 
  CREATE_INDEXES, 
  CREATE_FTS_TRIGGERS,
  SCHEMA_VERSION 
} from './definitions.js';

/**
 * 初始化数据库 Schema
 * 
 * @param adapter 数据库适配器
 * @param verbose 是否输出详细日志
 */
export async function initDatabase(
  adapter: DatabaseAdapter,
  verbose = false
): Promise<void> {
  // 检查当前版本
  const currentVersion = await getSchemaVersion(adapter);
  
  if (currentVersion >= SCHEMA_VERSION) {
    if (verbose) {
      console.log(`[Schema] Database already at version ${currentVersion}, skipping initialization`);
    }
    return;
  }

  if (verbose) {
    console.log(`[Schema] Initializing database schema version ${SCHEMA_VERSION}...`);
  }

  // 创建所有表
  for (const createTable of CREATE_TABLES) {
    adapter.exec(createTable);
  }

  // 创建索引
  for (const createIndex of CREATE_INDEXES) {
    adapter.exec(createIndex);
  }

  // 如果支持 FTS5，创建触发器
  if (adapter.isFTS5Supported()) {
    try {
      adapter.exec(CREATE_FTS_TRIGGERS);
      if (verbose) {
        console.log('[Schema] FTS5 triggers created');
      }
    } catch (error) {
      // 触发器创建失败不影响主流程
      if (verbose) {
        console.warn('[Schema] FTS5 triggers creation failed (non-critical):', error);
      }
    }
  }

  // 记录版本
  await setSchemaVersion(adapter, SCHEMA_VERSION);

  if (verbose) {
    console.log(`[Schema] Database schema initialized at version ${SCHEMA_VERSION}`);
  }
}

/**
 * 获取当前 Schema 版本
 */
export async function getSchemaVersion(adapter: DatabaseAdapter): Promise<number> {
  try {
    const result = adapter.prepare('SELECT version FROM _version ORDER BY version DESC LIMIT 1').get<{ version: number }>();
    return result?.version ?? 0;
  } catch {
    // 表不存在，返回 0
    return 0;
  }
}

/**
 * 设置 Schema 版本
 */
export async function setSchemaVersion(adapter: DatabaseAdapter, version: number): Promise<void> {
  adapter.exec(`INSERT OR REPLACE INTO _version (version) VALUES (${version})`);
}

/**
 * 验证 Schema 完整性
 * 
 * @param adapter 数据库适配器
 * @returns 是否验证通过
 */
export async function validateSchema(adapter: DatabaseAdapter): Promise<{
  valid: boolean;
  missingTables: string[];
  errors: string[];
}> {
  const result = {
    valid: true,
    missingTables: [] as string[],
    errors: [] as string[],
  };

  const requiredTables = ['deps', 'classes', 'methods', 'fields', '_version'];
  
  try {
    const tables = adapter.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
    `).all<{ name: string }>();
    
    const tableNames = new Set(tables.map(t => t.name));
    
    for (const table of requiredTables) {
      if (!tableNames.has(table)) {
        result.missingTables.push(table);
        result.valid = false;
      }
    }

    // 检查 FTS5 表（可选）
    if (adapter.isFTS5Supported()) {
      if (!tableNames.has('sources_fts')) {
        result.errors.push('sources_fts FTS5 table is missing (FTS search will not work)');
      }
    }
  } catch (error) {
    result.errors.push(`Schema validation error: ${error}`);
    result.valid = false;
  }

  return result;
}

/**
 * 重置数据库（删除所有表）
 * 
 * ⚠️ 警告：这将删除所有数据！
 */
export async function resetDatabase(adapter: DatabaseAdapter, verbose = false): Promise<void> {
  if (verbose) {
    console.log('[Schema] Resetting database...');
  }

  // 获取所有表名
  const tables = adapter.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
  `).all<{ name: string }>();

  // 删除所有表
  adapter.transaction(() => {
    for (const table of tables) {
      adapter.exec(`DROP TABLE IF EXISTS ${table.name}`);
    }
  });

  if (verbose) {
    console.log('[Schema] Database reset complete');
  }
}