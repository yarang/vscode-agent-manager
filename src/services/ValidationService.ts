/**
 * ValidationService - Validates expert, team, and agent definitions
 *
 * Ensures data integrity, required fields, and business rule compliance.
 */

import { Expert, Team, TeamMember, ValidationResult, Domain, Tier, PermissionMode, BackedBy } from '../types';
import { fileService } from './FileService';

export class ValidationService {
  private readonly VALID_DOMAINS: Domain[] = ['general', 'development'];
  private readonly VALID_TIERS: Tier[] = ['trivial', 'standard', 'premium'];
  private readonly VALID_PERMISSIONS: PermissionMode[] = ['plan', 'acceptEdits', 'default'];
  private readonly VALID_BACKED_BY: BackedBy[] = ['claude', 'codex', 'gemini', 'zai'];

  // ==========================================================================
  // Expert Validation
  // ==========================================================================

  validateExpert(data: Partial<Expert>): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required fields
    if (!data.role || data.role.trim() === '') {
      errors.push('role is required');
    }

    if (!data.slug || data.slug.trim() === '') {
      errors.push('slug is required');
    } else if (!/^[a-z0-9-]+$/.test(data.slug)) {
      errors.push('slug must be lowercase with hyphens only');
    }

    // Enum validations
    if (data.domain && !this.VALID_DOMAINS.includes(data.domain)) {
      errors.push(`invalid domain: ${data.domain}. Must be one of: ${this.VALID_DOMAINS.join(', ')}`);
    }

    if (data.tier && !this.VALID_TIERS.includes(data.tier)) {
      errors.push(`invalid tier: ${data.tier}. Must be one of: ${this.VALID_TIERS.join(', ')}`);
    }

    if (data.permission_mode && !this.VALID_PERMISSIONS.includes(data.permission_mode)) {
      errors.push(`invalid permission_mode: ${data.permission_mode}. Must be one of: ${this.VALID_PERMISSIONS.join(', ')}`);
    }

    if (data.backed_by && !this.VALID_BACKED_BY.includes(data.backed_by)) {
      errors.push(`invalid backed_by: ${data.backed_by}. Must be one of: ${this.VALID_BACKED_BY.join(', ')}`);
    }

    // Warnings
    if (!data.phases || data.phases.length === 0) {
      warnings.push('no phases defined - agent may not be routable');
    }

    if (!data.persona) {
      warnings.push('no persona defined - consider adding role description');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  async checkExpertExists(slug: string): Promise<boolean> {
    const result = await fileService.readExpert(slug);
    return result.success;
  }

  async checkExpertSlugUnique(slug: string): Promise<boolean> {
    const experts = await fileService.listExperts();
    if (!experts.success || !experts.data) {
      return true;
    }
    return !experts.data.some(e => e.slug === slug);
  }

  // ==========================================================================
  // Team Validation
  // ==========================================================================

  validateTeam(data: Partial<Team>): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required fields
    if (!data.name || data.name.trim() === '') {
      errors.push('name is required');
    }

    if (!data.slug || data.slug.trim() === '') {
      errors.push('slug is required');
    }

    if (!data.type) {
      errors.push('type is required (upper or lower)');
    } else if (!['upper', 'lower'].includes(data.type)) {
      errors.push(`invalid type: ${data.type}. Must be 'upper' or 'lower'`);
    }

    if (!data.members || data.members.length === 0) {
      errors.push('team must have at least one member');
    } else {
      // Validate members
      const memberValidation = this.validateTeamMembers(data.members, data.type);
      errors.push(...memberValidation.errors);
      warnings.push(...memberValidation.warnings);
    }

    // Team size limits
    if (data.members) {
      if (data.type === 'upper' && (data.members.length < 3 || data.members.length > 8)) {
        warnings.push(`upper team size should be 3-8 members (current: ${data.members.length})`);
      }
      if (data.type === 'lower' && (data.members.length < 2 || data.members.length > 6)) {
        warnings.push(`lower team size should be 2-6 members (current: ${data.members.length})`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  private validateTeamMembers(members: TeamMember[], teamType?: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check leader exists
    const leaders = members.filter(m => m.is_leader);
    if (leaders.length === 0) {
      errors.push('team must have at least one leader');
    } else if (leaders.length > 1) {
      warnings.push('multiple leaders defined - only one recommended');
    }

    // Team type specific rules
    if (teamType === 'upper') {
      const hasOrchestrator = members.some(m =>
        m.role.toLowerCase().includes('orchestrator') ||
        m.expert_slug.includes('orchestrator')
      );
      if (!hasOrchestrator) {
        errors.push('upper team must have an orchestrator');
      }

      const hasArchitect = members.some(m =>
        m.role.toLowerCase().includes('architect') ||
        m.expert_slug.includes('designer')
      );
      if (!hasArchitect) {
        errors.push('upper team must have an architect');
      }
    }

    if (teamType === 'lower') {
      const hasTeamLead = members.some(m =>
        m.role.toLowerCase().includes('lead') ||
        m.expert_slug.includes('leader')
      );
      if (!hasTeamLead) {
        errors.push('lower team must have a team leader');
      }
    }

    // Check for duplicate roles
    const roles = members.map(m => m.role);
    const duplicates = roles.filter((r, i) => roles.indexOf(r) !== i);
    if (duplicates.length > 0) {
      warnings.push(`duplicate roles found: ${[...new Set(duplicates)].join(', ')}`);
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  async checkTeamMemberExists(role: string): Promise<boolean> {
    const experts = await fileService.listExperts();
    if (!experts.success || !experts.data) {
      return false;
    }
    return experts.data.some(e => e.slug === role || e.role.toLowerCase() === role.toLowerCase());
  }

  // ==========================================================================
  // Phase Coverage Validation
  // ==========================================================================

  validatePhaseCoverage(members: TeamMember[]): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const phases = ['probe', 'grasp', 'tangle', 'ink'];
    const coveredPhases = new Set<string>();

    members.forEach(member => {
      // This is a simplified check - in practice, you'd read expert's phases
      coveredPhases.add('tangle'); // Placeholder
    });

    // For now, just warn if no phase coverage
    if (coveredPhases.size === 0) {
      warnings.push('no phases are covered by team members');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  // ==========================================================================
  // YAML/JSON Format Validation
  // ==========================================================================

  validateYamlFormat(content: string): ValidationResult {
    try {
      yaml.parse(content);
      return { valid: true, errors: [], warnings: [] };
    } catch (error) {
      return {
        valid: false,
        errors: [`YAML parse error: ${error}`],
        warnings: []
      };
    }
  }

  validateJsonFormat(content: string): ValidationResult {
    try {
      JSON.parse(content);
      return { valid: true, errors: [], warnings: [] };
    } catch (error) {
      return {
        valid: false,
        errors: [`JSON parse error: ${error}`],
        warnings: []
      };
    }
  }
}

// Note: yaml import needed for validation
import * as yaml from 'yaml';

// Singleton export
export const validationService = new ValidationService();
