/**
 * ExpertManagerService - Expert CRUD operations with templates
 *
 * Manages expert creation, editing, and template management.
 */
import { Expert } from '../types';
export interface ExpertTemplate {
    id: string;
    name: string;
    description: string;
    category: string;
    defaults: Partial<Expert>;
}
export declare class ExpertManagerService {
    private templates;
    getTemplates(): ExpertTemplate[];
    getTemplate(id: string): ExpertTemplate | undefined;
    getTemplatesByCategory(category: string): ExpertTemplate[];
    getCategories(): string[];
    createExpert(expert: Expert): Promise<{
        success: boolean;
        error?: string;
        data?: Expert;
    }>;
    updateExpert(slug: string, expert: Expert): Promise<{
        success: boolean;
        error?: string;
        data?: Expert;
    }>;
    deleteExpert(slug: string): Promise<{
        success: boolean;
        error?: string;
    }>;
    duplicateExpert(slug: string, newSlug: string): Promise<{
        success: boolean;
        error?: string;
        data?: Expert;
    }>;
    getFormData(): {
        domains: readonly [{
            readonly value: "general";
            readonly label: "General";
        }, {
            readonly value: "development";
            readonly label: "Development";
        }];
        tiers: readonly [{
            readonly value: "trivial";
            readonly label: "Trivial";
            readonly description: "Simple tasks, low cost";
        }, {
            readonly value: "standard";
            readonly label: "Standard";
            readonly description: "Regular tasks, balanced cost";
        }, {
            readonly value: "premium";
            readonly label: "Premium";
            readonly description: "Complex tasks, high quality";
        }];
        backedBy: readonly [{
            readonly value: "claude";
            readonly label: "Claude";
            readonly description: "Anthropic Claude";
        }, {
            readonly value: "codex";
            readonly label: "Codex";
            readonly description: "OpenAI Codex";
        }, {
            readonly value: "gemini";
            readonly label: "Gemini";
            readonly description: "Google Gemini";
        }, {
            readonly value: "zai";
            readonly label: "ZAI";
            readonly description: "ZAI Models";
        }];
        permissionModes: readonly [{
            readonly value: "plan";
            readonly label: "Plan";
            readonly description: "Planning and analysis only";
        }, {
            readonly value: "acceptEdits";
            readonly label: "Accept Edits";
            readonly description: "Review and approve changes";
        }, {
            readonly value: "default";
            readonly label: "Default";
            readonly description: "Full autonomy";
        }];
        phases: readonly [{
            readonly value: "probe";
            readonly label: "Probe";
            readonly description: "Research and discovery";
        }, {
            readonly value: "grasp";
            readonly label: "Grasp";
            readonly description: "Understanding and analysis";
        }, {
            readonly value: "tangle";
            readonly label: "Tangle";
            readonly description: "Implementation";
        }, {
            readonly value: "ink";
            readonly label: "Ink";
            readonly description: "Documentation and delivery";
        }];
    };
    generateSlug(role: string): string;
    validateSlug(slug: string): {
        valid: boolean;
        error?: string;
    };
}
export declare const expertManagerService: ExpertManagerService;
//# sourceMappingURL=ExpertManagerService.d.ts.map