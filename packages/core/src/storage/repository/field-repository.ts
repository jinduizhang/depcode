/**
 * FieldRepository
 * 
 * 字段实体的数据仓库，提供 CRUD 方法。
 */

import type { StorageService } from '../service/storage-service.js';
import type { FieldInfo, FieldInfoInput } from '../types/index.js';

/**
 * 字段仓库
 */
export class FieldRepository {
  private storage: StorageService;

  constructor(storage: StorageService) {
    this.storage = storage;
  }

  /**
   * 根据 ID 查找字段
   */
  findById(id: string): FieldInfo | null {
    const row = this.storage.queryOne<{
      id: string;
      class_id: string;
      name: string;
      type: string;
      modifiers: string | null;
    }>('SELECT * FROM fields WHERE id = ?', [id]);

    if (!row) return null;
    return this.mapRowToFieldInfo(row);
  }

  /**
   * 根据类 ID 查找所有字段
   */
  findByClassId(classId: string): FieldInfo[] {
    const rows = this.storage.query<{
      id: string;
      class_id: string;
      name: string;
      type: string;
      modifiers: string | null;
    }>('SELECT * FROM fields WHERE class_id = ? ORDER BY name', [classId]);

    return rows.map(row => this.mapRowToFieldInfo(row));
  }

  /**
   * 根据名称搜索字段
   */
  search(pattern: string, classId?: string): FieldInfo[] {
    const likePattern = pattern.replace(/\*/g, '%');
    
    let sql = 'SELECT * FROM fields WHERE name LIKE ?';
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
      type: string;
      modifiers: string | null;
    }>(sql, params);

    return rows.map(row => this.mapRowToFieldInfo(row));
  }

  /**
   * 保存字段
   */
  save(field: FieldInfoInput): void {
    const modifiers = field.modifiers ? JSON.stringify(field.modifiers) : null;

    this.storage.execute(
      `INSERT OR REPLACE INTO fields (id, class_id, name, type, modifiers)
       VALUES (?, ?, ?, ?, ?)`,
      [field.id, field.classId, field.name, field.type, modifiers]
    );
  }

  /**
   * 批量保存字段
   */
  saveBatch(fields: FieldInfoInput[]): void {
    this.storage.transaction(() => {
      for (const field of fields) {
        this.save(field);
      }
    });
  }

  /**
   * 删除字段
   */
  delete(id: string): void {
    this.storage.execute('DELETE FROM fields WHERE id = ?', [id]);
  }

  /**
   * 根据类 ID 删除所有字段
   */
  deleteByClassId(classId: string): void {
    this.storage.execute('DELETE FROM fields WHERE class_id = ?', [classId]);
  }

  /**
   * 统计字段数量
   */
  count(classId?: string): number {
    let sql = 'SELECT COUNT(*) as count FROM fields';
    const params: unknown[] = [];

    if (classId) {
      sql += ' WHERE class_id = ?';
      params.push(classId);
    }

    const row = this.storage.queryOne<{ count: number }>(sql, params);
    return row?.count ?? 0;
  }

  /**
   * 映射数据库行到 FieldInfo 对象
   */
  private mapRowToFieldInfo(row: {
    id: string;
    class_id: string;
    name: string;
    type: string;
    modifiers: string | null;
  }): FieldInfo {
    return {
      id: row.id,
      classId: row.class_id,
      name: row.name,
      type: row.type,
      modifiers: row.modifiers ? JSON.parse(row.modifiers) : [],
    };
  }
}