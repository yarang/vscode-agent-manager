/**
 * FileService Unit Tests
 *
 * Tests for file operations, Expert/Team CRUD, and data parsing.
 */

import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { FileService } from '../../src/services/FileService';
import { Expert, Team } from '../../src/types';

suite('FileService Tests', () => {
  let testDir: string;
  let fileService: FileService;
  let relayRoot: string;

  setup(async () => {
    // Create temporary directory for testing
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-manager-test-'));
    relayRoot = path.join(testDir, '.claude', 'relay');

    // Mock vscode.workspace.workspaceFolders
    (vscode as any).workspace = {
      workspaceFolders: [{
        uri: { fsPath: testDir }
      }]
    };

    fileService = new FileService();
  });

  teardown(() => {
    // Clean up test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  test('should create relay directory structure', () => {
    const expertsDir = path.join(relayRoot, 'experts');
    const teamsDir = path.join(relayRoot, 'teams');

    assert.ok(fs.existsSync(relayRoot), 'Relay root should exist');
    // Note: Directories are created lazily when needed
  });

  suite('Expert CRUD Operations', () => {
    const testExpert: Expert = {
      role: 'Test Expert',
      slug: 'test-expert',
      domain: 'development',
      backed_by: 'claude',
      tier: 'standard',
      permission_mode: 'default',
      phases: ['tangle', 'ink'],
      capabilities: ['Test capability'],
      constraints: ['Test constraint'],
      created_at: '2026-01-01'
    };

    test('should create an expert file', async () => {
      const result = await fileService.createExpert(testExpert);

      assert.strictEqual(result.success, true, 'Create should succeed');
      assert.ok(result.data, 'Should return file path');

      const filePath = path.join(relayRoot, 'experts', 'test-expert.md');
      assert.ok(fs.existsSync(filePath), 'Expert file should exist');
    });

    test('should read an expert file', async () => {
      await fileService.createExpert(testExpert);
      const result = await fileService.readExpert('test-expert');

      assert.strictEqual(result.success, true, 'Read should succeed');
      assert.ok(result.data, 'Should return expert data');
      assert.strictEqual(result.data?.role, 'Test Expert');
      assert.strictEqual(result.data?.slug, 'test-expert');
    });

    test('should list all experts', async () => {
      await fileService.createExpert(testExpert);
      await fileService.createExpert({
        ...testExpert,
        role: 'Another Expert',
        slug: 'another-expert'
      });

      const result = await fileService.listExperts();

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.data?.length, 2);
    });

    test('should update an expert', async () => {
      await fileService.createExpert(testExpert);

      const updatedExpert = { ...testExpert, role: 'Updated Expert' };
      const result = await fileService.updateExpert('test-expert', updatedExpert);

      assert.strictEqual(result.success, true);

      const readResult = await fileService.readExpert('test-expert');
      assert.strictEqual(readResult.data?.role, 'Updated Expert');
    });

    test('should delete an expert', async () => {
      await fileService.createExpert(testExpert);

      const deleteResult = await fileService.deleteExpert('test-expert');
      assert.strictEqual(deleteResult.success, true);

      const readResult = await fileService.readExpert('test-expert');
      assert.strictEqual(readResult.success, false);
    });
  });

  suite('Team CRUD Operations', () => {
    const testTeam: Team = {
      id: 'test-team-1',
      name: 'Test Team',
      slug: 'test-team',
      type: 'lower',
      execution_mode: 'teammate',
      coordinator: 'claude',
      coordinator_model: 'claude-opus-4-6',
      purpose: 'Test team purpose',
      decision_mode: 'leader_decides',
      members: [
        {
          role: 'Team Lead',
          expert_slug: 'team-lead',
          tier: 'premium',
          permission_mode: 'default',
          is_leader: true,
          is_bridge: false
        }
      ],
      phase_routing: {},
      created_at: '2026-01-01'
    };

    test('should create a team file', async () => {
      const result = await fileService.createTeam(testTeam);

      assert.strictEqual(result.success, true);

      const filePath = path.join(relayRoot, 'teams', 'test-team.json');
      assert.ok(fs.existsSync(filePath));
    });

    test('should read a team file', async () => {
      await fileService.createTeam(testTeam);
      const result = await fileService.readTeam('test-team');

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.data?.name, 'Test Team');
    });

    test('should list all teams', async () => {
      await fileService.createTeam(testTeam);
      await fileService.createTeam({
        ...testTeam,
        id: 'test-team-2',
        name: 'Another Team',
        slug: 'another-team'
      });

      const result = await fileService.listTeams();

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.data?.length, 2);
    });

    test('should update a team', async () => {
      await fileService.createTeam(testTeam);

      const updatedTeam = { ...testTeam, name: 'Updated Team' };
      const result = await fileService.updateTeam('test-team', updatedTeam);

      assert.strictEqual(result.success, true);

      const readResult = await fileService.readTeam('test-team');
      assert.strictEqual(readResult.data?.name, 'Updated Team');
    });

    test('should delete a team', async () => {
      await fileService.createTeam(testTeam);

      const deleteResult = await fileService.deleteTeam('test-team');
      assert.strictEqual(deleteResult.success, true);

      const readResult = await fileService.readTeam('test-team');
      assert.strictEqual(readResult.success, false);
    });
  });

  suite('Domain Config Operations', () => {
    test('should write domain config', async () => {
      const config = {
        domain: 'development',
        active_packs: ['typescript', 'react'],
        project_name: 'test-project',
        configured_at: '2026-01-01'
      };

      const result = await fileService.writeDomainConfig(config);

      assert.strictEqual(result.success, true);

      const filePath = path.join(relayRoot, 'domain-config.json');
      assert.ok(fs.existsSync(filePath));
    });

    test('should read domain config', async () => {
      const config = {
        domain: 'development',
        active_packs: ['typescript', 'react'],
        project_name: 'test-project',
        configured_at: '2026-01-01'
      };

      await fileService.writeDomainConfig(config);
      const result = await fileService.readDomainConfig();

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.data?.project_name, 'test-project');
    });

    test('should return null when domain config does not exist', async () => {
      const result = await fileService.readDomainConfig();

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.data, null);
    });
  });

  suite('Path Helpers', () => {
    test('should return correct relay root path', () => {
      const root = fileService.getRelayRoot();
      assert.ok(root.includes('.claude'));
      assert.ok(root.includes('relay'));
    });

    test('should return correct experts directory path', () => {
      const expertsDir = fileService.getExpertsDir();
      assert.ok(expertsDir.includes('experts'));
    });

    test('should return correct teams directory path', () => {
      const teamsDir = fileService.getTeamsDir();
      assert.ok(teamsDir.includes('teams'));
    });
  });
});
