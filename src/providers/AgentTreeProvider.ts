/**
 * AgentTreeProvider - Tree view provider for Agent Manager sidebar
 *
 * Displays teams, experts, templates, and configuration in a hierarchical tree.
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { FileService } from '../services/FileService';
import { TemplateService } from '../services/TemplateService';
import { Expert, Team, ResolvedSpec, SpecType } from '../types';

export class AgentTreeProvider implements vscode.TreeDataProvider<TreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<TreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(
    private fileService: FileService,
    private templateService: TemplateService,
    private extensionContext?: vscode.ExtensionContext
  ) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: TreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: TreeItem): Promise<TreeItem[]> {
    if (!element) {
      return this.getRootItems();
    }

    switch (element.contextValue) {
      case 'teams':           return this.getTeamItems();
      case 'experts':         return this.getExpertItems();
      case 'templates':       return this.getTemplateRootItems();
      case 'specs-root':      return this.getTypeSpecItems('spec');
      case 'platforms-root':  return this.getTypeSpecItems('platform');
      case 'policies-root':   return this.getTypeSpecItems('policy');
      case 'base-root':       return this.getTypeSpecItems('base');
      case 'config':          return this.getConfigItems();
      case 'team':            return this.getTeamMembers(element.metadata?.id);
      default:                return [];
    }
  }

  // ==========================================================================
  // Root
  // ==========================================================================

  private async getRootItems(): Promise<TreeItem[]> {
    const config = await this.fileService.readDomainConfig();
    const hasSetup = config.success && config.data;

    return [
      new TreeItem('Teams', vscode.TreeItemCollapsibleState.Collapsed, 'teams', 'account-group',
        { description: 'All configured teams' }),
      new TreeItem('Experts', vscode.TreeItemCollapsibleState.Collapsed, 'experts', 'symbol-namespace',
        { description: 'All expert definitions' }),
      new TreeItem('Templates', vscode.TreeItemCollapsibleState.Collapsed, 'templates', 'library',
        { description: hasSetup ? 'user + project scope' : 'user scope only',
          tooltip: 'Spec modules, platforms, policies' }),
      new TreeItem('Configuration', vscode.TreeItemCollapsibleState.Collapsed, 'config', 'settings-gear',
        { description: 'Domain and project settings' })
    ];
  }

  // ==========================================================================
  // Teams
  // ==========================================================================

  private async getTeamItems(): Promise<TreeItem[]> {
    const result = await this.fileService.listTeams();
    if (!result.success || !result.data || result.data.length === 0) {
      return [new TreeItem('No teams configured', vscode.TreeItemCollapsibleState.None, 'empty', 'warning')];
    }

    return result.data.map(team => {
      const icon = team.type === 'upper' ? 'server' : 'server-environment';
      const item = new TreeItem(
        team.name,
        vscode.TreeItemCollapsibleState.Collapsed,
        'team',
        icon,
        {
          description: `${team.members.length} members`,
          tooltip: this.getTeamTooltip(team),
          metadata: { id: team.slug, name: team.name }
        }
      );
      item.command = { command: 'agentManager.viewTeamDetails', title: 'View Team Details', arguments: [team.slug] };
      return item;
    });
  }

  // ==========================================================================
  // Experts
  // ==========================================================================

  private async getExpertItems(): Promise<TreeItem[]> {
    const result = await this.fileService.listExperts();
    if (!result.success || !result.data || result.data.length === 0) {
      return [new TreeItem('No experts defined', vscode.TreeItemCollapsibleState.None, 'empty', 'warning')];
    }

    const byDomain = result.data.reduce((acc, expert) => {
      if (!acc[expert.domain]) { acc[expert.domain] = []; }
      acc[expert.domain].push(expert);
      return acc;
    }, {} as Record<string, Expert[]>);

    const items: TreeItem[] = [];

    Object.entries(byDomain).forEach(([domain, experts]) => {
      const domainItem = new TreeItem(
        domain.charAt(0).toUpperCase() + domain.slice(1),
        vscode.TreeItemCollapsibleState.Expanded,
        'domain-folder',
        domain === 'development' ? 'code' : 'globe',
        { description: `${experts.length} experts` }
      );
      items.push(domainItem);

      experts.forEach(expert => {
        const specCount = expert.specs?.length ?? 0;
        const item = new TreeItem(
          expert.role,
          vscode.TreeItemCollapsibleState.None,
          'expert',
          this.getExpertIcon(expert),
          {
            description: `${expert.slug}${specCount > 0 ? ` · ${specCount} specs` : ''}`,
            tooltip: this.getExpertTooltip(expert),
            metadata: { slug: expert.slug, role: expert.role }
          }
        );
        item.command = { command: 'agentManager.openExpert', title: 'Open Expert', arguments: [expert.slug] };
        items.push(item);
      });
    });

    return items;
  }

  // ==========================================================================
  // Templates
  // ==========================================================================

  private async getTemplateRootItems(): Promise<TreeItem[]> {
    const allSpecs = await this.templateService.listSpecs();

    const countByType = (type: SpecType) => allSpecs.filter(s => s.effective.type === type).length;
    const projectCount = (type: SpecType) =>
      allSpecs.filter(s => s.effective.type === type && (s.effective.scope === 'project' || s.overridden_by === 'project')).length;

    const items: TreeItem[] = [];

    // Specs node (always shown)
    const specTotal = countByType('spec');
    items.push(new TreeItem(
      'Specs',
      vscode.TreeItemCollapsibleState.Collapsed,
      'specs-root',
      'extensions',
      {
        description: specTotal > 0
          ? `${specTotal} total · ${projectCount('spec')} project`
          : 'empty',
        metadata: { type: 'spec' }
      }
    ));

    // Platforms
    const platformTotal = countByType('platform');
    items.push(new TreeItem(
      'Platforms',
      platformTotal > 0 ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
      'platforms-root',
      'server',
      { description: `${platformTotal} total · ${projectCount('platform')} project` }
    ));

    // Policies
    const policyTotal = countByType('policy');
    items.push(new TreeItem(
      'Policies',
      policyTotal > 0 ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
      'policies-root',
      'file-code',
      { description: `${policyTotal} total · ${projectCount('policy')} project` }
    ));

    return items;
  }

  private async getTypeSpecItems(type: SpecType): Promise<TreeItem[]> {
    const allSpecs = await this.templateService.listSpecs(type);

    if (allSpecs.length === 0) {
      return [new TreeItem(`No ${type}s available`, vscode.TreeItemCollapsibleState.None, 'empty', 'warning')];
    }

    return allSpecs.map(resolved => {
      const { effective, overridden_by } = resolved;
      const isProject = effective.scope === 'project';
      const isOverride = overridden_by === 'project';

      const badge = isProject ? '[P]' : '[U]';
      const icon = isProject ? 'file-code' : 'file';
      const contextValue = isProject ? 'spec-project' : 'spec-user';

      const tags = effective.tags?.length ? effective.tags.slice(0, 2).join(', ') : '';
      const item = new TreeItem(
        `${badge} ${effective.id}`,
        vscode.TreeItemCollapsibleState.None,
        contextValue,
        icon,
        {
          description: tags || undefined,
          tooltip: this.getSpecTooltip(resolved),
          metadata: { id: effective.id, type: effective.type }
        }
      );

      if (isOverride) {
        item.resourceUri = vscode.Uri.parse(`spec-override://${effective.id}`);
      }

      // Pass both id and type so commands can find the correct file path
      item.command = {
        command: isProject ? 'agentManager.editProjectSpec' : 'agentManager.viewUserSpec',
        title: isProject ? 'Edit Spec' : 'View Spec',
        arguments: [effective.id, effective.type]
      };

      return item;
    });
  }

  // ==========================================================================
  // Config
  // ==========================================================================

  private async getConfigItems(): Promise<TreeItem[]> {
    const config = await this.fileService.readDomainConfig();
    const hasUserScope = this.templateService.hasUserScope();

    return [
      new TreeItem('Domain', vscode.TreeItemCollapsibleState.None, 'config-item', 'globe',
        { description: config.data?.domain || 'Not set' }),
      new TreeItem('Project', vscode.TreeItemCollapsibleState.None, 'config-item', 'project',
        { description: config.data?.project_name || 'Not set' }),
      new TreeItem('Active Packs', vscode.TreeItemCollapsibleState.None, 'config-item', 'package',
        { description: String(config.data?.active_packs?.length ?? 0) }),
      new TreeItem('Plugin (user scope)', vscode.TreeItemCollapsibleState.None, 'config', 'folder-opened',
        { description: hasUserScope ? this.templateService.getPluginRoot() ?? 'found' : 'not detected' }),
      new TreeItem('Relay Root', vscode.TreeItemCollapsibleState.None, 'config-item', 'folder',
        { description: this.fileService.getRelayRoot() })
    ];
  }

  // ==========================================================================
  // Team Members
  // ==========================================================================

  private async getTeamMembers(teamId?: string): Promise<TreeItem[]> {
    if (!teamId) { return []; }

    const result = await this.fileService.readTeam(teamId);
    if (!result.success || !result.data) {
      return [new TreeItem('Failed to load team', vscode.TreeItemCollapsibleState.None, 'error', 'error')];
    }

    const team = result.data;
    const items: TreeItem[] = [
      new TreeItem(
        `Coordinator: ${team.coordinator}`,
        vscode.TreeItemCollapsibleState.None,
        'coordinator',
        'star-full',
        { description: team.coordinator_model, tooltip: `Decision mode: ${team.decision_mode}` }
      )
    ];

    team.members.forEach(member => {
      const icon = member.is_leader ? 'star-full' : 'person';
      const item = new TreeItem(
        member.role,
        vscode.TreeItemCollapsibleState.None,
        'team-member',
        icon,
        {
          description: `${member.expert_slug}${member.is_bridge ? ' [bridge]' : ''}`,
          tooltip: this.getMemberTooltip(member),
          metadata: { expertSlug: member.expert_slug, role: member.role, teamSlug: team.slug }
        }
      );
      items.push(item);
    });

    return items;
  }

  // ==========================================================================
  // Tooltips
  // ==========================================================================

  private getTeamTooltip(team: Team): string {
    return [
      `**${team.name}**`, '',
      `Type: ${team.type}`, `Mode: ${team.execution_mode}`,
      `Coordinator: ${team.coordinator} (${team.coordinator_model})`,
      `Decision: ${team.decision_mode}`, '',
      `Members: ${team.members.length}`,
      team.purpose ? `Purpose: ${team.purpose}` : ''
    ].filter(Boolean).join('\n');
  }

  private getExpertTooltip(expert: Expert): string {
    return [
      `**${expert.role}**`, '',
      `Slug: \`${expert.slug}\``, `Domain: ${expert.domain}`,
      `Tier: ${expert.tier}`, `Backed by: ${expert.backed_by}`,
      `Permission: ${expert.permission_mode}`, '',
      `Specs: ${expert.specs?.length ?? 0}`,
      `Phases: ${expert.phases?.join(', ') || 'none'}`
    ].join('\n');
  }

  private getSpecTooltip(resolved: ResolvedSpec): string {
    const { effective, overridden_by } = resolved;
    const lines = [
      `**${effective.id}**`,
      `Type: ${effective.type}`,
      `Scope: ${effective.scope}`,
      `Version: ${effective.version}`,
      `Tags: ${effective.tags?.join(', ') || 'none'}`
    ];
    if (overridden_by === 'project') {
      lines.push('', '[P] This project-scope spec overrides the user-scope version');
    }
    if (effective.requires?.length) {
      lines.push(`Requires: ${effective.requires.join(', ')}`);
    }
    return lines.join('\n');
  }

  private getMemberTooltip(member: any): string {
    const lines = [
      `**${member.role}**`, '',
      `Expert: ${member.expert_slug}`,
      `Tier: ${member.tier}`, `Permission: ${member.permission_mode}`
    ];
    if (member.is_leader) { lines.push('Team Leader'); }
    if (member.is_bridge) { lines.push('Bridge Agent'); }
    return lines.join('\n');
  }

  private getExpertIcon(expert: Expert): string {
    const iconMap: Record<string, string> = {
      'claude': 'symbol-namespace',
      'codex':  'symbol-interface',
      'gemini': 'symbol-misc',
      'zai':    'symbol-boolean'
    };
    return iconMap[expert.backed_by] || 'symbol-namespace';
  }
}

// ==========================================================================
// TreeItem
// ==========================================================================

class TreeItem extends vscode.TreeItem {
  metadata?: {
    id?: string;
    slug?: string;
    role?: string;
    name?: string;
    path?: string;
    key?: string;
    type?: string;
    teamSlug?: string;
    expertSlug?: string;
  };

  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly contextValue: string,
    iconName?: string,
    options?: {
      description?: string;
      tooltip?: string;
      metadata?: TreeItem['metadata'];
    }
  ) {
    super(label, collapsibleState);
    this.contextValue = contextValue;

    if (iconName) {
      this.iconPath = new vscode.ThemeIcon(iconName);
    }
    if (options?.description) { this.description = options.description; }
    if (options?.tooltip) { this.tooltip = new vscode.MarkdownString(options.tooltip); }
    if (options?.metadata) { this.metadata = options.metadata; }
  }
}

// ==========================================================================
// Tree Commands
// ==========================================================================

export function registerTreeCommands(
  context: vscode.ExtensionContext,
  fileService: FileService,
  templateService: TemplateService
): void {
  // Expert commands
  context.subscriptions.push(
    vscode.commands.registerCommand('agentManager.openExpert', (slug: string) => {
      vscode.commands.executeCommand('agentManager.editAgent', slug);
    }),
    vscode.commands.registerCommand('agentManager.viewTeamDetails', (slug: string) => {
      vscode.commands.executeCommand('agentManager.viewTeamDiagram', slug);
    }),
    vscode.commands.registerCommand('agentManager.createExpertFromTree', () => {
      vscode.commands.executeCommand('agentManager.createExpert');
    }),
    vscode.commands.registerCommand('agentManager.buildTeamFromTree', () => {
      vscode.commands.executeCommand('agentManager.buildTeam');
    }),
    vscode.commands.registerCommand('agentManager.refreshFromTree', () => {
      vscode.commands.executeCommand('agentManager.refreshTree');
    })
  );

  // Expert CRUD
  context.subscriptions.push(
    vscode.commands.registerCommand('agentManager.deleteExpert', async (slug: string) => {
      const confirmed = await vscode.window.showWarningMessage(
        `Delete expert "${slug}"? This cannot be undone.`, 'Delete', 'Cancel'
      );
      if (confirmed === 'Delete') {
        const result = await fileService.deleteExpert(slug);
        if (result.success) {
          vscode.window.showInformationMessage(`Expert "${slug}" deleted.`);
          vscode.commands.executeCommand('agentManager.refreshTree');
        } else {
          vscode.window.showErrorMessage(`Failed to delete expert: ${result.error}`);
        }
      }
    }),

    vscode.commands.registerCommand('agentManager.deleteTeam', async (slug: string) => {
      const confirmed = await vscode.window.showWarningMessage(
        `Delete team "${slug}"? This cannot be undone.`, 'Delete', 'Cancel'
      );
      if (confirmed === 'Delete') {
        const result = await fileService.deleteTeam(slug);
        if (result.success) {
          vscode.window.showInformationMessage(`Team "${slug}" deleted.`);
          vscode.commands.executeCommand('agentManager.refreshTree');
        } else {
          vscode.window.showErrorMessage(`Failed to delete team: ${result.error}`);
        }
      }
    }),

    vscode.commands.registerCommand('agentManager.duplicateExpert', async (slug: string) => {
      const result = await fileService.readExpert(slug);
      if (!result.success || !result.data) {
        vscode.window.showErrorMessage(`Expert not found: ${slug}`);
        return;
      }
      const newSlug = await vscode.window.showInputBox({
        prompt: 'Enter new expert slug',
        value: `${slug}-copy`
      });
      if (!newSlug) { return; }
      const newExpert = { ...result.data, slug: newSlug, role: `${result.data.role} (Copy)` };
      const createResult = await fileService.createExpert(newExpert);
      if (createResult.success) {
        vscode.window.showInformationMessage(`Expert duplicated as "${newSlug}".`);
        vscode.commands.executeCommand('agentManager.refreshTree');
      } else {
        vscode.window.showErrorMessage(`Failed to duplicate expert: ${createResult.error}`);
      }
    }),

    vscode.commands.registerCommand('agentManager.openRelayFolder', async () => {
      const relayRoot = fileService.getRelayRoot();
      await vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(relayRoot));
    })
  );

  // Spec commands
  context.subscriptions.push(
    vscode.commands.registerCommand('agentManager.forkSpec', async (specId: string, _type?: string) => {
      try {
        await templateService.forkToProject(specId);
        vscode.window.showInformationMessage(`Spec "${specId}" forked to project scope.`);
        vscode.commands.executeCommand('agentManager.refreshTree');
      } catch (err) {
        vscode.window.showErrorMessage(`Fork failed: ${err}`);
      }
    }),

    vscode.commands.registerCommand('agentManager.deleteProjectSpec', async (specId: string, type?: string) => {
      const confirmed = await vscode.window.showWarningMessage(
        `Delete project spec "${specId}"?`, 'Delete', 'Cancel'
      );
      if (confirmed === 'Delete') {
        await templateService.deleteProjectSpec(specId, (type as any) ?? 'spec');
        vscode.window.showInformationMessage(`Spec "${specId}" deleted.`);
        vscode.commands.executeCommand('agentManager.refreshTree');
      }
    }),

    vscode.commands.registerCommand('agentManager.editProjectSpec', async (specId: string, type?: string) => {
      const specType = (type as any) ?? 'spec';
      const dir = fileService.getProjectDirForType(specType);
      const filePath = `${dir}/${specId}.md`;
      await vscode.window.showTextDocument(vscode.Uri.file(filePath));
    }),

    vscode.commands.registerCommand('agentManager.viewUserSpec', async (specId: string, type?: string) => {
      const pluginRoot = templateService.getPluginRoot();
      if (!pluginRoot) {
        vscode.window.showWarningMessage('User scope (relay-plugin) not detected.');
        return;
      }
      const subDir = userScopeSubDir(type ?? 'spec', pluginRoot);
      const filePath = `${pluginRoot}/docs/templates/modules/${subDir}/${specId}.md`;
      const uri = vscode.Uri.file(filePath);
      await vscode.window.showTextDocument(uri, { preview: true });
    }),

    vscode.commands.registerCommand('agentManager.diffSpec', async (specId: string, type?: string) => {
      const pluginRoot = templateService.getPluginRoot();
      if (!pluginRoot) {
        vscode.window.showWarningMessage('User scope (relay-plugin) not detected.');
        return;
      }
      const specType = (type as any) ?? 'spec';
      const subDir = userScopeSubDir(specType, pluginRoot);
      const userUri = vscode.Uri.file(`${pluginRoot}/docs/templates/modules/${subDir}/${specId}.md`);
      const projectUri = vscode.Uri.file(`${fileService.getProjectDirForType(specType)}/${specId}.md`);
      await vscode.commands.executeCommand(
        'vscode.diff', userUri, projectUri,
        `${specId}: user scope ↔ project scope`
      );
    })
  );
}

// ==========================================================================
// Helpers
// ==========================================================================

/**
 * Map SpecType to user scope subdirectory name inside modules/.
 * Older plugin installs use 'capabilities/' instead of 'specs/'.
 */
function userScopeSubDir(type: string, pluginRoot?: string): string {
  if (type === 'platform') { return 'platforms'; }
  if (type === 'policy')   { return 'policies'; }
  if (type === 'base')     { return 'base'; }
  if (pluginRoot) {
    const specsDir = path.join(pluginRoot, 'docs', 'templates', 'modules', 'specs');
    if (!fs.existsSync(specsDir)) { return 'capabilities'; }
  }
  return 'specs';
}
