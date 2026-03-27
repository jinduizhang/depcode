/**
 * MethodRepository
 * 
 * 方法实体的数据仓库，提供 CRUD 和搜索方法。
 */

import type { StorageService } from '../service/storage-service.js';
import type { MethodInfo, MethodInfoInput, MethodParam } from '../types/index.js';

/**
 * 方法仓库
 */
export class MethodRepository {
  private storage: StorageService;

  constructor(storage: StorageService) {
    this.storage = storage;
  }

  /**
   * 根据 ID 查找方法
   */
  findById(id: string): MethodInfo | null {
    const row = this.storage.queryOne<{
      id: string;
      class_id: string;
      name: string;
      return_type: string | null;
      params: string | null;
      modifiers: string | null;
      signature: string;
      line_start: number | null;
      line_end: number | null;
    }>('SELECT * FROM methods WHERE id = ?', [id]);

    if (!row) return null;
    return this.mapRowToMethodInfo(row);
  }

  /**
   * 根据类 ID 查找所有方法
   */
  findByClassId(classId: string): MethodInfo[] {
    const rows = this.storage.query<{
      id: string;
      class_id: string;
      name: string;
      return_type: string | null;
      params: string | null;
      modifiers: string | null;
      signature: string;
      line_start: number | null;
      line_end: number | null;
    }>('SELECT * FROM methods WHERE class_id = ? ORDER BY name', [classId]);

    return rows.map(row => this.mapRowToMethodInfo(row));
  }

  /**
   * 搜索方法名
   */
  search(pattern: string, classId?: string): MethodInfo[] {
    const likePattern = pattern.replace(/\*/g, '%');
    
    let sql = 'SELECT * FROM methods WHERE name LIKE ?';
    const params: unknown[] = [likePattern];

    if (classId) {
      sql += ' AND class_id = ?';
      params.push(classId);
    }

    sql += ' ORDER BY name LIMIT 100';

    const rows = this.storage.query<{
      id: string;
      class_id: string;
      name: string;
      return_type: string | null;
      params: string | null;
      modifiers: string | null;
      signature: string;
      line_start: number | null;
      line_end: number | null;
    }>(sql, params);

    return rows.map(row => this.mapRowToMethodInfo(row));
  }

  /**
   * 保存方法
   */
  save(method: MethodInfoInput): void {
    const params = method.params ? JSON.stringify(method.params) : null;
    const modifiers = method.modifiers ? JSON.stringify(method.modifiers) : null;

    this.storage.execute(
      `INSERT OR REPLACE INTO methods 
        (id, class_id, name, return_type, params, modifiers, signature, line_start, line_end)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        method.id,
        method.classId,
        method.name,
        method.returnType ?? null,
        params,
        modifiers,
        method.signature,
        method.lineStart ?? null,
        method.lineEnd ?? null,
      ]
    );
  }

  /**
   * 批量保存方法
   */
  saveBatch(methods: MethodInfoInput[]): void {
    this.storage.transaction(() => {
      for (const method of methods) {
        this.save(method);
      }
    });
  }

  /**
   * 删除方法
   */
  delete(id: string): void {
    this.storage.execute('DELETE FROM methods WHERE id = ?', [id]);
  }

  /**
   * 根据类 ID 删除所有方法
   */
  deleteByClassId(classId: string): void {
    this.storage.execute('DELETE FROM methods WHERE class_id = ?', [classId]);
  }

  /**
   * 统计方法数量
   */
  count(classId?: string): number {
    let sql = 'SELECT COUNT(*) as count FROM methods';
    const params: unknown[] = [];

    if (classId) {
      sql += ' WHERE class_id = ?';
      params.push(classId);
    }

    const row = this.storage.queryOne<{ count: number }>(sql, params);
    return row?.count ?? 0;
  }

  /**
   * 映射数据库行到 MethodInfo 对象
   */
  private mapRowToMethodInfo(row: {
    id: string;
    class_id: string;
    name: string;
    return_type: string | null;
    params: string | null;
    modifiers: string | null;
    signature: string;
    line_start: number | null;
    line_end: number | null;
  }): MethodInfo {
    return {
      id: row.id,
      classId: row.class_id,
      name: row.name,
      returnType: row.return_type ?? undefined,
      params: row.params ? JSON.parse(row.params) : [],
      modifiers: row.modifiers ? JSON.parse(row.modifiers) : [],
      signature: row.signature,
      lineStart: row.line_start ?? undefined,
      lineEnd: row.line_end ?? undefined,
    };
  }
}