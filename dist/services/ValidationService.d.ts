/**
 * ValidationService - Validates expert, team, and agent definitions
 *
 * Ensures data integrity, required fields, and business rule compliance.
 */
import { Expert, Team, TeamMember, ValidationResult } from '../types';
export declare class ValidationService {
    private readonly VALID_DOMAINS;
    private readonly VALID_TIERS;
    private readonly VALID_PERMISSIONS;
    private readonly VALID_BACKED_BY;
    validateExpert(data: Partial<Expert>): ValidationResult;
    checkExpertExists(slug: string): Promise<boolean>;
    checkExpertSlugUnique(slug: string): Promise<boolean>;
    validateTeam(data: Partial<Team>): ValidationResult;
    private validateTeamMembers;
    checkTeamMemberExists(role: string): Promise<boolean>;
    validatePhaseCoverage(members: TeamMember[]): ValidationResult;
    validateYamlFormat(content: string): ValidationResult;
    validateJsonFormat(content: string): ValidationResult;
}
export declare const validationService: ValidationService;
//# sourceMappingURL=ValidationService.d.ts.map