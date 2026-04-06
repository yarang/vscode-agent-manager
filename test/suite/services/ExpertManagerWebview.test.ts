/**
 * ExpertManager Webview Tests
 *
 * Verifies button wiring and message routing for the ExpertManager webview.
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import {
  dispatchExpertManagerMessage,
  getExpertManagerHtmlForTest
} from '../../../src/webviews/ExpertManager';

suite('ExpertManager Webview Tests', () => {
  test('should route button messages to the matching handlers', async () => {
    const calls: string[] = [];
    const panel = { dispose: () => { calls.push('panel.dispose'); } } as unknown as vscode.WebviewPanel;

    const handlers = {
      init: async (_panel: vscode.WebviewPanel, expertSlug?: string) => {
        calls.push(`init:${expertSlug ?? ''}`);
      },
      save: async (_panel: vscode.WebviewPanel, data: { slug?: string }) => {
        calls.push(`save:${data.slug ?? ''}`);
      },
      delete: async (_panel: vscode.WebviewPanel, slug: string) => {
        calls.push(`delete:${slug}`);
      },
      duplicate: async (_panel: vscode.WebviewPanel, slug: string) => {
        calls.push(`duplicate:${slug}`);
      },
      loadTemplate: async (_panel: vscode.WebviewPanel, templateId: string) => {
        calls.push(`template:${templateId}`);
      },
      generateSlug: (_panel: vscode.WebviewPanel, role: string) => {
        calls.push(`generate:${role}`);
      },
      validateSlug: async (_panel: vscode.WebviewPanel, slug: string, originalSlug?: string) => {
        calls.push(`validate:${slug}:${originalSlug ?? ''}`);
      },
      cancel: (_panel: vscode.WebviewPanel) => {
        calls.push('cancel');
      }
    };

    await dispatchExpertManagerMessage(panel, { command: 'init' }, 'edited-expert', handlers);
    await dispatchExpertManagerMessage(panel, { command: 'save', data: { slug: 'save-me' } }, undefined, handlers);
    await dispatchExpertManagerMessage(panel, { command: 'delete', slug: 'remove-me' }, undefined, handlers);
    await dispatchExpertManagerMessage(panel, { command: 'duplicate', slug: 'copy-me' }, undefined, handlers);
    await dispatchExpertManagerMessage(panel, { command: 'loadTemplate', templateId: 'frontend-developer' }, undefined, handlers);
    await dispatchExpertManagerMessage(panel, { command: 'generateSlug', role: 'Platform Engineer' }, undefined, handlers);
    await dispatchExpertManagerMessage(panel, {
      command: 'validateSlug',
      slug: 'platform-engineer',
      originalSlug: 'platform-engineer-old'
    }, undefined, handlers);
    await dispatchExpertManagerMessage(panel, { command: 'cancel' }, undefined, handlers);

    assert.deepStrictEqual(calls, [
      'init:edited-expert',
      'save:save-me',
      'delete:remove-me',
      'duplicate:copy-me',
      'template:frontend-developer',
      'generate:Platform Engineer',
      'validate:platform-engineer:platform-engineer-old',
      'cancel'
    ]);
  });

  test('should render wired action buttons and updated layout', () => {
    const html = getExpertManagerHtmlForTest();

    assert.ok(html.includes('class="page-layout"'));
    assert.ok(html.includes('onclick="addCapability()"'));
    assert.ok(html.includes('onclick="addConstraint()"'));
    assert.ok(html.includes('onclick="validateAndSave()"'));
    assert.ok(html.includes("vscode.postMessage({ command: 'cancel' })"));
    assert.ok(html.includes('window.addCapability = addCapability'));
    assert.ok(html.includes('window.validateAndSave = validateAndSave'));
  });
});
