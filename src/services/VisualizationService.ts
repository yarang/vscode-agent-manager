/**
 * VisualizationService - Diagram generation for agent hierarchy
 *
 * Generates Mermaid diagrams for:
 * - Team structure visualization
 * - Expert hierarchy
 * - Agent relationships
 */

import { Team, Expert } from '../types';

export class VisualizationService {
  // ==========================================================================
  // Team Structure Diagrams
  // ==========================================================================

  /**
   * Generate Mermaid flowchart for team structure
   */
  generateTeamDiagram(teams: Team[]): string {
    if (teams.length === 0) {
      return this.getEmptyDiagram('No teams configured');
    }

    let mermaid = 'graph TB\n';
    mermaid += '    %% Team Structure Diagram\n';
    mermaid += '    classDef teamClass fill:#1f77b4,stroke:#08519c,stroke-width:2px,color:#fff\n';
    mermaid += '    classDef leaderClass fill:#ff7f0e,stroke:#d62728,stroke-width:2px,color:#fff\n';
    mermaid += '    classDef memberClass fill:#2ca02c,stroke:#1f77b4,stroke-width:1px,color:#fff\n';
    mermaid += '    classDef bridgeClass fill:#9467bd,stroke:#6a51a3,stroke-width:2px,color:#fff\n\n';

    teams.forEach((team, teamIndex) => {
      const teamId = `T${teamIndex}`;
      const teamLabel = this.sanitizeLabel(`${team.name}\\n(${team.type})`);

      // Team node
      mermaid += `    ${teamId}["${teamLabel}"]:::teamClass\n`;

      // Add members
      team.members.forEach((member, memberIndex) => {
        const memberId = `${teamId}M${memberIndex}`;
        const memberLabel = this.sanitizeLabel(member.role);
        const memberClass = member.is_leader ? 'leaderClass' : 'memberClass';

        if (member.is_bridge) {
          mermaid += `    ${memberId}["${memberLabel}\\n🌉"]:::bridgeClass\n`;
        } else {
          mermaid += `    ${memberId}["${memberLabel}"]:::${memberClass}\n`;
        }

        // Connect to team
        mermaid += `    ${teamId} --> ${memberId}\n`;
      });

      mermaid += '\n';
    });

    return mermaid;
  }

  /**
   * Generate Mermaid diagram for single team with members
   */
  generateSingleTeamDiagram(team: Team): string {
    let mermaid = 'graph TB\n';
    mermaid += '    %% Single Team Structure\n';
    mermaid += '    classDef teamClass fill:#1f77b4,stroke:#08519c,stroke-width:3px,color:#fff\n';
    mermaid += '    classDef leaderClass fill:#ff7f0e,stroke:#d62728,stroke-width:2px,color:#fff\n';
    mermaid += '    classDef memberClass fill:#2ca02c,stroke:#1f77b4,stroke-width:1px,color:#fff\n';
    mermaid += '    classDef bridgeClass fill:#9467bd,stroke:#6a51a3,stroke-width:2px,color:#fff\n';
    mermaid += '    classDef expertRef fill:#17becf,stroke:#00d2d3,stroke-width:1px,stroke-dasharray: 3 3,color:#fff\n\n';

    // Team node
    const teamLabel = this.sanitizeLabel(`${team.name}\\n${team.type}\\n${team.execution_mode}`);
    mermaid += `    Root["${teamLabel}"]:::teamClass\n\n`;

    // Coordinator
    const coordLabel = this.sanitizeLabel(`Coordinator\\n${team.coordinator}\\n${team.coordinator_model}`);
    mermaid += `    Coordinator["${coordLabel}"]:::leaderClass\n`;
    mermaid += `    Root --> Coordinator\n\n`;

    // Members grouped by role
    const leaders = team.members.filter(m => m.is_leader);
    const members = team.members.filter(m => !m.is_leader);

    leaders.forEach((member, index) => {
      const memberId = `Leader${index}`;
      const memberLabel = this.sanitizeLabel(`${member.role}\\n⭐`);
      const memberClass = member.is_bridge ? 'bridgeClass' : 'leaderClass';

      mermaid += `    ${memberId}["${memberLabel}"]:::${memberClass}\n`;
      mermaid += `    Coordinator --> ${memberId}\n`;
    });

    members.forEach((member, index) => {
      const memberId = `Member${index}`;
      const memberLabel = this.sanitizeLabel(`${member.role}\\n${member.expert_slug}`);
      const memberClass = member.is_bridge ? 'bridgeClass' : 'memberClass';

      mermaid += `    ${memberId}["${memberLabel}"]:::${memberClass}\n`;

      // Connect to leader if exists
      if (leaders.length > 0) {
        mermaid += `    Leader0 --> ${memberId}\n`;
      } else {
        mermaid += `    Coordinator --> ${memberId}\n`;
      }
    });

    // Decision mode annotation
    mermaid += `\n    %% Decision Mode: ${team.decision_mode}\n`;

    return mermaid;
  }

  // ==========================================================================
  // Expert Hierarchy Diagrams
  // ==========================================================================

  /**
   * Generate Mermaid diagram for expert hierarchy by domain
   */
  generateExpertHierarchyDiagram(experts: Expert[]): string {
    if (experts.length === 0) {
      return this.getEmptyDiagram('No experts defined');
    }

    // Group by domain
    const byDomain = experts.reduce((acc, expert) => {
      if (!acc[expert.domain]) {
        acc[expert.domain] = [];
      }
      acc[expert.domain].push(expert);
      return acc;
    }, {} as Record<string, Expert[]>);

    let mermaid = 'graph LR\n';
    mermaid += '    %% Expert Hierarchy by Domain\n';
    mermaid += '    classDef domainClass fill:#1f77b4,stroke:#08519c,stroke-width:2px,color:#fff\n';
    mermaid += '    classDef expertClass fill:#2ca02c,stroke:#1f77b4,stroke-width:1px,color:#fff\n';
    mermaid += '    classDef claudeClass fill:#d62728,stroke:#a50f15,stroke-width:1px,color:#fff\n';
    mermaid += '    classDef codexClass fill:#ff7f0e,stroke:#d62728,stroke-width:1px,color:#fff\n';
    mermaid += '    classDef geminiClass fill:#9467bd,stroke:#6a51a3,stroke-width:1px,color:#fff\n';
    mermaid += '    classDef zaiClass fill:#17becf,stroke:#00d2d3,stroke-width:1px,color:#fff\n\n';

    Object.entries(byDomain).forEach(([domain, domainExperts], domainIndex) => {
      const domainId = `D${domainIndex}`;
      mermaid += `    subgraph ${domainId}["${domain}"]\n`;
      mermaid += `        direction TB\n`;
      mermaid += `        D${domainIndex}_Root["${domain} Domain"]:::domainClass\n\n`;

      domainExperts.forEach((expert, expertIndex) => {
        const expertId = `${domainId}E${expertIndex}`;
        const expertLabel = this.sanitizeLabel(`${expert.role}\\n${expert.tier}`);
        const backedByClass = `${expert.backed_by}Class`;

        mermaid += `        ${expertId}["${expertLabel}"]:::${backedByClass}\n`;
        mermaid += `        D${domainIndex}_Root --> ${expertId}\n`;
      });

      mermaid += `    end\n\n`;
    });

    return mermaid;
  }

  /**
   * Generate Mermaid mind map for expert capabilities
   */
  generateExpertMindMap(expert: Expert): string {
    let mermaid = 'mindmap\n';
    mermaid += '    %% Expert Capabilities Mind Map\n';
    mermaid += `    root((${this.sanitizeLabel(expert.role)}))\n`;
    mermaid += `        Domain(${expert.domain})\n`;
    mermaid += `        Tier[${expert.tier}]\n`;
    mermaid += `        BackedBy(${expert.backed_by})\n`;

    if (expert.capabilities && expert.capabilities.length > 0) {
      mermaid += `        Capabilities\n`;
      expert.capabilities.forEach(cap => {
        mermaid += `            ${this.sanitizeLabel(cap, 30)}\n`;
      });
    }

    if (expert.constraints && expert.constraints.length > 0) {
      mermaid += `        Constraints\n`;
      expert.constraints.forEach(con => {
        mermaid += `            ${this.sanitizeLabel(con, 30)}\n`;
      });
    }

    if (expert.phases && expert.phases.length > 0) {
      mermaid += `        Phases\n`;
      expert.phases.forEach(phase => {
        mermaid += `            ${phase}\n`;
      });
    }

    return mermaid;
  }

  // ==========================================================================
  // Combined Overview Diagram
  // ==========================================================================

  /**
   * Generate comprehensive overview diagram
   */
  generateOverviewDiagram(teams: Team[], experts: Expert[]): string {
    let mermaid = 'graph TB\n';
    mermaid += '    %% Agent Manager Overview\n';
    mermaid += '    classDef containerClass fill:#34495e,stroke:#2c3e50,stroke-width:2px,color:#fff\n';
    mermaid += '    classDef teamClass fill:#1f77b4,stroke:#08519c,stroke-width:2px,color:#fff\n';
    mermaid += '    classDef expertClass fill:#2ca02c,stroke:#1f77b4,stroke-width:1px,color:#fff\n';
    mermaid += '    classDef statClass fill:#95a5a6,stroke:#7f8c8d,stroke-width:1px,color:#fff\n\n';

    // Stats
    mermaid += `    TeamsContainer["📊 Teams: ${teams.length}"]:::statClass\n`;
    mermaid += `    ExpertsContainer["👥 Experts: ${experts.length}"]:::statClass\n\n`;

    // Team summary
    const upperTeams = teams.filter(t => t.type === 'upper').length;
    const lowerTeams = teams.filter(t => t.type === 'lower').length;

    mermaid += `    UpperTeams["Upper Teams: ${upperTeams}"]:::teamClass\n`;
    mermaid += `    LowerTeams["Lower Teams: ${lowerTeams}"]:::teamClass\n`;
    mermaid += `    TeamsContainer --> UpperTeams\n`;
    mermaid += `    TeamsContainer --> LowerTeams\n\n`;

    // Expert summary by domain
    const byDomain = experts.reduce((acc, e) => {
      acc[e.domain] = (acc[e.domain] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    Object.entries(byDomain).forEach(([domain, count]) => {
      mermaid += `    ${domain}Experts["${domain}: ${count}"]:::expertClass\n`;
      mermaid += `    ExpertsContainer --> ${domain}Experts\n`;
    });

    return mermaid;
  }

  // ==========================================================================
  // Helper Methods
  // ==========================================================================

  private sanitizeLabel(text: string, maxLength = 50): string {
    // Escape special Mermaid characters
    let sanitized = text
      .replace(/"/g, '#quot;')
      .replace(/\[/g, '#91;')
      .replace(/\]/g, '#93;')
      .replace(/\{/g, '#123;')
      .replace(/\}/g, '#125;')
      .replace(/\(/g, '#40;')
      .replace(/\)/g, '#41;');

    // Truncate if too long
    if (sanitized.length > maxLength) {
      sanitized = sanitized.substring(0, maxLength - 3) + '...';
    }

    return sanitized;
  }

  private getEmptyDiagram(message: string): string {
    return `graph TB
    Empty["${message}"]
    classDef emptyClass fill:#95a5a6,stroke:#7f8c8d,stroke-width:1px,color:#fff
    Empty:::emptyClass`;
  }

  // ==========================================================================
  // Statistics for Dashboard
  // ==========================================================================

  getTeamStats(teams: Team[]): {
    total: number;
    upper: number;
    lower: number;
    totalMembers: number;
    coordinators: Record<string, number>;
  } {
    const coordinators: Record<string, number> = {};

    teams.forEach(team => {
      coordinators[team.coordinator] = (coordinators[team.coordinator] || 0) + 1;
    });

    return {
      total: teams.length,
      upper: teams.filter(t => t.type === 'upper').length,
      lower: teams.filter(t => t.type === 'lower').length,
      totalMembers: teams.reduce((sum, t) => sum + t.members.length, 0),
      coordinators
    };
  }

  getExpertStats(experts: Expert[]): {
    total: number;
    byDomain: Record<string, number>;
    byBackedBy: Record<string, number>;
    byTier: Record<string, number>;
  } {
    const byDomain: Record<string, number> = {};
    const byBackedBy: Record<string, number> = {};
    const byTier: Record<string, number> = {};

    experts.forEach(expert => {
      byDomain[expert.domain] = (byDomain[expert.domain] || 0) + 1;
      byBackedBy[expert.backed_by] = (byBackedBy[expert.backed_by] || 0) + 1;
      byTier[expert.tier] = (byTier[expert.tier] || 0) + 1;
    });

    return {
      total: experts.length,
      byDomain,
      byBackedBy,
      byTier
    };
  }
}

// Singleton export
export const visualizationService = new VisualizationService();
