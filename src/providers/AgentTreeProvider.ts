/**
 * AgentTreeProvider - Tree view provider for Agent Manager sidebar
 *
 * Displays teams, experts, agents, and configuration in a hierarchical tree.
 * Enhanced with context menus, icons, and click handlers.
 */

import * as vscode from 'vscode';
import { FileService } from '../services/FileService';
import { Expert, Team, TreeItemType } from '../types';

export class AgentTreeProvider implements vscode.TreeDataProvider<TreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<TreeItem | undefined | null | void> =
    new vscode.EventEmitter<TreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<TreeItem | undefined | null | void> =
    this._onDidChangeTreeData.event;

  constructor(private fileService: FileService, private extensionContext?: vscode.ExtensionContext) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: TreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: TreeItem): Promise<TreeItem[]> {
    if (!element) {
      // Root level items
      return this.getRootItems();
    }

    switch (element.contextValue) {
      case 'teams':
        return this.getTeamItems();
      case 'experts':
        return this.getExpertItems();
      case 'modules':
        return this.getModuleItems();
      case 'config':
        return this.getConfigItems();
      case 'team':
        return this.getTeamMembers(element.metadata?.id);
      default:
        return [];
    }
  }

  private async getRootItems(): Promise<TreeItem[]> {
    const items: TreeItem[] = [
      new TreeItem(
        'Teams',
        vscode.TreeItemCollapsibleState.Collapsed,
        'teams',
        'account-group',
        { description: 'All configured teams' }
      ),
      new TreeItem(
        'Experts',
        vscode.TreeItemCollapsibleState.Collapsed,
        'experts',
        'symbol-namespace',
        { description: 'All expert definitions' }
      ),
      new TreeItem(
        'Modules',
        vscode.TreeItemCollapsibleState.Collapsed,
        'modules',
        'library',
        { description: 'Agent modules and components' }
      ),
      new TreeItem(
        'Configuration',
        vscode.TreeItemCollapsibleState.Collapsed,
        'config',
        'settings-gear',
        { description: 'Domain and project settings' }
      )
    ];
    return items;
  }

  private async getTeamItems(): Promise<TreeItem[]> {
    const result = await this.fileService.listTeams();
    if (!result.success || !result.data || result.data.length === 0) {
      return [
        new TreeItem(
          'No teams configured',
          vscode.TreeItemCollapsibleState.None,
          'empty',
          'warning'
        )
      ];
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

      // Add context value for command handling
      item.command = {
        command: 'agentManager.viewTeamDetails',
        title: 'View Team Details',
        arguments: [team.slug]
      };

      return item;
    });
  }

  private async getExpertItems(): Promise<TreeItem[]> {
    const result = await this.fileService.listExperts();
    if (!result.success || !result.data || result.data.length === 0) {
      return [
        new TreeItem(
          'No experts defined',
          vscode.TreeItemCollapsibleState.None,
          'empty',
          'warning'
        )
      ];
    }

    // Group by domain
    const byDomain = result.data.reduce((acc, expert) => {
      if (!acc[expert.domain]) {
        acc[expert.domain] = [];
      }
      acc[expert.domain].push(expert);
      return acc;
    }, {} as Record<string, Expert[]>);

    const items: TreeItem[] = [];

    Object.entries(byDomain).forEach(([domain, experts]) => {
      // Domain folder
      const domainIcon = domain === 'development' ? 'code' : 'globe';
      const domainItem = new TreeItem(
        domain.charAt(0).toUpperCase() + domain.slice(1),
        vscode.TreeItemCollapsibleState.Expanded,
        'domain-folder',
        domainIcon,
        { description: `${experts.length} experts` }
      );

      items.push(domainItem);

      // Add experts for this domain
      experts.forEach(expert => {
        const item = new TreeItem(
          expert.role,
          vscode.TreeItemCollapsibleState.None,
          'expert',
          this.getExpertIcon(expert),
          {
            description: expert.slug,
            tooltip: this.getExpertTooltip(expert),
            metadata: { slug: expert.slug, role: expert.role }
          }
        );

        // Add tier badge
        item.resourceUri = vscode.Uri.parse(
          `tier://${expert.tier}`
        );

        // Make clickable
        item.command = {
          command: 'agentManager.openExpert',
          title: 'Open Expert',
          arguments: [expert.slug]
        };

        items.push(item);
      });
    });

    return items;
  }

  private async getModuleItems(): Promise<TreeItem[]> {
    const modules = [
      {
        name: 'Base',
        desc: 'Role cores',
        icon: 'circle-outline',
        path: 'agent-library/base'
      },
      {
        name: 'Capabilities',
        desc: 'Feature modules',
        icon: 'extensions',
        path: 'agent-library/capabilities'
      },
      {
        name: 'Platforms',
        desc: 'Execution environments',
        icon: 'server',
        path: 'agent-library/platforms'
      },
      {
        name: 'Policies',
        desc: 'Project rules',
        icon: 'file-code',
        path: 'agent-library/policies'
      }
    ];

    return modules.map(mod =>
      new TreeItem(
        mod.name,
        vscode.TreeItemCollapsibleState.None,
        'module-folder',
        mod.icon,
        { description: mod.desc, metadata: { path: mod.path } }
      )
    );
  }

  private async getConfigItems(): Promise<TreeItem[]> {
    const config = await this.fileService.readDomainConfig();

    const items: TreeItem[] = [
      new TreeItem(
        'Domain',
        vscode.TreeItemCollapsibleState.None,
        'config-item',
        'globe',
        {
          description: config.data?.domain || 'Not set',
          metadata: { key: 'domain' }
        }
      ),
      new TreeItem(
        'Project',
        vscode.TreeItemCollapsibleState.None,
        'config-item',
        'project',
        {
          description: config.data?.project_name || 'Not set',
          metadata: { key: 'project' }
        }
      ),
      new TreeItem(
        'Active Packs',
        vscode.TreeItemCollapsibleState.None,
        'config-item',
        'package',
        {
          description: config.data?.active_packs?.length.toString() || '0',
          metadata: { key: 'packs' }
        }
      ),
      new TreeItem(
        'Relay Root',
        vscode.TreeItemCollapsibleState.None,
        'config-item',
        'folder-opened',
        {
          description: this.fileService.getRelayRoot(),
          metadata: { key: 'root' }
        }
      )
    ];

    return items;
  }

  private async getTeamMembers(teamId?: string): Promise<TreeItem[]> {
    if (!teamId) {
      return [];
    }

    const result = await this.fileService.readTeam(teamId);
    if (!result.success || !result.data) {
      return [
        new TreeItem(
          'Failed to load team',
          vscode.TreeItemCollapsibleState.None,
          'error',
          'error'
        )
      ];
    }

    const team = result.data;
    const items: TreeItem[] = [];

    // Coordinator
    items.push(
      new TreeItem(
        `Coordinator: ${team.coordinator}`,
        vscode.TreeItemCollapsibleState.None,
        'coordinator',
        'star-full',
        {
          description: team.coordinator_model,
          tooltip: `Decision mode: ${team.decision_mode}`
        }
      )
    );

    // Separator
    items.push(
      new TreeItem(
        'Members',
        vscode.TreeItemCollapsibleState.None,
        'separator',
        'separator'
      )
    );

    // Team members
    team.members.forEach(member => {
      const icon = member.is_leader ? 'star-full' : 'person';
      const item = new TreeItem(
        member.role,
        vscode.TreeItemCollapsibleState.None,
        'team-member',
        icon,
        {
          description: `${member.expert_slug}${member.is_bridge ? ' 🌉' : ''}`,
          tooltip: this.getMemberTooltip(member),
          metadata: {
            expertSlug: member.expert_slug,
            role: member.role,
            teamSlug: team.slug
          }
        }
      );

      if (member.is_bridge) {
        item.resourceUri = vscode.Uri.parse('bridge://true');
      }

      items.push(item);
    });

    return items;
  }

  // ==========================================================================
  // Tooltip Helpers
  // ==========================================================================

  private getTeamTooltip(team: Team): string {
    const lines = [
      `**${team.name}**`,
      '',
      `Type: ${team.type}`,
      `Mode: ${team.execution_mode}`,
      `Coordinator: ${team.coordinator} (${team.coordinator_model})`,
      `Decision: ${team.decision_mode}`,
      '',
      `Members: ${team.members.length}`,
      team.purpose ? `Purpose: ${team.purpose}` : ''
    ].filter(Boolean);

    return lines.join('\n');
  }

  private getExpertTooltip(expert: Expert): string {
    const lines = [
      `**${expert.role}**`,
      '',
      `Slug: \`${expert.slug}\``,
      `Domain: ${expert.domain}`,
      `Tier: ${expert.tier}`,
      `Backed by: ${expert.backed_by}`,
      `Permission: ${expert.permission_mode}`,
      '',
      `Capabilities: ${expert.capabilities?.length || 0}`,
      `Phases: ${expert.phases?.join(', ') || 'none'}`
    ];

    if (expert.isolation) {
      lines.push(`Isolation: ${expert.isolation}`);
    }

    return lines.join('\n');
  }

  private getMemberTooltip(member: any): string {
    const lines = [
      `**${member.role}**`,
      '',
      `Expert: ${member.expert_slug}`,
      `Tier: ${member.tier}`,
      `Permission: ${member.permission_mode}`
    ];

    if (member.is_leader) {
      lines.push('⭐ Team Leader');
    }
    if (member.is_bridge) {
      lines.push('🌉 Bridge Agent');
    }

    return lines.join('\n');
  }

  private getExpertIcon(expert: Expert): string {
    // Return icon based on backed_by property
    const iconMap: Record<string, string> = {
      'claude': 'symbol-namespace',
      'codex': 'symbol-interface',
      'gemini': 'symbol-misc',
      'zai': 'symbol-boolean'
    };

    return iconMap[expert.backed_by] || 'symbol-namespace';
  }
}

/**
 * Custom TreeItem with extended metadata support
 */
class TreeItem extends vscode.TreeItem {
  metadata?: {
    id?: string;
    slug?: string;
    role?: string;
    name?: string;
    path?: string;
    key?: string;
    description?: string;
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

    if (options?.description) {
      this.description = options.description;
    }

    if (options?.tooltip) {
      this.tooltip = new vscode.MarkdownString(options.tooltip);
    }

    if (options?.metadata) {
      this.metadata = options.metadata;
    }
  }

  withDescription(desc: string): TreeItem {
    this.description = desc;
    return this;
  }
}

/**
 * Register all tree item context menu commands
 */
export function registerTreeCommands(context: vscode.ExtensionContext, fileService: FileService): void {
  // Expert context menu
  context.subscriptions.push(
    vscode.commands.registerCommand('agentManager.openExpert', async (slug: string) => {
      // Open Expert Manager for editing
      vscode.commands.executeCommand('agentManager.editAgent', slug);
    })
  );

  // Team context menu
  context.subscriptions.push(
    vscode.commands.registerCommand('agentManager.viewTeamDetails', async (slug: string) => {
      vscode.commands.executeCommand('agentManager.viewTeamDiagram', slug);
    })
  );

  // Create expert from context menu
  context.subscriptions.push(
    vscode.commands.registerCommand('agentManager.createExpertFromTree', async () => {
      vscode.commands.executeCommand('agentManager.createExpert');
    })
  );

  // Build team from context menu
  context.subscriptions.push(
    vscode.commands.registerCommand('agentManager.buildTeamFromTree', async () => {
      vscode.commands.executeCommand('agentManager.buildTeam');
    })
  );

  // Refresh from context menu
  context.subscriptions.push(
    vscode.commands.registerCommand('agentManager.refreshFromTree', async () => {
      vscode.commands.executeCommand('agentManager.refreshTree');
    })
  );

  // Delete expert
  context.subscriptions.push(
    vscode.commands.registerCommand('agentManager.deleteExpert', async (slug: string) => {
      const confirmed = await vscode.window.showWarningMessage(
        `Delete expert "${slug}"? This action cannot be undone.`,
        'Delete',
        'Cancel'
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
    })
  );

  // Delete team
  context.subscriptions.push(
    vscode.commands.registerCommand('agentManager.deleteTeam', async (slug: string) => {
      const confirmed = await vscode.window.showWarningMessage(
        `Delete team "${slug}"? This action cannot be undone.`,
        'Delete',
        'Cancel'
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
    })
  );

  // Duplicate expert
  context.subscriptions.push(
    vscode.commands.registerCommand('agentManager.duplicateExpert', async (slug: string) => {
      const result = await fileService.readExpert(slug);
      if (!result.success || !result.data) {
        vscode.window.showErrorMessage(`Expert not found: ${slug}`);
        return;
      }

      const newSlug = await vscode.window.showInputBox({
        prompt: 'Enter new expert slug',
        placeHolder: `${slug}-copy`,
        value: `${slug}-copy`
      });

      if (!newSlug) return;

      const newExpert = { ...result.data, slug: newSlug, role: `${result.data.role} (Copy)` };
      const createResult = await fileService.createExpert(newExpert);

      if (createResult.success) {
        vscode.window.showInformationMessage(`Expert duplicated as "${newSlug}".`);
        vscode.commands.executeCommand('agentManager.refreshTree');
      } else {
        vscode.window.showErrorMessage(`Failed to duplicate expert: ${createResult.error}`);
      }
    })
  );

  // Open relay folder
  context.subscriptions.push(
    vscode.commands.registerCommand('agentManager.openRelayFolder', async () => {
      const relayRoot = fileService.getRelayRoot();
      const uri = vscode.Uri.file(relayRoot);
      await vscode.commands.executeCommand('vscode.openFolder', uri, { forceNewWindow: false });
    })
  );

  // View diagram for expert
  context.subscriptions.push(
    vscode.commands.registerCommand('agentManager.viewExpertDiagram', async (slug: string) => {
      vscode.commands.executeCommand('agentManager.viewExpertDiagram', slug);
    })
  );
}
