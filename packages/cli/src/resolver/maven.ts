/**
 * Maven 依赖解析器
 */

import * as fs from 'fs';
import * as path from 'path';

export interface MavenDependency {
  groupId: string;
  artifactId: string;
  version: string;
  type: 'internal' | 'third-party';
}

interface ParsedPom {
  properties: Record<string, string>;
  dependencies: {
    dependency: Array<{
      groupId?: string[];
      artifactId?: string[];
      version?: string[];
    }>;
  };
}

/**
 * 解析 Maven pom.xml 获取依赖列表
 */
export async function resolveMavenDeps(projectPath: string): Promise<MavenDependency[]> {
  const pomPath = path.join(projectPath, 'pom.xml');
  
  if (!fs.existsSync(pomPath)) {
    throw new Error(`pom.xml not found at ${pomPath}`);
  }

  const pomContent = fs.readFileSync(pomPath, 'utf-8');
  const pom = await parsePom(pomContent);

  // 内部二方件的组织 ID 前缀（可配置）
  const internalGroupPrefixes = getInternalGroupPrefixes(projectPath);

  const deps: MavenDependency[] = [];

  // 解析 dependencies
  if (pom.dependencies?.dependency) {
    for (const dep of pom.dependencies.dependency) {
      const groupId = dep.groupId?.[0] ?? '';
      const artifactId = dep.artifactId?.[0] ?? '';
      const version = resolveVersion(dep.version?.[0], pom);

      if (groupId && artifactId && version) {
        deps.push({
          groupId,
          artifactId,
          version,
          type: isInternal(groupId, internalGroupPrefixes) ? 'internal' : 'third-party',
        });
      }
    }
  }

  return deps;
}

/**
 * 解析 pom.xml
 */
async function parsePom(content: string): Promise<ParsedPom> {
  // 简单的正则解析（避免引入 xml2js 依赖）
  const properties: Record<string, string> = {};
  const propsMatch = content.match(/<properties>([\s\S]*?)<\/properties>/);
  if (propsMatch) {
    const propRegex = /<(\w+)>([^<]*)<\/\1>/g;
    let match;
    while ((match = propRegex.exec(propsMatch[1])) !== null) {
      properties[match[1]] = match[2];
    }
  }

  // 提取 dependencies
  const deps: Array<{
    groupId?: string[];
    artifactId?: string[];
    version?: string[];
  }> = [];
  const depsMatch = content.match(/<dependencies>([\s\S]*?)<\/dependencies>/);
  if (depsMatch) {
    const depRegex = /<dependency>([\s\S]*?)<\/dependency>/g;
    let depMatch;
    while ((depMatch = depRegex.exec(depsMatch[1])) !== null) {
      const depContent = depMatch[1];
      const dep: { groupId?: string[]; artifactId?: string[]; version?: string[] } = {};
      
      const groupIdMatch = depContent.match(/<groupId>([^<]*)<\/groupId>/);
      if (groupIdMatch) dep.groupId = [groupIdMatch[1]];
      
      const artifactIdMatch = depContent.match(/<artifactId>([^<]*)<\/artifactId>/);
      if (artifactIdMatch) dep.artifactId = [artifactIdMatch[1]];
      
      const versionMatch = depContent.match(/<version>([^<]*)<\/version>/);
      if (versionMatch) dep.version = [versionMatch[1]];
      
      deps.push(dep);
    }
  }

  return {
    properties,
    dependencies: { dependency: deps },
  };
}

/**
 * 解析版本号（处理属性引用）
 */
function resolveVersion(version: string | undefined, pom: ParsedPom): string {
  if (!version) return '';
  
  // 处理 ${property} 格式
  if (version.startsWith('${') && version.endsWith('}')) {
    const propName = version.slice(2, -1);
    return pom.properties?.[propName] ?? version;
  }
  
  return version;
}

/**
 * 获取内部二方件的组织 ID 前缀
 */
function getInternalGroupPrefixes(projectPath: string): string[] {
  // 尝试从配置文件读取
  const configPath = path.join(projectPath, '.depcode', 'config.json');
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    return config.internalGroupPrefixes ?? [];
  }
  
  // 默认值（可配置）
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
 * 判断是否为内部二方件
 */
function isInternal(groupId: string, prefixes: string[]): boolean {
  return prefixes.some(prefix => groupId.startsWith(prefix));
}