/**
 * pathResolver - Resolve .claude/relay directory paths
 *
 * Provides centralized path resolution for all relay-plugin data locations.
 */
/**
 * Get the workspace root folder
 *
 * @returns Workspace root path or empty string if no workspace open
 */
export declare function getWorkspaceRoot(): string;
/**
 * Get the .claude directory root
 *
 * @returns Path to .claude directory
 */
export declare function getClaudeRoot(): string;
/**
 * Get the relay plugin root directory
 *
 * @returns Path to .claude/relay directory
 */
export declare function getRelayRoot(): string;
/**
 * Get the experts directory
 *
 * @returns Path to .claude/relay/experts directory
 */
export declare function getExpertsDir(): string;
/**
 * Get the teams directory
 *
 * @returns Path to .claude/relay/teams directory
 */
export declare function getTeamsDir(): string;
/**
 * Get the agent library definitions directory
 *
 * @returns Path to .claude/relay/agent-library/definitions directory
 */
export declare function getAgentDefinitionsDir(): string;
/**
 * Get the domain config file path
 *
 * @returns Path to .claude/relay/domain-config.json
 */
export declare function getDomainConfigPath(): string;
/**
 * Get expert file path by slug
 *
 * @param slug - Expert slug
 * @returns Path to expert markdown file
 */
export declare function getExpertPath(slug: string): string;
/**
 * Get team file path by slug
 *
 * @param slug - Team slug
 * @returns Path to team JSON file
 */
export declare function getTeamPath(slug: string): string;
/**
 * Get agent definition file path by ID
 *
 * @param id - Agent definition ID
 * @returns Path to agent definition JSON file
 */
export declare function getAgentDefinitionPath(id: string): string;
/**
 * Check if relay directory structure exists
 *
 * @returns Object indicating which directories exist
 */
export declare function checkRelayStructure(): {
    relayExists: boolean;
    expertsExists: boolean;
    teamsExists: boolean;
    agentLibraryExists: boolean;
};
/**
 * Ensure all relay directories exist
 *
 * @returns Path to relay root
 * @throws Error if workspace is not open
 */
export declare function ensureRelayStructure(): string;
//# sourceMappingURL=pathResolver.d.ts.map