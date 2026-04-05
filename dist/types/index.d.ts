/**
 * Type definitions for Agent Manager VS Code Extension
 */
export type Domain = 'general' | 'development';
export type BackedBy = 'claude' | 'codex' | 'gemini' | 'zai';
export type Tier = 'trivial' | 'standard' | 'premium';
export type PermissionMode = 'plan' | 'acceptEdits' | 'default';
export interface Expert {
    role: string;
    slug: string;
    domain: Domain;
    backed_by: BackedBy;
    cli?: string;
    model?: string;
    fallback_cli?: string | null;
    tier: Tier;
    permission_mode: PermissionMode;
    memory?: 'project' | 'user' | 'local';
    isolation?: 'worktree' | null;
    phases?: string[];
    agent_profile?: string;
    default_platform?: string;
    persona?: string;
    capabilities?: string[];
    constraints?: string[];
    created_at: string;
}
export type TeamType = 'upper' | 'lower';
export type ExecutionMode = 'teammate' | 'inprocess';
export type CoordinatorType = 'claude' | 'glm';
export type DecisionMode = 'leader_decides' | 'consensus' | 'vote' | 'architect_veto';
export interface TeamMember {
    role: string;
    expert_slug: string;
    cli?: string | null;
    model?: string;
    fallback_cli?: string | null;
    tier: Tier;
    permission_mode: PermissionMode;
    memory?: string;
    isolation?: string | null;
    is_leader: boolean;
    is_bridge: boolean;
}
export interface PhaseRouting {
    probe?: string;
    grasp?: string;
    tangle?: string;
    ink?: string;
}
export interface Team {
    id: string;
    name: string;
    slug: string;
    type: TeamType;
    execution_mode: ExecutionMode;
    coordinator: CoordinatorType;
    coordinator_model: string;
    purpose: string;
    decision_mode: DecisionMode;
    members: TeamMember[];
    phase_routing: PhaseRouting;
    bridge_to?: string | null;
    created_at: string;
}
export interface AgentDefinition {
    id: string;
    kind: 'composed-agent';
    owner: string;
    version: number;
    base: string;
    capabilities: string[];
    available_platforms: string[];
    default_policy?: string;
    default_agent?: string;
    purpose?: string;
    runtime_rules?: string[];
}
export interface DomainConfig {
    domain: Domain;
    active_packs: string[];
    project_name: string;
    configured_at: string;
}
export interface ServiceResult<T> {
    success: boolean;
    data?: T;
    error?: string;
}
export interface ValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
}
export type TreeItemType = 'team' | 'expert' | 'agent' | 'module' | 'config';
export interface TreeItemData {
    type: TreeItemType;
    id: string;
    label: string;
    description?: string;
    icon?: string;
    children?: TreeItemData[];
}
//# sourceMappingURL=index.d.ts.map