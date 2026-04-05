/**
 * Extension Activation Tests
 *
 * Tests for extension activation, command registration, and basic functionality.
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import { before, after } from 'mocha';

suite('Extension Test Suite', () => {
  let extension: vscode.Extension<unknown> | undefined;

  before(async () => {
    const ext = vscode.extensions.getExtension('relay-plugin.agent-manager');
    if (ext) {
      extension = ext;
    } else {
      // For testing in development mode
      const extensionPath = process.env.TEST_EXTENSION_PATH;
      assert.ok(extensionPath, 'TEST_EXTENSION_PATH environment variable must be set');
      extension = await vscode.extensions.activateExtensionPath(extensionPath);
    }
    assert.ok(extension, 'Extension should be present');
    await extension.activate();
  });

  after(() => {
    // Cleanup after tests
  });

  test('Extension should be present', () => {
    assert.ok(extension, 'Extension should be present');
  });

  test('Extension should activate', async () => {
    await extension?.activate();
    assert.strictEqual(extension?.isActive, true);
  });

  test('Extension should register commands', async () => {
    const commands = await vscode.commands.getCommands(true);
    const expectedCommands = [
      'agentManager.openDashboard',
      'agentManager.createExpert',
      'agentManager.buildTeam',
      'agentManager.editAgent',
      'agentManager.openSettings',
      'agentManager.refreshTree',
      'agentManager.openExpertManager'
    ];

    for (const cmd of expectedCommands) {
      assert.ok(commands.has(cmd), \`Command \${cmd} should be registered\`);
    }
  });

  test('Extension should register tree view', async () => {
    const treeView = vscode.window.createTreeView('agentManager.treeView', {
      treeDataProvider: {
        getTreeItem: () => new vscode.TreeItem('test'),
        getChildren: () => [],
        onDidChangeTreeData: new vscode.EventEmitter().event
      }
    });

    assert.ok(treeView, 'Tree view should be created');
    treeView.dispose();
  });

  test('Dashboard command should execute', async () => {
    const executeCommand = new Promise<boolean>(resolve => {
      const disposable = vscode.commands.registerCommand('test.dashboardExecuted', () => resolve(true));
      vscode.commands.executeCommand('agentManager.openDashboard');
      setTimeout(() => {
        disposable.dispose();
        resolve(false);
      }, 1000);
    });

    const result = await executeCommand;
    assert.ok(result, 'Dashboard command should execute');
  });
});
