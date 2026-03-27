/**
 * SourceRepository
 * 
 * 源码实体的数据仓库，提供源码存储和 FTS 搜索。
 */

import type { StorageService } from '../service/storage-service.js';
import type { Source, SourceInput, SearchResult, FTSSearchOptions } from '../types/index.js';

/**
 * 源码仓库
 */
export class SourceRepository {
  private storage: StorageService;

  constructor(storage: StorageService) {
    this.storage = storage;
  }

  /**
   * 根据类 ID 获取源码
   */
  findById(classId: string): Source | null {
    // 由于源码存储在 FTS 表中，我们需要特殊处理
    // 这里假设源码存储在 sources_fts 表
    if (!this.storage.isFTS5Supported()) {
      return null;
    }

    const row = this.storage.queryOne<{
      class_id: string;
      source: string;
    }>('SELECT class_id, source FROM sources_fts WHERE class_id = ?', [classId]);

    if (!row) return null;

    return {
      classId: row.class_id,
      source: row.source,
      lines: row.source.split('\n').length,
    };
  }

  /**
   * 保存源码
   */
  save(source: SourceInput): void {
    if (!this.storage.isFTS5Supported()) {
      console.warn('FTS5 not supported, source code will not be indexed');
      return;
    }

    // 获取类信息
    const classRow = this.storage.queryOne<{
      id: string;
      simple_name: string;
    }>('SELECT id, simple_name FROM classes WHERE id = ?', [source.classId]);

    if (!classRow) {
      throw new Error(`Class not found: ${source.classId}`);
    }

    // 插入到 FTS 表
    this.storage.execute(
      `INSERT OR REPLACE INTO sources_fts (class_id, class_name, source)
       VALUES (?, ?, ?)`,
      [source.classId, classRow.simple_name, source.source]
    );
  }

  /**
   * 批量保存源码
   */
  saveBatch(sources: SourceInput[]): void {
    this.storage.transaction(() => {
      for (const source of sources) {
        this.save(source);
      }
    });
  }

  /**
   * 删除源码
   */
  delete(classId: string): void {
    if (!this.storage.isFTS5Supported()) return;

    this.storage.execute(
      'DELETE FROM sources_fts WHERE class_id = ?',
      [classId]
    );
  }

  /**
   * FTS 全文搜索
   */
  search(query: string, options: FTSSearchOptions = {}): SearchResult[] {
    return this.storage.searchFTS(query, options);
  }

  /**
   * 搜索源码中的关键词
   */
  searchKeyword(keyword: string, depId?: string, limit = 20): SearchResult[] {
    const results = this.search(keyword, { limit: limit * 2 });

    // 如果指定了 depId，过滤结果
    if (depId) {
      return results.filter(r => r.depId === depId).slice(0, limit);
    }

    return results.slice(0, limit);
  }

  /**
   * 获取源码行数
   */
  getLineCount(classId: string): number {
    const source = this.findById(classId);
    return source?.lines ?? 0;
  }

  /**
   * 统计已索引的源码数量
   */
  count(): number {
    if (!this.storage.isFTS5Supported()) return 0;

    const row = this.storage.queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM sources_fts'
    );
    return row?.count ?? 0;
  }

  /**
   * 检查类是否已索引
   */
  isIndexed(classId: string): boolean {
    if (!this.storage.isFTS5Supported()) return false;

    const row = this.storage.queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM sources_fts WHERE class_id = ?',
      [classId]
    );
    return (row?.count ?? 0) > 0;
  }
}