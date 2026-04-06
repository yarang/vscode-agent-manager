/**
 * FileService - Core file operations for relay-plugin data
 *
 * Handles reading/writing expert definitions, team configurations,
 * spec modules, and domain config from .claude/relay/ directory.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as yaml from 'yaml';
import {
  Expert, Team, DomainConfig, AgentDefinition,
  ServiceResult, CapabilityDefinition, SpecDefinition, SpecType, TemplateExportMeta
} from '../types';
import { generateUniqueSlug, slugify } from '../utils/slugify';

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

  /** Project scope template root: {workspace}/.claude/relay/templates/ */
  getProjectTemplatesRoot(): string {
    return path.join(this.relayRoot, 'templates');
  }

  getProjectSpecsDir(): string {
    return path.join(this.relayRoot, 'templates', 'modules', 'specs');
  }

  getProjectPlatformsDir(): string {
    return path.join(this.relayRoot, 'templates', 'modules', 'platforms');
  }

  getProjectPoliciesDir(): string {
    return path.join(this.relayRoot, 'templates', 'modules', 'policies');
  }

  getProjectBaseDir(): string {
    return path.join(this.relayRoot, 'templates', 'modules', 'base');
  }

  getProjectDefinitionsDir(): string {
    return path.join(this.relayRoot, 'templates', 'definitions');
  }

  /** Return the project-scope directory for a given spec type */
  getProjectDirForType(type: SpecType): string {
    switch (type) {
      case 'platform': return this.getProjectPlatformsDir();
      case 'policy':   return this.getProjectPoliciesDir();
      case 'base':     return this.getProjectBaseDir();
      default:         return this.getProjectSpecsDir();
    }
  }

  getNotifyEventsDir(): string {
    return path.join(this.relayRoot, 'notify', 'events');
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
  // Project Scope Spec Operations
  // ==========================================================================

  async listProjectSpecs(): Promise<ServiceResult<SpecDefinition[]>> {
    try {
      const typeDirs: Array<{ dir: string; type: SpecType }> = [
        { dir: this.getProjectSpecsDir(),     type: 'spec' },
        { dir: this.getProjectPlatformsDir(), type: 'platform' },
        { dir: this.getProjectPoliciesDir(),  type: 'policy' },
        { dir: this.getProjectBaseDir(),      type: 'base' }
      ];

      const specs: SpecDefinition[] = [];

      for (const { dir, type } of typeDirs) {
        if (!fs.existsSync(dir)) { continue; }
        const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
        for (const file of files) {
          const result = await this.readProjectSpec(path.parse(file).name, type);
          if (result.success && result.data) {
            specs.push(result.data);
          }
        }
      }

      return { success: true, data: specs };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  async readProjectSpec(id: string, type: SpecType = 'spec'): Promise<ServiceResult<SpecDefinition>> {
    try {
      const dir = this.getProjectDirForType(type);
      const filePath = path.join(dir, `${id}.md`);
      if (!fs.existsSync(filePath)) {
        return { success: false, error: `Project spec not found: ${id}` };
      }

      const content = fs.readFileSync(filePath, 'utf-8');
      const spec = this.parseSpecMarkdown(content, 'project');
      spec.id = id;
      return { success: true, data: spec };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  async writeProjectSpec(id: string, spec: SpecDefinition): Promise<ServiceResult<void>> {
    try {
      const dir = this.getProjectDirForType(spec.type);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const content = this.generateSpecMarkdown({ ...spec, scope: 'project' });
      fs.writeFileSync(path.join(dir, `${id}.md`), content, 'utf-8');
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  async deleteProjectSpec(id: string, type: SpecType = 'spec'): Promise<ServiceResult<void>> {
    try {
      const dir = this.getProjectDirForType(type);
      const filePath = path.join(dir, `${id}.md`);
      if (!fs.existsSync(filePath)) {
        return { success: false, error: `Project spec not found: ${id}` };
      }
      fs.unlinkSync(filePath);
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  // ==========================================================================
  // Export / Import Operations
  // ==========================================================================

  async exportProjectTemplates(outputPath: string): Promise<ServiceResult<TemplateExportMeta>> {
    try {
      const templatesRoot = this.getProjectTemplatesRoot();
      if (!fs.existsSync(templatesRoot)) {
        return { success: false, error: 'No project templates found. Run /relay:setup first.' };
      }

      if (!fs.existsSync(outputPath)) {
        fs.mkdirSync(outputPath, { recursive: true });
      }

      const configResult = await this.readDomainConfig();
      const projectName = configResult.data?.project_name ?? 'unknown';

      const copiedFiles: string[] = [];
      this.copyDirRecursive(templatesRoot, outputPath, copiedFiles);

      const meta: TemplateExportMeta = {
        exported_at: new Date().toISOString(),
        source_project: projectName,
        scope: 'project',
        files: copiedFiles
      };

      fs.writeFileSync(
        path.join(outputPath, 'relay-templates-export.json'),
        JSON.stringify(meta, null, 2),
        'utf-8'
      );

      return { success: true, data: meta };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  async importProjectTemplates(
    sourcePath: string,
    conflictMode: 'skip' | 'overwrite' | 'rename'
  ): Promise<ServiceResult<{ imported: number; skipped: number }>> {
    try {
      const metaPath = path.join(sourcePath, 'relay-templates-export.json');
      if (!fs.existsSync(metaPath)) {
        return { success: false, error: 'relay-templates-export.json not found in source path' };
      }

      const meta: TemplateExportMeta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
      const destRoot = this.getProjectTemplatesRoot();

      if (!fs.existsSync(destRoot)) {
        fs.mkdirSync(destRoot, { recursive: true });
      }

      let imported = 0;
      let skipped = 0;

      for (const relFile of meta.files) {
        const srcFile = path.join(sourcePath, relFile);
        let destFile = path.join(destRoot, relFile);

        if (!fs.existsSync(srcFile)) {
          continue;
        }

        if (fs.existsSync(destFile)) {
          if (conflictMode === 'skip') {
            skipped++;
            continue;
          } else if (conflictMode === 'rename') {
            destFile = destFile.replace(/\.md$/, '.imported.md');
          }
          // 'overwrite' falls through
        }

        const destDir = path.dirname(destFile);
        if (!fs.existsSync(destDir)) {
          fs.mkdirSync(destDir, { recursive: true });
        }

        // Ensure scope: project in frontmatter
        let content = fs.readFileSync(srcFile, 'utf-8');
        content = this.ensureProjectScope(content);

        fs.writeFileSync(destFile, content, 'utf-8');
        imported++;
      }

      return { success: true, data: { imported, skipped } };
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
  // Legacy compatibility wrappers (deprecated, use SpecDefinition APIs)
  // ==========================================================================

  /** @deprecated Use TemplateService.listSpecs() instead */
  async listCapabilities(): Promise<ServiceResult<CapabilityDefinition[]>> {
    return { success: true, data: [] };
  }

  /** @deprecated Use TemplateService.resolveSpec() instead */
  async readCapability(_id: string): Promise<ServiceResult<CapabilityDefinition>> {
    return { success: false, error: 'Use TemplateService.resolveSpec() instead' };
  }

  /** @deprecated Use writeProjectSpec() instead */
  async upsertCapability(
    definition: Partial<CapabilityDefinition> & { title: string; content: string; id?: string }
  ): Promise<ServiceResult<CapabilityDefinition>> {
    try {
      const specsDir = this.getProjectSpecsDir();
      if (!fs.existsSync(specsDir)) {
        fs.mkdirSync(specsDir, { recursive: true });
      }

      const existing = await this.listProjectSpecs();
      const existingIds = new Set((existing.data || []).map(s => s.id));
      const baseId = definition.id || slugify(definition.title);
      const id = definition.id || generateUniqueSlug(baseId, existingIds);

      const spec: SpecDefinition = {
        id,
        type: 'spec',
        scope: 'project',
        version: 1,
        tags: [],
        content: definition.content
      };

      await this.writeProjectSpec(id, spec);

      return {
        success: true,
        data: {
          id,
          title: definition.title,
          content: definition.content,
          created_at: definition.created_at || new Date().toISOString().split('T')[0]
        }
      };
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

    const fm = yaml.parse(frontmatterMatch[1]) as Partial<Expert> & { capabilities?: string[] };
    return {
      role: fm.role || '',
      slug: fm.slug || '',
      domain: fm.domain || 'general',
      backed_by: fm.backed_by || 'claude',
      cli: fm.cli,
      model: fm.model,
      fallback_cli: fm.fallback_cli,
      tier: fm.tier || 'standard',
      permission_mode: fm.permission_mode || 'default',
      memory: fm.memory,
      isolation: fm.isolation,
      phases: fm.phases || [],
      agent_profile: fm.agent_profile,
      default_platform: fm.default_platform,
      persona: '',
      // Backward compat: read 'specs' first, fall back to 'capabilities'
      specs: fm.specs ?? fm.capabilities ?? [],
      capabilities: fm.capabilities ?? [],
      constraints: fm.constraints || [],
      created_at: fm.created_at || new Date().toISOString().split('T')[0]
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
      specs: expert.specs ?? [],
      constraints: expert.constraints,
      created_at: expert.created_at
    };

    // Remove undefined fields
    Object.keys(frontmatter).forEach(k => {
      if (frontmatter[k] === undefined || frontmatter[k] === null) {
        delete frontmatter[k];
      }
    });

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

    return content;
  }

  parseSpecMarkdown(content: string, defaultScope: 'user' | 'project' = 'user'): SpecDefinition {
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n?/);
    const fm = frontmatterMatch ? yaml.parse(frontmatterMatch[1]) as Partial<SpecDefinition> : {};
    const body = frontmatterMatch ? content.slice(frontmatterMatch[0].length).trim() : content.trim();

    return {
      id: fm.id || '',
      type: fm.type || 'spec',
      scope: fm.scope || defaultScope,
      version: fm.version || 1,
      tags: fm.tags || [],
      requires: fm.requires,
      conflicts_with: fm.conflicts_with,
      content: body
    };
  }

  generateSpecMarkdown(spec: SpecDefinition): string {
    const fm: Record<string, unknown> = {
      id: spec.id,
      type: spec.type,
      scope: spec.scope,
      version: spec.version,
    };
    if (spec.tags?.length) { fm['tags'] = spec.tags; }
    if (spec.requires?.length) { fm['requires'] = spec.requires; }
    if (spec.conflicts_with?.length) { fm['conflicts_with'] = spec.conflicts_with; }

    return `---\n${yaml.stringify(fm)}---\n\n${spec.content.trim()}\n`;
  }

  private ensureProjectScope(content: string): string {
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!frontmatterMatch) { return content; }

    const fm = yaml.parse(frontmatterMatch[1]) as Record<string, unknown>;
    fm['scope'] = 'project';

    return content.replace(frontmatterMatch[0], `---\n${yaml.stringify(fm)}---`);
  }

  private copyDirRecursive(src: string, dest: string, collected: string[]): void {
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        if (!fs.existsSync(destPath)) {
          fs.mkdirSync(destPath, { recursive: true });
        }
        this.copyDirRecursive(srcPath, destPath, collected);
      } else if (entry.name.endsWith('.md')) {
        fs.copyFileSync(srcPath, destPath);
        // Store relative path from templates root
        const relPath = path.relative(this.getProjectTemplatesRoot(), srcPath);
        collected.push(relPath);
      }
    }
  }
}

// Singleton export
export const fileService = new FileService();
