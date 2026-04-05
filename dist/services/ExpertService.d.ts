/**
 * ExpertService - High-level Expert management operations
 *
 * Wraps FileService with additional functionality:
 * - Auto-generate slugs from role names
 * - Template loading for new experts
 * - Bulk operations
 * - Expert search and filtering
 */
import { Expert, ServiceResult } from '../types';
export interface ExpertTemplate {
    name: string;
    description: string;
    template: Partial<Expert>;
}
export interface ExpertFilter {
    domain?: string;
    backed_by?: string;
    tier?: string;
    phase?: string;
    search?: string;
}
export declare class ExpertService {
    private readonly templates;
    constructor();
    private initializeTemplates;
    getTemplates(): ExpertTemplate[];
    getTemplate(key: string): ExpertTemplate | undefined;
    createExpert(role: string, options?: Partial<Expert>): Promise<ServiceResult<Expert>>;
    createExpertFromTemplate(templateKey: string, customRole?: string): Promise<ServiceResult<Expert>>;
    updateExpert(slug: string, updates: Partial<Expert>): Promise<ServiceResult<Expert>>;
    deleteExpert(slug: string): Promise<ServiceResult<void>>;
    listExperts(): Promise<ServiceResult<Expert[]>>;
    getExpert(slug: string): Promise<ServiceResult<Expert>>;
    findExperts(filter: ExpertFilter): Promise<ServiceResult<Expert[]>>;
    searchExperts(query: string): Promise<ServiceResult<Expert[]>>;
    cloneExpert(sourceSlug: string, newRole: string): Promise<ServiceResult<Expert>>;
    exportExperts(): Promise<ServiceResult<string>>;
    importExperts(jsonData: string, overwrite?: boolean): Promise<ServiceResult<{
        created: number;
        updated: number;
        skipped: number;
    }>>;
    getExpertStats(): Promise<ServiceResult<{
        total: number;
        byDomain: Record<string, number>;
        byBackedBy: Record<string, number>;
        byTier: Record<string, number>;
    }>>;
}
export declare const expertService: ExpertService;
//# sourceMappingURL=ExpertService.d.ts.map