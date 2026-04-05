/**
 * ExpertManagerService - Expert CRUD operations with templates
 *
 * Manages expert creation, editing, and template management.
 */

import { Expert, Domain, Tier, BackedBy, PermissionMode } from '../types';
import { fileService } from './FileService';
import { validationService } from './ValidationService';

export interface ExpertTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  defaults: Partial<Expert>;
}

export class ExpertManagerService {
  // ==========================================================================
  // Templates
  // ==========================================================================

  private templates: ExpertTemplate[] = [
    {
      id: 'frontend-developer',
      name: 'Frontend Developer',
      description: 'React, Vue, Web development expert',
      category: 'development',
      defaults: {
        role: 'Frontend Developer',
        domain: 'development',
        backed_by: 'claude',
        tier: 'premium',
        permission_mode: 'default',
        phases: ['tangle', 'ink'],
        capabilities: [
          'React 19+ component architecture',
          'Next.js 15 App Router',
          'TypeScript 5+ type safety',
          'Tailwind CSS styling',
          'Performance optimization',
          'Accessibility (WCAG 2.1)',
          'Responsive design patterns'
        ],
        constraints: [
          'Always use TypeScript for type safety',
          'Follow React best practices',
          'Ensure accessibility compliance',
          'Optimize for Core Web Vitals'
        ],
        persona: 'Expert frontend developer specializing in modern React applications, Next.js, and cutting-edge frontend architecture.'
      }
    },
    {
      id: 'backend-developer',
      name: 'Backend Developer',
      description: 'API, Database, Server-side development expert',
      category: 'development',
      defaults: {
        role: 'Backend Developer',
        domain: 'development',
        backed_by: 'claude',
        tier: 'premium',
        permission_mode: 'default',
        phases: ['grasp', 'tangle'],
        capabilities: [
          'RESTful API design',
          'GraphQL implementation',
          'Database modeling',
          'Authentication & Authorization',
          'Performance optimization',
          'Security best practices',
          'Microservices architecture'
        ],
        constraints: [
          'Always validate input data',
          'Use prepared statements for database queries',
          'Implement proper error handling',
          'Follow OWASP security guidelines'
        ],
        persona: 'Expert backend developer specializing in API design, database architecture, and server-side development.'
      }
    },
    {
      id: 'fullstack-developer',
      name: 'Fullstack Developer',
      description: 'End-to-end web development expert',
      category: 'development',
      defaults: {
        role: 'Fullstack Developer',
        domain: 'development',
        backed_by: 'claude',
        tier: 'premium',
        permission_mode: 'default',
        phases: ['grasp', 'tangle', 'ink'],
        capabilities: [
          'Full-stack web development',
          'Frontend frameworks (React, Vue, Next.js)',
          'Backend frameworks (Express, Fastify, NestJS)',
          'Database design and optimization',
          'API design and integration',
          'DevOps and deployment',
          'Testing and quality assurance'
        ],
        constraints: [
          'Maintain consistency across frontend and backend',
          'Follow testing best practices',
          'Implement proper error boundaries',
          'Use TypeScript end-to-end'
        ],
        persona: 'Expert fullstack developer capable of handling end-to-end web application development.'
      }
    },
    {
      id: 'devops-engineer',
      name: 'DevOps Engineer',
      description: 'CI/CD, Infrastructure, Deployment expert',
      category: 'development',
      defaults: {
        role: 'DevOps Engineer',
        domain: 'development',
        backed_by: 'claude',
        tier: 'premium',
        permission_mode: 'acceptEdits',
        phases: ['tangle', 'ink'],
        capabilities: [
          'CI/CD pipeline design',
          'Docker containerization',
          'Kubernetes orchestration',
          'Infrastructure as Code (Terraform)',
          'Cloud platforms (AWS, GCP, Azure)',
          'Monitoring and observability',
          'Security and compliance'
        ],
        constraints: [
          'Always use Infrastructure as Code',
          'Implement proper security measures',
          'Follow the principle of least privilege',
          'Document all infrastructure changes'
        ],
        persona: 'Expert DevOps engineer specializing in cloud infrastructure, CI/CD pipelines, and automation.'
      }
    },
    {
      id: 'security-auditor',
      name: 'Security Auditor',
      description: 'Security review, OWASP compliance expert',
      category: 'development',
      defaults: {
        role: 'Security Auditor',
        domain: 'development',
        backed_by: 'claude',
        tier: 'premium',
        permission_mode: 'plan',
        phases: ['grasp', 'tangle'],
        capabilities: [
          'OWASP Top 10 vulnerability assessment',
          'Security code review',
          'Penetration testing',
          'Compliance auditing (GDPR, SOC 2, HIPAA)',
          'Threat modeling',
          'Security architecture review',
          'Secure coding practices'
        ],
        constraints: [
          'Follow OWASP security guidelines',
          'Report all security findings',
          'Maintain confidentiality',
          'Follow responsible disclosure'
        ],
        persona: 'Expert security auditor specializing in application security, vulnerability assessment, and compliance.'
      }
    },
    {
      id: 'ux-designer',
      name: 'UX Designer',
      description: 'User experience, interface design expert',
      category: 'development',
      defaults: {
        role: 'UX Designer',
        domain: 'development',
        backed_by: 'claude',
        tier: 'standard',
        permission_mode: 'default',
        phases: ['probe', 'ink'],
        capabilities: [
          'User research and analysis',
          'Wireframing and prototyping',
          'Visual design',
          'Design system creation',
          'Usability testing',
          'Accessibility design',
          'Interaction design'
        ],
        constraints: [
          'Follow WCAG accessibility guidelines',
          'Design for mobile-first',
          'Maintain design consistency',
          'Consider user feedback'
        ],
        persona: 'Expert UX designer specializing in user-centered design, interface design, and design systems.'
      }
    },
    {
      id: 'product-manager',
      name: 'Product Manager',
      description: 'Product strategy, requirements, planning expert',
      category: 'general',
      defaults: {
        role: 'Product Manager',
        domain: 'general',
        backed_by: 'claude',
        tier: 'standard',
        permission_mode: 'plan',
        phases: ['probe'],
        capabilities: [
          'Product strategy and roadmap',
          'Requirements gathering',
          'User story creation',
          'Prioritization',
          'Stakeholder management',
          'Market analysis',
          'Agile planning'
        ],
        constraints: [
          'Focus on user value',
          'Data-driven decision making',
          'Clear communication',
          'Iterative improvement'
        ],
        persona: 'Expert product manager specializing in product strategy, requirements definition, and agile planning.'
      }
    },
    {
      id: 'technical-writer',
      name: 'Technical Writer',
      description: 'Documentation, technical communication expert',
      category: 'general',
      defaults: {
        role: 'Technical Writer',
        domain: 'general',
        backed_by: 'claude',
        tier: 'standard',
        permission_mode: 'default',
        phases: ['ink'],
        capabilities: [
          'Technical documentation',
          'API documentation',
          'User guides',
          'README files',
          'Knowledge base articles',
          'Video tutorials',
          'Documentation architecture'
        ],
        constraints: [
          'Write clearly and concisely',
          'Target the right audience',
          'Keep documentation up to date',
          'Use examples and diagrams'
        ],
        persona: 'Expert technical writer specializing in developer documentation, API docs, and knowledge management.'
      }
    },
    {
      id: 'custom',
      name: 'Custom Expert',
      description: 'Create your own expert from scratch',
      category: 'custom',
      defaults: {
        role: '',
        domain: 'general',
        backed_by: 'claude',
        tier: 'standard',
        permission_mode: 'default',
        phases: [],
        capabilities: [],
        constraints: [],
        persona: ''
      }
    }
  ];

  // ==========================================================================
  // Template Operations
  // ==========================================================================

  getTemplates(): ExpertTemplate[] {
    return this.templates;
  }

  getTemplate(id: string): ExpertTemplate | undefined {
    return this.templates.find(t => t.id === id);
  }

  getTemplatesByCategory(category: string): ExpertTemplate[] {
    return this.templates.filter(t => t.category === category);
  }

  getCategories(): string[] {
    const categories = new Set(this.templates.map(t => t.category));
    return Array.from(categories).sort();
  }

  // ==========================================================================
  // Expert CRUD Operations
  // ==========================================================================

  async createExpert(expert: Expert): Promise<{ success: boolean; error?: string; data?: Expert }> {
    // Validate
    const validation = validationService.validateExpert(expert);
    if (!validation.valid) {
      return {
        success: false,
        error: `Validation failed: ${validation.errors.join(', ')}`
      };
    }

    // Check uniqueness
    const exists = await validationService.checkExpertExists(expert.slug);
    if (exists) {
      return {
        success: false,
        error: `Expert with slug "${expert.slug}" already exists`
      };
    }

    // Create
    const result = await fileService.createExpert(expert);
    if (result.success) {
      return { success: true, data: expert };
    }
    return { success: false, error: result.error };
  }

  async updateExpert(slug: string, expert: Expert): Promise<{ success: boolean; error?: string; data?: Expert }> {
    // Validate
    const validation = validationService.validateExpert(expert);
    if (!validation.valid) {
      return {
        success: false,
        error: `Validation failed: ${validation.errors.join(', ')}`
      };
    }

    // Check if slug changed and new slug exists
    if (slug !== expert.slug) {
      const exists = await validationService.checkExpertExists(expert.slug);
      if (exists) {
        return {
          success: false,
          error: `Expert with slug "${expert.slug}" already exists`
        };
      }

      // Delete old file if slug changed
      await fileService.deleteExpert(slug);
    }

    // Update
    const result = await fileService.updateExpert(expert.slug, expert);
    if (result.success) {
      return { success: true, data: expert };
    }
    return { success: false, error: result.error };
  }

  async deleteExpert(slug: string): Promise<{ success: boolean; error?: string }> {
    // Check if expert is used in any team
    const teams = await fileService.listTeams();
    if (teams.success && teams.data) {
      const inUse = teams.data.some(team =>
        team.members.some(member => member.expert_slug === slug)
      );

      if (inUse) {
        return {
          success: false,
          error: `Expert "${slug}" is used in one or more teams. Remove from teams first.`
        };
      }
    }

    const result = await fileService.deleteExpert(slug);
    return result;
  }

  async duplicateExpert(slug: string, newSlug: string): Promise<{ success: boolean; error?: string; data?: Expert }> {
    const result = await fileService.readExpert(slug);
    if (!result.success || !result.data) {
      return { success: false, error: `Expert not found: ${slug}` };
    }

    const newExpert: Expert = {
      ...result.data,
      slug: newSlug,
      role: `${result.data.role} (Copy)`,
      created_at: new Date().toISOString().split('T')[0]
    };

    return this.createExpert(newExpert);
  }

  // ==========================================================================
  // Expert Form Data
  // ==========================================================================

  getFormData() {
    return {
      domains: [
        { value: 'general', label: 'General' },
        { value: 'development', label: 'Development' }
      ] as const,
      tiers: [
        { value: 'trivial', label: 'Trivial', description: 'Simple tasks, low cost' },
        { value: 'standard', label: 'Standard', description: 'Regular tasks, balanced cost' },
        { value: 'premium', label: 'Premium', description: 'Complex tasks, high quality' }
      ] as const,
      backedBy: [
        { value: 'claude', label: 'Claude', description: 'Anthropic Claude' },
        { value: 'codex', label: 'Codex', description: 'OpenAI Codex' },
        { value: 'gemini', label: 'Gemini', description: 'Google Gemini' },
        { value: 'zai', label: 'ZAI', description: 'ZAI Models' }
      ] as const,
      permissionModes: [
        { value: 'plan', label: 'Plan', description: 'Planning and analysis only' },
        { value: 'acceptEdits', label: 'Accept Edits', description: 'Review and approve changes' },
        { value: 'default', label: 'Default', description: 'Full autonomy' }
      ] as const,
      phases: [
        { value: 'probe', label: 'Probe', description: 'Research and discovery' },
        { value: 'grasp', label: 'Grasp', description: 'Understanding and analysis' },
        { value: 'tangle', label: 'Tangle', description: 'Implementation' },
        { value: 'ink', label: 'Ink', description: 'Documentation and delivery' }
      ] as const
    };
  }

  // ==========================================================================
  // Slug Generation
  // ==========================================================================

  generateSlug(role: string): string {
    return role
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 50);
  }

  // ==========================================================================
  // Validation
  // ==========================================================================

  validateSlug(slug: string): { valid: boolean; error?: string } {
    if (!slug || slug.trim() === '') {
      return { valid: false, error: 'Slug is required' };
    }

    if (!/^[a-z0-9-]+$/.test(slug)) {
      return { valid: false, error: 'Slug must contain only lowercase letters, numbers, and hyphens' };
    }

    if (slug.startsWith('-') || slug.endsWith('-')) {
      return { valid: false, error: 'Slug cannot start or end with a hyphen' };
    }

    if (slug.length > 50) {
      return { valid: false, error: 'Slug must be 50 characters or less' };
    }

    return { valid: true };
  }
}

// Singleton export
export const expertManagerService = new ExpertManagerService();
