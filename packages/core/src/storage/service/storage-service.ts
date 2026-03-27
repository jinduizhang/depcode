/**
 * StorageService
 * 
 * 存储层外观服务，统一封装数据库操作。
 * 提供简化的 API：query、execute、transaction、searchFTS。
 */

import type { DatabaseAdapter } from '../adapter/interface.js';
import type { 
  SearchResult, 
  FTSSearchOptions,
  Row 
} from '../types/index.js';
import { initDatabase } from '../schema/init.js';

/**
 * StorageService 配置
 */
export interface StorageServiceConfig {
  /** 数据库文件路径 */
  dbPath: string;
  /** 是否自动初始化 Schema */
  autoInit?: boolean;
  /** 是否输出详细日志 */
  verbose?: boolean;
}

/**
 * StorageService
 * 
 * 存储层的外观类，提供统一的数据访问接口。
 */
export class StorageService {
  private adapter: DatabaseAdapter;
  private initialized: boolean = false;

  constructor(adapter: DatabaseAdapter) {
    this.adapter = adapter;
  }

  /**
   * 初始化存储服务（创建 Schema）
   */
  async initialize(verbose = false): Promise<void> {
    if (this.initialized) {
      return;
    }

    await initDatabase(this.adapter, verbose);
    this.initialized = true;
  }

  /**
   * 执行查询并返回结果
   * 
   * @param sql SQL 语句
   * @param params 参数
   * @returns 查询结果数组
   */
  query<T = Row>(sql: string, params: unknown[] = []): T[] {
    const stmt = this.adapter.prepare(sql);
    return stmt.all<T>(...params);
  }

  /**
   * 执行查询并返回第一行
   * 
   * @param sql SQL 语句
   * @param params 参数
   * @returns 查询结果或 undefined
   */
  queryOne<T = Row>(sql: string, params: unknown[] = []): T | undefined {
    const stmt = this.adapter.prepare(sql);
    return stmt.get<T>(...params);
  }

  /**
   * 执行 SQL 语句（INSERT/UPDATE/DELETE）
   * 
   * @param sql SQL 语句
   * @param params 参数
   * @returns 执行结果
   */
  execute(sql: string, params: unknown[] = []): { changes: number; lastInsertRowid: number | bigint } {
    const stmt = this.adapter.prepare(sql);
    return stmt.run(...params);
  }

  /**
   * 执行事务
   * 
   * @param fn 事务函数
   * @returns 事务函数的返回值
   */
  transaction<T>(fn: () => T): T {
    return this.adapter.transaction(fn);
  }

  /**
   * 批量执行 SQL
   * 
   * @param statements SQL 语句数组
   */
  batch(statements: string[]): void {
    this.transaction(() => {
      for (const sql of statements) {
        this.adapter.exec(sql);
      }
    });
  }

  /**
   * FTS 全文搜索
   * 
   * @param query 搜索关键词
   * @param options 搜索选项
   * @returns 搜索结果
   */
  searchFTS(query: string, options: FTSSearchOptions = {}): SearchResult[] {
    if (!this.adapter.isFTS5Supported()) {
      throw new Error('FTS5 is not supported by the current database adapter');
    }

    const {
      limit = 20,
      offset = 0,
      highlight = true,
      highlightPrefix = '**',
      highlightSuffix = '**',
    } = options;

    // 清理查询字符串（FTS5 特殊字符）
    const cleanQuery = query.replace(/['"]/g, '');

    // 构建 FTS 查询
    let selectFields = 'class_id, class_name, dep_id';
    
    if (highlight) {
      selectFields += `, highlight(sources_fts, 2, '${highlightPrefix}', '${highlightSuffix}') as snippet`;
    } else {
      selectFields += ', source as snippet';
    }

    const sql = `
      SELECT ${selectFields}
      FROM sources_fts
      WHERE sources_fts MATCH ?
      ORDER BY rank
      LIMIT ? OFFSET ?
    `;

    const results = this.query<{
      class_id: string;
      class_name: string;
      dep_id: string;
      snippet?: string;
      rank?: number;
    }>(sql, [cleanQuery, limit, offset]);

    return results.map(row => ({
      classId: row.class_id,
      className: row.class_name,
      depId: row.dep_id,
      snippet: row.snippet,
      rank: row.rank,
    }));
  }

  /**
   * 按类名搜索（模糊匹配）
   * 
   * @param pattern 类名模式（支持通配符 *）
   * @param depId 可选的依赖 ID 过滤
   * @param limit 结果数量限制
   */
  searchClass(pattern: string, depId?: string, limit = 20): SearchResult[] {
    // 转换通配符
    const likePattern = pattern.replace(/\*/g, '%');
    
    let sql = `
      SELECT id as class_id, simple_name as class_name, dep_id
      FROM classes
      WHERE simple_name LIKE ?
    `;
    const params: unknown[] = [likePattern];

    if (depId) {
      sql += ' AND dep_id = ?';
      params.push(depId);
    }

    sql += ` LIMIT ?`;
    params.push(limit);

    const results = this.query<{
      class_id: string;
      class_name: string;
      dep_id: string;
    }>(sql, params);

    return results.map(row => ({
      classId: row.class_id,
      className: row.class_name,
      depId: row.dep_id,
    }));
  }

  /**
   * 按方法名搜索
   * 
   * @param pattern 方法名模式
   * @param classId 可选的类 ID 过滤
   * @param limit 结果数量限制
   */
  searchMethod(pattern: string, classId?: string, limit = 20): Row[] {
    const likePattern = pattern.replace(/\*/g, '%');
    
    let sql = `
      SELECT m.id, m.name, m.signature, c.id as class_id, c.simple_name as class_name
      FROM methods m
      JOIN classes c ON m.class_id = c.id
      WHERE m.name LIKE ?
    `;
    const params: unknown[] = [likePattern];

    if (classId) {
      sql += ' AND m.class_id = ?';
      params.push(classId);
    }

    sql += ` LIMIT ?`;
    params.push(limit);

    return this.query(sql, params);
  }

  /**
   * 关闭数据库连接
   */
  close(): void {
    this.adapter.close();
  }

  /**
   * 获取底层数据库适配器（用于高级操作）
   */
  getAdapter(): DatabaseAdapter {
    return this.adapter;
  }

  /**
   * 检查是否支持 FTS5
   */
  isFTS5Supported(): boolean {
    return this.adapter.isFTS5Supported();
  }

  /**
   * 获取数据库路径
   */
  get dbPath(): string {
    return this.adapter.dbPath;
  }
}

/**
 * 创建 StorageService 实例
 * 
 * @param adapter 数据库适配器
 * @param autoInit 是否自动初始化 Schema
 * @param verbose 是否输出详细日志
 */
export async function createStorageService(
  adapter: DatabaseAdapter,
  autoInit = true,
  verbose = false
): Promise<StorageService> {
  const service = new StorageService(adapter);
  
  if (autoInit) {
    await service.initialize(verbose);
  }
  
  return service;
}