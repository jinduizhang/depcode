# depcode 设计方案

> 二方件源码解析工具 - CLI + MCP Server

## 一、项目概述

### 1.1 项目定位

**depcode** 是一个面向企业内部的二方件源码分析工具，帮助开发者：
- 识别项目依赖的二方件来源
- 反编译 JAR 包获取源码
- 构建可检索的代码索引
- 通过 MCP 协议向 AI 助手提供依赖上下文

### 1.2 核心价值

| 能力 | 描述 |
|------|------|
| **依赖识别** | 扫描 pom.xml/build.gradle/package.json，解析依赖树 |
| **源码反编译** | 使用 CFR/Vineflower 反编译 JAR 为 Java 源码 |
| **结构化索引** | AST 解析 + FTS 索引 + 向量嵌入（可选） |
| **MCP 服务** | 向 AI 助手暴露依赖查询能力 |

### 1.3 与现有工具对比

| 工具 | 定位 | depcode 差异化 |
|------|------|----------------|
| Context7 | 公开库文档索引 | 聚焦**内部二方件**，反编译+AST |
| jadx | Java 反编译器 | 增加**依赖管理+MCP服务** |
| depcheck | 依赖检查 | 增加**源码分析+AI集成** |

---

## 二、架构设计

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                         depcode CLI                              │
├───────────┬───────────┬───────────┬───────────┬─────────────────┤
│   init    │  analyze  │   index   │  search   │    mcp          │
│  初始化   │   分析    │   索引    │   搜索    │   启动服务      │
└───────────┴───────────┴───────────┴───────────┴─────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐    ┌─────────────────┐    ┌───────────────┐
│  依赖解析器   │    │   源码处理器    │    │   索引引擎    │
│               │    │                 │    │               │
│ - Maven       │    │ - JAR反编译     │    │ - FTS索引     │
│ - Gradle      │    │ - AST解析       │    │ - 向量索引    │
│ - NPM         │    │ - 结构提取      │    │ - 符号索引    │
└───────────────┘    └─────────────────┘    └───────────────┘
                              │
                              ▼
                  ┌───────────────────────┐
                  │    本地存储层          │
                  ├───────────────────────┤
                  │ ~/.depcode/           │
                  │ ├── cache/            │  反编译缓存
                  │ │   └── {groupId}/    │
                  │ │       └── {artifactId}-{version}/
                  │ │           └── **/*.java
                  │ ├── index/            │  索引数据
                  │ │   ├── main.db       │  SQLite 主库
                  │ │   └── vectors.db    │  向量索引(可选)
                  │ └── config.json       │  全局配置
                  └───────────────────────┘
                              │
                              ▼
                  ┌───────────────────────┐
                  │   MCP Server          │
                  ├───────────────────────┤
                  │ Tools:                │
                  │ - resolve_dep         │  解析依赖
                  │ - get_source          │  获取源码
                  │ - search_class        │  搜索类
                  │ - search_method       │  搜索方法
                  │ - get_dep_tree        │  依赖树
                  │ - decompile           │  反编译
                  └───────────────────────┘
```

### 2.2 模块划分

```
depcode/
├── packages/
│   ├── cli/                    # CLI 入口
│   │   ├── src/
│   │   │   ├── commands/       # 命令实现
│   │   │   │   ├── init.ts
│   │   │   │   ├── analyze.ts
│   │   │   │   ├── index.ts
│   │   │   │   ├── search.ts
│   │   │   │   └── mcp.ts
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── core/                   # 核心库
│   │   ├── src/
│   │   │   ├── resolver/       # 依赖解析
│   │   │   │   ├── maven.ts
│   │   │   │   ├── gradle.ts
│   │   │   │   └── npm.ts
│   │   │   ├── decompiler/     # 反编译
│   │   │   │   ├── cfr.ts
│   │   │   │   └── vineflower.ts
│   │   │   ├── parser/         # AST 解析
│   │   │   │   ├── java.ts
│   │   │   │   └── typescript.ts
│   │   │   ├── indexer/        # 索引引擎
│   │   │   │   ├── fts.ts
│   │   │   │   ├── vector.ts
│   │   │   │   └── symbol.ts
│   │   │   └── storage/        # 存储层
│   │   │       └── sqlite.ts
│   │   └── package.json
│   │
│   └── mcp-server/             # MCP 服务
│       ├── src/
│       │   ├── server.ts       # MCP 服务入口
│       │   ├── tools/          # MCP 工具
│       │   │   ├── resolve-dep.ts
│       │   │   ├── get-source.ts
│       │   │   ├── search-class.ts
│       │   │   ├── search-method.ts
│       │   │   └── decompile.ts
│       │   └── resources/      # MCP 资源
│       └── package.json
│
├── bin/                        # 二进制工具
│   └── cfr-0.152.jar          # CFR 反编译器
│
├── package.json
├── tsconfig.json
└── README.md
```

---

## 三、CLI 命令设计

### 3.1 命令概览

```bash
depcode <command> [options]

Commands:
  init        初始化项目，扫描依赖
  analyze     分析依赖，生成 SBOM
  index       构建源码索引
  search      搜索类/方法
  mcp         启动 MCP 服务
  status      查看状态
  clean       清理缓存

Options:
  -c, --config <path>   配置文件路径
  -o, --output <path>   输出目录
  -v, --verbose         详细输出
  --no-cache            禁用缓存
```

### 3.2 命令详细设计

#### `depcode init`

```bash
depcode init [options]

Options:
  -p, --project <path>    项目路径 (默认: 当前目录)
  -f, --format <format>   项目类型 (maven|gradle|npm|auto)
  --scan-depth <n>        依赖扫描深度 (默认: 1)

功能:
  1. 检测项目类型
  2. 解析依赖清单
  3. 生成 .depcode/config.json
  4. 创建目录结构

输出:
  .depcode/
  ├── config.json      # 项目配置
  ├── deps.json        # 依赖清单
  └── cache/           # 缓存目录
```

#### `depcode analyze`

```bash
depcode analyze [options]

Options:
  --decompile            是否反编译 JAR (默认: true)
  --sbom                 生成 SBOM (默认: true)
  --sbom-format <fmt>    SBOM 格式 (cyclonedx|spdx)

功能:
  1. 扫描项目依赖
  2. 识别二方件 vs 三方件
  3. 反编译二方件 JAR
  4. 提取类/方法信息
  5. 生成 SBOM

输出:
  .depcode/
  ├── cache/
  │   └── {groupId}/{artifactId}-{version}/
  │       └── **/*.java      # 反编译源码
  ├── sbom.json              # SBOM 文件
  └── analysis.json          # 分析报告
```

#### `depcode index`

```bash
depcode index [options]

Options:
  --vector               启用向量索引
  --embed-model <model>  嵌入模型 (默认: local)
  --incremental          增量索引 (默认: true)

功能:
  1. 解析反编译源码
  2. 提取 AST 结构
  3. 构建 FTS 索引
  4. (可选) 构建向量索引

输出:
  ~/.depcode/index/
  ├── main.db              # SQLite 索引库
  │   ├── deps             # 依赖表
  │   ├── classes          # 类表
  │   ├── methods          # 方法表
  │   ├── fields           # 字段表
  │   └── sources          # 源码表
  └── vectors.db           # 向量索引 (可选)
```

#### `depcode search`

```bash
depcode search <query> [options]

Options:
  -t, --type <type>      搜索类型 (class|method|field|all)
  -d, --dep <name>       限定依赖
  -n, --limit <n>        结果数量 (默认: 20)

Examples:
  depcode search "DiamondClient" -t class
  depcode search "getConfig" -t method -d fastjson
  depcode search "com.alibaba.*" -t class
```

#### `depcode mcp`

```bash
depcode mcp [options]

Options:
  --transport <type>     传输方式 (stdio|http)
  --port <port>          HTTP 端口 (默认: 3000)

功能:
  启动 MCP 服务器，向 AI 助手暴露工具

Examples:
  depcode mcp                              # stdio 模式
  depcode mcp --transport http --port 3000 # HTTP 模式
```

---

## 四、MCP 服务设计

### 4.1 工具列表

| 工具名称 | 描述 | 参数 |
|----------|------|------|
| `resolve_dep` | 解析依赖标识 | `name: string, version?: string` |
| `get_dep_tree` | 获取依赖树 | `projectPath: string` |
| `get_source` | 获取源码 | `className: string` |
| `search_class` | 搜索类 | `pattern: string, depId?: string` |
| `search_method` | 搜索方法 | `pattern: string, depId?: string` |
| `get_class_info` | 获取类信息 | `className: string` |
| `get_method_info` | 获取方法信息 | `className: string, methodName: string` |
| `decompile` | 反编译类 | `className: string, depId: string` |

### 4.2 工具详细设计

#### `resolve_dep`

```typescript
// 输入
{
  name: "fastjson",           // 依赖名或 groupId:artifactId
  version?: "2.0.43"          // 可选版本
}

// 输出
{
  id: "com.alibaba:fastjson:2.0.43",
  groupId: "com.alibaba",
  artifactId: "fastjson",
  version: "2.0.43",
  type: "internal",           // internal | third-party
  status: "indexed",          // pending | decompiling | indexed | error
  classes: 156,               // 类数量
  methods: 1243,              // 方法数量
  path: "~/.depcode/cache/com.alibaba/fastjson-2.0.43"
}
```

#### `get_source`

```typescript
// 输入
{
  className: "com.alibaba.fastjson.JSON"
}

// 输出
{
  className: "com.alibaba.fastjson.JSON",
  source: "package com.alibaba.fastjson;\n\npublic class JSON { ... }",
  lines: 245,
  methods: ["parseObject", "toJSONString", ...],
  fields: ["DEFAULT_PARSER_CONFIG", ...]
}
```

#### `search_class`

```typescript
// 输入
{
  pattern: "*Client*",        // 通配符模式
  depId?: "com.alibaba:*"     // 可选限定
}

// 输出
{
  results: [
    {
      className: "com.alibaba.diamond.client.DiamondClient",
      depId: "com.alibaba:diamond-client:3.8.0",
      type: "class",
      modifiers: ["public"],
      superClass: "java.lang.Object",
      interfaces: ["com.alibaba.diamond.api.DiamondAPI"]
    }
  ],
  total: 15,
  page: 1,
  pageSize: 20
}
```

#### `search_method`

```typescript
// 输入
{
  pattern: "getConfig*",
  depId?: "com.alibaba:diamond-client:*"
}

// 输出
{
  results: [
    {
      className: "com.alibaba.diamond.client.DiamondClient",
      methodName: "getConfig",
      returnType: "String",
      params: [
        { name: "dataId", type: "String" },
        { name: "group", type: "String" }
      ],
      modifiers: ["public"],
      signature: "public String getConfig(String dataId, String group)"
    }
  ],
  total: 8
}
```

### 4.3 MCP 配置示例

```json
// Claude Desktop 配置
{
  "mcpServers": {
    "depcode": {
      "command": "depcode",
      "args": ["mcp"]
    }
  }
}

// Cursor 配置
{
  "mcp.servers": {
    "depcode": {
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

---

## 五、数据模型

### 5.1 数据库 Schema

```sql
-- 依赖表
CREATE TABLE deps (
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

-- 类表
CREATE TABLE classes (
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

-- 方法表
CREATE TABLE methods (
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

-- 字段表
CREATE TABLE fields (
  id TEXT PRIMARY KEY,           -- className#fieldName
  class_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  modifiers TEXT,
  FOREIGN KEY (class_id) REFERENCES classes(id)
);

-- 源码全文索引
CREATE VIRTUAL TABLE sources_fts USING fts5(
  class_id,
  source,
  content='classes',
  content_rowid='rowid'
);

-- 索引
CREATE INDEX idx_classes_name ON classes(simple_name);
CREATE INDEX idx_classes_package ON classes(package);
CREATE INDEX idx_methods_name ON methods(name);
```

### 5.2 配置文件格式

```json
{
  "version": "1.0",
  "project": {
    "name": "my-project",
    "type": "maven",
    "path": "/path/to/project"
  },
  "deps": {
    "cacheDir": "~/.depcode/cache",
    "indexDir": "~/.depcode/index",
    "scanDepth": 2,
    "exclude": ["junit:*", "org.mockito:*"],
    "include": ["com.alibaba:*", "com.huawei:*"]
  },
  "decompiler": {
    "engine": "cfr",
    "cfrPath": "~/.depcode/bin/cfr-0.152.jar"
  },
  "indexer": {
    "fts": true,
    "vector": false
  },
  "mcp": {
    "transport": "stdio",
    "port": 3000
  }
}
```

---

## 六、技术栈选型

| 模块 | 技术选型 | 理由 |
|------|----------|------|
| **语言** | TypeScript | 类型安全、Node生态、MCP官方支持 |
| **CLI框架** | Commander.js | 成熟、功能完善 |
| **MCP SDK** | @modelcontextprotocol/sdk | 官方支持 |
| **数据库** | SQLite + better-sqlite3 | 本地优先、零配置、FTS支持 |
| **向量索引** | sqlite-vec (可选) | 轻量级、无需额外服务 |
| **JAR反编译** | CFR / Vineflower | 你的CFR代码可复用 |
| **Java AST** | tree-sitter-java | 高性能、多语言统一 |
| **包管理** | pnpm monorepo | 模块化管理 |

### 依赖清单

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "commander": "^12.0.0",
    "better-sqlite3": "^11.0.0",
    "tree-sitter": "^0.21.0",
    "tree-sitter-java": "^0.21.0",
    "glob": "^10.0.0",
    "chalk": "^5.0.0",
    "ora": "^8.0.0"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "vitest": "^1.0.0",
    "@types/better-sqlite3": "^7.6.0",
    "@types/node": "^20.0.0"
  }
}
```

---

## 七、实现路线图

### Phase 1: MVP (2-3 周)

| 任务 | 优先级 | 预估时间 |
|------|--------|----------|
| 项目初始化 (monorepo + 配置) | P0 | 1天 |
| CLI 命令框架 | P0 | 1天 |
| Maven 依赖解析 | P0 | 2天 |
| JAR 反编译 (复用CFR代码) | P0 | 2天 |
| SQLite 索引构建 | P0 | 2天 |
| `depcode init` 命令 | P0 | 1天 |
| `depcode analyze` 命令 | P0 | 2天 |
| `depcode index` 命令 | P0 | 2天 |
| MCP Server 基础框架 | P0 | 2天 |
| MCP 工具: `resolve_dep`, `get_source` | P0 | 2天 |

### Phase 2: 增强 (2-3 周)

| 任务 | 优先级 | 预估时间 |
|------|--------|----------|
| Java AST 解析 (tree-sitter) | P0 | 3天 |
| 类/方法/字段提取 | P0 | 2天 |
| FTS 全文搜索 | P0 | 2天 |
| `depcode search` 命令 | P0 | 2天 |
| MCP 工具: `search_class`, `search_method` | P0 | 2天 |
| Gradle 依赖解析 | P1 | 2天 |
| 增量索引 | P1 | 2天 |

### Phase 3: 完善 (1-2 周)

| 任务 | 优先级 | 预估时间 |
|------|--------|----------|
| 向量索引 (可选) | P1 | 3天 |
| HTTP 传输支持 | P1 | 2天 |
| 错误处理与日志 | P0 | 2天 |
| 完整测试 | P0 | 2天 |
| 文档完善 | P1 | 2天 |

---

## 八、与现有 CFR 代码集成

### 8.1 可复用模块

你的 CFR 代码 (`D:\OpenCode\DTAgentCLI\src\utils\cfr.ts`) 可直接复用：

```typescript
// 直接迁移到 depcode/packages/core/src/decompiler/cfr.ts
export {
  decompileJar,
  decompileJars,
  decompileClass,
  extractClassInfo,
  generateIndex,
  saveIndex,
  loadIndex,
  parseJarPath,
  needsDecompile,
  cleanOldVersions,
  findDecompiledFile
} from './cfr';
```

### 8.2 需要增强的部分

| 模块 | 当前状态 | 增强方向 |
|------|----------|----------|
| `extractClassInfo` | 简单正则解析 | 使用 tree-sitter 精确解析 |
| `generateIndex` | 类名→路径映射 | 增加 FTS + 符号索引 |
| 版本管理 | 手动检查 | 自动化 + 过期清理 |

---

## 九、风险与对策

| 风险 | 影响 | 对策 |
|------|------|------|
| 反编译质量不稳定 | 源码可读性差 | 多引擎支持 (CFR + Vineflower) |
| 大型JAR反编译慢 | 用户体验差 | 异步处理 + 进度显示 + 缓存 |
| AST解析复杂 | 开发周期长 | 先用正则快速实现，迭代优化 |
| 向量索引资源消耗大 | 本地运行受限 | 作为可选功能，默认关闭 |
| MCP协议变更 | 兼容性问题 | 使用官方SDK，跟随更新 |

---

## 十、后续扩展方向

1. **多语言支持**: 扩展到 Python、Go、Rust 依赖分析
2. **漏洞扫描**: 集成 OWASP Dependency-Check
3. **许可证合规**: 自动检查依赖许可证
4. **调用关系图**: 构建方法调用图谱
5. **IDE 集成**: VSCode 插件
6. **Web UI**: 可视化依赖和源码浏览器

---

## 附录：参考资源

| 资源 | 链接 |
|------|------|
| Context7 官方文档 | https://context7.com/docs/api-guide |
| MCP 协议规范 | https://modelcontextprotocol.io/docs/learn/architecture |
| JarAnalyzer Engine | https://github.com/jar-analyzer/jar-analyzer-engine |
| Vineflower 反编译器 | https://github.com/Vineflower/vineflower |
| Srclight 代码索引 | https://github.com/srclight/srclight |
| CodeGraphContext | https://github.com/CodeGraphContext/CodeGraphContext |
| tree-sitter | https://tree-sitter.github.io/tree-sitter/ |
| modelcontextprotocol/servers | https://github.com/modelcontextprotocol/servers |