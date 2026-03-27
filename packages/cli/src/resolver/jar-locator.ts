/**
 * JAR 定位器
 * 
 * 从 Maven 本地仓库定位 JAR 文件。
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface JarLocation {
  groupId: string;
  artifactId: string;
  version: string;
  jarPath: string | null;
  sourcePath: string | null;
  exists: boolean;
}

/**
 * 获取 Maven 本地仓库路径
 */
export function getMavenLocalRepo(): string {
  // 优先使用环境变量
  if (process.env.M2_REPO) {
    return process.env.M2_REPO;
  }
  
  // 默认路径
  const homeDir = os.homedir();
  return path.join(homeDir, '.m2', 'repository');
}

/**
 * 构建 JAR 在本地仓库中的路径
 */
export function buildJarPath(
  groupId: string,
  artifactId: string,
  version: string,
  localRepo?: string
): string {
  const repo = localRepo ?? getMavenLocalRepo();
  const groupPath = groupId.replace(/\./g, path.sep);
  return path.join(repo, groupPath, artifactId, version, `${artifactId}-${version}.jar`);
}

/**
 * 构建源码 JAR 在本地仓库中的路径
 */
export function buildSourceJarPath(
  groupId: string,
  artifactId: string,
  version: string,
  localRepo?: string
): string {
  const repo = localRepo ?? getMavenLocalRepo();
  const groupPath = groupId.replace(/\./g, path.sep);
  return path.join(repo, groupPath, artifactId, version, `${artifactId}-${version}-sources.jar`);
}

/**
 * 定位 JAR 文件
 */
export function locateJar(
  groupId: string,
  artifactId: string,
  version: string,
  localRepo?: string
): JarLocation {
  const jarPath = buildJarPath(groupId, artifactId, version, localRepo);
  const sourcePath = buildSourceJarPath(groupId, artifactId, version, localRepo);
  
  return {
    groupId,
    artifactId,
    version,
    jarPath: fs.existsSync(jarPath) ? jarPath : null,
    sourcePath: fs.existsSync(sourcePath) ? sourcePath : null,
    exists: fs.existsSync(jarPath),
  };
}

/**
 * 批量定位 JAR 文件
 */
export function locateJars(
  deps: Array<{ groupId: string; artifactId: string; version: string }>,
  localRepo?: string
): JarLocation[] {
  return deps.map(dep => locateJar(dep.groupId, dep.artifactId, dep.version, localRepo));
}

/**
 * 检查 JAR 是否存在
 */
export function isJarAvailable(
  groupId: string,
  artifactId: string,
  version: string,
  localRepo?: string
): boolean {
  const jarPath = buildJarPath(groupId, artifactId, version, localRepo);
  return fs.existsSync(jarPath);
}

/**
 * 下载 JAR (通过 Maven 命令)
 * 
 * 注意：这需要 Maven 已安装
 */
export async function downloadJar(
  groupId: string,
  artifactId: string,
  version: string
): Promise<boolean> {
  const { execSync } = await import('child_process');
  
  try {
    const command = `mvn dependency:get -DgroupId=${groupId} -DartifactId=${artifactId} -Dversion=${version}`;
    execSync(command, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/**
 * 下载源码 JAR
 */
export async function downloadSourceJar(
  groupId: string,
  artifactId: string,
  version: string
): Promise<boolean> {
  const { execSync } = await import('child_process');
  
  try {
    const command = `mvn dependency:get -DgroupId=${groupId} -DartifactId=${artifactId} -Dversion=${version} -Dclassifier=sources`;
    execSync(command, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}