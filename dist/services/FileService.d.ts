/**
 * FileService - Core file operations for relay-plugin data
 *
 * Handles reading/writing expert definitions, team configurations,
 * agent definitions, and domain config from .claude/relay/ directory.
 */
import { Expert, Team, DomainConfig, ServiceResult } from '../types';
export declare class FileService {
    private workspaceRoot;
    private relayRoot;
    constructor();
    getRelayRoot(): string;
    getExpertsDir(): string;
    getTeamsDir(): string;
    getAgentDefinitionsDir(): string;
    getDomainConfigPath(): string;
    listExperts(): Promise<ServiceResult<Expert[]>>;
    readExpert(slug: string): Promise<ServiceResult<Expert>>;
    createExpert(expert: Expert): Promise<ServiceResult<string>>;
    updateExpert(slug: string, expert: Expert): Promise<ServiceResult<void>>;
    deleteExpert(slug: string): Promise<ServiceResult<void>>;
    listTeams(): Promise<ServiceResult<Team[]>>;
    readTeam(id: string): Promise<ServiceResult<Team>>;
    createTeam(team: Team): Promise<ServiceResult<string>>;
    updateTeam(slug: string, team: Team): Promise<ServiceResult<void>>;
    deleteTeam(slug: string): Promise<ServiceResult<void>>;
    readDomainConfig(): Promise<ServiceResult<DomainConfig | null>>;
    writeDomainConfig(config: DomainConfig): Promise<ServiceResult<void>>;
    private parseExpertMarkdown;
    private generateExpertMarkdown;
}
export declare const fileService: FileService;
//# sourceMappingURL=FileService.d.ts.map