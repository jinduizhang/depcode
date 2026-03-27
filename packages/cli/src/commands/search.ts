/**
 * search 命令 - 搜索类/方法
 */

import * as fs from 'fs';
import * as path from 'path';
import { 
  createDatabaseAdapter, 
  createStorageService, 
  ClassRepository,
  MethodRepository 
} from '@depcode/core';

export interface SearchOptions {
  type: string;
  dep: string;
  limit: string;
}

export async function searchCommand(query: string, options: SearchOptions) {
  const { type, dep, limit } = options;
  
  console.log(`\n🔍 Searching for: ${query}\n`);

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
  const classRepo = new ClassRepository(storage);
  const methodRepo = new MethodRepository(storage);

  const limitNum = parseInt(limit, 10);

  // 执行搜索
  if (type === 'class' || type === 'all') {
    const allClasses = classRepo.search(query, dep);
    const classes = allClasses.slice(0, limitNum);
    console.log(`   📦 Classes (${classes.length}):\n`);
    for (const cls of classes) {
      console.log(`   - ${cls.id}`);
      console.log(`     Package: ${cls.packageName}`);
      console.log(`     Type: ${cls.type}`);
      console.log(`     Dependency: ${cls.depId}\n`);
    }
  }

  if (type === 'method' || type === 'all') {
    const allMethods = methodRepo.search(query, dep);
    const methods = allMethods.slice(0, limitNum);
    console.log(`   🔧 Methods (${methods.length}):\n`);
    for (const method of methods) {
      console.log(`   - ${method.name}`);
      console.log(`     Signature: ${method.signature}`);
      console.log(`     Class: ${method.classId}\n`);
    }
  }

  storage.close();
}