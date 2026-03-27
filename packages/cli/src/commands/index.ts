/**
 * index 命令 - 构建源码索引
 */

import * as fs from 'fs';
import * as path from 'path';
import { 
  createDatabaseAdapter, 
  createStorageService, 
  DepRepository,
  ClassRepository,
  MethodRepository,
  SourceRepository,
  type ClassType
} from '@depcode/core';

export interface IndexOptions {
  project: string;
  incremental: boolean;
}

export async function indexCommand(options: IndexOptions) {
  const { project, incremental } = options;
  
  console.log(`\n📊 Building index for: ${project}\n`);

  // 检查是否已初始化
  const depcodeDir = path.join(project, '.depcode');
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

  // 获取已索引的依赖
  const indexedDeps = depRepo.findByStatus('indexed');
  console.log(`   Found ${indexedDeps.length} indexed dependencies\n`);

  let totalClasses = 0;
  let totalMethods = 0;
  let totalSources = 0;

  for (const dep of indexedDeps) {
    if (!dep.cachePath) continue;

    console.log(`   📦 Processing: ${dep.id}`);

    // 扫描反编译的 Java 文件
    const javaFiles = findJavaFiles(dep.cachePath);
    console.log(`      Found ${javaFiles.length} Java files`);

    for (const javaFile of javaFiles) {
      try {
        const content = fs.readFileSync(javaFile, 'utf-8');
        const classInfo = parseJavaFile(javaFile, dep.id, content);
        
        if (classInfo) {
          // 保存类信息
          classRepo.save(classInfo);
          totalClasses++;

          // 解析方法
          const methods = extractMethods(content, classInfo.id);
          for (const method of methods) {
            methodRepo.save(method);
            totalMethods++;
          }

          // 索引源码
          if (storage.isFTS5Supported()) {
            sourceRepo.save({
              classId: classInfo.id,
              source: content,
            });
            totalSources++;
          }
        }
      } catch (error) {
        // 忽略解析错误
      }
    }

    // 更新依赖统计
    depRepo.updateStats(dep.id, totalClasses, totalMethods);
  }

  storage.close();

  console.log(`\n   ✅ Index complete!`);
  console.log(`      Classes: ${totalClasses}`);
  console.log(`      Methods: ${totalMethods}`);
  console.log(`      Sources indexed: ${totalSources}\n`);
}

/**
 * 查找 Java 文件
 */
function findJavaFiles(dir: string): string[] {
  const files: string[] = [];

  function walk(currentDir: string) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.name.endsWith('.java')) {
        files.push(fullPath);
      }
    }
  }

  if (fs.existsSync(dir)) {
    walk(dir);
  }

  return files;
}

/**
 * 解析 Java 文件
 */
function parseJavaFile(
  filePath: string, 
  depId: string, 
  content: string
): { id: string; depId: string; simpleName: string; packageName: string; type: ClassType } | null {
  // 提取包名
  const packageMatch = content.match(/package\s+([\w.]+)\s*;/);
  const packageName = packageMatch?.[1] ?? '';

  // 提取类名
  const classMatch = content.match(/(?:public\s+)?(?:abstract\s+)?(?:class|interface|enum)\s+(\w+)/);
  const simpleName = classMatch?.[1];

  if (!simpleName) return null;

  // 确定类型
  let type: ClassType = 'class';
  if (content.includes('interface ' + simpleName)) type = 'interface';
  else if (content.includes('enum ' + simpleName)) type = 'enum';

  const id = packageName ? `${packageName}.${simpleName}` : simpleName;

  return {
    id,
    depId,
    simpleName,
    packageName,
    type,
  };
}

/**
 * 提取方法
 */
function extractMethods(content: string, classId: string): Array<{
  id: string;
  classId: string;
  name: string;
  signature: string;
}> {
  const methods: Array<{
    id: string;
    classId: string;
    name: string;
    signature: string;
  }> = [];

  // 简单的方法提取（正则匹配）
  const methodRegex = /(?:public|private|protected)?\s*(?:static)?\s*(?:\w+(?:<[^>]+>)?)\s+(\w+)\s*\([^)]*\)/g;
  let match;

  while ((match = methodRegex.exec(content)) !== null) {
    const name = match[1];
    // 跳过常见的关键字
    if (['if', 'for', 'while', 'switch', 'catch', 'class', 'interface', 'new'].includes(name)) {
      continue;
    }

    const signature = match[0];
    const id = `${classId}#${name}`;

    methods.push({
      id,
      classId,
      name,
      signature,
    });
  }

  return methods;
}