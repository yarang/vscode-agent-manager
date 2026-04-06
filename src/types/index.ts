/**
 * Type definitions for Agent Manager VS Code Extension
 */

// ============================================================================
// Expert Types
// ============================================================================

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
  /** Module spec ID references (e.g. 'auth-jwt', 'crud') */
  specs?: string[];
  /** Free-text capability descriptions (legacy / persona detail) */
  capabilities?: string[];
  constraints?: string[];
  created_at: string;
}

// ============================================================================
// Spec / Template Types
// ============================================================================

export type SpecType = 'spec' | 'base' | 'platform' | 'policy';
export type SpecScope = 'user' | 'project';

export interface SpecDefinition {
  id: string;
  type: SpecType;
  scope: SpecScope;
  version: number;
  tags: string[];
  requires?: string[];
  conflicts_with?: string[];
  /** Frontmatter-stripped body content */
  content: string;
}

/** Result of scope resolution: project scope overrides user scope */
export interface ResolvedSpec {
  id: string;
  /** The spec that will actually be used */
  effective: SpecDefinition;
  /** Set to 'project' when a project-scope spec shadows the user-scope one */
  overridden_by?: 'project';
  /** The shadowed user-scope spec (if overridden) */
  shadowed?: SpecDefinition;
}

/** Deprecated: use SpecDefinition instead */
export interface CapabilityDefinition {
  id: string;
  title: string;
  content: string;
  created_at: string;
}

// ============================================================================
// Team Types
// ============================================================================

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

// ============================================================================
// Agent Definition Types (5-Layer Composed)
// ============================================================================

export interface AgentDefinition {
  id: string;
  kind: 'composed-agent';
  owner: string;
  version: number;
  base: string;
  /** Module spec ID references (renamed from capabilities) */
  specs: string[];
  available_platforms: string[];
  default_policy?: string;
  default_agent?: string;
  purpose?: string;
  runtime_rules?: string[];
}

// ============================================================================
// Domain Config Types
// ============================================================================

export interface DomainConfig {
  domain: Domain;
  active_packs: string[];
  project_name: string;
  configured_at: string;
}

// ============================================================================
// Relay Event Types
// ============================================================================

export interface RelayEvent {
  event_type: string;
  timestamp: string;
  cwd: string;
  payload: Record<string, unknown>;
}

// ============================================================================
// Export / Import Types
// ============================================================================

export interface TemplateExportMeta {
  exported_at: string;
  source_project: string;
  scope: 'project';
  files: string[];
}

// ============================================================================
// File Service Response Types
// ============================================================================

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

// ============================================================================
// Tree View Types
// ============================================================================

export type TreeItemType = 'team' | 'expert' | 'agent' | 'module' | 'config' | 'spec' | 'templates';

export interface TreeItemData {
  type: TreeItemType;
  id: string;
  label: string;
  description?: string;
  icon?: string;
  children?: TreeItemData[];
}
