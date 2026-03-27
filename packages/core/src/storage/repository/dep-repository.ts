/**
 * DepRepository
 * 
 * 依赖实体的数据仓库，提供 CRUD 和业务查询方法。
 */

import type { StorageService } from '../service/storage-service.js';
import type { Dep, DepInput, DepType, DepStatus } from '../types/index.js';

/**
 * 依赖仓库
 */
export class DepRepository {
  private storage: StorageService;

  constructor(storage: StorageService) {
    this.storage = storage;
  }

  /**
   * 根据 ID 查找依赖
   */
  findById(id: string): Dep | null {
    const row = this.storage.queryOne<{
      id: string;
      group_id: string;
      artifact_id: string;
      version: string;
      type: string;
      status: string;
      jar_path: string | null;
      cache_path: string | null;
      class_count: number;
      method_count: number;
      created_at: string;
      updated_at: string;
    }>('SELECT * FROM deps WHERE id = ?', [id]);

    if (!row) return null;
    return this.mapRowToDep(row);
  }

  /**
   * 查找所有依赖
   */
  findAll(): Dep[] {
    const rows = this.storage.query<{
      id: string;
      group_id: string;
      artifact_id: string;
      version: string;
      type: string;
      status: string;
      jar_path: string | null;
      cache_path: string | null;
      class_count: number;
      method_count: number;
      created_at: string;
      updated_at: string;
    }>('SELECT * FROM deps ORDER BY group_id, artifact_id');

    return rows.map(row => this.mapRowToDep(row));
  }

  /**
   * 根据组织 ID 查找依赖
   */
  findByGroupId(groupId: string): Dep[] {
    const rows = this.storage.query<{
      id: string;
      group_id: string;
      artifact_id: string;
      version: string;
      type: string;
      status: string;
      jar_path: string | null;
      cache_path: string | null;
      class_count: number;
      method_count: number;
      created_at: string;
      updated_at: string;
    }>('SELECT * FROM deps WHERE group_id = ? ORDER BY artifact_id, version', [groupId]);

    return rows.map(row => this.mapRowToDep(row));
  }

  /**
   * 查找内部二方件
   */
  findInternalDeps(): Dep[] {
    const rows = this.storage.query<{
      id: string;
      group_id: string;
      artifact_id: string;
      version: string;
      type: string;
      status: string;
      jar_path: string | null;
      cache_path: string | null;
      class_count: number;
      method_count: number;
      created_at: string;
      updated_at: string;
    }>("SELECT * FROM deps WHERE type = 'internal' ORDER BY group_id, artifact_id");

    return rows.map(row => this.mapRowToDep(row));
  }

  /**
   * 根据状态查找依赖
   */
  findByStatus(status: DepStatus): Dep[] {
    const rows = this.storage.query<{
      id: string;
      group_id: string;
      artifact_id: string;
      version: string;
      type: string;
      status: string;
      jar_path: string | null;
      cache_path: string | null;
      class_count: number;
      method_count: number;
      created_at: string;
      updated_at: string;
    }>('SELECT * FROM deps WHERE status = ? ORDER BY group_id, artifact_id', [status]);

    return rows.map(row => this.mapRowToDep(row));
  }

  /**
   * 保存依赖（插入或更新）
   */
  save(dep: DepInput): void {
    const existing = dep.id ? this.findById(dep.id) : null;

    if (existing) {
      // 更新
      this.storage.execute(
        `UPDATE deps SET 
          group_id = ?, artifact_id = ?, version = ?, type = ?,
          jar_path = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
        [dep.groupId, dep.artifactId, dep.version, dep.type ?? 'internal', dep.jarPath ?? null, dep.id]
      );
    } else {
      // 插入
      const id = dep.id ?? `${dep.groupId}:${dep.artifactId}:${dep.version}`;
      this.storage.execute(
        `INSERT INTO deps (id, group_id, artifact_id, version, type, jar_path)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, dep.groupId, dep.artifactId, dep.version, dep.type ?? 'internal', dep.jarPath ?? null]
      );
    }
  }

  /**
   * 更新依赖状态
   */
  updateStatus(id: string, status: DepStatus): void {
    this.storage.execute(
      'UPDATE deps SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [status, id]
    );
  }

  /**
   * 更新统计信息
   */
  updateStats(id: string, classCount: number, methodCount: number, cachePath?: string): void {
    this.storage.execute(
      `UPDATE deps SET 
        class_count = ?, method_count = ?, cache_path = ?, status = 'indexed',
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
      [classCount, methodCount, cachePath ?? null, id]
    );
  }

  /**
   * 删除依赖
   */
  delete(id: string): void {
    this.storage.transaction(() => {
      // 级联删除相关数据
      this.storage.execute('DELETE FROM fields WHERE class_id IN (SELECT id FROM classes WHERE dep_id = ?)', [id]);
      this.storage.execute('DELETE FROM methods WHERE class_id IN (SELECT id FROM classes WHERE dep_id = ?)', [id]);
      this.storage.execute('DELETE FROM classes WHERE dep_id = ?', [id]);
      this.storage.execute('DELETE FROM deps WHERE id = ?', [id]);
    });
  }

  /**
   * 统计依赖数量
   */
  count(): number {
    const row = this.storage.queryOne<{ count: number }>('SELECT COUNT(*) as count FROM deps');
    return row?.count ?? 0;
  }

  /**
   * 映射数据库行到 Dep 对象
   */
  private mapRowToDep(row: {
    id: string;
    group_id: string;
    artifact_id: string;
    version: string;
    type: string;
    status: string;
    jar_path: string | null;
    cache_path: string | null;
    class_count: number;
    method_count: number;
    created_at: string;
    updated_at: string;
  }): Dep {
    return {
      id: row.id,
      groupId: row.group_id,
      artifactId: row.artifact_id,
      version: row.version,
      type: row.type as DepType,
      status: row.status as DepStatus,
      jarPath: row.jar_path ?? undefined,
      cachePath: row.cache_path ?? undefined,
      classCount: row.class_count,
      methodCount: row.method_count,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}