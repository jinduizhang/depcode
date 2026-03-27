/**
 * init 命令 - 初始化项目，扫描依赖
 */

import * as fs from 'fs';
import * as path from 'path';
import { 
  createDatabaseAdapter, 
  createStorageService, 
  DepRepository 
} from '@depcode/core';
import { resolveMavenDeps } from '../resolver/maven.js';

export interface InitOptions {
  project: string;
  format: string;
  scanDepth: string;
}

export async function initCommand(options: InitOptions) {
  const { project, format } = options;
  
  console.log(`\n🚀 Initializing project: ${project}\n`);

  // 1. 检测项目类型
  const projectType = detectProjectType(project, format);
  console.log(`   Project type: ${projectType}`);

  // 2. 创建 .depcode 目录
  const depcodeDir = path.join(project, '.depcode');
  if (!fs.existsSync(depcodeDir)) {
    fs.mkdirSync(depcodeDir, { recursive: true });
    console.log(`   Created: ${depcodeDir}`);
  }

  // 3. 初始化数据库
  const dbPath = path.join(depcodeDir, 'index.db');
  const adapter = await createDatabaseAdapter({ dbPath, verbose: true });
  const storage = await createStorageService(adapter, true, true);
  console.log(`   Database: ${dbPath}`);

  // 4. 解析依赖
  const depRepo = new DepRepository(storage);
  let deps: Array<{
    groupId: string;
    artifactId: string;
    version: string;
    type: 'internal' | 'third-party';
  }> = [];

  switch (projectType) {
    case 'maven':
      deps = await resolveMavenDeps(project);
      break;
    case 'gradle':
      console.log('   ⚠ Gradle support coming soon');
      break;
    case 'npm':
      console.log('   ⚠ NPM support coming soon');
      break;
  }

  // 5. 保存依赖到数据库
  console.log(`\n   Found ${deps.length} dependencies:\n`);
  
  for (const dep of deps) {
    depRepo.save({
      id: `${dep.groupId}:${dep.artifactId}:${dep.version}`,
      groupId: dep.groupId,
      artifactId: dep.artifactId,
      version: dep.version,
      type: dep.type,
    });
    console.log(`   - ${dep.groupId}:${dep.artifactId}:${dep.version} (${dep.type})`);
  }

  // 6. 生成配置文件
  const config = {
    version: '1.0',
    project: {
      name: path.basename(project),
      type: projectType,
      path: project,
    },
    createdAt: new Date().toISOString(),
  };
  
  fs.writeFileSync(
    path.join(depcodeDir, 'config.json'),
    JSON.stringify(config, null, 2)
  );

  // 7. 生成依赖清单
  fs.writeFileSync(
    path.join(depcodeDir, 'deps.json'),
    JSON.stringify(deps, null, 2)
  );

  storage.close();

  console.log(`\n✅ Project initialized successfully!\n`);
  console.log(`   Dependencies found: ${deps.length}`);
  console.log(`   Internal deps: ${deps.filter(d => d.type === 'internal').length}\n`);
  console.log(`   Next steps:`);
  console.log(`   1. Run 'depcode build' to decompile JARs and build index`);
  console.log(`   2. Run 'depcode mcp' to start MCP server\n`);
}

/**
 * 检测项目类型
 */
function detectProjectType(projectPath: string, format: string): string {
  if (format !== 'auto') {
    return format;
  }

  if (fs.existsSync(path.join(projectPath, 'pom.xml'))) {
    return 'maven';
  }
  if (fs.existsSync(path.join(projectPath, 'build.gradle')) || 
      fs.existsSync(path.join(projectPath, 'build.gradle.kts'))) {
    return 'gradle';
  }
  if (fs.existsSync(path.join(projectPath, 'package.json'))) {
    return 'npm';
  }

  return 'unknown';
}