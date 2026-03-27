# depcode

> 二方件源码解析工具 - CLI + MCP Server

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node: >=18](https://img.shields.io/badge/Node-%3E%3D18-green.svg)](https://nodejs.org/)

## 简介

**depcode** 是一个面向企业内部的二方件源码分析工具，帮助开发者：

- 🔍 **识别依赖** - 自动扫描 pom.xml/build.gradle/package.json
- 🔧 **反编译 JAR** - 使用 CFR 反编译为 Java 源码
- 📊 **构建索引** - FTS 全文搜索 + 类/方法/字段索引
- 🤖 **MCP 集成** - 向 AI 助手暴露依赖查询能力

## 快速开始

### 安装

```bash
# 克隆仓库
git clone https://github.com/your-org/depcode.git
cd depcode

# 安装依赖
npm install

# 构建
npm run build
```

### 使用

```bash
cd /path/to/your/maven/project

# 1. 初始化项目（解析依赖）
node /path/to/depcode/packages/cli/dist/index.js init

# 2. 构建索引（定位JAR → 反编译 → 索引）
node /path/to/depcode/packages/cli/dist/index.js build

# 3. 搜索类
node /path/to/depcode/packages/cli/dist/index.js search "JSON" -t class

# 4. 启动 MCP 服务
node /path/to/depcode/packages/cli/dist/index.js mcp
```

## 文档

| 文档 | 说明 |
|------|------|
| [安装指南](./doc/INSTALL.md) | 详细安装步骤和配置 |
| [使用指南](./doc/USAGE.md) | 命令详解和 MCP 集成 |
| [设计文档](./DESIGN.md) | 架构设计和技术细节 |

## 功能特性

### CLI 命令

| 命令 | 说明 |
|------|------|
| `depcode init` | 初始化项目，扫描依赖 |
| `depcode build` | 完整构建：定位JAR → 反编译 → 索引 |
| `depcode analyze` | 分析依赖，生成 SBOM |
| `depcode search` | 搜索类/方法/字段 |
| `depcode status` | 查看项目状态 |
| `depcode mcp` | 启动 MCP 服务 |

### MCP 工具

| 工具 | 说明 |
|------|------|
| `resolve_dep` | 解析依赖标识 |
| `search_class` | 搜索类名，返回类信息 |
| `search_method` | 搜索方法名 |
| `get_source` | **获取源码** - 输入类名返回 JAR 中的源码 |
| `get_dep_tree` | 获取依赖树 |

### 典型使用流程

```bash
# 1. 进入项目目录
cd /path/to/your/project

# 2. 初始化并构建
depcode init      # 解析 pom.xml
depcode build     # 反编译二方件 JAR，构建索引

# 3. 启动 MCP 服务
depcode mcp

# 4. AI 助手可以：
#    - 输入类名 "JSON" → 找到 com.alibaba.fastjson.JSON
#    - 调用 get_source → 返回 2351 行源码
```

## 架构

```
depcode/
├── packages/
│   ├── core/           # 核心库
│   │   └── storage/    # 存储层 (Adapter/Service/Repository)
│   │
│   └── cli/            # CLI 工具
│       ├── commands/   # 命令实现
│       ├── resolver/   # 依赖解析 (Maven)
│       └── decompiler/ # CFR 反编译
│
├── doc/                # 文档
└── DESIGN.md          # 设计文档
```

### 存储层架构

```
┌─────────────────────────────────────────────────────┐
│                   Application                        │
│              (CLI Commands / MCP Tools)              │
└─────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│                   Repository                         │
│  DepRepository | ClassRepository | MethodRepository  │
└─────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│                 StorageService                       │
│           (外观层 - 统一数据访问)                    │
└─────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│                DatabaseAdapter                       │
│  ┌─────────────────┐    ┌─────────────────┐        │
│  │ BetterSqlite    │    │     SqlJs       │        │
│  │ (原生, 高性能)   │    │  (WASM, 回退)   │        │
│  └─────────────────┘    └─────────────────┘        │
└─────────────────────────────────────────────────────┘
```

### 设计模式

| 模式 | 应用位置 |
|------|----------|
| **工厂模式** | DatabaseAdapterFactory |
| **适配器模式** | BetterSqliteAdapter / SqlJsAdapter |
| **外观模式** | StorageService |
| **Repository 模式** | 5 个 Repository 类 |

## 技术栈

| 类别 | 技术 |
|------|------|
| 语言 | TypeScript |
| CLI 框架 | Commander.js |
| 数据库 | SQLite (better-sqlite3 / sql.js) |
| MCP SDK | @modelcontextprotocol/sdk |
| 反编译 | CFR |
| 包管理 | npm / pnpm |

## 支持

- **Maven**: ✅ 支持
- **Gradle**: 🚧 计划中
- **NPM**: 🚧 计划中

## 开发

```bash
# 开发模式
npm run dev

# 构建
npm run build

# 类型检查
npx tsc --noEmit
```

## License

MIT © 2026