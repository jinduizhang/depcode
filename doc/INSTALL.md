# 安装指南

本文档介绍如何安装和配置 depcode CLI 工具。

## 系统要求

| 要求 | 说明 |
|------|------|
| **Node.js** | >= 18.0.0 |
| **npm** | >= 9.0.0 或 pnpm >= 8.0.0 |
| **Java** | >= 11 (可选，用于 CFR 反编译) |
| **操作系统** | Windows / macOS / Linux |

## 快速安装

### 1. 克隆仓库

```bash
git clone https://github.com/your-org/depcode.git
cd depcode
```

### 2. 安装依赖

使用 npm:

```bash
npm install
```

或使用 pnpm:

```bash
pnpm install
```

### 3. 构建项目

```bash
npm run build
```

这将构建两个包:
- `@depcode/core` - 核心存储层
- `@depcode/cli` - CLI 命令行工具

### 4. 验证安装

```bash
node packages/cli/dist/index.js --version
```

输出应显示 `0.1.0`。

---

## 全局安装 (可选)

### 方式一: npm link

```bash
cd packages/cli
npm link
```

之后可以直接使用 `depcode` 命令:

```bash
depcode --version
depcode init
```

### 方式二: 全局安装

```bash
npm install -g .
```

---

## 依赖说明

### 核心依赖

| 依赖 | 版本 | 用途 |
|------|------|------|
| `better-sqlite3` | ^11.0.0 | 原生 SQLite (高性能) |
| `sql.js` | ^1.10.0 | WASM SQLite (跨平台回退) |
| `commander` | ^12.0.0 | CLI 框架 |
| `@modelcontextprotocol/sdk` | ^1.0.0 | MCP 协议支持 |

### 可选依赖

| 依赖 | 用途 |
|------|------|
| Java JRE | CFR JAR 反编译 |
| tree-sitter | AST 解析 (未来版本) |

---

## 数据库配置

depcode 使用 SQLite 作为本地存储，支持两种后端:

### better-sqlite3 (推荐)

- **优点**: 高性能、原生 C++ 实现
- **支持**: FTS5 全文搜索、完整事务
- **要求**: 需要 C++ 编译环境

**Windows 安装 better-sqlite3:**

```bash
# 安装 Windows 构建工具
npm install -g windows-build-tools

# 或使用预编译版本
npm install better-sqlite3 --build-from-source=false
```

### sql.js (回退方案)

- **优点**: 纯 WASM 实现、零编译依赖
- **支持**: 跨平台兼容
- **限制**: 不支持 FTS5、性能较低

系统会自动选择最佳后端:
1. 优先尝试 `better-sqlite3`
2. 失败则回退到 `sql.js`

---

## 配置内部二方件

depcode 需要知道哪些组织 ID 是内部二方件。默认支持:

```
com.alibaba
com.huawei
com.tencent
com.baidu
com.dianping
com.meituan
```

### 自定义配置

编辑 `.depcode/config.json`:

```json
{
  "version": "1.0",
  "internalGroupPrefixes": [
    "com.your-company",
    "org.your-org"
  ]
}
```

或在 `packages/cli/src/resolver/maven.ts` 中修改默认列表。

---

## 目录结构

安装完成后，项目结构如下:

```
depcode/
├── packages/
│   ├── core/                 # 核心库
│   │   ├── dist/             # 编译输出
│   │   └── src/storage/      # 存储层源码
│   │
│   └── cli/                  # CLI 工具
│       ├── dist/             # 编译输出
│       └── src/              # 源码
│           ├── commands/     # 命令实现
│           ├── resolver/     # 依赖解析
│           └── decompiler/   # 反编译
│
├── doc/                      # 文档
├── package.json
└── tsconfig.json
```

---

## 故障排除

### 问题: better-sqlite3 安装失败

**原因**: 缺少 C++ 编译环境

**解决方案**:

```bash
# Windows
npm install -g windows-build-tools

# macOS
xcode-select --install

# Linux (Ubuntu)
sudo apt-get install build-essential
```

### 问题: Java 反编译失败

**原因**: 未安装 Java 或 CFR JAR 缺失

**解决方案**:

1. 安装 Java JRE 11+
2. 下载 CFR JAR:

```bash
mkdir -p bin
curl -L -o bin/cfr-0.152.jar \
  https://github.com/leibnitz27/cfr/releases/download/0.152/cfr-0.152.jar
```

### 问题: FTS5 不可用

**原因**: SQLite 未编译 FTS5 支持

**解决方案**: 使用 `better-sqlite3` 后端，或接受 `sql.js` 的功能限制

---

## 下一步

- [使用文档](./USAGE.md) - 学习如何使用 depcode
- [设计文档](../DESIGN.md) - 了解架构设计