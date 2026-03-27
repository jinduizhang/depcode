/**
 * status 命令 - 查看状态
 */

import * as fs from 'fs';
import * as path from 'path';
import { 
  createDatabaseAdapter, 
  createStorageService, 
  DepRepository,
  ClassRepository,
  MethodRepository 
} from '@depcode/core';

export interface StatusOptions {
  project: string;
}

export async function statusCommand(options: StatusOptions) {
  const { project } = options;
  
  console.log(`\n📊 Project Status: ${project}\n`);

  // 检查是否已初始化
  const depcodeDir = path.join(project, '.depcode');
  const dbPath = path.join(depcodeDir, 'index.db');
  
  if (!fs.existsSync(dbPath)) {
    console.log('   Status: Not initialized');
    console.log('   Run "depcode init" to initialize the project.\n');
    return;
  }

  // 读取配置
  const configPath = path.join(depcodeDir, 'config.json');
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    console.log(`   Project: ${config.project?.name ?? 'Unknown'}`);
    console.log(`   Type: ${config.project?.type ?? 'Unknown'}`);
    console.log(`   Created: ${config.createdAt ?? 'Unknown'}\n`);
  }

  // 打开数据库
  const adapter = await createDatabaseAdapter({ dbPath });
  const storage = await createStorageService(adapter, false, false);
  const depRepo = new DepRepository(storage);
  const classRepo = new ClassRepository(storage);
  const methodRepo = new MethodRepository(storage);

  // 统计信息
  const allDeps = depRepo.findAll();
  const internalDeps = depRepo.findInternalDeps();
  const indexedDeps = depRepo.findByStatus('indexed');
  const pendingDeps = depRepo.findByStatus('pending');
  const errorDeps = depRepo.findByStatus('error');

  console.log('   Dependencies:');
  console.log(`     Total: ${allDeps.length}`);
  console.log(`     Internal: ${internalDeps.length}`);
  console.log(`     Indexed: ${indexedDeps.length}`);
  console.log(`     Pending: ${pendingDeps.length}`);
  console.log(`     Errors: ${errorDeps.length}\n`);

  console.log('   Index:');
  console.log(`     Classes: ${classRepo.count()}`);
  console.log(`     Methods: ${methodRepo.count()}`);
  console.log(`     FTS5: ${storage.isFTS5Supported() ? 'Enabled' : 'Disabled'}\n`);

  // 显示错误的依赖
  if (errorDeps.length > 0) {
    console.log('   ⚠️  Errors:');
    for (const dep of errorDeps) {
      console.log(`     - ${dep.id}`);
    }
    console.log();
  }

  storage.close();
}