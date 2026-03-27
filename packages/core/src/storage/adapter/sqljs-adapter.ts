/**
 * SqlJsAdapter
 * 
 * 使用 sql.js (WASM) 实现的数据库适配器。
 * 零原生依赖，跨平台兼容性好，但性能较低。
 */

import type { 
  DatabaseAdapter, 
  PreparedStatement, 
  RunResult, 
  ColumnDefinition
} from './interface.js';
import type { Row } from '../types/index.js';
import * as fs from 'fs';
import * as path from 'path';

// sql.js 类型定义（简化版）
interface SqlJsDatabase {
  run(sql: string, params?: unknown[]): void;
  exec(sql: string): { columns: string[]; values: unknown[][] }[];
  export(): Uint8Array;
}

interface SqlJsInstance {
  Database: new (data?: ArrayLike<number>) => SqlJsDatabase;
}

/**
 * sql.js 语句包装类
 */
class SqlJsStatement implements PreparedStatement {
  private db: SqlJsDatabase;
  private sql: string;
  private boundParams: unknown[] = [];

  constructor(db: SqlJsDatabase, sql: string) {
    this.db = db;
    this.sql = sql;
  }

  run(...params: unknown[]): RunResult {
    const actualParams = params.length > 0 ? params : this.boundParams;
    this.db.run(this.sql, actualParams);
    
    // sql.js 不提供准确的 changes 和 lastInsertRowid
    // 这里做近似处理
    return {
      changes: 1,
      lastInsertRowid: 0,
    };
  }

  get<T = Record<string, unknown>>(...params: unknown[]): T | undefined {
    const actualParams = params.length > 0 ? params : this.boundParams;
    const results = this._execute(actualParams);
    if (results.length === 0 || results[0].values.length === 0) {
      return undefined;
    }
    return this._rowToObject(results[0])[0] as T;
  }

  all<T = Record<string, unknown>>(...params: unknown[]): T[] {
    const actualParams = params.length > 0 ? params : this.boundParams;
    const results = this._execute(actualParams);
    if (results.length === 0) {
      return [];
    }
    return this._rowToObject(results[0]) as T[];
  }

  iterate<T = Record<string, unknown>>(...params: unknown[]): IterableIterator<T> {
    const rows = this.all<T>(...params);
    return rows[Symbol.iterator]();
  }

  bind(...params: unknown[]): this {
    this.boundParams = params;
    return this;
  }

  pluck(_toggle?: boolean): this {
    // sql.js 不支持 pluck，忽略
    return this;
  }

  expand(_toggle?: boolean): this {
    // sql.js 不支持 expand，忽略
    return this;
  }

  raw(_toggle?: boolean): this {
    // sql.js 不支持 raw，忽略
    return this;
  }

  columns(): ColumnDefinition[] {
    // sql.js 的列信息需要执行查询后才能获取
    // 这里返回空数组，因为还没有执行查询
    return [];
  }

  private _execute(params: unknown[]): { columns: string[]; values: unknown[][] }[] {
    // 将参数注入 SQL（简单实现，不支持命名参数）
    let sql = this.sql;
    
    // 处理 ? 占位符
    let paramIndex = 0;
    sql = sql.replace(/\?/g, () => {
      const param = params[paramIndex++];
      if (param === undefined || param === null) return 'NULL';
      if (typeof param === 'string') return `'${param.replace(/'/g, "''")}'`;
      return String(param);
    });
    
    return this.db.exec(sql);
  }

  private _rowToObject(result: { columns: string[]; values: unknown[][] }): Row[] {
    return result.values.map((row: unknown[]) => {
      const obj: Row = {};
      result.columns.forEach((col: string, index: number) => {
        obj[col] = row[index];
      });
      return obj;
    });
  }
}

/**
 * SqlJsAdapter
 * 
 * 使用 sql.js (WASM) 的数据库适配器实现。
 */
export class SqlJsAdapter implements DatabaseAdapter {
  private db: SqlJsDatabase;
  private _dbPath: string;
  private _inTransaction = false;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private saveIntervalMs: number;

  constructor(db: SqlJsDatabase, dbPath: string, saveIntervalMs = 5000) {
    this.db = db;
    this._dbPath = dbPath;
    this.saveIntervalMs = saveIntervalMs;
    this.scheduleSave();
  }

  get dbPath(): string {
    return this._dbPath;
  }

  get inTransaction(): boolean {
    return this._inTransaction;
  }

  prepare(sql: string): PreparedStatement {
    return new SqlJsStatement(this.db, sql);
  }

  exec(sql: string): void {
    this.db.run(sql);
    this.scheduleSave();
  }

  close(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }
    this.saveToFile();
  }

  pragma(key: string, value?: unknown): unknown {
    if (value !== undefined) {
      this.db.run(`PRAGMA ${key} = ${value}`);
    } else {
      const result = this.db.exec(`PRAGMA ${key}`);
      if (result.length > 0 && result[0].values.length > 0) {
        return result[0].values[0][0];
      }
    }
    return undefined;
  }

  transaction<T>(fn: () => T): T {
    this.db.run('BEGIN TRANSACTION');
    this._inTransaction = true;
    try {
      const result = fn();
      this.db.run('COMMIT');
      this._inTransaction = false;
      this.scheduleSave();
      return result;
    } catch (error) {
      this.db.run('ROLLBACK');
      this._inTransaction = false;
      throw error;
    }
  }

  /**
   * sql.js 不支持 FTS5
   */
  isFTS5Supported(): boolean {
    return false;
  }

  /**
   * 获取底层数据库实例
   */
  getDatabase(): SqlJsDatabase {
    return this.db;
  }

  /**
   * 调度保存到文件
   */
  private scheduleSave(): void {
    if (this.saveTimer) {
      return;
    }
    this.saveTimer = setTimeout(() => {
      this.saveToFile();
      this.saveTimer = null;
    }, this.saveIntervalMs);
  }

  /**
   * 保存数据库到文件
   */
  saveToFile(): void {
    const data = this.db.export();
    const buffer = Buffer.from(data);
    
    // 确保目录存在
    const dir = path.dirname(this._dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(this._dbPath, buffer);
  }
}

/**
 * 初始化 sql.js
 */
async function initSqlJs(): Promise<SqlJsInstance> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const initSqlJs = require('sql.js');
  return initSqlJs();
}

/**
 * 创建 SqlJsAdapter 实例
 * 
 * @param dbPath 数据库文件路径
 * @param options 配置选项
 */
export async function createSqlJsAdapter(
  dbPath: string,
  options?: { 
    saveIntervalMs?: number;
    verbose?: boolean;
  }
): Promise<SqlJsAdapter> {
  const SQL = await initSqlJs();
  
  let db: SqlJsDatabase;
  
  // 如果文件存在，加载数据库
  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
    if (options?.verbose) {
      console.log(`[SqlJsAdapter] Loaded database from ${dbPath}`);
    }
  } else {
    db = new SQL.Database();
    if (options?.verbose) {
      console.log(`[SqlJsAdapter] Created new database at ${dbPath}`);
    }
  }

  // 设置优化参数
  db.run('PRAGMA journal_mode = MEMORY');
  db.run('PRAGMA foreign_keys = ON');

  return new SqlJsAdapter(db, dbPath, options?.saveIntervalMs ?? 5000);
}