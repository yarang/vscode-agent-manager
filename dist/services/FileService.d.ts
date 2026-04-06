/**
 * FileService - Core file operations for relay-plugin data
 *
 * Handles reading/writing expert definitions, team configurations,
 * spec modules, and domain config from .claude/relay/ directory.
 */
import { Expert, Team, DomainConfig, ServiceResult, CapabilityDefinition, SpecDefinition, SpecType, TemplateExportMeta } from '../types';
export declare class FileService {
    private workspaceRoot;
    private relayRoot;
    constructor();
    getRelayRoot(): string;
    getExpertsDir(): string;
    getTeamsDir(): string;
    getAgentDefinitionsDir(): string;
    getDomainConfigPath(): string;
    /** Project scope template root: {workspace}/.claude/relay/templates/ */
    getProjectTemplatesRoot(): string;
    getProjectSpecsDir(): string;
    getProjectPlatformsDir(): string;
    getProjectPoliciesDir(): string;
    getProjectBaseDir(): string;
    getProjectDefinitionsDir(): string;
    /** Return the project-scope directory for a given spec type */
    getProjectDirForType(type: SpecType): string;
    getNotifyEventsDir(): string;
    listExperts(): Promise<ServiceResult<Expert[]>>;
    readExpert(slug: string): Promise<ServiceResult<Expert>>;
    createExpert(expert: Expert): Promise<ServiceResult<string>>;
    updateExpert(slug: string, expert: Expert): Promise<ServiceResult<void>>;
    deleteExpert(slug: string): Promise<ServiceResult<void>>;
    listProjectSpecs(): Promise<ServiceResult<SpecDefinition[]>>;
    readProjectSpec(id: string, type?: SpecType): Promise<ServiceResult<SpecDefinition>>;
    writeProjectSpec(id: string, spec: SpecDefinition): Promise<ServiceResult<void>>;
    deleteProjectSpec(id: string, type?: SpecType): Promise<ServiceResult<void>>;
    exportProjectTemplates(outputPath: string): Promise<ServiceResult<TemplateExportMeta>>;
    importProjectTemplates(sourcePath: string, conflictMode: 'skip' | 'overwrite' | 'rename'): Promise<ServiceResult<{
        imported: number;
        skipped: number;
    }>>;
    listTeams(): Promise<ServiceResult<Team[]>>;
    readTeam(id: string): Promise<ServiceResult<Team>>;
    createTeam(team: Team): Promise<ServiceResult<string>>;
    updateTeam(slug: string, team: Team): Promise<ServiceResult<void>>;
    deleteTeam(slug: string): Promise<ServiceResult<void>>;
    readDomainConfig(): Promise<ServiceResult<DomainConfig | null>>;
    writeDomainConfig(config: DomainConfig): Promise<ServiceResult<void>>;
    /** @deprecated Use TemplateService.listSpecs() instead */
    listCapabilities(): Promise<ServiceResult<CapabilityDefinition[]>>;
    /** @deprecated Use TemplateService.resolveSpec() instead */
    readCapability(_id: string): Promise<ServiceResult<CapabilityDefinition>>;
    /** @deprecated Use writeProjectSpec() instead */
    upsertCapability(definition: Partial<CapabilityDefinition> & {
        title: string;
        content: string;
        id?: string;
    }): Promise<ServiceResult<CapabilityDefinition>>;
    private parseExpertMarkdown;
    private generateExpertMarkdown;
    parseSpecMarkdown(content: string, defaultScope?: 'user' | 'project'): SpecDefinition;
    generateSpecMarkdown(spec: SpecDefinition): string;
    private ensureProjectScope;
    private copyDirRecursive;
}
export declare const fileService: FileService;
//# sourceMappingURL=FileService.d.ts.map