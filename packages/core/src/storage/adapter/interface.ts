/**
 * DatabaseAdapter Interface
 * 
 * 统一的数据库适配器接口，用于抽象 better-sqlite3 和 sql.js 的差异。
 * 采用适配器模式，让上层代码无需关心底层数据库实现。
 */

/**
 * SQL 执行结果
 */
export interface RunResult {
  /** 受影响的行数 */
  changes: number;
  /** 最后插入的行 ID */
  lastInsertRowid: number | bigint;
}

/**
 * 列定义
 */
export interface ColumnDefinition {
  /** 列名 */
  name: string;
  /** 列别名 */
  column?: string | null;
  /** 表名 */
  table?: string | null;
  /** 数据库名 */
  database?: string | null;
  /** 数据类型 */
  type?: string | null;
}

/**
 * 预编译语句接口
 * 
 * 封装 SQL 预编译语句，支持参数绑定和结果获取。
 */
export interface PreparedStatement {
  /**
   * 执行语句并返回结果信息
   * @param params 参数（位置参数或命名参数）
   */
  run(...params: unknown[]): RunResult;

  /**
   * 执行查询并返回第一行
   * @param params 参数
   */
  get<T = Record<string, unknown>>(...params: unknown[]): T | undefined;

  /**
   * 执行查询并返回所有行
   * @param params 参数
   */
  all<T = Record<string, unknown>>(...params: unknown[]): T[];

  /**
   * 执行查询并返回迭代器
   * @param params 参数
   */
  iterate<T = Record<string, unknown>>(...params: unknown[]): IterableIterator<T>;

  /**
   * 绑定参数（支持链式调用）
   * @param params 参数
   */
  bind(...params: unknown[]): this;

  /**
   * 设置是否只返回第一列
   * @param toggle 是否启用
   */
  pluck?(toggle?: boolean): this;

  /**
   * 设置是否展开结果
   * @param toggle 是否启用
   */
  expand?(toggle?: boolean): this;

  /**
   * 设置是否返回原始数据
   * @param toggle 是否启用
   */
  raw?(toggle?: boolean): this;

  /**
   * 获取列信息
   */
  columns?(): ColumnDefinition[];
}

/**
 * 数据库适配器接口
 * 
 * 统一 better-sqlite3 和 sql.js 的接口差异。
 * 实现此接口可以无缝切换底层数据库。
 */
export interface DatabaseAdapter {
  /**
   * 准备 SQL 语句
   * @param sql SQL 语句
   */
  prepare(sql: string): PreparedStatement;

  /**
   * 执行 SQL 语句（无返回结果）
   * @param sql SQL 语句
   */
  exec(sql: string): void;

  /**
   * 关闭数据库连接
   */
  close(): void;

  /**
   * 执行 PRAGMA 命令
   * @param key PRAGMA 键名
   * @param value 可选的值
   */
  pragma?(key: string, value?: unknown): unknown;

  /**
   * 是否在事务中（只读属性）
   */
  readonly inTransaction: boolean;

  /**
   * 执行事务
   * @param fn 事务函数
   * @returns 事务函数的返回值
   */
  transaction<T>(fn: () => T): T;

  /**
   * 检测是否支持 FTS5 全文搜索
   */
  isFTS5Supported(): boolean;

  /**
   * 获取数据库文件路径
   */
  readonly dbPath: string;
}

/**
 * 数据库适配器类型
 */
export type DatabaseAdapterType = 'better-sqlite3' | 'sql.js';

/**
 * 数据库适配器配置
 */
export interface DatabaseAdapterConfig {
  /** 数据库文件路径 */
  dbPath: string;
  /** 强制指定适配器类型 */
  type?: DatabaseAdapterType;
  /** 是否只读模式 */
  readonly?: boolean;
  /** 是否启用详细日志 */
  verbose?: boolean;
}