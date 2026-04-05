/**
 * ConfigService - Domain and API key configuration management
 *
 * Handles:
 * - Domain configuration (active packs, project name)
 * - API key status checking
 * - Relay plugin settings
 */
import { ServiceResult, Domain } from '../types';
export interface ApiKeyStatus {
    provider: string;
    configured: boolean;
    source?: string;
    error?: string;
}
export interface RelayConfig {
    domain: Domain;
    active_packs: string[];
    project_name: string;
    coordinator_model?: string;
    execution_mode?: 'teammate' | 'inprocess';
}
export declare class ConfigService {
    private readonly CONFIG_FILE;
    private readonly CLAUDE_CONFIG;
    getDomainConfig(): Promise<ServiceResult<RelayConfig>>;
    updateDomainConfig(updates: Partial<RelayConfig>): Promise<ServiceResult<RelayConfig>>;
    setDomain(domain: Domain): Promise<ServiceResult<void>>;
    setActivePacks(packs: string[]): Promise<ServiceResult<void>>;
    addActivePack(pack: string): Promise<ServiceResult<void>>;
    removeActivePack(pack: string): Promise<ServiceResult<void>>;
    setProjectName(name: string): Promise<ServiceResult<void>>;
    getApiKeyStatus(): Promise<ServiceResult<ApiKeyStatus[]>>;
    private checkClaudeApiKey;
    private checkCodexApiKey;
    private checkGeminiApiKey;
    private checkZaiMcp;
    checkRelayStructure(): Promise<ServiceResult<{
        exists: boolean;
        relayDir: string;
        expertsDir: string;
        teamsDir: string;
        agentLibraryDir: string;
        configFile: string;
        expertsCount: number;
        teamsCount: number;
    }>>;
    initializeRelayStructure(): Promise<ServiceResult<string>>;
    private getDefaultConfig;
    private getClaudeSettings;
    private isMcpServerConfigured;
    getProjectInfo(): Promise<ServiceResult<{
        name: string;
        path: string;
        relayConfigured: boolean;
        expertCount: number;
        teamCount: number;
    }>>;
    openRelayFolder(): Promise<void>;
    openDomainConfig(): Promise<void>;
}
export declare const configService: ConfigService;
//# sourceMappingURL=ConfigService.d.ts.map