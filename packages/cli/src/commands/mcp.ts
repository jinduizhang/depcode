/**
 * mcp 命令 - 启动 MCP 服务
 */

import * as fs from 'fs';
import * as path from 'path';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { 
  createDatabaseAdapter, 
  createStorageService, 
  DepRepository,
  ClassRepository,
  MethodRepository,
  SourceRepository,
  type Dep
} from '@depcode/core';

export interface McpOptions {
  transport: string;
  port: string;
}

export async function mcpCommand(options: McpOptions) {
  const { transport } = options;
  
  console.error('🚀 Starting depcode MCP server...\n');

  // 获取项目路径
  const projectPath = process.cwd();
  const depcodeDir = path.join(projectPath, '.depcode');
  const dbPath = path.join(depcodeDir, 'index.db');
  
  if (!fs.existsSync(dbPath)) {
    console.error('❌ Project not initialized. Run "depcode init" first.\n');
    process.exit(1);
  }

  // 打开数据库
  const adapter = await createDatabaseAdapter({ dbPath });
  const storage = await createStorageService(adapter, false, false);
  const depRepo = new DepRepository(storage);
  const classRepo = new ClassRepository(storage);
  const methodRepo = new MethodRepository(storage);
  const sourceRepo = new SourceRepository(storage);

  // 创建 MCP 服务器
  const server = new Server(
    {
      name: 'depcode',
      version: '0.1.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // 注册工具列表
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'resolve_dep',
          description: '解析依赖标识，获取依赖信息',
          inputSchema: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
                description: '依赖名或 groupId:artifactId',
              },
              version: {
                type: 'string',
                description: '版本号（可选）',
              },
            },
            required: ['name'],
          },
        },
        {
          name: 'search_class',
          description: '搜索类',
          inputSchema: {
            type: 'object',
            properties: {
              pattern: {
                type: 'string',
                description: '类名模式（支持通配符 *）',
              },
              depId: {
                type: 'string',
                description: '限定依赖 ID（可选）',
              },
            },
            required: ['pattern'],
          },
        },
        {
          name: 'search_method',
          description: '搜索方法',
          inputSchema: {
            type: 'object',
            properties: {
              pattern: {
                type: 'string',
                description: '方法名模式',
              },
              classId: {
                type: 'string',
                description: '限定类 ID（可选）',
              },
            },
            required: ['pattern'],
          },
        },
        {
          name: 'get_source',
          description: '获取源码',
          inputSchema: {
            type: 'object',
            properties: {
              classId: {
                type: 'string',
                description: '类 ID',
              },
            },
            required: ['classId'],
          },
        },
        {
          name: 'get_dep_tree',
          description: '获取依赖树',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
      ],
    };
  });

  // 注册工具调用处理
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    switch (name) {
      case 'resolve_dep': {
        const { name: depName } = args as { name: string };
        const dep = depRepo.findById(depName) ?? 
          depRepo.findAll().find(d => 
            d.artifactId === depName || d.id.includes(depName)
          );
        
        if (!dep) {
          return {
            content: [{ type: 'text', text: `Dependency not found: ${depName}` }],
          };
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify(dep, null, 2),
          }],
        };
      }

      case 'search_class': {
        const { pattern, depId } = args as { pattern: string; depId?: string };
        const classes = classRepo.search(pattern, depId);
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(classes, null, 2),
          }],
        };
      }

      case 'search_method': {
        const { pattern, classId } = args as { pattern: string; classId?: string };
        const methods = methodRepo.search(pattern, classId);
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(methods, null, 2),
          }],
        };
      }

      case 'get_source': {
        const { classId } = args as { classId: string };
        const source = sourceRepo.findById(classId);
        
        if (!source) {
          return {
            content: [{ type: 'text', text: `Source not found: ${classId}` }],
          };
        }

        return {
          content: [{
            type: 'text',
            text: source.source,
          }],
        };
      }

      case 'get_dep_tree': {
        const deps = depRepo.findAll();
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(deps, null, 2),
          }],
        };
      }

      default:
        return {
          content: [{ type: 'text', text: `Unknown tool: ${name}` }],
        };
    }
  });

  // 启动服务器
  if (transport === 'stdio') {
    const transportInstance = new StdioServerTransport();
    await server.connect(transportInstance);
    console.error('✅ MCP server started (stdio mode)\n');
  } else {
    console.error('⚠️ HTTP transport not implemented yet\n');
    process.exit(1);
  }
}