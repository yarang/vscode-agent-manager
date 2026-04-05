/**
 * TeamService - High-level Team management operations
 *
 * Wraps FileService with additional functionality:
 * - Member validation against existing experts
 * - Bridge member management
 * - Team composition analysis
 * - Phase coverage validation
 */

import * as vscode from 'vscode';
import { Team, TeamMember, ServiceResult, Expert } from '../types';
import { fileService } from './FileService';
import { validationService } from './ValidationService';
import { slugify, generateUniqueSlug } from '../utils/slugify';

export interface TeamCompositionAnalysis {
  valid: boolean;
  errors: string[];
  warnings: string[];
  hasLeader: boolean;
  hasOrchestrator: boolean;
  hasArchitect: boolean;
  phaseCoverage: string[];
  size: {
    current: number;
    recommended: { min: number; max: number };
  };
}

export class TeamService {
  // ==========================================================================
  // CRUD Operations
  // ==========================================================================

  async createTeam(
    name: string,
    options: Partial<Team> = {}
  ): Promise<ServiceResult<Team>> {
    // Generate slug from name if not provided
    let slug = options.slug || slugify(name);

    // Check uniqueness
    const existing = await fileService.listTeams();
    const existingSlugs = existing.success && existing.data
      ? new Set(existing.data.map(t => t.slug))
      : new Set<string>();

    slug = generateUniqueSlug(slug, existingSlugs);

    // Validate members exist
    const members = options.members || [];
    const memberValidation = await this.validateMembersExist(members);
    if (!memberValidation.valid) {
      return {
        success: false,
        error: `Member validation failed: ${memberValidation.errors.join(', ')}`
      };
    }

    // Build team object
    const team: Team = {
      id: options.id || this.generateTeamId(),
      name,
      slug,
      type: options.type || 'lower',
      execution_mode: options.execution_mode || 'teammate',
      coordinator: options.coordinator || 'claude',
      coordinator_model: options.coordinator_model || 'claude-opus-4-6',
      purpose: options.purpose || '',
      decision_mode: options.decision_mode || 'leader_decides',
      members,
      phase_routing: options.phase_routing || {},
      bridge_to: options.bridge_to || null,
      created_at: options.created_at || new Date().toISOString().split('T')[0]
    };

    // Validate
    const validation = validationService.validateTeam(team);
    if (!validation.valid) {
      return {
        success: false,
        error: `Validation failed: ${validation.errors.join(', ')}`
      };
    }

    // Warn if issues but continue
    if (validation.warnings.length > 0) {
      const warningMsg = `Team created with warnings:\n${validation.warnings.map(w => `- ${w}`).join('\n')}`;
      vscode.window.showWarningMessage(warningMsg);
    }

    // Create
    const result = await fileService.createTeam(team);
    if (!result.success) {
      return { success: false, error: result.error };
    }

    return { success: true, data: team };
  }

  async updateTeam(
    slug: string,
    updates: Partial<Team>
  ): Promise<ServiceResult<Team>> {
    // Read existing
    const existing = await fileService.readTeam(slug);
    if (!existing.success || !existing.data) {
      return { success: false, error: `Team not found: ${slug}` };
    }

    // Validate new members if provided
    if (updates.members) {
      const memberValidation = await this.validateMembersExist(updates.members);
      if (!memberValidation.valid) {
        return {
          success: false,
          error: `Member validation failed: ${memberValidation.errors.join(', ')}`
        };
      }
    }

    // Merge updates
    const updated: Team = {
      ...existing.data,
      ...updates,
      slug, // Preserve original slug
      id: updates.id || existing.data.id
    };

    // Validate
    const validation = validationService.validateTeam(updated);
    if (!validation.valid) {
      return {
        success: false,
        error: `Validation failed: ${validation.errors.join(', ')}`
      };
    }

    // Update
    const result = await fileService.updateTeam(slug, updated);
    if (!result.success) {
      return { success: false, error: result.error };
    }

    return { success: true, data: updated };
  }

  async deleteTeam(slug: string): Promise<ServiceResult<void>> {
    // Check if referenced as bridge_to
    const teams = await fileService.listTeams();
    if (teams.success && teams.data) {
      const isBridgeTarget = teams.data.some(team =>
        team.bridge_to === slug && team.slug !== slug
      );
      if (isBridgeTarget) {
        return {
          success: false,
          error: 'Cannot delete: This team is referenced as a bridge target by another team'
        };
      }
    }

    return fileService.deleteTeam(slug);
  }

  // ==========================================================================
  // Query Operations
  // ==========================================================================

  async listTeams(): Promise<ServiceResult<Team[]>> {
    return fileService.listTeams();
  }

  async getTeam(slug: string): Promise<ServiceResult<Team>> {
    return fileService.readTeam(slug);
  }

  async getTeamsByType(type: 'upper' | 'lower'): Promise<ServiceResult<Team[]>> {
    const result = await fileService.listTeams();
    if (!result.success || !result.data) {
      return result;
    }

    const filtered = result.data.filter(t => t.type === type);
    return { success: true, data: filtered };
  }

  async findTeamByMember(expertSlug: string): Promise<ServiceResult<Team[]>> {
    const result = await fileService.listTeams();
    if (!result.success || !result.data) {
      return result;
    }

    const filtered = result.data.filter(team =>
      team.members.some(m => m.expert_slug === expertSlug)
    );

    return { success: true, data: filtered };
  }

  // ==========================================================================
  // Member Management
  // ==========================================================================

  async addMember(
    teamSlug: string,
    member: TeamMember
  ): Promise<ServiceResult<Team>> {
    const teamResult = await fileService.readTeam(teamSlug);
    if (!teamResult.success || !teamResult.data) {
      return { success: false, error: `Team not found: ${teamSlug}` };
    }

    // Validate expert exists
    const expertExists = await validationService.checkTeamMemberExists(member.expert_slug);
    if (!expertExists) {
      return {
        success: false,
        error: `Expert not found: ${member.expert_slug}`
      };
    }

    const team = teamResult.data;
    const updatedMembers = [...team.members, member];

    return this.updateTeam(teamSlug, { members: updatedMembers });
  }

  async removeMember(
    teamSlug: string,
    expertSlug: string
  ): Promise<ServiceResult<Team>> {
    const teamResult = await fileService.readTeam(teamSlug);
    if (!teamResult.success || !teamResult.data) {
      return { success: false, error: `Team not found: ${teamSlug}` };
    }

    const team = teamResult.data;
    const updatedMembers = team.members.filter(m => m.expert_slug !== expertSlug);

    // Check if removing leader
    const wasLeader = team.members.find(m => m.expert_slug === expertSlug)?.is_leader;
    if (wasLeader && updatedMembers.length > 0) {
      // Check if there's still a leader
      const hasLeader = updatedMembers.some(m => m.is_leader);
      if (!hasLeader) {
        return {
          success: false,
          error: 'Cannot remove the only leader. Designate another leader first.'
        };
      }
    }

    return this.updateTeam(teamSlug, { members: updatedMembers });
  }

  async updateMember(
    teamSlug: string,
    expertSlug: string,
    updates: Partial<TeamMember>
  ): Promise<ServiceResult<Team>> {
    const teamResult = await fileService.readTeam(teamSlug);
    if (!teamResult.success || !teamResult.data) {
      return { success: false, error: `Team not found: ${teamSlug}` };
    }

    const team = teamResult.data;
    const memberIndex = team.members.findIndex(m => m.expert_slug === expertSlug);

    if (memberIndex === -1) {
      return { success: false, error: `Member not found: ${expertSlug}` };
    }

    const updatedMembers = [...team.members];
    updatedMembers[memberIndex] = {
      ...updatedMembers[memberIndex],
      ...updates
    };

    return this.updateTeam(teamSlug, { members: updatedMembers });
  }

  async setLeader(
    teamSlug: string,
    expertSlug: string
  ): Promise<ServiceResult<Team>> {
    const teamResult = await fileService.readTeam(teamSlug);
    if (!teamResult.success || !teamResult.data) {
      return { success: false, error: `Team not found: ${teamSlug}` };
    }

    const team = teamResult.data;
    const updatedMembers = team.members.map(m => ({
      ...m,
      is_leader: m.expert_slug === expertSlug
    }));

    return this.updateTeam(teamSlug, { members: updatedMembers });
  }

  async setBridgeMember(
    teamSlug: string,
    expertSlug: string
  ): Promise<ServiceResult<Team>> {
    const teamResult = await fileService.readTeam(teamSlug);
    if (!teamResult.success || !teamResult.data) {
      return { success: false, error: `Team not found: ${teamSlug}` };
    }

    // Clear existing bridge member first
    const team = teamResult.data;
    const updatedMembers = team.members.map(m => ({
      ...m,
      is_bridge: m.expert_slug === expertSlug
    }));

    return this.updateTeam(teamSlug, { members: updatedMembers });
  }

  // ==========================================================================
  // Bridge Management
  // ==========================================================================

  async setBridgeTarget(
    teamSlug: string,
    targetTeamSlug: string | null
  ): Promise<ServiceResult<Team>> {
    if (targetTeamSlug) {
      // Validate target team exists
      const targetResult = await fileService.readTeam(targetTeamSlug);
      if (!targetResult.success || !targetResult.data) {
        return { success: false, error: `Target team not found: ${targetTeamSlug}` };
      }
    }

    return this.updateTeam(teamSlug, { bridge_to: targetTeamSlug });
  }

  async getBridgeChain(teamSlug: string): Promise<ServiceResult<Team[]>> {
    const chain: Team[] = [];
    let currentSlug = teamSlug;
    const visited = new Set<string>();

    while (currentSlug && !visited.has(currentSlug)) {
      visited.add(currentSlug);
      const result = await fileService.readTeam(currentSlug);

      if (!result.success || !result.data) {
        break;
      }

      chain.push(result.data);

      if (!result.data.bridge_to) {
        break;
      }

      currentSlug = result.data.bridge_to;
    }

    // Detect cycles
    if (currentSlug && visited.has(currentSlug)) {
      return { success: false, error: 'Circular bridge reference detected' };
    }

    return { success: true, data: chain };
  }

  // ==========================================================================
  // Team Analysis
  // ==========================================================================

  async analyzeTeam(teamSlug: string): Promise<ServiceResult<TeamCompositionAnalysis>> {
    const teamResult = await fileService.readTeam(teamSlug);
    if (!teamResult.success || !teamResult.data) {
      return { success: false, error: `Team not found: ${teamSlug}` };
    }

    const team = teamResult.data;
    const analysis: TeamCompositionAnalysis = {
      valid: true,
      errors: [],
      warnings: [],
      hasLeader: false,
      hasOrchestrator: false,
      hasArchitect: false,
      phaseCoverage: [],
      size: {
        current: team.members.length,
        recommended: team.type === 'upper' ? { min: 3, max: 8 } : { min: 2, max: 6 }
      }
    };

    // Check for leader
    analysis.hasLeader = team.members.some(m => m.is_leader);
    if (!analysis.hasLeader) {
      analysis.errors.push('Team must have at least one leader');
      analysis.valid = false;
    }

    // Check team composition
    if (team.type === 'upper') {
      for (const member of team.members) {
        const role = member.role.toLowerCase();
        if (role.includes('orchestrator')) {
          analysis.hasOrchestrator = true;
        }
        if (role.includes('architect') || role.includes('designer')) {
          analysis.hasArchitect = true;
        }
      }

      if (!analysis.hasOrchestrator) {
        analysis.errors.push('Upper team must have an orchestrator');
        analysis.valid = false;
      }
      if (!analysis.hasArchitect) {
        analysis.errors.push('Upper team must have an architect');
        analysis.valid = false;
      }
    }

    // Analyze phase coverage
    const phaseRoutingKeys = Object.keys(team.phase_routing).filter(k =>
      team.phase_routing[k as keyof typeof team.phase_routing]
    );
    analysis.phaseCoverage = phaseRoutingKeys;

    if (analysis.phaseCoverage.length === 0) {
      analysis.warnings.push('No phase routing configured');
    }

    // Size warnings
    if (team.members.length < analysis.size.recommended.min) {
      analysis.warnings.push(
        `Team size (${team.members.length}) is below recommended minimum (${analysis.size.recommended.min})`
      );
    } else if (team.members.length > analysis.size.recommended.max) {
      analysis.warnings.push(
        `Team size (${team.members.length}) exceeds recommended maximum (${analysis.size.recommended.max})`
      );
    }

    return { success: true, data: analysis };
  }

  async getExpertUsage(expertSlug: string): Promise<ServiceResult<{
    teams: Array<{ name: string; slug: string; role: string }>;
    isLeader: boolean;
    isBridge: boolean;
  }>> {
    const teamsResult = await fileService.listTeams();
    if (!teamsResult.success || !teamsResult.data) {
      return { success: false, error: teamsResult.error };
    }

    const teams = teamsResult.data
      .filter(team => team.members.some(m => m.expert_slug === expertSlug))
      .map(team => {
        const member = team.members.find(m => m.expert_slug === expertSlug)!;
        return {
          name: team.name,
          slug: team.slug,
          role: member.role
        };
      });

    const isLeader = teamsResult.data.some(team =>
      team.members.some(m => m.expert_slug === expertSlug && m.is_leader)
    );

    const isBridge = teamsResult.data.some(team =>
      team.members.some(m => m.expert_slug === expertSlug && m.is_bridge)
    );

    return {
      success: true,
      data: { teams, isLeader, isBridge }
    };
  }

  // ==========================================================================
  // Utilities
  // ==========================================================================

  private async validateMembersExist(members: TeamMember[]): Promise<{
    valid: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];
    const expertsResult = await fileService.listExperts();

    const expertSlugs = new Set<string>();
    if (expertsResult.success && expertsResult.data) {
      for (const expert of expertsResult.data) {
        expertSlugs.add(expert.slug);
      }
    }

    for (const member of members) {
      if (!expertSlugs.has(member.expert_slug)) {
        errors.push(`Expert not found: ${member.expert_slug}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  private generateTeamId(): string {
    return `team-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  async cloneTeam(
    sourceSlug: string,
    newName: string
  ): Promise<ServiceResult<Team>> {
    const sourceResult = await fileService.readTeam(sourceSlug);
    if (!sourceResult.success || !sourceResult.data) {
      return { success: false, error: `Source team not found: ${sourceSlug}` };
    }

    const source = sourceResult.data;

    // Generate new slug
    const newSlug = slugify(newName);
    const existing = await fileService.listTeams();
    const existingSlugs = existing.success && existing.data
      ? new Set(existing.data.map(t => t.slug))
      : new Set<string>();
    const uniqueSlug = generateUniqueSlug(newSlug, existingSlugs);

    // Create clone
    const cloned: Team = {
      ...source,
      id: this.generateTeamId(),
      name: newName,
      slug: uniqueSlug,
      created_at: new Date().toISOString().split('T')[0]
    };

    const validation = validationService.validateTeam(cloned);
    if (!validation.valid) {
      return {
        success: false,
        error: `Validation failed: ${validation.errors.join(', ')}`
      };
    }

    const result = await fileService.createTeam(cloned);
    if (!result.success) {
      return { success: false, error: result.error };
    }

    return { success: true, data: cloned };
  }

  async getTeamStats(): Promise<ServiceResult<{
    total: number;
    byType: Record<string, number>;
    totalMembers: number;
    avgTeamSize: number;
  }>> {
    const result = await fileService.listTeams();
    if (!result.success || !result.data) {
      return { success: false, error: result.error };
    }

    const teams = result.data;
    const stats = {
      total: teams.length,
      byType: {} as Record<string, number>,
      totalMembers: 0,
      avgTeamSize: 0
    };

    for (const team of teams) {
      stats.byType[team.type] = (stats.byType[team.type] || 0) + 1;
      stats.totalMembers += team.members.length;
    }

    stats.avgTeamSize = teams.length > 0
      ? Math.round((stats.totalMembers / teams.length) * 10) / 10
      : 0;

    return { success: true, data: stats };
  }
}

// Singleton export
export const teamService = new TeamService();
