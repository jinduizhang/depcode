#!/usr/bin/env node

/**
 * depcode CLI Entry Point
 * 
 * 二方件源码解析工具命令行入口
 */

import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { buildCommand } from './commands/build.js';
import { analyzeCommand } from './commands/analyze.js';
import { searchCommand } from './commands/search.js';
import { indexCommand } from './commands/index.js';
import { statusCommand } from './commands/status.js';
import { mcpCommand } from './commands/mcp.js';

const program = new Command();

program
  .name('depcode')
  .description('二方件源码解析工具 - Dependency analyzer for internal packages')
  .version('0.1.0');

// 注册命令
program
  .command('init')
  .description('初始化项目，扫描依赖')
  .option('-p, --project <path>', '项目路径', process.cwd())
  .option('-f, --format <format>', '项目类型 (maven|gradle|npm|auto)', 'auto')
  .option('--scan-depth <n>', '依赖扫描深度', '1')
  .action(initCommand);

program
  .command('build')
  .description('完整构建：扫描依赖 → 定位JAR → 反编译 → 索引')
  .option('-p, --project <path>', '项目路径', process.cwd())
  .option('-f, --format <format>', '项目类型 (maven|gradle|npm|auto)', 'auto')
  .option('--download', '自动下载缺失的 JAR', false)
  .option('-v, --verbose', '详细输出', false)
  .action(buildCommand);

program
  .command('analyze')
  .description('分析依赖，反编译二方件')
  .option('-p, --project <path>', '项目路径', process.cwd())
  .option('--decompile', '是否反编译 JAR', true)
  .option('--no-decompile', '不反编译 JAR')
  .option('--sbom', '生成 SBOM', true)
  .option('--sbom-format <format>', 'SBOM 格式 (cyclonedx|spdx)', 'cyclonedx')
  .action(analyzeCommand);

program
  .command('index')
  .description('构建源码索引')
  .option('-p, --project <path>', '项目路径', process.cwd())
  .option('--incremental', '增量索引', true)
  .action(indexCommand);

program
  .command('search <query>')
  .description('搜索类/方法')
  .option('-t, --type <type>', '搜索类型 (class|method|field|all)', 'all')
  .option('-d, --dep <name>', '限定依赖')
  .option('-n, --limit <n>', '结果数量', '20')
  .action(searchCommand);

program
  .command('status')
  .description('查看状态')
  .option('-p, --project <path>', '项目路径', process.cwd())
  .action(statusCommand);

program
  .command('mcp')
  .description('启动 MCP 服务或生成配置')
  .option('--transport <type>', '传输方式 (stdio|http)', 'stdio')
  .option('--port <port>', 'HTTP 端口', '3000')
  .option('--config', '输出 MCP 配置 JSON（不启动服务）', false)
  .option('--opencode', '将 MCP 配置写入 opencode.json', false)
  .action(mcpCommand);

// 解析命令行参数
program.parse();