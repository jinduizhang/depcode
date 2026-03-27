/**
 * Database Schema Definitions
 * 
 * 定义 depcode 数据库的表结构和索引。
 * 使用 SQLite 作为存储后端，支持 FTS5 全文搜索。
 */

// ==================== 依赖表 ====================

export const CREATE_DEPS_TABLE = `
CREATE TABLE IF NOT EXISTS deps (
  id TEXT PRIMARY KEY,           -- groupId:artifactId:version
  group_id TEXT NOT NULL,
  artifact_id TEXT NOT NULL,
  version TEXT NOT NULL,
  type TEXT DEFAULT 'internal',  -- internal | third-party
  status TEXT DEFAULT 'pending', -- pending | decompiling | indexed | error
  jar_path TEXT,                 -- JAR 文件路径
  cache_path TEXT,               -- 反编译缓存路径
  class_count INTEGER DEFAULT 0,
  method_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`;

// ==================== 类表 ====================

export const CREATE_CLASSES_TABLE = `
CREATE TABLE IF NOT EXISTS classes (
  id TEXT PRIMARY KEY,           -- 全限定类名
  dep_id TEXT NOT NULL,          -- 所属依赖
  simple_name TEXT NOT NULL,     -- 简单类名
  package TEXT,                  -- 包名
  type TEXT DEFAULT 'class',     -- class | interface | enum | annotation
  modifiers TEXT,                -- JSON 数组
  super_class TEXT,              -- 父类
  interfaces TEXT,               -- JSON 数组
  source_path TEXT,              -- 源码路径
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (dep_id) REFERENCES deps(id)
);
`;

// ==================== 方法表 ====================

export const CREATE_METHODS_TABLE = `
CREATE TABLE IF NOT EXISTS methods (
  id TEXT PRIMARY KEY,           -- className#methodName(signature)
  class_id TEXT NOT NULL,
  name TEXT NOT NULL,
  return_type TEXT,
  params TEXT,                   -- JSON 数组
  modifiers TEXT,                -- JSON 数组
  signature TEXT,                -- 完整签名
  line_start INTEGER,
  line_end INTEGER,
  FOREIGN KEY (class_id) REFERENCES classes(id)
);
`;

// ==================== 字段表 ====================

export const CREATE_FIELDS_TABLE = `
CREATE TABLE IF NOT EXISTS fields (
  id TEXT PRIMARY KEY,           -- className#fieldName
  class_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  modifiers TEXT,
  FOREIGN KEY (class_id) REFERENCES classes(id)
);
`;

// ==================== 源码 FTS 虚拟表 ====================

export const CREATE_SOURCES_FTS_TABLE = `
CREATE VIRTUAL TABLE IF NOT EXISTS sources_fts USING fts5(
  class_id,                      -- 类 ID
  class_name,                    -- 类名
  source,                        -- 源码内容
  content='classes',
  content_rowid='rowid',
  tokenize='porter unicode61'
);
`;

// ==================== 版本表（用于迁移） ====================

export const CREATE_VERSION_TABLE = `
CREATE TABLE IF NOT EXISTS _version (
  version INTEGER PRIMARY KEY,
  applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`;

// ==================== 索引定义 ====================

export const CREATE_INDEXES = [
  `CREATE INDEX IF NOT EXISTS idx_deps_group_id ON deps(group_id);`,
  `CREATE INDEX IF NOT EXISTS idx_deps_artifact_id ON deps(artifact_id);`,
  `CREATE INDEX IF NOT EXISTS idx_deps_type ON deps(type);`,
  `CREATE INDEX IF NOT EXISTS idx_deps_status ON deps(status);`,
  
  `CREATE INDEX IF NOT EXISTS idx_classes_name ON classes(simple_name);`,
  `CREATE INDEX IF NOT EXISTS idx_classes_package ON classes(package);`,
  `CREATE INDEX IF NOT EXISTS idx_classes_dep_id ON classes(dep_id);`,
  `CREATE INDEX IF NOT EXISTS idx_classes_type ON classes(type);`,
  
  `CREATE INDEX IF NOT EXISTS idx_methods_name ON methods(name);`,
  `CREATE INDEX IF NOT EXISTS idx_methods_class_id ON methods(class_id);`,
  
  `CREATE INDEX IF NOT EXISTS idx_fields_name ON fields(name);`,
  `CREATE INDEX IF NOT EXISTS idx_fields_class_id ON fields(class_id);`,
];

// ==================== 完整 Schema ====================

/**
 * 所有表的创建语句
 */
export const CREATE_TABLES = [
  CREATE_VERSION_TABLE,
  CREATE_DEPS_TABLE,
  CREATE_CLASSES_TABLE,
  CREATE_METHODS_TABLE,
  CREATE_FIELDS_TABLE,
  CREATE_SOURCES_FTS_TABLE,
];

/**
 * 当前 Schema 版本
 */
export const SCHEMA_VERSION = 1;

// ==================== 触发器（用于 FTS 同步） ====================

export const CREATE_FTS_TRIGGERS = `
-- 插入时同步到 FTS
CREATE TRIGGER IF NOT EXISTS fts_insert AFTER INSERT ON classes BEGIN
  INSERT INTO sources_fts(rowid, class_id, class_name, source)
  VALUES (NEW.rowid, NEW.id, NEW.simple_name, '');
END;

-- 删除时从 FTS 移除
CREATE TRIGGER IF NOT EXISTS fts_delete AFTER DELETE ON classes BEGIN
  INSERT INTO sources_fts(sources_fts, rowid, class_id, class_name, source)
  VALUES ('delete', OLD.rowid, OLD.id, OLD.simple_name, '');
END;

-- 更新时同步到 FTS
CREATE TRIGGER IF NOT EXISTS fts_update AFTER UPDATE ON classes BEGIN
  INSERT INTO sources_fts(sources_fts, rowid, class_id, class_name, source)
  VALUES ('delete', OLD.rowid, OLD.id, OLD.simple_name, '');
  INSERT INTO sources_fts(rowid, class_id, class_name, source)
  VALUES (NEW.rowid, NEW.id, NEW.simple_name, '');
END;
`;