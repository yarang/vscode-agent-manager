/**
 * TemplateService - User scope + Project scope template resolution
 *
 * Resolution rule: project scope overrides user scope when both
 * define a module with the same id.
 *
 * User scope  : relay-plugin/docs/templates/  (read-only, shipped with plugin)
 * Project scope: {workspace}/.claude/relay/templates/  (per-project, mutable)
 */

import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';
import { SpecDefinition, SpecType, ResolvedSpec } from '../types';
import { FileService } from './FileService';

export class TemplateService {
  private pluginRoot: string | undefined;
  private fileService: FileService;

  constructor(fileService: FileService) {
    this.fileService = fileService;
    this.pluginRoot = this.resolvePluginRoot();
  }

  // ==========================================================================
  // Public API
  // ==========================================================================

  /**
   * List all specs from user + project scope, merged.
   * Project scope wins when id collides.
   */
  async listSpecs(filterType?: SpecType): Promise<ResolvedSpec[]> {
    const userSpecs = await this.loadUserScopeSpecs(filterType);
    const projectSpecs = await this.loadProjectScopeSpecs(filterType);

    const resolved = new Map<string, ResolvedSpec>();

    // Load user scope first
    for (const spec of userSpecs) {
      resolved.set(spec.id, { id: spec.id, effective: spec });
    }

    // Project scope overrides user scope
    for (const spec of projectSpecs) {
      const existing = resolved.get(spec.id);
      if (existing) {
        resolved.set(spec.id, {
          id: spec.id,
          effective: spec,
          overridden_by: 'project',
          shadowed: existing.effective
        });
      } else {
        resolved.set(spec.id, { id: spec.id, effective: spec });
      }
    }

    return Array.from(resolved.values()).sort((a, b) => a.id.localeCompare(b.id));
  }

  /** Resolve a single spec id. Project scope wins. */
  async resolveSpec(id: string): Promise<ResolvedSpec | null> {
    const all = await this.listSpecs();
    return all.find(s => s.id === id) ?? null;
  }

  /** List only project-scope specs */
  async listProjectSpecs(filterType?: SpecType): Promise<SpecDefinition[]> {
    const specs = await this.loadProjectScopeSpecs(filterType);
    return specs;
  }

  /** Create or overwrite a project-scope spec */
  async createProjectSpec(id: string, content: string, meta: Partial<SpecDefinition> = {}): Promise<void> {
    const spec: SpecDefinition = {
      id,
      type: meta.type ?? 'spec',
      scope: 'project',
      version: meta.version ?? 1,
      tags: meta.tags ?? [],
      requires: meta.requires,
      conflicts_with: meta.conflicts_with,
      content
    };
    await this.fileService.writeProjectSpec(id, spec);
  }

  /** Delete a project-scope spec (user scope specs are read-only) */
  async deleteProjectSpec(id: string, type: SpecType = 'spec'): Promise<void> {
    await this.fileService.deleteProjectSpec(id, type);
  }

  /**
   * Copy a user-scope spec to project scope as a starting point for customization.
   * Opens the file in VSCode editor after forking.
   */
  async forkToProject(id: string): Promise<void> {
    const resolved = await this.resolveSpec(id);
    if (!resolved) {
      throw new Error(`Spec not found: ${id}`);
    }

    const userSpec = resolved.shadowed ?? resolved.effective;

    const projectSpec: SpecDefinition = {
      ...userSpec,
      scope: 'project'
    };

    await this.fileService.writeProjectSpec(id, projectSpec);

    // Open in editor — use type-aware directory
    const dir = this.fileService.getProjectDirForType(projectSpec.type);
    const filePath = path.join(dir, `${id}.md`);
    const uri = vscode.Uri.file(filePath);
    await vscode.window.showTextDocument(uri);
  }

  /** Check if a plugin-level user scope is available */
  hasUserScope(): boolean {
    if (!this.pluginRoot) { return false; }
    const modulesRoot = this.getUserScopeModulesRoot();
    if (!fs.existsSync(modulesRoot)) { return false; }
    // at least one known subdirectory must exist
    return ['specs', 'capabilities', 'platforms', 'policies', 'base'].some(
      sub => fs.existsSync(path.join(modulesRoot, sub))
    );
  }

  getPluginRoot(): string | undefined {
    return this.pluginRoot;
  }

  // ==========================================================================
  // Private: load specs
  // ==========================================================================

  private async loadUserScopeSpecs(filterType?: SpecType): Promise<SpecDefinition[]> {
    if (!this.hasUserScope()) { return []; }

    const results: SpecDefinition[] = [];
    const dirs = this.getUserScopeDirs(filterType);

    for (const { dir, type } of dirs) {
      if (!fs.existsSync(dir)) { continue; }

      const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
      for (const file of files) {
        try {
          const content = fs.readFileSync(path.join(dir, file), 'utf-8');
          const spec = this.fileService.parseSpecMarkdown(content, 'user');
          spec.id = path.parse(file).name;
          if (!filterType || spec.type === filterType) {
            results.push(spec);
          }
        } catch {
          // skip malformed files
        }
      }
    }

    return results;
  }

  private async loadProjectScopeSpecs(filterType?: SpecType): Promise<SpecDefinition[]> {
    const result = await this.fileService.listProjectSpecs();
    const specs = result.data ?? [];
    if (!filterType) { return specs; }
    return specs.filter(s => s.type === filterType);
  }

  private getUserScopeModulesRoot(): string {
    return path.join(this.pluginRoot!, 'docs', 'templates', 'modules');
  }

  /**
   * spec 디렉토리명은 구버전 `capabilities/` 또는 신버전 `specs/` 모두 지원
   */
  private resolveSpecsDir(modulesRoot: string): string {
    const specsDir = path.join(modulesRoot, 'specs');
    if (fs.existsSync(specsDir)) { return specsDir; }
    // backward compat: installed plugin may still use 'capabilities/'
    return path.join(modulesRoot, 'capabilities');
  }

  private getUserScopeDirs(filterType?: SpecType): Array<{ dir: string; type: SpecType }> {
    const root = this.getUserScopeModulesRoot();
    const all: Array<{ dir: string; type: SpecType }> = [
      { dir: this.resolveSpecsDir(root), type: 'spec' },
      { dir: path.join(root, 'base'),       type: 'base' },
      { dir: path.join(root, 'platforms'),  type: 'platform' },
      { dir: path.join(root, 'policies'),   type: 'policy' }
    ];
    if (!filterType) { return all; }
    return all.filter(d => d.type === filterType);
  }

  // ==========================================================================
  // Plugin root detection
  // ==========================================================================

  /** Re-detect plugin root (call after settings change) */
  refresh(): void {
    this.pluginRoot = this.resolvePluginRoot();
  }

  private resolvePluginRoot(): string | undefined {
    // 1. VSCode setting: agentManager.relayPluginPath
    const settingPath = vscode.workspace.getConfiguration('agentManager').get<string>('relayPluginPath');
    if (settingPath && fs.existsSync(path.join(settingPath, 'docs', 'templates'))) {
      return settingPath;
    }

    // 2. RELAY_PLUGIN_PATH env variable
    const envPath = process.env['RELAY_PLUGIN_PATH'];
    if (envPath && fs.existsSync(path.join(envPath, 'docs', 'templates'))) {
      return envPath;
    }

    const homeDir = process.env['HOME'] ?? process.env['USERPROFILE'] ?? '';

    // 3. Claude Code plugin cache: installed_plugins.json 파싱
    const installedPluginsPath = path.join(homeDir, '.claude', 'plugins', 'installed_plugins.json');
    if (fs.existsSync(installedPluginsPath)) {
      try {
        const json = JSON.parse(fs.readFileSync(installedPluginsPath, 'utf-8')) as {
          plugins?: Record<string, Array<{ installPath: string }>>
        };
        const entries = json.plugins ?? {};
        // relay@* 키를 찾아 가장 최신 installPath 사용
        const relayEntry = Object.entries(entries).find(([key]) => key.startsWith('relay@'));
        if (relayEntry) {
          // 설치 목록에서 마지막 항목 = 최신 버전
          const installs = relayEntry[1];
          const latest = installs[installs.length - 1]?.installPath;
          if (latest && fs.existsSync(path.join(latest, 'docs', 'templates'))) {
            return latest;
          }
        }
      } catch {
        // malformed JSON — continue to next candidate
      }
    }

    // 4. workspace-relative candidates
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (workspaceRoot) {
      const workspaceCandidates = [
        path.join(workspaceRoot, 'relay-plugin'),
        path.join(workspaceRoot, '.claude-plugins', 'relay'),
        path.join(path.dirname(workspaceRoot), 'relay-plugin')
      ];
      for (const candidate of workspaceCandidates) {
        if (fs.existsSync(path.join(candidate, 'docs', 'templates'))) {
          return candidate;
        }
      }
    }

    // 5. Common global paths
    const globalCandidates = [
      path.join(homeDir, '.claude', 'plugins', 'relay'),
      path.join(homeDir, '.claude', 'plugins', 'relay-plugin'),
      path.join(homeDir, '.claude', 'plugins', 'cache', 'relay-plugin', 'relay')
    ];
    for (const candidate of globalCandidates) {
      if (fs.existsSync(path.join(candidate, 'docs', 'templates'))) {
        return candidate;
      }
    }

    return undefined;
  }
}
