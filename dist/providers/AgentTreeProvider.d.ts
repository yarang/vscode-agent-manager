/**
 * AgentTreeProvider - Tree view provider for Agent Manager sidebar
 *
 * Displays teams, experts, templates, and configuration in a hierarchical tree.
 */
import * as vscode from 'vscode';
import { FileService } from '../services/FileService';
import { TemplateService } from '../services/TemplateService';
export declare class AgentTreeProvider implements vscode.TreeDataProvider<TreeItem> {
    private fileService;
    private templateService;
    private extensionContext?;
    private _onDidChangeTreeData;
    readonly onDidChangeTreeData: vscode.Event<void | TreeItem | null | undefined>;
    constructor(fileService: FileService, templateService: TemplateService, extensionContext?: vscode.ExtensionContext | undefined);
    refresh(): void;
    getTreeItem(element: TreeItem): vscode.TreeItem;
    getChildren(element?: TreeItem): Promise<TreeItem[]>;
    private getRootItems;
    private getTeamItems;
    private getExpertItems;
    private getTemplateRootItems;
    private getTypeSpecItems;
    private getConfigItems;
    private getTeamMembers;
    private getTeamTooltip;
    private getExpertTooltip;
    private getSpecTooltip;
    private getMemberTooltip;
    private getExpertIcon;
}
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
        type?: string;
        teamSlug?: string;
        expertSlug?: string;
    };
    constructor(label: string, collapsibleState: vscode.TreeItemCollapsibleState, contextValue: string, iconName?: string, options?: {
        description?: string;
        tooltip?: string;
        metadata?: TreeItem['metadata'];
    });
}
export declare function registerTreeCommands(context: vscode.ExtensionContext, fileService: FileService, templateService: TemplateService): void;
export {};
//# sourceMappingURL=AgentTreeProvider.d.ts.map