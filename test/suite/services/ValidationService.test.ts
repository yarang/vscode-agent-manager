/**
 * ValidationService Unit Tests
 *
 * Tests for expert and team validation logic.
 */

import * as assert from 'assert';
import { ValidationService } from '../../src/services/ValidationService';
import { Expert, Team } from '../../src/types';

suite('ValidationService Tests', () => {
  let validationService: ValidationService;

  setup(() => {
    validationService = new ValidationService();
  });

  suite('Expert Validation', () => {
    const validExpert: Expert = {
      role: 'Test Expert',
      slug: 'test-expert',
      domain: 'development',
      backed_by: 'claude',
      tier: 'standard',
      permission_mode: 'default',
      phases: ['tangle', 'ink'],
      capabilities: ['Test capability'],
      constraints: [],
      created_at: '2026-01-01'
    };

    test('should validate a valid expert', () => {
      const result = validationService.validateExpert(validExpert);

      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.errors.length, 0);
    });

    test('should reject expert without role', () => {
      const result = validationService.validateExpert({ ...validExpert, role: '' });

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('role')));
    });

    test('should reject expert without slug', () => {
      const result = validationService.validateExpert({ ...validExpert, slug: '' });

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('slug')));
    });

    test('should reject expert with invalid slug format', () => {
      const result = validationService.validateExpert({ ...validExpert, slug: 'Invalid_Slug' });

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('lowercase')));
    });

    test('should reject expert with invalid domain', () => {
      const result = validationService.validateExpert({
        ...validExpert,
        domain: 'invalid' as any
      });

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('domain')));
    });

    test('should reject expert with invalid tier', () => {
      const result = validationService.validateExpert({
        ...validExpert,
        tier: 'invalid' as any
      });

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('tier')));
    });

    test('should warn when no phases defined', () => {
      const result = validationService.validateExpert({ ...validExpert, phases: [] });

      assert.strictEqual(result.valid, true);
      assert.ok(result.warnings.some(w => w.includes('phases')));
    });

    test('should warn when no persona defined', () => {
      const result = validationService.validateExpert({
        ...validExpert,
        persona: ''
      });

      assert.strictEqual(result.valid, true);
      assert.ok(result.warnings.some(w => w.includes('persona')));
    });
  });

  suite('Team Validation', () => {
    const validTeam: Team = {
      id: 'test-team',
      name: 'Test Team',
      slug: 'test-team',
      type: 'upper',
      execution_mode: 'teammate',
      coordinator: 'claude',
      coordinator_model: 'claude-opus-4-6',
      purpose: 'Test purpose',
      decision_mode: 'leader_decides',
      members: [
        {
          role: 'Orchestrator',
          expert_slug: 'orchestrator',
          tier: 'premium',
          permission_mode: 'default',
          is_leader: true,
          is_bridge: false
        },
        {
          role: 'Architect',
          expert_slug: 'architect',
          tier: 'premium',
          permission_mode: 'default',
          is_leader: false,
          is_bridge: false
        }
      ],
      phase_routing: {},
      created_at: '2026-01-01'
    };

    test('should validate a valid upper team', () => {
      const result = validationService.validateTeam(validTeam);

      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.errors.length, 0);
    });

    test('should reject team without name', () => {
      const result = validationService.validateTeam({ ...validTeam, name: '' });

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('name')));
    });

    test('should reject team without slug', () => {
      const result = validationService.validateTeam({ ...validTeam, slug: '' });

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('slug')));
    });

    test('should reject team without members', () => {
      const result = validationService.validateTeam({
        ...validTeam,
        members: []
      });

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('members')));
    });

    test('should reject team without leader', () => {
      const result = validationService.validateTeam({
        ...validTeam,
        members: [
          {
            role: 'Member',
            expert_slug: 'member',
            tier: 'standard',
            permission_mode: 'default',
            is_leader: false,
            is_bridge: false
          }
        ]
      });

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('leader')));
    });

    test('should warn about multiple leaders', () => {
      const result = validationService.validateTeam({
        ...validTeam,
        members: [
          {
            role: 'Leader 1',
            expert_slug: 'leader1',
            tier: 'premium',
            permission_mode: 'default',
            is_leader: true,
            is_bridge: false
          },
          {
            role: 'Leader 2',
            expert_slug: 'leader2',
            tier: 'premium',
            permission_mode: 'default',
            is_leader: true,
            is_bridge: false
          }
        ]
      });

      assert.strictEqual(result.valid, true);
      assert.ok(result.warnings.some(w => w.includes('multiple leaders')));
    });

    test('should require orchestrator for upper team', () => {
      const result = validationService.validateTeam({
        ...validTeam,
        type: 'upper',
        members: [
          {
            role: 'Architect',
            expert_slug: 'architect',
            tier: 'premium',
            permission_mode: 'default',
            is_leader: true,
            is_bridge: false
          }
        ]
      });

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('orchestrator')));
    });

    test('should require team lead for lower team', () => {
      const result = validationService.validateTeam({
        ...validTeam,
        type: 'lower',
        members: [
          {
            role: 'Developer',
            expert_slug: 'developer',
            tier: 'standard',
            permission_mode: 'default',
            is_leader: false,
            is_bridge: false
          }
        ]
      });

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('team leader')));
    });

    test('should warn about upper team size', () => {
      const manyMembers = Array(10).fill(null).map((_, i) => ({
        role: `Member ${i}`,
        expert_slug: `member-${i}`,
        tier: 'standard' as const,
        permission_mode: 'default' as const,
        is_leader: false,
        is_bridge: false
      }));

      const result = validationService.validateTeam({
        ...validTeam,
        type: 'upper',
        members: manyMembers
      });

      assert.strictEqual(result.valid, true);
      assert.ok(result.warnings.some(w => w.includes('3-8 members')));
    });

    test('should warn about lower team size', () => {
      const manyMembers = Array(8).fill(null).map((_, i) => ({
        role: `Member ${i}`,
        expert_slug: `member-${i}`,
        tier: 'standard' as const,
        permission_mode: 'default' as const,
        is_leader: i === 0,
        is_bridge: false
      }));

      const result = validationService.validateTeam({
        ...validTeam,
        type: 'lower',
        members: manyMembers
      });

      assert.strictEqual(result.valid, true);
      assert.ok(result.warnings.some(w => w.includes('2-6 members')));
    });

    test('should warn about duplicate roles', () => {
      const result = validationService.validateTeam({
        ...validTeam,
        members: [
          {
            role: 'Developer',
            expert_slug: 'dev1',
            tier: 'standard',
            permission_mode: 'default',
            is_leader: true,
            is_bridge: false
          },
          {
            role: 'Developer',
            expert_slug: 'dev2',
            tier: 'standard',
            permission_mode: 'default',
            is_leader: false,
            is_bridge: false
          }
        ]
      });

      assert.strictEqual(result.valid, true);
      assert.ok(result.warnings.some(w => w.includes('duplicate roles')));
    });
  });

  suite('YAML/JSON Validation', () => {
    test('should validate correct YAML', () => {
      const result = validationService.validateYamlFormat('key: value\\nnested:\\n  item: 1');

      assert.strictEqual(result.valid, true);
    });

    test('should reject invalid YAML', () => {
      const result = validationService.validateYamlFormat('key: value\\n  invalid indentation');

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('YAML')));
    });

    test('should validate correct JSON', () => {
      const result = validationService.validateJsonFormat('{"key": "value", "nested": {"item": 1}}');

      assert.strictEqual(result.valid, true);
    });

    test('should reject invalid JSON', () => {
      const result = validationService.validateJsonFormat('{"key": value, "missing": quotes}');

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('JSON')));
    });
  });
});
