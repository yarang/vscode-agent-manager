/**
 * AgentTreeProvider - Tree view provider for Agent Manager sidebar
 *
 * Displays teams, experts, agents, and configuration in a hierarchical tree.
 * Enhanced with context menus, icons, and click handlers.
 */
import * as vscode from 'vscode';
import { FileService } from '../services/FileService';
export declare class AgentTreeProvider implements vscode.TreeDataProvider<TreeItem> {
    private fileService;
    private extensionContext?;
    private _onDidChangeTreeData;
    readonly onDidChangeTreeData: vscode.Event<TreeItem | undefined | null | void>;
    constructor(fileService: FileService, extensionContext?: vscode.ExtensionContext | undefined);
    refresh(): void;
    getTreeItem(element: TreeItem): vscode.TreeItem;
    getChildren(element?: TreeItem): Promise<TreeItem[]>;
    private getRootItems;
    private getTeamItems;
    private getExpertItems;
    private getModuleItems;
    private getConfigItems;
    private getTeamMembers;
    private getTeamTooltip;
    private getExpertTooltip;
    private getMemberTooltip;
    private getExpertIcon;
}
/**
 * Custom TreeItem with extended metadata support
 */
declare class TreeItem extends vscode.TreeItem {
    readonly label: string;
    readonly collapsibleState: vscode.TreeItemCollapsibleState;
    readonly contextValue: string;
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
    constructor(label: string, collapsibleState: vscode.TreeItemCollapsibleState, contextValue: string, iconName?: string, options?: {
        description?: string;
        tooltip?: string;
        metadata?: TreeItem['metadata'];
    });
    withDescription(desc: string): TreeItem;
}
/**
 * Register all tree item context menu commands
 */
export declare function registerTreeCommands(context: vscode.ExtensionContext, fileService: FileService): void;
export {};
//# sourceMappingURL=AgentTreeProvider.d.ts.map