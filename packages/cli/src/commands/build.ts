/**
 * build 命令 - 完整构建流程
 * 
 * 执行: 解析依赖 → 定位JAR → 反编译 → 索引
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
import { resolveMavenDeps } from '../resolver/maven.js';
import { locateJar, getMavenLocalRepo, downloadJar } from '../resolver/jar-locator.js';
import { decompileJar, isJavaAvailable } from '../decompiler/cfr.js';

export interface BuildOptions {
  project: string;
  format: string;
  download?: boolean;
  verbose?: boolean;
}

export async function buildCommand(options: BuildOptions) {
  const { project, format, download, verbose } = options;
  
  console.log(`\n🔨 Building depcode index for: ${project}\n`);

  // 1. 检测项目类型
  const projectType = detectProjectType(project, format);
  console.log(`   Project type: ${projectType}`);

  // 2. 创建 .depcode 目录
  const depcodeDir = path.join(project, '.depcode');
  if (!fs.existsSync(depcodeDir)) {
    fs.mkdirSync(depcodeDir, { recursive: true });
  }

  // 3. 初始化数据库
  const dbPath = path.join(depcodeDir, 'index.db');
  const adapter = await createDatabaseAdapter({ dbPath, verbose });
  const storage = await createStorageService(adapter, true, verbose);
  console.log(`   Database: ${dbPath}`);

  // 4. 解析依赖
  const depRepo = new DepRepository(storage);
  const classRepo = new ClassRepository(storage);
  const methodRepo = new MethodRepository(storage);
  const sourceRepo = new SourceRepository(storage);

  let deps: Array<{
    groupId: string;
    artifactId: string;
    version: string;
    type: 'internal' | 'third-party';
  }> = [];

  if (projectType === 'maven') {
    deps = await resolveMavenDeps(project);
  }

  console.log(`\n   Found ${deps.length} dependencies\n`);

  // 5. 筛选内部二方件
  const internalDeps = deps.filter(d => d.type === 'internal');
  console.log(`   Internal dependencies: ${internalDeps.length}\n`);

  if (internalDeps.length === 0) {
    console.log('   ⚠️ No internal dependencies found.');
    console.log('   Configure internalGroupPrefixes in .depcode/config.json\n');
    storage.close();
    return;
  }

  // 6. 检查 Java 环境
  if (!isJavaAvailable()) {
    console.log('   ⚠️ Java not found. JAR decompilation may not work.\n');
  }

  // 7. 处理每个内部二方件
  const cacheDir = path.join(depcodeDir, 'cache');
  const localRepo = getMavenLocalRepo();
  
  let totalClasses = 0;
  let totalMethods = 0;

  for (const dep of internalDeps) {
    const depId = `${dep.groupId}:${dep.artifactId}:${dep.version}`;
    console.log(`\n📦 Processing: ${depId}`);

    // 7.1 定位 JAR
    let jarLocation = locateJar(dep.groupId, dep.artifactId, dep.version, localRepo);
    
    if (!jarLocation.exists) {
      if (download) {
        console.log(`   Downloading JAR...`);
        const downloaded = await downloadJar(dep.groupId, dep.artifactId, dep.version);
        if (downloaded) {
          jarLocation = locateJar(dep.groupId, dep.artifactId, dep.version, localRepo);
        }
      }
      
      if (!jarLocation.exists) {
        console.log(`   ⚠️ JAR not found in local repository`);
        console.log(`   Run: mvn dependency:get -DgroupId=${dep.groupId} -DartifactId=${dep.artifactId} -Dversion=${dep.version}`);
        continue;
      }
    }

    console.log(`   JAR: ${jarLocation.jarPath}`);

    // 7.2 保存依赖信息
    depRepo.save({
      id: depId,
      groupId: dep.groupId,
      artifactId: dep.artifactId,
      version: dep.version,
      type: dep.type,
      jarPath: jarLocation.jarPath ?? undefined,
    });
    depRepo.updateStatus(depId, 'decompiling');

    // 7.3 反编译 JAR
    const outputDir = path.join(cacheDir, dep.groupId, `${dep.artifactId}-${dep.version}`);
    console.log(`   Decompiling to: ${outputDir}`);

    const result = await decompileJar(jarLocation.jarPath!, outputDir);
    
    if (!result.success) {
      console.log(`   ❌ Decompilation failed: ${result.error}`);
      depRepo.updateStatus(depId, 'error');
      continue;
    }

    console.log(`   ✓ Decompiled ${result.classCount} classes`);

    // 7.4 解析并索引源码
    console.log(`   Indexing...`);
    const javaFiles = findJavaFiles(outputDir);
    let classCount = 0;
    let methodCount = 0;

    for (const javaFile of javaFiles) {
      try {
        const content = fs.readFileSync(javaFile, 'utf-8');
        const classInfo = parseJavaFile(javaFile, depId, content);
        
        if (classInfo) {
          classRepo.save(classInfo);
          classCount++;

          const methods = extractMethods(content, classInfo.id);
          for (const method of methods) {
            methodRepo.save(method);
            methodCount++;
          }
        }
      } catch {
        // 忽略解析错误
      }
    }

    // 7.5 更新统计
    depRepo.updateStats(depId, classCount, methodCount, outputDir);
    console.log(`   ✓ Indexed ${classCount} classes, ${methodCount} methods`);
    
    totalClasses += classCount;
    totalMethods += methodCount;
  }

  // 8. 生成配置
  const config = {
    version: '1.0',
    project: {
      name: path.basename(project),
      type: projectType,
      path: project,
    },
    internalGroupPrefixes: getDefaultInternalPrefixes(),
    createdAt: new Date().toISOString(),
  };
  
  fs.writeFileSync(
    path.join(depcodeDir, 'config.json'),
    JSON.stringify(config, null, 2)
  );

  storage.close();

  // 9. 输出总结
  console.log(`\n✅ Build complete!\n`);
  console.log(`   Summary:`);
  console.log(`   - Internal deps: ${internalDeps.length}`);
  console.log(`   - Classes: ${totalClasses}`);
  console.log(`   - Methods: ${totalMethods}`);
  console.log(`\n   Next steps:`);
  console.log(`   - Run 'depcode mcp' to start MCP server`);
  console.log(`   - Use search_class tool to find classes\n`);
}

/**
 * 检测项目类型
 */
function detectProjectType(projectPath: string, format: string): string {
  if (format !== 'auto') return format;
  
  if (fs.existsSync(path.join(projectPath, 'pom.xml'))) return 'maven';
  if (fs.existsSync(path.join(projectPath, 'build.gradle'))) return 'gradle';
  if (fs.existsSync(path.join(projectPath, 'package.json'))) return 'npm';
  
  return 'unknown';
}

/**
 * 获取默认内部二方件前缀
 */
function getDefaultInternalPrefixes(): string[] {
  return [
    'com.alibaba',
    'com.huawei',
    'com.tencent',
    'com.baidu',
    'com.dianping',
    'com.meituan',
  ];
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
  const packageMatch = content.match(/package\s+([\w.]+)\s*;/);
  const packageName = packageMatch?.[1] ?? '';

  const classMatch = content.match(/(?:public\s+)?(?:abstract\s+)?(?:class|interface|enum)\s+(\w+)/);
  const simpleName = classMatch?.[1];

  if (!simpleName) return null;

  let type: ClassType = 'class';
  if (content.includes('interface ' + simpleName)) type = 'interface';
  else if (content.includes('enum ' + simpleName)) type = 'enum';

  const id = packageName ? `${packageName}.${simpleName}` : simpleName;

  return { id, depId, simpleName, packageName, type };
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

  const methodRegex = /(?:public|private|protected)?\s*(?:static)?\s*(?:\w+(?:<[^>]+>)?)\s+(\w+)\s*\([^)]*\)/g;
  let match;

  while ((match = methodRegex.exec(content)) !== null) {
    const name = match[1];
    if (['if', 'for', 'while', 'switch', 'catch', 'class', 'interface', 'new'].includes(name)) {
      continue;
    }

    methods.push({
      id: `${classId}#${name}`,
      classId,
      name,
      signature: match[0],
    });
  }

  return methods;
}