/**
 * FileService - Core file operations for relay-plugin data
 *
 * Handles reading/writing expert definitions, team configurations,
 * agent definitions, and domain config from .claude/relay/ directory.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as yaml from 'yaml';
import { Expert, Team, DomainConfig, AgentDefinition, ServiceResult } from '../types';

export class FileService {
  private workspaceRoot: string;
  private relayRoot: string;

  constructor() {
    this.workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
    this.relayRoot = path.join(this.workspaceRoot, '.claude', 'relay');
  }

  // ==========================================================================
  // Path Helpers
  // ==========================================================================

  getRelayRoot(): string {
    return this.relayRoot;
  }

  getExpertsDir(): string {
    return path.join(this.relayRoot, 'experts');
  }

  getTeamsDir(): string {
    return path.join(this.relayRoot, 'teams');
  }

  getAgentDefinitionsDir(): string {
    return path.join(this.relayRoot, 'agent-library', 'definitions');
  }

  getDomainConfigPath(): string {
    return path.join(this.relayRoot, 'domain-config.json');
  }

  // ==========================================================================
  // Expert Operations
  // ==========================================================================

  async listExperts(): Promise<ServiceResult<Expert[]>> {
    try {
      const expertsDir = this.getExpertsDir();
      if (!fs.existsSync(expertsDir)) {
        return { success: true, data: [] };
      }

      const files = fs.readdirSync(expertsDir).filter(f => f.endsWith('.md'));
      const experts: Expert[] = [];

      for (const file of files) {
        const filePath = path.join(expertsDir, file);
        const expert = await this.readExpert(path.parse(file).name);
        if (expert.success && expert.data) {
          experts.push(expert.data);
        }
      }

      return { success: true, data: experts };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  async readExpert(slug: string): Promise<ServiceResult<Expert>> {
    try {
      const filePath = path.join(this.getExpertsDir(), `${slug}.md`);
      if (!fs.existsSync(filePath)) {
        return { success: false, error: `Expert not found: ${slug}` };
      }

      const content = fs.readFileSync(filePath, 'utf-8');
      const expert = this.parseExpertMarkdown(content);
      expert.slug = slug;

      return { success: true, data: expert };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  async createExpert(expert: Expert): Promise<ServiceResult<string>> {
    try {
      const filePath = path.join(this.getExpertsDir(), `${expert.slug}.md`);

      // Ensure directory exists
      if (!fs.existsSync(this.getExpertsDir())) {
        fs.mkdirSync(this.getExpertsDir(), { recursive: true });
      }

      const content = this.generateExpertMarkdown(expert);
      fs.writeFileSync(filePath, content, 'utf-8');

      return { success: true, data: filePath };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  async updateExpert(slug: string, expert: Expert): Promise<ServiceResult<void>> {
    try {
      const filePath = path.join(this.getExpertsDir(), `${slug}.md`);

      if (!fs.existsSync(filePath)) {
        return { success: false, error: `Expert not found: ${slug}` };
      }

      const content = this.generateExpertMarkdown(expert);
      fs.writeFileSync(filePath, content, 'utf-8');

      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  async deleteExpert(slug: string): Promise<ServiceResult<void>> {
    try {
      const filePath = path.join(this.getExpertsDir(), `${slug}.md`);

      if (!fs.existsSync(filePath)) {
        return { success: false, error: `Expert not found: ${slug}` };
      }

      fs.unlinkSync(filePath);
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  // ==========================================================================
  // Team Operations
  // ==========================================================================

  async listTeams(): Promise<ServiceResult<Team[]>> {
    try {
      const teamsDir = this.getTeamsDir();
      if (!fs.existsSync(teamsDir)) {
        return { success: true, data: [] };
      }

      const files = fs.readdirSync(teamsDir).filter(f => f.endsWith('.json'));
      const teams: Team[] = [];

      for (const file of files) {
        const filePath = path.join(teamsDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const team = JSON.parse(content) as Team;
        teams.push(team);
      }

      return { success: true, data: teams };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  async readTeam(id: string): Promise<ServiceResult<Team>> {
    try {
      const filePath = path.join(this.getTeamsDir(), `${id}.json`);
      if (!fs.existsSync(filePath)) {
        return { success: false, error: `Team not found: ${id}` };
      }

      const content = fs.readFileSync(filePath, 'utf-8');
      const team = JSON.parse(content) as Team;

      return { success: true, data: team };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  async createTeam(team: Team): Promise<ServiceResult<string>> {
    try {
      const filePath = path.join(this.getTeamsDir(), `${team.slug}.json`);

      if (!fs.existsSync(this.getTeamsDir())) {
        fs.mkdirSync(this.getTeamsDir(), { recursive: true });
      }

      fs.writeFileSync(filePath, JSON.stringify(team, null, 2), 'utf-8');
      return { success: true, data: filePath };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  async updateTeam(slug: string, team: Team): Promise<ServiceResult<void>> {
    try {
      const filePath = path.join(this.getTeamsDir(), `${slug}.json`);

      if (!fs.existsSync(filePath)) {
        return { success: false, error: `Team not found: ${slug}` };
      }

      fs.writeFileSync(filePath, JSON.stringify(team, null, 2), 'utf-8');
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  async deleteTeam(slug: string): Promise<ServiceResult<void>> {
    try {
      const filePath = path.join(this.getTeamsDir(), `${slug}.json`);

      if (!fs.existsSync(filePath)) {
        return { success: false, error: `Team not found: ${slug}` };
      }

      fs.unlinkSync(filePath);
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  // ==========================================================================
  // Domain Config Operations
  // ==========================================================================

  async readDomainConfig(): Promise<ServiceResult<DomainConfig | null>> {
    try {
      const filePath = this.getDomainConfigPath();
      if (!fs.existsSync(filePath)) {
        return { success: true, data: null };
      }

      const content = fs.readFileSync(filePath, 'utf-8');
      const config = JSON.parse(content) as DomainConfig;
      return { success: true, data: config };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  async writeDomainConfig(config: DomainConfig): Promise<ServiceResult<void>> {
    try {
      const filePath = this.getDomainConfigPath();
      fs.writeFileSync(filePath, JSON.stringify(config, null, 2), 'utf-8');
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  private parseExpertMarkdown(content: string): Expert {
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!frontmatterMatch) {
      throw new Error('No YAML frontmatter found');
    }

    const frontmatter = yaml.parse(frontmatterMatch[1]) as Partial<Expert>;
    return {
      role: frontmatter.role || '',
      slug: frontmatter.slug || '',
      domain: frontmatter.domain || 'general',
      backed_by: frontmatter.backed_by || 'claude',
      cli: frontmatter.cli,
      model: frontmatter.model,
      fallback_cli: frontmatter.fallback_cli,
      tier: frontmatter.tier || 'standard',
      permission_mode: frontmatter.permission_mode || 'default',
      memory: frontmatter.memory,
      isolation: frontmatter.isolation,
      phases: frontmatter.phases || [],
      agent_profile: frontmatter.agent_profile,
      default_platform: frontmatter.default_platform,
      persona: '',
      capabilities: [],
      constraints: [],
      created_at: frontmatter.created_at || new Date().toISOString().split('T')[0]
    };
  }

  private generateExpertMarkdown(expert: Expert): string {
    const frontmatter: Record<string, unknown> = {
      role: expert.role,
      slug: expert.slug,
      domain: expert.domain,
      backed_by: expert.backed_by,
      cli: expert.cli,
      model: expert.model,
      fallback_cli: expert.fallback_cli,
      tier: expert.tier,
      permission_mode: expert.permission_mode,
      memory: expert.memory,
      isolation: expert.isolation,
      phases: expert.phases,
      agent_profile: expert.agent_profile,
      default_platform: expert.default_platform,
      created_at: expert.created_at
    };

    let content = `---\n${yaml.stringify(frontmatter)}---\n\n`;
    content += `# ${expert.role}\n\n`;

    if (expert.persona) {
      content += `## 페르소나\n\n${expert.persona}\n\n`;
    }

    if (expert.capabilities && expert.capabilities.length > 0) {
      content += `## 역량\n\n`;
      expert.capabilities.forEach(cap => {
        content += `- ${cap}\n`;
      });
      content += '\n';
    }

    if (expert.constraints && expert.constraints.length > 0) {
      content += `## 제약\n\n`;
      expert.constraints.forEach(con => {
        content += `- ${con}\n`;
      });
      content += '\n';
    }

    return content;
  }
}

// Singleton export
export const fileService = new FileService();
