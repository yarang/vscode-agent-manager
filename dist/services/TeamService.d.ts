/**
 * TeamService - High-level Team management operations
 *
 * Wraps FileService with additional functionality:
 * - Member validation against existing experts
 * - Bridge member management
 * - Team composition analysis
 * - Phase coverage validation
 */
import { Team, TeamMember, ServiceResult } from '../types';
export interface TeamCompositionAnalysis {
    valid: boolean;
    errors: string[];
    warnings: string[];
    hasLeader: boolean;
    hasOrchestrator: boolean;
    hasArchitect: boolean;
    phaseCoverage: string[];
    size: {
        current: number;
        recommended: {
            min: number;
            max: number;
        };
    };
}
export declare class TeamService {
    createTeam(name: string, options?: Partial<Team>): Promise<ServiceResult<Team>>;
    updateTeam(slug: string, updates: Partial<Team>): Promise<ServiceResult<Team>>;
    deleteTeam(slug: string): Promise<ServiceResult<void>>;
    listTeams(): Promise<ServiceResult<Team[]>>;
    getTeam(slug: string): Promise<ServiceResult<Team>>;
    getTeamsByType(type: 'upper' | 'lower'): Promise<ServiceResult<Team[]>>;
    findTeamByMember(expertSlug: string): Promise<ServiceResult<Team[]>>;
    addMember(teamSlug: string, member: TeamMember): Promise<ServiceResult<Team>>;
    removeMember(teamSlug: string, expertSlug: string): Promise<ServiceResult<Team>>;
    updateMember(teamSlug: string, expertSlug: string, updates: Partial<TeamMember>): Promise<ServiceResult<Team>>;
    setLeader(teamSlug: string, expertSlug: string): Promise<ServiceResult<Team>>;
    setBridgeMember(teamSlug: string, expertSlug: string): Promise<ServiceResult<Team>>;
    setBridgeTarget(teamSlug: string, targetTeamSlug: string | null): Promise<ServiceResult<Team>>;
    getBridgeChain(teamSlug: string): Promise<ServiceResult<Team[]>>;
    analyzeTeam(teamSlug: string): Promise<ServiceResult<TeamCompositionAnalysis>>;
    getExpertUsage(expertSlug: string): Promise<ServiceResult<{
        teams: Array<{
            name: string;
            slug: string;
            role: string;
        }>;
        isLeader: boolean;
        isBridge: boolean;
    }>>;
    private validateMembersExist;
    private generateTeamId;
    cloneTeam(sourceSlug: string, newName: string): Promise<ServiceResult<Team>>;
    getTeamStats(): Promise<ServiceResult<{
        total: number;
        byType: Record<string, number>;
        totalMembers: number;
        avgTeamSize: number;
    }>>;
}
export declare const teamService: TeamService;
//# sourceMappingURL=TeamService.d.ts.map