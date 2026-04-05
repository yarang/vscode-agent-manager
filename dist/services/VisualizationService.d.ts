/**
 * VisualizationService - Diagram generation for agent hierarchy
 *
 * Generates Mermaid diagrams for:
 * - Team structure visualization
 * - Expert hierarchy
 * - Agent relationships
 */
import { Team, Expert } from '../types';
export declare class VisualizationService {
    /**
     * Generate Mermaid flowchart for team structure
     */
    generateTeamDiagram(teams: Team[]): string;
    /**
     * Generate Mermaid diagram for single team with members
     */
    generateSingleTeamDiagram(team: Team): string;
    /**
     * Generate Mermaid diagram for expert hierarchy by domain
     */
    generateExpertHierarchyDiagram(experts: Expert[]): string;
    /**
     * Generate Mermaid mind map for expert capabilities
     */
    generateExpertMindMap(expert: Expert): string;
    /**
     * Generate comprehensive overview diagram
     */
    generateOverviewDiagram(teams: Team[], experts: Expert[]): string;
    private sanitizeLabel;
    private getEmptyDiagram;
    getTeamStats(teams: Team[]): {
        total: number;
        upper: number;
        lower: number;
        totalMembers: number;
        coordinators: Record<string, number>;
    };
    getExpertStats(experts: Expert[]): {
        total: number;
        byDomain: Record<string, number>;
        byBackedBy: Record<string, number>;
        byTier: Record<string, number>;
    };
}
export declare const visualizationService: VisualizationService;
//# sourceMappingURL=VisualizationService.d.ts.map