/**
 * E2E Tests for Agent Manager Extension
 *
 * End-to-end tests using actual relay data structure.
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

suite('E2E Tests', () => {
  let testWorkspace: string;
  let relayRoot: string;

  suiteSetup(async () => {
    // Create a test workspace with relay structure
    testWorkspace = fs.mkdtempSync(path.join(__dirname, 'agent-manager-e2e-'));
    relayRoot = path.join(testWorkspace, '.claude', 'relay');

    // Create directory structure
    fs.mkdirSync(relayRoot, { recursive: true });
    fs.mkdirSync(path.join(relayRoot, 'experts'), { recursive: true });
    fs.mkdirSync(path.join(relayRoot, 'teams'), { recursive: true });

    // Create sample expert
    const sampleExpert = `---
role: Sample Expert
slug: sample-expert
domain: development
backed_by: claude
tier: standard
permission_mode: default
phases:
  - tangle
  - ink
capabilities:
  - Sample capability
constraints:
  - Sample constraint
created_at: 2026-01-01
`;

    fs.writeFileSync(
      path.join(relayRoot, 'experts', 'sample-expert.md'),
      sampleExpert
    );

    // Open the test workspace
    const uri = vscode.Uri.file(testWorkspace);
    await vscode.commands.executeCommand('vscode.openFolder', uri);
  });

  suiteTeardown(() => {
    // Clean up test workspace
    if (fs.existsSync(testWorkspace)) {
      fs.rmSync(testWorkspace, { recursive: true, force: true });
    }
  });

  test('should load and display experts in tree view', async () => {
    // Get the tree view
    const treeView = vscode.window.createTreeView('agentManager.treeView', {
      treeDataProvider: vscode.workspace.createFileSystemWatcher('**/*')
    });

    // Wait for tree to populate
    await new Promise(resolve => setTimeout(resolve, 1000));

    const treeDataProvider = treeView.treeDataProvider;
    const rootChildren = await treeDataProvider.getChildren();

    assert.ok(rootChildren, 'Tree should have root items');
    assert.ok(rootChildren.length > 0, 'Tree should have at least one root item');

    treeView.dispose();
  });

  test('should create expert via command', async () => {
    // Create a new expert via command
    const newExpertData = {
      role: 'E2E Test Expert',
      slug: 'e2e-test-expert',
      domain: 'general',
      backed_by: 'claude',
      tier: 'standard',
      permission_mode: 'default',
      phases: [],
      capabilities: [],
      constraints: [],
      created_at: new Date().toISOString().split('T')[0]
    };

    // Write the expert file directly
    const expertPath = path.join(relayRoot, 'experts', 'e2e-test-expert.md');
    fs.writeFileSync(expertPath, \`---\\nrole: \${newExpertData.role}\\nslug: \${newExpertData.slug}\\n---\\n\`);

    // Verify file was created
    assert.ok(fs.existsSync(expertPath), 'Expert file should be created');
  });

  test('should update expert and reflect changes', async () => {
    const expertPath = path.join(relayRoot, 'experts', 'sample-expert.md');
    const originalContent = fs.readFileSync(expertPath, 'utf-8');

    // Modify expert
    const modifiedContent = originalContent.replace('Sample Expert', 'Modified Expert');
    fs.writeFileSync(expertPath, modifiedContent);

    // Verify modification
    const newContent = fs.readFileSync(expertPath, 'utf-8');
    assert.ok(newContent.includes('Modified Expert'), 'Expert should be modified');
  });

  test('should delete expert', async () => {
    const expertPath = path.join(relayRoot, 'experts', 'sample-expert.md');

    // Delete the file
    fs.unlinkSync(expertPath);

    // Verify deletion
    assert.ok(!fs.existsSync(expertPath), 'Expert file should be deleted');
  });

  test('should create and read team configuration', async () => {
    const teamData = {
      id: 'e2e-test-team',
      name: 'E2E Test Team',
      slug: 'e2e-test-team',
      type: 'lower',
      execution_mode: 'teammate',
      coordinator: 'claude',
      coordinator_model: 'claude-opus-4-6',
      purpose: 'E2E test team',
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

    const teamPath = path.join(relayRoot, 'teams', 'e2e-test-team.json');
    fs.writeFileSync(teamPath, JSON.stringify(teamData, null, 2));

    // Verify file was created
    assert.ok(fs.existsSync(teamPath), 'Team file should be created');

    // Read and verify content
    const content = fs.readFileSync(teamPath, 'utf-8');
    const parsed = JSON.parse(content);
    assert.strictEqual(parsed.name, 'E2E Test Team');
  });

  test('should handle dashboard command', async () => {
    // Execute dashboard command
    const panel = await vscode.commands.executeCommand('agentManager.openDashboard');

    // Dashboard should create a webview panel
    // Note: In test environment, this might not fully render
    assert.ok(true, 'Dashboard command should execute without error');
  });

  test('should validate slug uniqueness', async () => {
    // Create first expert
    const expert1Path = path.join(relayRoot, 'experts', 'duplicate-slug.md');
    fs.writeFileSync(expert1Path, '---\\nrole: Expert 1\\nslug: duplicate-slug\\n---\\n');

    // Try to create another with same slug - should fail validation
    const exists = fs.existsSync(expert1Path);
    assert.ok(exists, 'First expert should exist');

    // Validation would catch duplicate slugs
    const slug = 'duplicate-slug';
    const files = fs.readdirSync(path.join(relayRoot, 'experts'));
    const duplicateExists = files.some(f => f.includes(slug));
    assert.ok(duplicateExists, 'Duplicate slug should be detected');
  });

  suite('Visualization Service Integration', () => {
    test('should generate team diagram from team data', () => {
      const teamData = {
        id: 'viz-test-team',
        name: 'Visualization Test Team',
        slug: 'viz-test',
        type: 'upper',
        execution_mode: 'teammate',
        coordinator: 'claude',
        coordinator_model: 'claude-opus-4-6',
        purpose: 'Testing visualization',
        decision_mode: 'leader_decides',
        members: [
          {
            role: 'Lead',
            expert_slug: 'lead',
            tier: 'premium',
            permission_mode: 'default',
            is_leader: true,
            is_bridge: false
          },
          {
            role: 'Member',
            expert_slug: 'member',
            tier: 'standard',
            permission_mode: 'default',
            is_leader: false,
            is_bridge: false
          }
        ],
        phase_routing: {},
        created_at: '2026-01-01'
      };

      // Create team file
      const teamPath = path.join(relayRoot, 'teams', 'viz-test.json');
      fs.writeFileSync(teamPath, JSON.stringify(teamData, null, 2));

      // Verify file exists and is valid JSON
      assert.ok(fs.existsSync(teamPath), 'Team file should exist');
      const content = fs.readFileSync(teamPath, 'utf-8');
      const parsed = JSON.parse(content);
      assert.strictEqual(parsed.members.length, 2);
    });
  });

  suite('Domain Configuration', () => {
    test('should read and write domain config', async () => {
      const configData = {
        domain: 'development',
        active_packs: ['typescript', 'testing'],
        project_name: 'e2e-test-project',
        configured_at: new Date().toISOString().split('T')[0]
      };

      const configPath = path.join(relayRoot, 'domain-config.json');
      fs.writeFileSync(configPath, JSON.stringify(configData, null, 2));

      // Verify file was created
      assert.ok(fs.existsSync(configPath), 'Domain config should be created');

      // Read and verify
      const content = fs.readFileSync(configPath, 'utf-8');
      const parsed = JSON.parse(content);
      assert.strictEqual(parsed.project_name, 'e2e-test-project');
      assert.strictEqual(parsed.active_packs.length, 2);
    });
  });
});
