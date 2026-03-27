/**
 * ClassRepository
 * 
 * 类实体的数据仓库，提供 CRUD 和搜索方法。
 */

import type { StorageService } from '../service/storage-service.js';
import type { ClassInfo, ClassInfoInput, ClassType } from '../types/index.js';

/**
 * 类仓库
 */
export class ClassRepository {
  private storage: StorageService;

  constructor(storage: StorageService) {
    this.storage = storage;
  }

  /**
   * 根据 ID 查找类
   */
  findById(id: string): ClassInfo | null {
    const row = this.storage.queryOne<{
      id: string;
      dep_id: string;
      simple_name: string;
      package: string | null;
      type: string;
      modifiers: string | null;
      super_class: string | null;
      interfaces: string | null;
      source_path: string | null;
      created_at: string;
    }>('SELECT * FROM classes WHERE id = ?', [id]);

    if (!row) return null;
    return this.mapRowToClassInfo(row);
  }

  /**
   * 根据依赖 ID 查找所有类
   */
  findByDepId(depId: string): ClassInfo[] {
    const rows = this.storage.query<{
      id: string;
      dep_id: string;
      simple_name: string;
      package: string | null;
      type: string;
      modifiers: string | null;
      super_class: string | null;
      interfaces: string | null;
      source_path: string | null;
      created_at: string;
    }>('SELECT * FROM classes WHERE dep_id = ? ORDER BY package, simple_name', [depId]);

    return rows.map(row => this.mapRowToClassInfo(row));
  }

  /**
   * 根据包名查找类
   */
  findByPackage(packageName: string): ClassInfo[] {
    const rows = this.storage.query<{
      id: string;
      dep_id: string;
      simple_name: string;
      package: string | null;
      type: string;
      modifiers: string | null;
      super_class: string | null;
      interfaces: string | null;
      source_path: string | null;
      created_at: string;
    }>('SELECT * FROM classes WHERE package = ? ORDER BY simple_name', [packageName]);

    return rows.map(row => this.mapRowToClassInfo(row));
  }

  /**
   * 搜索类名
   */
  search(pattern: string, depId?: string): ClassInfo[] {
    const likePattern = pattern.replace(/\*/g, '%');
    
    let sql = 'SELECT * FROM classes WHERE simple_name LIKE ?';
    const params: unknown[] = [likePattern];

    if (depId) {
      sql += ' AND dep_id = ?';
      params.push(depId);
    }

    sql += ' ORDER BY simple_name LIMIT 100';

    const rows = this.storage.query<{
      id: string;
      dep_id: string;
      simple_name: string;
      package: string | null;
      type: string;
      modifiers: string | null;
      super_class: string | null;
      interfaces: string | null;
      source_path: string | null;
      created_at: string;
    }>(sql, params);

    return rows.map(row => this.mapRowToClassInfo(row));
  }

  /**
   * 保存类
   */
  save(classInfo: ClassInfoInput): void {
    const id = classInfo.id ?? `${classInfo.packageName}.${classInfo.simpleName}`;
    const modifiers = classInfo.modifiers ? JSON.stringify(classInfo.modifiers) : null;
    const interfaces = classInfo.interfaces ? JSON.stringify(classInfo.interfaces) : null;

    this.storage.execute(
      `INSERT OR REPLACE INTO classes 
        (id, dep_id, simple_name, package, type, modifiers, super_class, interfaces, source_path)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        classInfo.depId,
        classInfo.simpleName,
        classInfo.packageName,
        classInfo.type ?? 'class',
        modifiers,
        classInfo.superClass ?? null,
        interfaces,
        classInfo.sourcePath ?? null,
      ]
    );
  }

  /**
   * 批量保存类
   */
  saveBatch(classes: ClassInfoInput[]): void {
    this.storage.transaction(() => {
      for (const classInfo of classes) {
        this.save(classInfo);
      }
    });
  }

  /**
   * 删除类
   */
  delete(id: string): void {
    this.storage.transaction(() => {
      this.storage.execute('DELETE FROM fields WHERE class_id = ?', [id]);
      this.storage.execute('DELETE FROM methods WHERE class_id = ?', [id]);
      this.storage.execute('DELETE FROM classes WHERE id = ?', [id]);
    });
  }

  /**
   * 根据依赖 ID 删除所有类
   */
  deleteByDepId(depId: string): void {
    this.storage.transaction(() => {
      const classes = this.findByDepId(depId);
      for (const cls of classes) {
        this.storage.execute('DELETE FROM fields WHERE class_id = ?', [cls.id]);
        this.storage.execute('DELETE FROM methods WHERE class_id = ?', [cls.id]);
      }
      this.storage.execute('DELETE FROM classes WHERE dep_id = ?', [depId]);
    });
  }

  /**
   * 统计类数量
   */
  count(depId?: string): number {
    let sql = 'SELECT COUNT(*) as count FROM classes';
    const params: unknown[] = [];

    if (depId) {
      sql += ' WHERE dep_id = ?';
      params.push(depId);
    }

    const row = this.storage.queryOne<{ count: number }>(sql, params);
    return row?.count ?? 0;
  }

  /**
   * 映射数据库行到 ClassInfo 对象
   */
  private mapRowToClassInfo(row: {
    id: string;
    dep_id: string;
    simple_name: string;
    package: string | null;
    type: string;
    modifiers: string | null;
    super_class: string | null;
    interfaces: string | null;
    source_path: string | null;
    created_at: string;
  }): ClassInfo {
    return {
      id: row.id,
      depId: row.dep_id,
      simpleName: row.simple_name,
      packageName: row.package ?? '',
      type: row.type as ClassType,
      modifiers: row.modifiers ? JSON.parse(row.modifiers) : [],
      superClass: row.super_class ?? undefined,
      interfaces: row.interfaces ? JSON.parse(row.interfaces) : [],
      sourcePath: row.source_path ?? undefined,
      createdAt: row.created_at,
    };
  }
}