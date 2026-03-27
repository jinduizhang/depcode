/**
 * CFR Java Decompiler utilities
 * 
 * 用于反编译二方件 JAR 包，提取源码
 * 
 * CFR JAR 位置: D:\OpenCode\DTAgentCLI\bin\cfr-0.152.jar
 */

import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';

/**
 * 反编译结果
 */
export interface DecompileResult {
  success: boolean;
  classCount: number;
  outputDir: string;
  error?: string;
}

/**
 * 方法参数信息
 */
export interface ParamInfo {
  name?: string;
  type: string;
}

/**
 * 方法信息
 */
export interface MethodInfo {
  name: string;
  returnType: string;
  params: ParamInfo[];
  isStatic?: boolean;
  isPublic?: boolean;
  isConstructor?: boolean;
}

/**
 * 类信息
 */
export interface ClassInfo {
  className: string;
  packageName: string;
  methods: MethodInfo[];
  fields?: FieldInfo[];
  superClass?: string;
  interfaces?: string[];
}

/**
 * 字段信息
 */
export interface FieldInfo {
  name: string;
  type: string;
  isStatic?: boolean;
}

/**
 * 默认 CFR JAR 路径
 */
const CFR_PATH = 'D:\\OpenCode\\DTAgentCLI\\bin\\cfr-0.152.jar';

/**
 * 获取 CFR JAR 路径
 */
export function getCfrPath(): string {
  // 优先使用环境变量
  if (process.env.DEPICODE_CFR_PATH && fs.existsSync(process.env.DEPICODE_CFR_PATH)) {
    return process.env.DEPICODE_CFR_PATH;
  }
  
  // 使用默认路径
  if (fs.existsSync(CFR_PATH)) {
    return CFR_PATH;
  }
  
  // 查找其他位置
  const searchPaths = [
    path.join(process.cwd(), 'bin', 'cfr-0.152.jar'),
    path.join(process.cwd(), '..', 'bin', 'cfr-0.152.jar'),
    path.join(process.env.USERPROFILE ?? '', '.depcode', 'bin', 'cfr-0.152.jar'),
  ];
  
  for (const searchPath of searchPaths) {
    if (fs.existsSync(searchPath)) {
      return searchPath;
    }
  }
  
  return CFR_PATH; // 返回默认路径，即使不存在
}

/**
 * 检查 CFR 是否可用
 */
export function isCfrAvailable(): boolean {
  return fs.existsSync(getCfrPath());
}

/**
 * 检查 Java 是否可用
 */
export function isJavaAvailable(): boolean {
  try {
    const result = spawn('java', ['-version'], { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/**
 * 反编译整个 JAR 包
 * 
 * @param jarPath JAR 文件路径
 * @param outputDir 输出目录
 * @param cfrPath CFR JAR 路径（可选）
 * @returns 反编译结果
 */
export async function decompileJar(
  jarPath: string,
  outputDir: string,
  cfrPath?: string
): Promise<DecompileResult> {
  const cfr = cfrPath || getCfrPath();
  
  // 检查 CFR
  if (!fs.existsSync(cfr)) {
    return {
      success: false,
      classCount: 0,
      outputDir,
      error: `CFR jar not found: ${cfr}`,
    };
  }
  
  // 检查 JAR
  if (!fs.existsSync(jarPath)) {
    return {
      success: false,
      classCount: 0,
      outputDir,
      error: `JAR file not found: ${jarPath}`,
    };
  }
  
  // 创建输出目录
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  return new Promise((resolve) => {
    const args = ['-jar', cfr, jarPath, '--outputdir', outputDir];
    const child = spawn('java', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    
    let stderr = '';
    
    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        const classCount = countJavaFiles(outputDir);
        resolve({
          success: true,
          classCount,
          outputDir,
        });
      } else {
        resolve({
          success: false,
          classCount: 0,
          outputDir,
          error: `CFR decompilation failed (code ${code}): ${stderr}`,
        });
      }
    });
    
    child.on('error', (error) => {
      resolve({
        success: false,
        classCount: 0,
        outputDir,
        error: `Failed to run CFR: ${error.message}`,
      });
    });
  });
}

/**
 * 反编译指定类
 * 
 * @param className 类的全限定名
 * @param jarPath JAR 文件路径
 * @param outputDir 输出目录
 * @param cfrPath CFR JAR 路径
 */
export async function decompileClass(
  className: string,
  jarPath: string,
  outputDir: string,
  cfrPath?: string
): Promise<string | null> {
  const cfr = cfrPath || getCfrPath();
  
  if (!fs.existsSync(cfr) || !fs.existsSync(jarPath)) {
    return null;
  }
  
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  return new Promise((resolve) => {
    const args = ['-jar', cfr, jarPath, className, '--outputdir', outputDir];
    const child = spawn('java', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        const classFilePath = className.replace(/\./g, path.sep) + '.java';
        const outputFile = path.join(outputDir, classFilePath);
        resolve(fs.existsSync(outputFile) ? outputFile : null);
      } else {
        resolve(null);
      }
    });
    
    child.on('error', () => {
      resolve(null);
    });
  });
}

/**
 * 统计 Java 文件数量
 */
export function countJavaFiles(dir: string): number {
  let count = 0;
  
  function walk(currentDir: string) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.name.endsWith('.java')) {
        count++;
      }
    }
  }
  
  if (fs.existsSync(dir)) {
    walk(dir);
  }
  
  return count;
}

/**
 * 查找反编译后的 Java 文件
 */
export function findJavaFile(className: string, depsDir: string): string | null {
  // 直接构造路径
  const filePath = path.join(depsDir, className.replace(/\./g, path.sep) + '.java');
  if (fs.existsSync(filePath)) {
    return filePath;
  }
  
  return null;
}

/**
 * 从反编译后的源码中提取类信息
 */
export function extractClassInfo(javaFilePath: string): ClassInfo | null {
  if (!fs.existsSync(javaFilePath)) {
    return null;
  }
  
  const content = fs.readFileSync(javaFilePath, 'utf-8');
  
  // 解析包名
  const packageMatch = content.match(/package\s+([\w.]+);/);
  const packageName = packageMatch ? packageMatch[1] : '';
  
  // 解析类名
  const classMatch = content.match(/(?:public\s+)?(?:class|interface|enum)\s+(\w+)/);
  const simpleClassName = classMatch ? classMatch[1] : '';
  const fullClassName = packageName ? `${packageName}.${simpleClassName}` : simpleClassName;
  
  // 解析父类
  const extendsMatch = content.match(/extends\s+([\w.]+)/);
  const superClass = extendsMatch ? extendsMatch[1] : undefined;
  
  // 解析接口
  const implementsMatch = content.match(/implements\s+([\w.,\s]+)/);
  const interfaces = implementsMatch
    ? implementsMatch[1].split(',').map(s => s.trim())
    : undefined;
  
  // 解析方法
  const methods: MethodInfo[] = [];
  const methodRegex = /(?:public|private|protected)?\s*(?:static\s+)?(?:final\s+)?(?:abstract\s+)?(?:<[^>]+>\s+)?([\w.<>\[\]]+)\s+(\w+)\s*\(([^)]*)\)/g;
  let match;
  
  while ((match = methodRegex.exec(content)) !== null) {
    const returnType = match[1];
    const methodName = match[2];
    const paramsStr = match[3];
    
    // 跳过构造方法
    if (returnType === simpleClassName) {
      continue;
    }
    
    // 解析参数
    const params: ParamInfo[] = [];
    if (paramsStr.trim()) {
      const paramPairs = paramsStr.split(',');
      for (const pair of paramPairs) {
        const parts = pair.trim().split(/\s+/);
        if (parts.length >= 2) {
          params.push({ type: parts[0], name: parts[1] });
        } else if (parts.length === 1) {
          params.push({ type: parts[0] });
        }
      }
    }
    
    methods.push({
      name: methodName,
      returnType,
      params,
      isConstructor: methodName === simpleClassName,
      isStatic: content.substring(Math.max(0, match.index - 50), match.index).includes('static'),
      isPublic: content.substring(Math.max(0, match.index - 50), match.index).includes('public'),
    });
  }
  
  return {
    className: fullClassName,
    packageName,
    methods,
    superClass,
    interfaces,
  };
}

/**
 * 生成类名到文件路径的索引
 */
export function generateIndex(depsDir: string): Record<string, string> {
  const index: Record<string, string> = {};
  
  function scanDir(dir: string, relativePath: string) {
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const relPath = relativePath ? path.join(relativePath, item) : item;
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        scanDir(fullPath, relPath);
      } else if (item.endsWith('.java')) {
        const className = relPath
          .replace(/\.java$/, '')
          .split(path.sep)
          .join('.');
        
        index[className] = fullPath;
      }
    }
  }
  
  if (fs.existsSync(depsDir)) {
    scanDir(depsDir, '');
  }
  
  return index;
}