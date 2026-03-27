# 使用指南

本文档介绍 depcode CLI 工具的完整使用方法。

## 目录

- [快速开始](#快速开始)
- [命令详解](#命令详解)
- [MCP 集成](#mcp-集成)
- [配置说明](#配置说明)
- [最佳实践](#最佳实践)

---

## 快速开始

### 典型工作流程

```bash
# 1. 进入 Maven 项目目录
cd /path/to/your/project

# 2. 初始化项目（解析 pom.xml）
depcode init

# 3. 构建索引（反编译 JAR → 索引源码）
depcode build

# 4. 搜索类
depcode search "JSON" -t class

# 5. 启动 MCP 服务
depcode mcp
```

### 示例输出

**depcode build:**

```
🔨 Building depcode index for: /path/to/project

   Project type: maven
   Database: /path/to/project/.depcode/index.db

   Found 4 dependencies
   Internal dependencies: 1

📦 Processing: com.alibaba:fastjson:2.0.43
   JAR: ~/.m2/repository/com/alibaba/fastjson/2.0.43/fastjson-2.0.43.jar
   Decompiling to: .depcode/cache/com.alibaba/fastjson-2.0.43
   ✓ Decompiled 92 classes
   Indexing...
   ✓ Indexed 92 classes, 1015 methods

✅ Build complete!

   Summary:
   - Internal deps: 1
   - Classes: 92
   - Methods: 1015
```

---

## 命令详解

### `depcode init`

初始化项目，扫描依赖。

```bash
depcode init [options]
```

**选项:**

| 选项 | 简写 | 默认值 | 说明 |
|------|------|--------|------|
| `--project <path>` | `-p` | 当前目录 | 项目路径 |
| `--format <type>` | `-f` | `auto` | 项目类型 (maven/gradle/npm/auto) |

**输出文件:**

```
.depcode/
├── config.json    # 项目配置
├── deps.json      # 依赖清单
└── index.db       # SQLite 数据库
```

---

### `depcode build` ⭐ 核心命令

完整构建流程：定位 JAR → 反编译 → 索引

```bash
depcode build [options]
```

**选项:**

| 选项 | 默认值 | 说明 |
|------|--------|------|
| `--project <path>` | 当前目录 | 项目路径 |
| `--format <type>` | `auto` | 项目类型 |
| `--download` | `false` | 自动下载缺失的 JAR |
| `--verbose` | `false` | 详细输出 |

**流程:**

1. 解析 pom.xml 获取依赖列表
2. 从 Maven 本地仓库定位 JAR 文件
3. 使用 CFR 反编译 JAR 为 Java 源码
4. 解析源码，索引类/方法/字段
5. 存储到 SQLite 数据库

**输出:**

```
.depcode/
├── cache/                      # 反编译缓存
│   └── com.alibaba/
│       └── fastjson-2.0.43/
│           └── **/*.java       # 反编译源码
├── config.json
├── deps.json
└── index.db
```

---

### `depcode analyze`

分析依赖，生成 SBOM。

```bash
depcode analyze [options]
```

**选项:**

| 选项 | 默认值 | 说明 |
|------|--------|------|
| `--project <path>` | 当前目录 | 项目路径 |
| `--sbom` | `true` | 生成 SBOM |
| `--sbom-format <fmt>` | `cyclonedx` | SBOM 格式 |

---

### `depcode index`

构建源码索引（增量更新）。

```bash
depcode index [options]
```

---

### `depcode search`

搜索类/方法/字段。

```bash
depcode search <query> [options]
```

**选项:**

| 选项 | 简写 | 默认值 | 说明 |
|------|------|--------|------|
| `--type <type>` | `-t` | `all` | 搜索类型 (class/method/field/all) |
| `--dep <name>` | `-d` | - | 限定依赖 |
| `--limit <n>` | `-n` | `20` | 结果数量 |

**示例:**

```bash
# 搜索类
depcode search "JSON" -t class

# 搜索方法
depcode search "parseObject" -t method
```

---

### `depcode status`

查看项目状态。

```bash
depcode status
```

**输出:**

```
📊 Project Status: /path/to/project

   Dependencies:
     Total: 4
     Internal: 1
     Indexed: 1
     Pending: 0

   Index:
     Classes: 92
     Methods: 1015
```

---

### `depcode mcp`

启动 MCP (Model Context Protocol) 服务或生成配置。

```bash
# 启动 MCP 服务（stdio 模式）
depcode mcp

# 输出 MCP 配置 JSON
depcode mcp --config

# 写入配置到 opencode.json
depcode mcp --opencode
```

**选项:**

| 选项 | 说明 |
|------|------|
| `--config` | 输出 MCP 配置 JSON（不启动服务） |
| `--opencode` | 将 MCP 配置写入 opencode.json |
| `--transport <type>` | 传输方式 (stdio/http) |
| `--port <port>` | HTTP 端口 |

---

## MCP 集成

depcode 可以作为 MCP Server 集成到 AI 助手中。

### OpenCode 配置

```bash
# 一键配置（推荐）
depcode mcp --opencode
```

配置将自动写入 `opencode.json`：

```json
{
  "mcp": {
    "depcode": {
      "type": "local",
      "command": ["depcode", "mcp"],
      "enabled": true
    }
  }
}
```

### Claude Desktop 配置

编辑 `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "depcode": {
      "command": "depcode",
      "args": ["mcp"]
    }
  }
}
```

> **注意**: Claude Desktop 需要在项目目录下启动，或配置 `cwd` 参数。

---

### 可用工具

| 工具 | 描述 | 示例 |
|------|------|------|
| `resolve_dep` | 解析依赖标识 | `fastjson` → 返回依赖信息 |
| `search_class` | 搜索类 | `JSON` → 返回匹配的类 |
| `search_method` | 搜索方法 | `parseObject` → 返回匹配的方法 |
| `get_source` | **获取源码** | `com.alibaba.fastjson.JSON` → 返回 2351 行源码 |
| `get_dep_tree` | 获取依赖树 | 返回所有依赖列表 |

### 使用示例

**搜索类:**

```
AI: 帮我找一下 JSON 相关的类

调用: search_class({ pattern: "JSON" })

返回:
- com.alibaba.fastjson.JSON
- com.alibaba.fastjson.JSONArray
- com.alibaba.fastjson.JSONObject
```

**获取源码:**

```
AI: 查看 com.alibaba.fastjson.JSON 的源码

调用: get_source({ classId: "com.alibaba.fastjson.JSON" })

返回: 2351 行 Java 源码
```

---

### 更新索引与重启 MCP

当二方依赖发生变化时（如新增依赖、版本更新），需要重新构建索引并重启 MCP。

#### 完整更新流程

```bash
# 1. 重新扫描依赖
depcode init

# 2. 重新构建索引（反编译 + 索引）
depcode build

# 3. 重启 MCP（见下方方式）
```

#### 重启 MCP 的方式

| 方式 | 操作 | 适用场景 |
|------|------|----------|
| **方式一：重启 AI 客户端** | 关闭 OpenCode/Claude，重新打开 | 推荐，最简单 |
| **方式二：禁用/启用配置** | 修改 `opencode.json` 中 `enabled: false` → `true` | 不想关闭客户端时 |
| **方式三：手动终止进程** | `taskkill /F /PID <PID>`，客户端自动重启 | 进程异常时 |

**方式二详细步骤：**

```json
// 1. 禁用 MCP
{
  "mcp": {
    "depcode": { "enabled": false }
  }
}

// 2. 保存后，再启用
{
  "mcp": {
    "depcode": { "enabled": true }
  }
}
```

**方式三详细步骤：**

```bash
# Windows
tasklist | findstr node      # 查找进程 PID
taskkill /F /PID <PID>       # 终止进程

# macOS/Linux
ps aux | grep depcode
kill -9 <PID>
```

> **注意**: MCP 启动时读取 `.depcode/index.db`，只要数据库更新 + 重启 MCP，AI 就能获取最新数据。

---

## 配置说明

### 项目配置 (.depcode/config.json)

```json
{
  "version": "1.0",
  "project": {
    "name": "my-project",
    "type": "maven",
    "path": "/path/to/project"
  },
  "internalGroupPrefixes": [
    "com.alibaba",
    "com.huawei"
  ],
  "createdAt": "2026-03-27T15:57:25.361Z"
}
```

### 全局配置 (~/.depcode/config.json)

```json
{
  "cacheDir": "~/.depcode/cache",
  "indexDir": "~/.depcode/index",
  "internalGroupPrefixes": [
    "com.alibaba",
    "com.tencent",
    "com.huawei"
  ],
  "decompiler": {
    "engine": "cfr",
    "cfrPath": "~/.depcode/bin/cfr-0.152.jar"
  }
}
```

---

## 最佳实践

### 1. 识别内部二方件

在项目初始化前，配置组织 ID 前缀:

```json
{
  "internalGroupPrefixes": [
    "com.your-company",
    "org.your-org"
  ]
}
```

### 2. 定期更新索引

```bash
# 增量更新
depcode index

# 重新分析
depcode analyze
```

### 3. 使用 MCP 集成

将 depcode 集成到 AI 助手，让 AI 能够:
- 查询依赖信息
- 搜索类和方法
- 获取源码

### 4. 生成 SBOM

定期生成 SBOM 用于安全审计:

```bash
depcode analyze --sbom --sbom-format cyclonedx
```

---

## 常见问题

### Q: 为什么没有识别到内部二方件?

A: 检查 `internalGroupPrefixes` 配置是否包含正确的组织 ID 前缀。

### Q: 反编译失败怎么办?

A: 确保:
1. 已安装 Java JRE 11+
2. JAR 文件路径正确
3. 有足够的磁盘空间

### Q: FTS5 搜索不工作?

A: FTS5 需要 `better-sqlite3` 后端。检查是否正确安装。

### Q: MCP 工具无响应?

A: 确保:
1. 已运行 `depcode init` 初始化项目
2. 数据库文件存在
3. 工作目录正确

---

## 下一步

- [安装文档](./INSTALL.md) - 安装和配置
- [设计文档](../DESIGN.md) - 架构设计