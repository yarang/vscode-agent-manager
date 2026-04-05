/**
 * TeamBuilderPanel - Webview panel for creating/editing teams
 *
 * Features:
 * - Team creation and editing
 * - Member management with drag-drop
 * - Bridge member configuration
 * - Real-time validation
 */
import * as vscode from 'vscode';
export interface TeamBuilderMessage {
    type: string;
    data?: unknown;
}
export interface TeamCreateData {
    name: string;
    type: 'upper' | 'lower';
    execution_mode: 'teammate' | 'inprocess';
    coordinator: 'claude' | 'glm';
    coordinator_model: string;
    purpose: string;
    decision_mode: 'leader_decides' | 'consensus' | 'vote' | 'architect_veto';
    members: TeamMemberData[];
    phase_routing: PhaseRoutingData;
}
export interface TeamMemberData {
    expert_slug: string;
    role: string;
    cli?: string;
    model?: string;
    tier: 'trivial' | 'standard' | 'premium';
    permission_mode: 'plan' | 'acceptEdits' | 'default';
    is_leader: boolean;
    is_bridge: boolean;
}
export interface PhaseRoutingData {
    probe?: string;
    grasp?: string;
    tangle?: string;
    ink?: string;
}
export declare class TeamBuilderPanel {
    private extensionUri;
    private static currentPanel;
    private readonly panel;
    private disposables;
    private editingTeamSlug;
    private availableExperts;
    private constructor();
    static createOrShow(extensionUri: vscode.Uri, editingSlug?: string): Promise<void>;
    private loadInitialData;
    private handleMessage;
    private handleValidation;
    private handleSave;
    private handleLoadExpert;
    private buildTeamObject;
    private postMessage;
    private getHtmlContent;
    private getScriptContent;
    dispose(): void;
}
//# sourceMappingURL=TeamBuilderPanel.d.ts.map