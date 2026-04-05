/**
 * ExpertService - High-level Expert management operations
 *
 * Wraps FileService with additional functionality:
 * - Auto-generate slugs from role names
 * - Template loading for new experts
 * - Bulk operations
 * - Expert search and filtering
 */

import * as vscode from 'vscode';
import { Expert, ServiceResult } from '../types';
import { fileService } from './FileService';
import { validationService } from './ValidationService';
import { slugify, generateUniqueSlug } from '../utils/slugify';

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
  search?: string; // Search in role, persona
}

export class ExpertService {
  private readonly templates: Map<string, ExpertTemplate> = new Map();

  constructor() {
    this.initializeTemplates();
  }

  // ==========================================================================
  // Templates
  // ==========================================================================

  private initializeTemplates(): void {
    this.templates.set('backend-developer', {
      name: 'Backend Developer',
      description: 'Server-side API and database development',
      template: {
        role: 'Backend Developer',
        domain: 'development',
        backed_by: 'claude',
        tier: 'premium',
        permission_mode: 'default',
        phases: ['grasp', 'tangle'],
        agent_profile: 'backend-developer',
        capabilities: [
          'API design (REST, GraphQL, gRPC)',
          'Database modeling and queries',
          'Server-side architecture',
          'Authentication and authorization',
          'API documentation'
        ],
        constraints: [
          'Focus on backend concerns only',
          'Coordinate with frontend for API contracts',
          'Write tests for API endpoints'
        ],
        persona: 'Expert in backend development with deep knowledge of server architectures, databases, and API design.'
      }
    });

    this.templates.set('frontend-developer', {
      name: 'Frontend Developer',
      description: 'Client-side UI and user experience',
      template: {
        role: 'Frontend Developer',
        domain: 'development',
        backed_by: 'claude',
        tier: 'premium',
        permission_mode: 'default',
        phases: ['tangle', 'ink'],
        agent_profile: 'frontend-developer',
        capabilities: [
          'React/Vue/Angular component development',
          'State management (Redux, Vuex, NgRx)',
          'Responsive design and accessibility',
          'Performance optimization',
          'Testing frameworks (Jest, Cypress)'
        ],
        constraints: [
          'Focus on UI/UX implementation',
          'Coordinate with backend for API integration',
          'Ensure WCAG accessibility compliance'
        ],
        persona: 'Expert in modern frontend development with focus on user experience and performance.'
      }
    });

    this.templates.set('security-auditor', {
      name: 'Security Auditor',
      description: 'Security review and vulnerability assessment',
      template: {
        role: 'Security Auditor',
        domain: 'development',
        backed_by: 'claude',
        tier: 'premium',
        permission_mode: 'acceptEdits',
        phases: ['grasp', 'tangle'],
        agent_profile: 'security-auditor',
        capabilities: [
          'OWASP compliance checks',
          'Vulnerability scanning',
          'Security architecture review',
          'Penetration testing guidance',
          'Security best practices enforcement'
        ],
        constraints: [
          'Read-only access for production code',
          'Provide security recommendations only',
          'Never bypass security controls'
        ],
        persona: 'Security specialist focused on identifying vulnerabilities and ensuring OWASP compliance.'
      }
    });

    this.templates.set('test-automation', {
      name: 'Test Automation Engineer',
      description: 'Test strategy and automated testing',
      template: {
        role: 'Test Automation Engineer',
        domain: 'development',
        backed_by: 'claude',
        tier: 'standard',
        permission_mode: 'default',
        phases: ['tangle', 'ink'],
        agent_profile: 'test-automation',
        capabilities: [
          'Unit testing strategy',
          'Integration testing',
          'E2E test automation',
          'Test coverage analysis',
          'CI/CD test pipeline integration'
        ],
        constraints: [
          'Maintain test independence',
          'Ensure tests are deterministic',
          'Document test scenarios clearly'
        ],
        persona: 'Testing expert focused on comprehensive test coverage and quality assurance.'
      }
    });

    this.templates.set('devops-engineer', {
      name: 'DevOps Engineer',
      description: 'CI/CD, infrastructure, and deployment',
      template: {
        role: 'DevOps Engineer',
        domain: 'development',
        backed_by: 'claude',
        tier: 'premium',
        permission_mode: 'default',
        phases: ['ink'],
        agent_profile: 'devops-engineer',
        capabilities: [
          'CI/CD pipeline design',
          'Docker and Kubernetes',
          'Infrastructure as Code (Terraform, CloudFormation)',
          'Monitoring and logging setup',
          'Deployment automation'
        ],
        constraints: [
          'Follow infrastructure best practices',
          'Ensure zero-downtime deployments',
          'Document all infrastructure changes'
        ],
        persona: 'DevOps specialist focused on automation, reliability, and deployment excellence.'
      }
    });

    this.templates.set('code-reviewer', {
      name: 'Code Reviewer',
      description: 'Code quality review and analysis',
      template: {
        role: 'Code Reviewer',
        domain: 'development',
        backed_by: 'codex',
        tier: 'standard',
        permission_mode: 'plan',
        phases: ['ink'],
        agent_profile: 'code-reviewer',
        capabilities: [
          'Code quality analysis',
          'Best practices enforcement',
          'Bug detection',
          'Performance review',
          'Security review'
        ],
        constraints: [
          'Read-only access',
          'Provide constructive feedback',
          'Suggest improvements without direct changes'
        ],
        persona: 'Code quality expert focused on maintainability, performance, and best practices.'
      }
    });

    this.templates.set('general-assistant', {
      name: 'General Assistant',
      description: 'General-purpose AI assistant',
      template: {
        role: 'General Assistant',
        domain: 'general',
        backed_by: 'claude',
        tier: 'standard',
        permission_mode: 'default',
        phases: [],
        capabilities: [
          'General task assistance',
          'Research and analysis',
          'Documentation',
          'Problem solving'
        ],
        constraints: [],
        persona: 'Helpful assistant capable of handling a wide range of tasks.'
      }
    });
  }

  getTemplates(): ExpertTemplate[] {
    return Array.from(this.templates.values());
  }

  getTemplate(key: string): ExpertTemplate | undefined {
    return this.templates.get(key);
  }

  // ==========================================================================
  // CRUD Operations
  // ==========================================================================

  async createExpert(
    role: string,
    options: Partial<Expert> = {}
  ): Promise<ServiceResult<Expert>> {
    // Generate slug from role if not provided
    let slug = options.slug || slugify(role);

    // Check uniqueness and generate unique slug
    const existing = await fileService.listExperts();
    const existingSlugs = existing.success && existing.data
      ? new Set(existing.data.map(e => e.slug))
      : new Set<string>();

    slug = generateUniqueSlug(slug, existingSlugs);

    // Build expert object
    const expert: Expert = {
      role,
      slug,
      domain: options.domain || 'general',
      backed_by: options.backed_by || 'claude',
      cli: options.cli,
      model: options.model,
      fallback_cli: options.fallback_cli || null,
      tier: options.tier || 'standard',
      permission_mode: options.permission_mode || 'default',
      memory: options.memory,
      isolation: options.isolation || null,
      phases: options.phases || [],
      agent_profile: options.agent_profile,
      default_platform: options.default_platform,
      persona: options.persona || '',
      capabilities: options.capabilities || [],
      constraints: options.constraints || [],
      created_at: options.created_at || new Date().toISOString().split('T')[0]
    };

    // Validate
    const validation = validationService.validateExpert(expert);
    if (!validation.valid) {
      return {
        success: false,
        error: `Validation failed: ${validation.errors.join(', ')}`
      };
    }

    // Create
    const result = await fileService.createExpert(expert);
    if (!result.success) {
      return { success: false, error: result.error };
    }

    return { success: true, data: expert };
  }

  async createExpertFromTemplate(
    templateKey: string,
    customRole?: string
  ): Promise<ServiceResult<Expert>> {
    const template = this.templates.get(templateKey);
    if (!template) {
      return { success: false, error: `Template not found: ${templateKey}` };
    }

    const role = customRole || template.template.role || template.name;
    return this.createExpert(role, { ...template.template, role });
  }

  async updateExpert(
    slug: string,
    updates: Partial<Expert>
  ): Promise<ServiceResult<Expert>> {
    // Read existing
    const existing = await fileService.readExpert(slug);
    if (!existing.success || !existing.data) {
      return { success: false, error: `Expert not found: ${slug}` };
    }

    // Merge updates
    const updated: Expert = {
      ...existing.data,
      ...updates,
      slug // Preserve original slug
    };

    // Validate
    const validation = validationService.validateExpert(updated);
    if (!validation.valid) {
      return {
        success: false,
        error: `Validation failed: ${validation.errors.join(', ')}`
      };
    }

    // Update
    const result = await fileService.updateExpert(slug, updated);
    if (!result.success) {
      return { success: false, error: result.error };
    }

    return { success: true, data: updated };
  }

  async deleteExpert(slug: string): Promise<ServiceResult<void>> {
    // Check if used in teams
    const teams = await fileService.listTeams();
    if (teams.success && teams.data) {
      const inUse = teams.data.some(team =>
        team.members.some(m => m.expert_slug === slug)
      );
      if (inUse) {
        return {
          success: false,
          error: `Cannot delete: Expert is used in one or more teams`
        };
      }
    }

    return fileService.deleteExpert(slug);
  }

  // ==========================================================================
  // Query Operations
  // ==========================================================================

  async listExperts(): Promise<ServiceResult<Expert[]>> {
    return fileService.listExperts();
  }

  async getExpert(slug: string): Promise<ServiceResult<Expert>> {
    return fileService.readExpert(slug);
  }

  async findExperts(filter: ExpertFilter): Promise<ServiceResult<Expert[]>> {
    const result = await fileService.listExperts();
    if (!result.success || !result.data) {
      return result;
    }

    let filtered = result.data;

    if (filter.domain) {
      filtered = filtered.filter(e => e.domain === filter.domain);
    }

    if (filter.backed_by) {
      filtered = filtered.filter(e => e.backed_by === filter.backed_by);
    }

    if (filter.tier) {
      filtered = filtered.filter(e => e.tier === filter.tier);
    }

    if (filter.phase) {
      filtered = filtered.filter(e =>
        e.phases && e.phases.includes(filter.phase!)
      );
    }

    if (filter.search) {
      const searchLower = filter.search.toLowerCase();
      filtered = filtered.filter(e =>
        e.role.toLowerCase().includes(searchLower) ||
        e.persona?.toLowerCase().includes(searchLower) ||
        e.capabilities?.some(c => c.toLowerCase().includes(searchLower))
      );
    }

    return { success: true, data: filtered };
  }

  async searchExperts(query: string): Promise<ServiceResult<Expert[]>> {
    return this.findExperts({ search: query });
  }

  // ==========================================================================
  // Utility Operations
  // ==========================================================================

  async cloneExpert(
    sourceSlug: string,
    newRole: string
  ): Promise<ServiceResult<Expert>> {
    const source = await fileService.readExpert(sourceSlug);
    if (!source.success || !source.data) {
      return { success: false, error: `Source expert not found: ${sourceSlug}` };
    }

    // Create copy with new role
    const cloneData: Partial<Expert> = {
      ...source.data,
      role: newRole,
      created_at: new Date().toISOString().split('T')[0]
    };
    delete cloneData.slug; // Let createExpert generate new slug

    return this.createExpert(newRole, cloneData);
  }

  async exportExperts(): Promise<ServiceResult<string>> {
    const result = await fileService.listExperts();
    if (!result.success || !result.data) {
      return { success: false, error: result.error };
    }

    const exportData = {
      version: 1,
      exported_at: new Date().toISOString(),
      experts: result.data
    };

    return { success: true, data: JSON.stringify(exportData, null, 2) };
  }

  async importExperts(
    jsonData: string,
    overwrite: boolean = false
  ): Promise<ServiceResult<{ created: number; updated: number; skipped: number }>> {
    try {
      const importData = JSON.parse(jsonData);
      if (!importData.experts || !Array.isArray(importData.experts)) {
        return { success: false, error: 'Invalid import data format' };
      }

      let created = 0;
      let updated = 0;
      let skipped = 0;

      for (const expert of importData.experts as Expert[]) {
        const existing = await fileService.readExpert(expert.slug);

        if (existing.success) {
          if (overwrite) {
            await fileService.updateExpert(expert.slug, expert);
            updated++;
          } else {
            skipped++;
          }
        } else {
          await fileService.createExpert(expert);
          created++;
        }
      }

      return {
        success: true,
        data: { created, updated, skipped }
      };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  // ==========================================================================
  // Statistics
  // ==========================================================================

  async getExpertStats(): Promise<ServiceResult<{
    total: number;
    byDomain: Record<string, number>;
    byBackedBy: Record<string, number>;
    byTier: Record<string, number>;
  }>> {
    const result = await fileService.listExperts();
    if (!result.success || !result.data) {
      return { success: false, error: result.error };
    }

    const experts = result.data;
    const stats = {
      total: experts.length,
      byDomain: {} as Record<string, number>,
      byBackedBy: {} as Record<string, number>,
      byTier: {} as Record<string, number>
    };

    for (const expert of experts) {
      stats.byDomain[expert.domain] = (stats.byDomain[expert.domain] || 0) + 1;
      stats.byBackedBy[expert.backed_by] = (stats.byBackedBy[expert.backed_by] || 0) + 1;
      stats.byTier[expert.tier] = (stats.byTier[expert.tier] || 0) + 1;
    }

    return { success: true, data: stats };
  }
}

// Singleton export
export const expertService = new ExpertService();
