/**
 * analyze 命令 - 分析依赖，反编译二方件
 */

import * as fs from 'fs';
import * as path from 'path';
import { 
  createDatabaseAdapter, 
  createStorageService, 
  DepRepository,
  type Dep
} from '@depcode/core';
import { decompileJar } from '../decompiler/cfr.js';

export interface AnalyzeOptions {
  project: string;
  decompile: boolean;
  sbom: boolean;
  sbomFormat: string;
}

export async function analyzeCommand(options: AnalyzeOptions) {
  const { project, decompile, sbom, sbomFormat } = options;
  
  console.log(`\n🔍 Analyzing project: ${project}\n`);

  // 1. 检查是否已初始化
  const depcodeDir = path.join(project, '.depcode');
  const dbPath = path.join(depcodeDir, 'index.db');
  
  if (!fs.existsSync(dbPath)) {
    console.error('❌ Project not initialized. Run "depcode init" first.\n');
    process.exit(1);
  }

  // 2. 打开数据库
  const adapter = await createDatabaseAdapter({ dbPath });
  const storage = await createStorageService(adapter, false, false);
  const depRepo = new DepRepository(storage);

  // 3. 获取内部二方件
  const internalDeps = depRepo.findInternalDeps();
  console.log(`   Found ${internalDeps.length} internal dependencies to analyze\n`);

  if (internalDeps.length === 0) {
    console.log('   No internal dependencies found.\n');
    storage.close();
    return;
  }

  // 4. 反编译每个二方件
  const cacheDir = path.join(depcodeDir, 'cache');
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }

  for (const dep of internalDeps) {
    console.log(`\n   📦 Processing: ${dep.id}`);
    depRepo.updateStatus(dep.id, 'decompiling');

    try {
      if (decompile && dep.jarPath) {
        // 反编译 JAR
        const outputDir = path.join(cacheDir, dep.groupId, `${dep.artifactId}-${dep.version}`);
        console.log(`      Decompiling to: ${outputDir}`);
        
        const result = await decompileJar(dep.jarPath, outputDir);
        
        if (result.success) {
          console.log(`      ✓ Decompiled ${result.classCount} classes`);
          
          // 更新统计信息
          depRepo.updateStats(dep.id, result.classCount, 0, outputDir);
        } else {
          console.log(`      ✗ Decompilation failed: ${result.error}`);
          depRepo.updateStatus(dep.id, 'error');
        }
      } else {
        console.log(`      ⚠ No JAR path found, skipping decompilation`);
        depRepo.updateStatus(dep.id, 'indexed');
      }
    } catch (error) {
      console.log(`      ✗ Error: ${error}`);
      depRepo.updateStatus(dep.id, 'error');
    }
  }

  // 5. 生成 SBOM
  if (sbom) {
    const allDeps = depRepo.findAll();
    const sbomPath = path.join(depcodeDir, `sbom.${sbomFormat}.json`);
    generateSBOM(allDeps, sbomFormat, sbomPath);
    console.log(`\n   📄 SBOM generated: ${sbomPath}\n`);
  }

  storage.close();

  console.log(`\n✅ Analysis complete!\n`);
}

/**
 * 生成 SBOM
 */
function generateSBOM(
  deps: ReturnType<DepRepository['findAll']>,
  format: string,
  outputPath: string
): void {
  if (format === 'cyclonedx') {
    const sbom = {
      bomFormat: 'CycloneDX',
      specVersion: '1.4',
      serialNumber: `urn:uuid:${crypto.randomUUID()}`,
      version: 1,
      metadata: {
        timestamp: new Date().toISOString(),
        tool: {
          name: 'depcode',
          version: '0.1.0',
        },
      },
      components: deps.map(dep => ({
        type: 'library',
        group: dep.groupId,
        name: dep.artifactId,
        version: dep.version,
        purl: `pkg:maven/${dep.groupId}/${dep.artifactId}@${dep.version}`,
      })),
    };
    fs.writeFileSync(outputPath, JSON.stringify(sbom, null, 2));
  } else {
    // SPDX format
    const sbom = {
      spdxVersion: 'SPDX-2.3',
      dataLicense: 'CC0-1.0',
      SPDXID: 'SPDXRef-DOCUMENT',
      name: 'depcode-sbom',
      documentNamespace: `https://depcode.io/sbom/${crypto.randomUUID()}`,
      creationInfo: {
        created: new Date().toISOString(),
        creators: ['Tool: depcode-0.1.0'],
      },
      packages: deps.map(dep => ({
        SPDXID: `SPDXRef-${dep.artifactId}`,
        name: dep.artifactId,
        versionInfo: dep.version,
        downloadLocation: `pkg:maven/${dep.groupId}/${dep.artifactId}@${dep.version}`,
      })),
    };
    fs.writeFileSync(outputPath, JSON.stringify(sbom, null, 2));
  }
}