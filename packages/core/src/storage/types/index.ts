/**
 * Storage Layer - Domain Types
 * 
 * 定义存储层的领域对象类型。
 */

// ==================== 依赖相关类型 ====================

/**
 * 依赖类型
 */
export type DepType = 'internal' | 'third-party';

/**
 * 依赖状态
 */
export type DepStatus = 'pending' | 'decompiling' | 'indexed' | 'error';

/**
 * 依赖信息
 */
export interface Dep {
  /** 唯一标识 (groupId:artifactId:version) */
  id: string;
  /** 组织 ID */
  groupId: string;
  /** 构件 ID */
  artifactId: string;
  /** 版本号 */
  version: string;
  /** 依赖类型 */
  type: DepType;
  /** 状态 */
  status: DepStatus;
  /** JAR 文件路径 */
  jarPath?: string;
  /** 反编译缓存路径 */
  cachePath?: string;
  /** 类数量 */
  classCount: number;
  /** 方法数量 */
  methodCount: number;
  /** 创建时间 */
  createdAt: string;
  /** 更新时间 */
  updatedAt: string;
}

/**
 * 创建依赖的输入
 */
export interface DepInput {
  id: string;
  groupId: string;
  artifactId: string;
  version: string;
  type?: DepType;
  jarPath?: string;
}

// ==================== 类相关类型 ====================

/**
 * 类类型
 */
export type ClassType = 'class' | 'interface' | 'enum' | 'annotation';

/**
 * 类信息
 */
export interface ClassInfo {
  /** 全限定类名 */
  id: string;
  /** 所属依赖 ID */
  depId: string;
  /** 简单类名 */
  simpleName: string;
  /** 包名 */
  packageName: string;
  /** 类类型 */
  type: ClassType;
  /** 修饰符列表 */
  modifiers: string[];
  /** 父类 */
  superClass?: string;
  /** 实现的接口 */
  interfaces: string[];
  /** 源码文件路径 */
  sourcePath?: string;
  /** 创建时间 */
  createdAt: string;
}

/**
 * 创建类信息的输入
 */
export interface ClassInfoInput {
  id: string;
  depId: string;
  simpleName: string;
  packageName: string;
  type?: ClassType;
  modifiers?: string[];
  superClass?: string;
  interfaces?: string[];
  sourcePath?: string;
}

// ==================== 方法相关类型 ====================

/**
 * 方法参数
 */
export interface MethodParam {
  /** 参数名 */
  name: string;
  /** 参数类型 */
  type: string;
}

/**
 * 方法信息
 */
export interface MethodInfo {
  /** 唯一标识 (className#methodName(signature)) */
  id: string;
  /** 所属类 ID */
  classId: string;
  /** 方法名 */
  name: string;
  /** 返回类型 */
  returnType?: string;
  /** 参数列表 */
  params: MethodParam[];
  /** 修饰符列表 */
  modifiers: string[];
  /** 完整签名 */
  signature: string;
  /** 起始行号 */
  lineStart?: number;
  /** 结束行号 */
  lineEnd?: number;
}

/**
 * 创建方法信息的输入
 */
export interface MethodInfoInput {
  id: string;
  classId: string;
  name: string;
  returnType?: string;
  params?: MethodParam[];
  modifiers?: string[];
  signature: string;
  lineStart?: number;
  lineEnd?: number;
}

// ==================== 字段相关类型 ====================

/**
 * 字段信息
 */
export interface FieldInfo {
  /** 唯一标识 (className#fieldName) */
  id: string;
  /** 所属类 ID */
  classId: string;
  /** 字段名 */
  name: string;
  /** 字段类型 */
  type: string;
  /** 修饰符列表 */
  modifiers: string[];
}

/**
 * 创建字段信息的输入
 */
export interface FieldInfoInput {
  id: string;
  classId: string;
  name: string;
  type: string;
  modifiers?: string[];
}

// ==================== 源码相关类型 ====================

/**
 * 源码信息
 */
export interface Source {
  /** 类 ID */
  classId: string;
  /** 源码内容 */
  source: string;
  /** 行数 */
  lines: number;
}

/**
 * 创建源码的输入
 */
export interface SourceInput {
  classId: string;
  source: string;
}

// ==================== 搜索相关类型 ====================

/**
 * FTS 搜索选项
 */
export interface FTSSearchOptions {
  /** 结果数量限制 */
  limit?: number;
  /** 偏移量 */
  offset?: number;
  /** 是否高亮 */
  highlight?: boolean;
  /** 高亮前缀 */
  highlightPrefix?: string;
  /** 高亮后缀 */
  highlightSuffix?: string;
}

/**
 * 搜索结果
 */
export interface SearchResult {
  /** 类 ID */
  classId: string;
  /** 类名 */
  className: string;
  /** 依赖 ID */
  depId: string;
  /** 匹配的片段 */
  snippet?: string;
  /** 相关度分数 */
  rank?: number;
}

/**
 * 行数据（通用）
 */
export type Row = Record<string, unknown>;

// ==================== sql.js 类型声明 ====================

/**
 * sql.js 查询执行结果
 */
export interface SqlJsQueryResult {
  columns: string[];
  values: unknown[][];
}

/**
 * sql.js 数据库实例
 */
export interface SqlJsDatabase {
  run(sql: string, params?: unknown[]): void;
  exec(sql: string): SqlJsQueryResult[];
  export(): Uint8Array;
}