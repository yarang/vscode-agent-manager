/**
 * pathResolver - Resolve .claude/relay directory paths
 */
export declare function getWorkspaceRoot(): string;
export declare function getClaudeRoot(): string;
export declare function getRelayRoot(): string;
export declare function getExpertsDir(): string;
export declare function getTeamsDir(): string;
export declare function getAgentDefinitionsDir(): string;
export declare function getDomainConfigPath(): string;
/** Project scope template root */
export declare function getProjectTemplatesRoot(): string;
export declare function getProjectSpecsDir(): string;
export declare function getProjectPlatformsDir(): string;
export declare function getProjectPoliciesDir(): string;
export declare function getProjectDefinitionsDir(): string;
export declare function getNotifyEventsDir(): string;
export declare function getExpertPath(slug: string): string;
export declare function getTeamPath(slug: string): string;
export declare function getAgentDefinitionPath(id: string): string;
export declare function checkRelayStructure(): {
    relayExists: boolean;
    expertsExists: boolean;
    teamsExists: boolean;
    templatesExists: boolean;
};
export declare function ensureRelayStructure(): string;
//# sourceMappingURL=pathResolver.d.ts.map