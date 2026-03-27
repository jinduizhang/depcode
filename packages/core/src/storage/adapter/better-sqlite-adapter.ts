/**
 * BetterSqliteAdapter
 * 
 * 使用 better-sqlite3 原生模块实现的数据库适配器。
 * 高性能，支持 FTS5 全文搜索。
 */

import type Database from 'better-sqlite3';
import type { 
  DatabaseAdapter, 
  PreparedStatement, 
  RunResult, 
  ColumnDefinition 
} from './interface.js';

/**
 * better-sqlite3 语句包装类
 */
class BetterSQLiteStatement implements PreparedStatement {
  private statement: Database.Statement;

  constructor(statement: Database.Statement) {
    this.statement = statement;
  }

  run(...params: unknown[]): RunResult {
    const result = this.statement.run(...params);
    return {
      changes: result.changes,
      lastInsertRowid: result.lastInsertRowid,
    };
  }

  get<T = Record<string, unknown>>(...params: unknown[]): T | undefined {
    return this.statement.get(...params) as T | undefined;
  }

  all<T = Record<string, unknown>>(...params: unknown[]): T[] {
    return this.statement.all(...params) as T[];
  }

  iterate<T = Record<string, unknown>>(...params: unknown[]): IterableIterator<T> {
    return this.statement.iterate(...params) as IterableIterator<T>;
  }

  bind(...params: unknown[]): this {
    this.statement.bind(...params);
    return this;
  }

  pluck(toggle = true): this {
    this.statement.pluck(toggle);
    return this;
  }

  expand(toggle = true): this {
    this.statement.expand(toggle);
    return this;
  }

  raw(toggle = true): this {
    this.statement.raw(toggle);
    return this;
  }

  columns(): ColumnDefinition[] {
    return this.statement.columns().map(col => ({
      name: col.name,
      column: col.column,
      table: col.table,
      database: col.database,
      type: col.type,
    }));
  }
}

/**
 * BetterSqliteAdapter
 * 
 * 使用 better-sqlite3 的数据库适配器实现。
 */
export class BetterSqliteAdapter implements DatabaseAdapter {
  private db: Database.Database;
  private _dbPath: string;
  private _fts5Supported: boolean | null = null;

  constructor(db: Database.Database, dbPath: string) {
    this.db = db;
    this._dbPath = dbPath;
  }

  get dbPath(): string {
    return this._dbPath;
  }

  get inTransaction(): boolean {
    return this.db.inTransaction;
  }

  prepare(sql: string): PreparedStatement {
    return new BetterSQLiteStatement(this.db.prepare(sql));
  }

  exec(sql: string): void {
    this.db.exec(sql);
  }

  close(): void {
    this.db.close();
  }

  pragma(key: string, value?: unknown): unknown {
    if (value !== undefined) {
      return this.db.pragma(`${key} = ${value}`);
    }
    return this.db.pragma(key);
  }

  transaction<T>(fn: () => T): T {
    return this.db.transaction(fn)();
  }

  /**
   * 检测是否支持 FTS5 全文搜索
   * 通过尝试创建 FTS5 虚拟表来验证
   */
  isFTS5Supported(): boolean {
    if (this._fts5Supported !== null) {
      return this._fts5Supported;
    }

    try {
      // 尝试创建一个临时的 FTS5 表
      this.db.exec(`
        CREATE TEMP TABLE IF NOT EXISTS _fts5_test USING fts5(content);
        DROP TABLE IF EXISTS _fts5_test;
      `);
      this._fts5Supported = true;
    } catch {
      this._fts5Supported = false;
    }

    return this._fts5Supported;
  }

  /**
   * 获取底层数据库实例（用于高级操作）
   */
  getDatabase(): Database.Database {
    return this.db;
  }
}

/**
 * 创建 BetterSqliteAdapter 实例
 * 
 * @param dbPath 数据库文件路径
 * @param options 配置选项
 */
export async function createBetterSqliteAdapter(
  dbPath: string,
  options?: { readonly?: boolean }
): Promise<BetterSqliteAdapter> {
  // 动态导入 better-sqlite3
  const Database = (await import('better-sqlite3')).default;
  
  const db = new Database(dbPath, {
    readonly: options?.readonly ?? false,
    fileMustExist: false,
  });

  // 优化设置
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('synchronous = NORMAL');
  db.pragma('cache_size = -64000'); // 64MB cache

  return new BetterSqliteAdapter(db, dbPath);
}