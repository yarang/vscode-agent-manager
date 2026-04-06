/**
 * ExpertManager Webview - Expert creation and editing interface
 *
 * Provides a rich UI for creating, editing, and managing expert definitions.
 */

import * as vscode from 'vscode';
import { Expert, SpecDefinition } from '../types';
import { expertManagerService } from '../services/ExpertManagerService';
import { TemplateService } from '../services/TemplateService';
import { getNonce } from '../utils/webview';

let currentPanel: vscode.WebviewPanel | undefined;
let currentExpertSlug: string | undefined;
let _templateService: TemplateService | undefined;
const debugChannel = vscode.window.createOutputChannel('Agent Manager: ExpertManager');

interface ExpertManagerMessage {
  command: string;
  [key: string]: unknown;
}

interface ExpertManagerMessageHandlers {
  init: (panel: vscode.WebviewPanel, expertSlug?: string) => Promise<void>;
  save: (panel: vscode.WebviewPanel, data: ExpertFormData) => Promise<void>;
  delete: (panel: vscode.WebviewPanel, slug: string) => Promise<void>;
  duplicate: (panel: vscode.WebviewPanel, slug: string) => Promise<void>;
  loadTemplate: (panel: vscode.WebviewPanel, templateId: string) => Promise<void>;
  generateSlug: (panel: vscode.WebviewPanel, role: string) => void;
  validateSlug: (panel: vscode.WebviewPanel, slug: string, originalSlug?: string) => Promise<void>;
  cancel: (panel: vscode.WebviewPanel) => void;
  saveSpec: (panel: vscode.WebviewPanel, spec: SpecDefinition) => Promise<void>;
  deleteSpec: (panel: vscode.WebviewPanel, id: string) => Promise<void>;
}

function logDebug(message: string, data?: unknown): void {
  const timestamp = new Date().toISOString();
  const suffix = data === undefined ? '' : ` ${safeStringify(data)}`;
  const line = `[${timestamp}] ${message}${suffix}`;
  debugChannel.appendLine(line);
  console.log(`[ExpertManager] ${message}`, data ?? '');
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return '[unserializable]';
  }
}

function postToWebview(panel: vscode.WebviewPanel, message: Record<string, unknown>): void {
  logDebug('Posting message to webview', message);
  panel.webview.postMessage(message);
}

const defaultMessageHandlers: ExpertManagerMessageHandlers = {
  init: handleInit,
  save: handleSave,
  delete: handleDelete,
  duplicate: handleDuplicate,
  loadTemplate: handleLoadTemplate,
  generateSlug: handleGenerateSlug,
  validateSlug: handleValidateSlug,
  cancel: handleCancel,
  saveSpec: handleSaveSpec,
  deleteSpec: handleDeleteSpec
};

export function openExpertManager(
  extensionUri: vscode.Uri,
  expertSlug?: string,
  templateService?: TemplateService
): void {
  currentExpertSlug = expertSlug;
  _templateService = templateService;
  logDebug('openExpertManager invoked', { expertSlug, hasCurrentPanel: !!currentPanel });
  if (currentPanel) {
    logDebug('Revealing existing ExpertManager panel', { expertSlug });
    currentPanel.title = expertSlug ? 'Edit Expert' : 'Create Expert';
    currentPanel.reveal();
    void dispatchExpertManagerMessage(currentPanel, { command: 'init' }, currentExpertSlug);
    return;
  }

  currentPanel = vscode.window.createWebviewPanel(
    'expertManager',
    expertSlug ? 'Edit Expert' : 'Create Expert',
    vscode.ViewColumn.Beside,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [extensionUri]
    }
  );

  currentPanel.webview.html = getHtml(currentPanel.webview, extensionUri);

  currentPanel.onDidDispose(() => {
    currentPanel = undefined;
    currentExpertSlug = undefined;
  });

  // Handle messages from webview
  currentPanel.webview.onDidReceiveMessage(
    async (message) => {
      const panel = currentPanel;
      if (!panel) {return;}
      await dispatchExpertManagerMessage(panel, message, currentExpertSlug);
    },
    undefined
  );
}

interface ExpertFormData extends Partial<Expert> {
  _originalSlug?: string;
  specs?: string[];
}

// ==========================================================================
// Message Handlers
// ==========================================================================

async function handleInit(panel: vscode.WebviewPanel, expertSlug?: string) {
  logDebug('handleInit start', { expertSlug });
  const { fileService } = await import('../services/FileService');

  // Load specs: user scope + project scope merged via TemplateService if available,
  // otherwise fall back to project-scope only.
  let allSpecs: SpecDefinition[] = [];
  if (_templateService) {
    const resolved = await _templateService.listSpecs('spec');
    allSpecs = resolved.map(r => ({
      ...r.effective,
      // carry scope badge so webview can show [U]/[P]
      _overridden: r.overridden_by === 'project'
    } as SpecDefinition & { _overridden?: boolean }));
  } else {
    const specsResult = await fileService.listProjectSpecs();
    allSpecs = (specsResult.data || []).filter(s => s.type === 'spec');
  }

  if (expertSlug) {
    const result = await fileService.readExpert(expertSlug);
    if (result.success && result.data) {
      postToWebview(panel, { command: 'loadExpert', data: result.data, specs: allSpecs });
    } else {
      postToWebview(panel, { command: 'error', message: `Expert not found: ${expertSlug}` });
    }
  } else {
    postToWebview(panel, {
      command: 'loadTemplates',
      templates: expertManagerService.getTemplates(),
      categories: expertManagerService.getCategories(),
      formData: expertManagerService.getFormData(),
      specs: allSpecs
    });
  }
}

async function handleSave(panel: vscode.WebviewPanel, data: ExpertFormData) {
  logDebug('handleSave start', {
    slug: data.slug,
    originalSlug: data._originalSlug,
    role: data.role,
    phases: data.phases?.length ?? 0
  });
  const isEdit = !!data._originalSlug;

  // Prepare expert object
  const expert: Expert = {
    role: data.role || '',
    slug: data.slug || '',
    domain: data.domain || 'general',
    backed_by: data.backed_by || 'claude',
    cli: data.cli,
    model: data.model,
    fallback_cli: data.fallback_cli,
    tier: data.tier || 'standard',
    permission_mode: data.permission_mode || 'default',
    memory: data.memory,
    isolation: data.isolation,
    phases: data.phases || [],
    agent_profile: data.agent_profile,
    default_platform: data.default_platform,
    persona: data.persona || '',
    specs: data.specs || [],
    capabilities: data.capabilities || [],
    constraints: data.constraints || [],
    created_at: data.created_at || new Date().toISOString().split('T')[0]
  };

  let result;
  if (isEdit) {
    result = await expertManagerService.updateExpert(data._originalSlug!, expert);
  } else {
    result = await expertManagerService.createExpert(expert);
  }

  if (result.success) {
    postToWebview(panel, {
      command: 'saved',
      data: result.data
    });
    currentExpertSlug = result.data?.slug;
    panel.title = currentExpertSlug ? 'Edit Expert' : 'Create Expert';

    vscode.window.showInformationMessage(
      `Expert ${isEdit ? 'updated' : 'created'} successfully!`
    );

    // Refresh tree
    vscode.commands.executeCommand('agentManager.refreshTree');
  } else {
    postToWebview(panel, {
      command: 'error',
      message: result.error || 'Failed to save expert'
    });
  }
}

async function handleDelete(panel: vscode.WebviewPanel, slug: string) {
  logDebug('handleDelete start', { slug });
  const confirmed = await vscode.window.showWarningMessage(
    `Delete expert "${slug}"? This action cannot be undone.`,
    { modal: true },
    'Delete',
    'Cancel'
  );

  if (confirmed === 'Delete') {
    const result = await expertManagerService.deleteExpert(slug);

    if (result.success) {
      vscode.window.showInformationMessage(`Expert "${slug}" deleted.`);
      panel.dispose();
      vscode.commands.executeCommand('agentManager.refreshTree');
    } else {
      vscode.window.showErrorMessage(result.error || 'Failed to delete expert');
    }
  }
}

async function handleDuplicate(panel: vscode.WebviewPanel, slug: string) {
  logDebug('handleDuplicate start', { slug });
  const newSlug = await vscode.window.showInputBox({
    prompt: 'Enter slug for the duplicate',
    value: `${slug}-copy`,
    validateInput: (value) => {
      const validation = expertManagerService.validateSlug(value);
      return validation.valid ? null : validation.error;
    }
  });

  if (!newSlug) {return;}

  const result = await expertManagerService.duplicateExpert(slug, newSlug);

  if (result.success) {
    vscode.window.showInformationMessage(`Expert duplicated as "${newSlug}"`);
    vscode.commands.executeCommand('agentManager.refreshTree');

    // Open the new expert
    vscode.commands.executeCommand('agentManager.editAgent', newSlug);
  } else {
    vscode.window.showErrorMessage(result.error || 'Failed to duplicate expert');
  }
}

function handleCancel(panel: vscode.WebviewPanel) {
  logDebug('handleCancel start');
  panel.dispose();
}

async function handleSaveSpec(panel: vscode.WebviewPanel, spec: SpecDefinition) {
  logDebug('handleSaveSpec start', { id: spec.id, type: spec.type });
  const { fileService } = await import('../services/FileService');
  const result = await fileService.writeProjectSpec(spec.id, {
    ...spec,
    type: 'spec',
    scope: 'project'
  });

  if (result.success) {
    postToWebview(panel, {
      command: 'specSaved',
      spec: { ...spec, type: 'spec', scope: 'project' }
    });
  } else {
    postToWebview(panel, {
      command: 'error',
      message: result.error || 'Failed to save spec'
    });
  }
}

async function handleDeleteSpec(panel: vscode.WebviewPanel, id: string) {
  logDebug('handleDeleteSpec start', { id });
  const { fileService } = await import('../services/FileService');
  const result = await fileService.deleteProjectSpec(id, 'spec');

  if (result.success) {
    postToWebview(panel, {
      command: 'specDeleted',
      id
    });
  } else {
    postToWebview(panel, {
      command: 'error',
      message: result.error || 'Failed to delete spec'
    });
  }
}

async function handleLoadTemplate(panel: vscode.WebviewPanel, templateId: string) {
  logDebug('handleLoadTemplate start', { templateId });
  const template = expertManagerService.getTemplate(templateId);

  if (template) {
    postToWebview(panel, {
      command: 'loadTemplate',
      template
    });
  }
}

function handleGenerateSlug(panel: vscode.WebviewPanel, role: string) {
  logDebug('handleGenerateSlug start', { role });
  const slug = expertManagerService.generateSlug(role);
  postToWebview(panel, {
    command: 'slugGenerated',
    slug
  });
}

async function handleValidateSlug(
  panel: vscode.WebviewPanel,
  slug: string,
  originalSlug?: string
) {
  logDebug('handleValidateSlug start', { slug, originalSlug });
  // Basic format validation
  const formatValidation = expertManagerService.validateSlug(slug);
  if (!formatValidation.valid) {
    postToWebview(panel, {
      command: 'slugValidation',
      valid: false,
      error: formatValidation.error
    });
    return;
  }

  // Check uniqueness if creating new or slug changed
  if (!originalSlug || slug !== originalSlug) {
    const { validationService } = await import('../services/ValidationService');
    const isUnique = await validationService.checkExpertSlugUnique(slug);

    postToWebview(panel, {
      command: 'slugValidation',
      valid: isUnique,
      error: isUnique ? undefined : 'Slug already exists'
    });
  } else {
    postToWebview(panel, {
      command: 'slugValidation',
      valid: true
    });
  }
}

export async function dispatchExpertManagerMessage(
  panel: vscode.WebviewPanel,
  message: ExpertManagerMessage,
  expertSlug?: string,
  handlers: ExpertManagerMessageHandlers = defaultMessageHandlers
): Promise<void> {
  logDebug('Received message from webview', message);

  switch (message.command) {
    case 'init':
      await handlers.init(panel, expertSlug);
      break;
    case 'save':
      await handlers.save(panel, message.data as ExpertFormData);
      break;
    case 'delete':
      await handlers.delete(panel, String(message.slug || ''));
      break;
    case 'duplicate':
      await handlers.duplicate(panel, String(message.slug || ''));
      break;
    case 'loadTemplate':
      await handlers.loadTemplate(panel, String(message.templateId || ''));
      break;
    case 'generateSlug':
      handlers.generateSlug(panel, String(message.role || ''));
      break;
    case 'validateSlug':
      await handlers.validateSlug(
        panel,
        String(message.slug || ''),
        message.originalSlug ? String(message.originalSlug) : undefined
      );
      break;
    case 'cancel':
      handlers.cancel(panel);
      break;
    case 'saveSpec':
      await handlers.saveSpec(panel, message.spec as SpecDefinition);
      break;
    case 'deleteSpec':
      await handlers.deleteSpec(panel, String(message.id || ''));
      break;
    case 'debug':
      logDebug(`Webview debug: ${String(message.message || '')}`, message.data);
      break;
    default:
      logDebug('Unhandled webview message command', message);
      break;
  }
}

// ==========================================================================
// HTML Generation
// ==========================================================================

function getHtml(_webview: vscode.Webview, _extensionUri: vscode.Uri): string {
  const nonce = getNonce();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline' 'unsafe-eval';">
  <title>Expert Manager</title>
  <style>
    :root {
      --bg-primary: var(--vscode-editor-background);
      --bg-secondary: var(--vscode-editorWidget-background);
      --bg-input: var(--vscode-input-background);
      --border-color: var(--vscode-editorWidget-border);
      --text-primary: var(--vscode-editor-foreground);
      --text-secondary: var(--vscode-descriptionForeground);
      --text-placeholder: var(--vscode-input-placeholderForeground);
      --accent-color: var(--vscode-textLink-foreground);
      --accent-hover: var(--vscode-textLink-activeForeground);
      --input-border: var(--vscode-input-border);
      --button-bg: var(--vscode-button-background);
      --button-foreground: var(--vscode-button-foreground);
      --button-hover: var(--vscode-button-hoverBackground);
      --error-color: var(--vscode-errorForeground);
      --warning-color: var(--vscode-editorWarning-foreground);
      --success-color: var(--vscode-testing-iconPassed);
      --radius: 6px;
      --spacing-xs: 4px;
      --spacing-sm: 8px;
      --spacing-md: 16px;
      --spacing-lg: 24px;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: var(--vscode-font-family);
      background: var(--bg-primary);
      color: var(--text-primary);
      padding: var(--spacing-lg);
      line-height: 1.5;
      font-size: 13px;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: var(--spacing-lg);
      padding-bottom: var(--spacing-md);
      border-bottom: 1px solid var(--border-color);
      gap: var(--spacing-md);
    }

    .header h1 {
      font-size: 18px;
      font-weight: 600;
    }

    .header-copy {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .header-copy p {
      color: var(--text-secondary);
      font-size: 12px;
    }

    .header-actions {
      display: flex;
      gap: var(--spacing-sm);
      flex-wrap: wrap;
      justify-content: flex-end;
    }

    .template-section {
      margin-bottom: var(--spacing-lg);
    }

    .template-section h2 {
      font-size: 14px;
      font-weight: 600;
      margin-bottom: var(--spacing-sm);
      color: var(--text-secondary);
    }

    .template-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: var(--spacing-sm);
    }

    .template-card {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: var(--radius);
      padding: var(--spacing-md);
      cursor: pointer;
      transition: all 0.2s;
    }

    .template-card:hover {
      border-color: var(--accent-color);
    }

    .template-card.selected {
      border-color: var(--accent-color);
      background: rgba(var(--accent-color), 0.1);
    }

    .template-card h3 {
      font-size: 14px;
      font-weight: 600;
      margin-bottom: var(--spacing-xs);
    }

    .template-card p {
      font-size: 12px;
      color: var(--text-secondary);
    }

    .form-section {
      margin-bottom: var(--spacing-lg);
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 10px;
      padding: var(--spacing-lg);
    }

    .form-section h2 {
      font-size: 14px;
      font-weight: 600;
      margin-bottom: var(--spacing-md);
      color: var(--text-secondary);
    }

    .form-row {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: var(--spacing-md);
      margin-bottom: var(--spacing-md);
    }

    .form-row.single {
      grid-template-columns: 1fr;
    }

    .page-layout {
      display: grid;
      grid-template-columns: minmax(0, 1.7fr) minmax(280px, 0.9fr);
      gap: var(--spacing-lg);
      align-items: start;
    }

    .main-column,
    .side-column {
      min-width: 0;
    }

    .side-column {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-lg);
      position: sticky;
      top: var(--spacing-lg);
    }

    .side-card {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 10px;
      padding: var(--spacing-lg);
    }

    .side-card h2 {
      font-size: 14px;
      font-weight: 600;
      margin-bottom: var(--spacing-md);
      color: var(--text-secondary);
    }

    .summary-list {
      display: grid;
      gap: var(--spacing-sm);
    }

    .summary-item {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: var(--spacing-sm);
      border-radius: var(--radius);
      background: var(--bg-primary);
      border: 1px solid var(--border-color);
    }

    .summary-item strong {
      font-size: 12px;
      color: var(--text-secondary);
      font-weight: 500;
    }

    .summary-item span {
      font-size: 13px;
    }

    .phase-grid {
      display: grid;
      gap: var(--spacing-sm);
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-xs);
    }

    .form-group label {
      font-size: 12px;
      font-weight: 500;
      color: var(--text-secondary);
    }

    .form-group label.required::after {
      content: '*';
      color: var(--error-color);
      margin-left: 2px;
    }

    .form-group input,
    .form-group select,
    .form-group textarea {
      background: var(--bg-input);
      border: 1px solid var(--input-border);
      border-radius: var(--radius);
      padding: 6px 10px;
      color: var(--text-primary);
      font-family: inherit;
      font-size: 13px;
      outline: none;
    }

    .form-group input:focus,
    .form-group select:focus,
    .form-group textarea:focus {
      border-color: var(--accent-color);
    }

    .form-group textarea {
      min-height: 80px;
      resize: vertical;
    }

    .form-group .error {
      color: var(--error-color);
      font-size: 11px;
    }

    .form-group .success {
      color: var(--success-color);
      font-size: 11px;
    }

    .slug-row {
      display: flex;
      gap: var(--spacing-sm);
      align-items: flex-end;
    }

    .slug-row .form-group {
      flex: 1;
    }

    .btn-icon {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: var(--radius);
      padding: 6px 10px;
      cursor: pointer;
      color: var(--text-primary);
      display: flex;
      align-items: center;
      justify-content: center;
      height: 32px;
    }

    .btn-icon:hover {
      background: var(--accent-color);
      border-color: var(--accent-color);
    }

    .checkbox-group {
      display: flex;
      flex-wrap: wrap;
      gap: var(--spacing-sm);
    }

    .checkbox-item {
      display: flex;
      align-items: center;
      gap: var(--spacing-xs);
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: var(--radius);
      padding: var(--spacing-xs) var(--spacing-sm);
      cursor: pointer;
    }

    .checkbox-item:hover {
      border-color: var(--accent-color);
    }

    .checkbox-item input[type="checkbox"] {
      margin: 0;
    }

    .checkbox-item.selected {
      background: rgba(var(--accent-color), 0.15);
      border-color: var(--accent-color);
    }

    .list-editor {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: var(--radius);
      padding: var(--spacing-sm);
    }

    .capability-browser {
      display: grid;
      grid-template-columns: minmax(0, 1.1fr) minmax(240px, 0.9fr);
      gap: var(--spacing-md);
      margin-bottom: var(--spacing-md);
    }

    .capability-picker {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-sm);
    }

    .preset-select {
      width: 100%;
      min-height: 180px;
      background: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: var(--radius);
      color: var(--text-primary);
      padding: var(--spacing-sm);
      font-family: inherit;
      font-size: 13px;
    }

    .preset-select option {
      padding: 6px 8px;
    }

    .preset-actions {
      display: flex;
      gap: var(--spacing-sm);
      align-items: center;
    }

    .preset-meta {
      font-size: 12px;
      color: var(--text-secondary);
    }

    .capability-detail {
      border: 1px solid var(--border-color);
      border-radius: 10px;
      background: var(--bg-primary);
      padding: var(--spacing-md);
      min-height: 180px;
      display: flex;
      flex-direction: column;
      gap: var(--spacing-sm);
    }

    .capability-detail h3 {
      font-size: 13px;
      font-weight: 600;
    }

    .capability-detail p {
      font-size: 13px;
      color: var(--text-secondary);
      white-space: pre-wrap;
      line-height: 1.6;
    }

    .capability-detail .empty {
      color: var(--text-placeholder);
    }

    .list-item.selected {
      border-color: var(--accent-color);
      box-shadow: inset 0 0 0 1px var(--accent-color);
    }

    .list-item {
      display: flex;
      gap: var(--spacing-sm);
      margin-bottom: var(--spacing-sm);
      align-items: center;
      background: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: var(--radius);
      padding: 8px 10px;
      transition: all 0.15s ease;
    }

    .list-item:hover {
      border-color: var(--accent-color);
    }

    .list-item input {
      flex: 1;
      background: var(--bg-input);
      border: 1px solid var(--input-border);
      border-radius: var(--radius);
      padding: 8px 10px;
      color: var(--text-primary);
      font-size: 13px;
    }

    .list-item input:focus {
      outline: none;
      border-color: var(--accent-color);
    }

    .btn-small {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      color: var(--text-secondary);
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 11px;
      transition: all 0.15s ease;
    }

    .btn-small:hover {
      background: var(--error-color);
      border-color: var(--error-color);
      color: white;
    }

    .btn-add {
      background: var(--bg-secondary);
      border: 1px dashed var(--border-color);
      color: var(--text-primary);
      cursor: pointer;
      padding: 10px 14px;
      border-radius: var(--radius);
      font-size: 13px;
      font-weight: 500;
      width: 100%;
      margin-top: var(--spacing-sm);
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }

    .btn-add:hover {
      border-color: var(--accent-color);
      background: var(--accent-color);
      color: var(--bg-primary);
      border-style: solid;
    }

    .btn-add:active {
      transform: scale(0.98);
    }

    .actions {
      display: flex;
      justify-content: flex-end;
      gap: var(--spacing-sm);
      margin-top: var(--spacing-lg);
      padding-top: var(--spacing-lg);
      border-top: 1px solid var(--border-color);
      position: sticky;
      bottom: 0;
      background: linear-gradient(180deg, rgba(0, 0, 0, 0) 0%, var(--bg-primary) 35%);
      padding-bottom: var(--spacing-sm);
    }

    .btn {
      background: var(--button-bg);
      color: var(--button-foreground);
      border: none;
      padding: 8px 16px;
      border-radius: var(--radius);
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
    }

    .btn:hover {
      background: var(--button-hover);
    }

    .btn-primary {
      background: var(--accent-color);
      color: var(--bg-primary);
    }

    .btn-primary:hover {
      background: var(--accent-hover);
    }

    .btn-danger {
      background: transparent;
      color: var(--error-color);
      border: 1px solid var(--error-color);
    }

    .btn-danger:hover {
      background: var(--error-color);
      color: white;
    }

    .btn-secondary {
      background: var(--bg-secondary);
      color: var(--text-primary);
    }

    .validation-summary {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: var(--radius);
      padding: var(--spacing-md);
      margin-bottom: var(--spacing-md);
    }

    .validation-summary.has-errors {
      border-color: var(--error-color);
    }

    .validation-summary.has-warnings {
      border-color: var(--warning-color);
    }

    .validation-summary h3 {
      font-size: 13px;
      font-weight: 600;
      margin-bottom: var(--spacing-sm);
    }

    .validation-summary ul {
      list-style: none;
    }

    .validation-summary li {
      font-size: 12px;
      margin-bottom: var(--spacing-xs);
      padding-left: var(--spacing-md);
      position: relative;
    }

    .validation-summary li.error::before {
      content: '×';
      position: absolute;
      left: 0;
      color: var(--error-color);
      font-weight: bold;
    }

    .validation-summary li.warning::before {
      content: '⚠';
      position: absolute;
      left: 0;
      color: var(--warning-color);
    }

    .loading {
      text-align: center;
      padding: var(--spacing-lg);
      color: var(--text-secondary);
    }

    .spinner {
      border: 3px solid var(--border-color);
      border-top-color: var(--accent-color);
      border-radius: 50%;
      width: 32px;
      height: 32px;
      animation: spin 1s linear infinite;
      margin: 0 auto var(--spacing-md);
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .toast {
      position: fixed;
      bottom: var(--spacing-lg);
      right: var(--spacing-lg);
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: var(--radius);
      padding: var(--spacing-md);
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      display: none;
      z-index: 1000;
    }

    .toast.show {
      display: block;
    }

    .toast.error {
      border-color: var(--error-color);
    }

    .toast.success {
      border-color: var(--success-color);
    }

    .help-text {
      font-size: 11px;
      color: var(--text-secondary);
      margin-top: var(--spacing-xs);
    }

    .badge {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
    }

    .badge-development { background: #2ca02c; color: white; }
    .badge-general { background: #1f77b4; color: white; }
    .badge-custom { background: #95a5a6; color: white; }

    @media (max-width: 980px) {
      body {
        padding: var(--spacing-md);
      }

      .header {
        flex-direction: column;
        align-items: flex-start;
      }

      .header-actions {
        width: 100%;
        justify-content: flex-start;
      }

      .page-layout {
        grid-template-columns: 1fr;
      }

      .side-column {
        position: static;
      }

      .form-row {
        grid-template-columns: 1fr;
      }

      .capability-browser {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>
<body>
  <div id="app">
    <div class="loading">
      <div class="spinner"></div>
      <p>Loading...</p>
    </div>
  </div>

  <div id="toast" class="toast"></div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    let currentData = null;
    let selectedTemplate = null;
    let selectedSpecs = [];
    let constraints = [];
    let specDefinitions = [];
    let selectedSpecId = '';

    function debug(message, data) {
      console.log('[ExpertManager webview]', message, data ?? '');
      vscode.postMessage({ command: 'debug', message, data });
    }

    window.addEventListener('error', (event) => {
      debug('window error', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      });
    });

    window.addEventListener('unhandledrejection', (event) => {
      debug('unhandled promise rejection', {
        reason: String(event.reason)
      });
    });

    // Request initialization
    debug('posting init request');
    vscode.postMessage({ command: 'init' });

    // Handle messages from extension
    window.addEventListener('message', (event) => {
      const message = event.data;
      debug('received extension message', message);

      switch (message.command) {
        case 'loadTemplates':
          specDefinitions = message.specs || [];
          renderTemplateSelection(message);
          break;
        case 'loadTemplate':
          loadTemplate(message.template);
          break;
        case 'loadExpert':
          specDefinitions = message.specs || [];
          loadExpert(message.data);
          break;
        case 'specSaved':
          upsertSpec(message.spec);
          showToast('Spec saved successfully!', 'success');
          break;
        case 'specDeleted':
          removeSpecDefinition(message.id);
          showToast('Spec deleted.', 'success');
          break;
        case 'saved':
          showToast('Expert saved successfully!', 'success');
          currentData = message.data;
          break;
        case 'slugGenerated':
          document.getElementById('slug').value = message.slug;
          break;
        case 'slugValidation':
          handleSlugValidation(message);
          break;
        case 'error':
          showToast(message.message, 'error');
          break;
      }
    });

    function renderTemplateSelection(data) {
      debug('renderTemplateSelection', {
        templateCount: data.templates?.length ?? 0,
        categoryCount: data.categories?.length ?? 0
      });
      const { templates, categories } = data;

      const html = \`
        <div class="header">
          <h1>Create Expert</h1>
          <div class="header-actions">
            <button class="btn btn-secondary" onclick="cancel()">Cancel</button>
          </div>
        </div>

        <div class="template-section">
          <h2>Choose a Template</h2>
          <div class="template-grid">
            \${templates.map(t => \`
              <div class="template-card" data-action="select-template" data-template-id="\${t.id}">
                <h3>\${t.name}</h3>
                <p>\${t.description}</p>
                <span class="badge badge-\${t.category}">\${t.category}</span>
              </div>
            \`).join('')}
          </div>
        </div>
      \`;

      document.getElementById('app').innerHTML = html;
    }

    function selectTemplate(templateId) {
      debug('selectTemplate clicked', { templateId });
      selectedTemplate = templateId;
      vscode.postMessage({ command: 'loadTemplate', templateId });
    }

    function loadTemplate(template) {
      debug('loadTemplate', { templateId: template?.id, templateName: template?.name });
      currentData = { ...template.defaults };

      const html = getFormHtml(template);
      document.getElementById('app').innerHTML = html;

      // Populate form
      populateForm(currentData);
    }

    function loadExpert(expert) {
      debug('loadExpert', { slug: expert?.slug, role: expert?.role });
      currentData = { ...expert, _originalSlug: expert.slug };

      const html = getFormHtml(null, true);
      document.getElementById('app').innerHTML = html;

      // Populate form
      populateForm(currentData);
    }

    function getFormHtml(template, isEdit = false) {
      const title = isEdit ? 'Edit Expert' : 'Create Expert';
      const selectedTemplateInfo = template ? \`<span class="badge badge-\${template.category}">\${template.name}</span>\` : '';
      const modeText = isEdit ? 'Update an existing expert definition and verify its routing.' : 'Configure a new expert, then save it into relay.';

      return \`
        <div class="header">
          <div class="header-copy">
            <h1>\${title} \${selectedTemplateInfo}</h1>
            <p>\${modeText}</p>
          </div>
          <div class="header-actions">
            <button class="btn btn-secondary" data-action="cancel">Cancel</button>
            \${isEdit ? '<button class="btn btn-secondary" data-action="duplicate-expert">Duplicate</button>' : ''}
            \${isEdit ? '<button class="btn btn-danger" data-action="delete-expert">Delete</button>' : ''}
            <button class="btn btn-primary" data-action="save-expert">Save Expert</button>
          </div>
        </div>

        <div id="validationSummary" class="validation-summary" style="display: none;">
          <h3>Validation</h3>
          <ul id="validationErrors"></ul>
        </div>

        <div class="page-layout">
          <div class="main-column">
            <div class="form-section">
              <h2>Identity</h2>
              <div class="form-row">
                <div class="form-group">
                  <label class="required">Role Name</label>
                  <input type="text" id="role" placeholder="e.g., Frontend Developer" onchange="generateSlug()">
                  <div class="help-text">The display name for this expert</div>
                </div>
                <div class="slug-row">
                  <div class="form-group" style="flex: 1;">
                    <label class="required">Slug</label>
                    <input type="text" id="slug" placeholder="e.g., frontend-developer" data-action="validate-slug-on-blur">
                    <div id="slugError" class="error"></div>
                    <div id="slugSuccess" class="success"></div>
                  </div>
                  <button class="btn-icon" data-action="generate-slug" title="Auto-generate from role name">⚡</button>
                </div>
              </div>
              <div class="form-row single">
                <div class="form-group">
                  <label>Persona Description</label>
                  <textarea id="persona" placeholder="Describe this expert's role and approach..."></textarea>
                </div>
              </div>
            </div>

            <div class="form-section">
              <h2>Specs</h2>
              <div class="help-text" style="margin-bottom: 8px;">Manage spec modules from the project spec store, then attach or detach them for this expert.</div>
              <div class="capability-browser">
                <div class="capability-picker">
                  <select id="capabilityPresets" class="preset-select" size="8"></select>
                  <div class="preset-actions">
                    <button class="btn btn-secondary" type="button" data-action="add-selected-capability">Add Selected</button>
                    <button class="btn btn-secondary" type="button" data-action="new-capability">New Spec</button>
                    <button class="btn btn-secondary" type="button" data-action="save-spec">Save Spec</button>
                    <button class="btn btn-danger" type="button" data-action="delete-spec">Delete Spec</button>
                    <span id="capabilityPresetMeta" class="preset-meta"></span>
                  </div>
                </div>
                <div id="capabilityDetail" class="capability-detail"></div>
              </div>
              <div id="capabilitiesList" class="list-editor"></div>
              <button class="btn-add" data-action="add-capability">
                <span style="font-size: 16px;">+</span> Add Spec
              </button>
            </div>

            <div class="form-section">
              <h2>Constraints</h2>
              <div class="help-text" style="margin-bottom: 8px;">Define rules this expert must follow (e.g., "Always use TypeScript", "No production changes")</div>
              <div id="constraintsList" class="list-editor"></div>
              <button class="btn-add" data-action="add-constraint">
                <span style="font-size: 16px;">+</span> Add Constraint
              </button>
            </div>
          </div>

          <div class="side-column">
            <div class="side-card">
              <h2>Configuration</h2>
              <div class="form-row single">
                <div class="form-group">
                  <label class="required">Domain</label>
                  <select id="domain">
                    <option value="general">General</option>
                    <option value="development">Development</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="required">Backed By</label>
                  <select id="backed_by">
                    <option value="claude">Claude (Anthropic)</option>
                    <option value="codex">Codex (OpenAI)</option>
                    <option value="gemini">Gemini (Google)</option>
                    <option value="zai">ZAI</option>
                  </select>
                  <div class="help-text">The AI model backing this expert</div>
                </div>
                <div class="form-group">
                  <label class="required">Tier</label>
                  <select id="tier">
                    <option value="trivial">Trivial (Simple, Low Cost)</option>
                    <option value="standard">Standard (Balanced)</option>
                    <option value="premium">Premium (Complex, High Quality)</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="required">Permission Mode</label>
                  <select id="permission_mode">
                    <option value="plan">Plan (Analysis Only)</option>
                    <option value="acceptEdits">Accept Edits (Review & Approve)</option>
                    <option value="default">Default (Full Autonomy)</option>
                  </select>
                </div>
                <div class="form-group">
                  <label>Memory Type</label>
                  <select id="memory">
                    <option value="">None</option>
                    <option value="project">Project</option>
                    <option value="user">User</option>
                    <option value="local">Local</option>
                  </select>
                </div>
                <div class="form-group">
                  <label>CLI Override</label>
                  <input type="text" id="cli" placeholder="e.g., /expert-frontend">
                </div>
                <div class="form-group">
                  <label>Model Override</label>
                  <input type="text" id="model" placeholder="e.g., claude-opus-4-6">
                </div>
              </div>
            </div>

            <div class="side-card">
              <h2>Phase Assignment</h2>
              <div class="phase-grid">
                <label class="checkbox-item" data-action="toggle-phase" data-phase="probe">
                  <input type="checkbox" id="phase-probe">
                  <span>Probe (Research)</span>
                </label>
                <label class="checkbox-item" data-action="toggle-phase" data-phase="grasp">
                  <input type="checkbox" id="phase-grasp">
                  <span>Grasp (Analysis)</span>
                </label>
                <label class="checkbox-item" data-action="toggle-phase" data-phase="tangle">
                  <input type="checkbox" id="phase-tangle">
                  <span>Tangle (Implementation)</span>
                </label>
                <label class="checkbox-item" data-action="toggle-phase" data-phase="ink">
                  <input type="checkbox" id="phase-ink">
                  <span>Ink (Documentation)</span>
                </label>
              </div>
            </div>

            <div class="side-card">
              <h2>Quick Checks</h2>
              <div class="summary-list">
                <div class="summary-item">
                  <strong>Required</strong>
                  <span>Role, slug, and at least one phase</span>
                </div>
                <div class="summary-item">
                  <strong>Helpful</strong>
                  <span>Add 2-3 concrete specs and guardrails</span>
                </div>
                <div class="summary-item">
                  <strong>Save Flow</strong>
                  <span>Validate in the webview, then persist through the extension</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="actions">
          <button class="btn btn-secondary" data-action="cancel">Cancel</button>
          <button class="btn btn-primary" data-action="save-expert">Save Expert</button>
        </div>
      \`;
    }

    function populateForm(data) {
      debug('populateForm', {
        slug: data.slug,
        role: data.role,
        specs: data.specs?.length ?? 0,
        constraints: data.constraints?.length ?? 0
      });
      // Basic fields
      if (data.role) document.getElementById('role').value = data.role;
      if (data.slug) document.getElementById('slug').value = data.slug;
      if (data.domain) document.getElementById('domain').value = data.domain;
      if (data.persona) document.getElementById('persona').value = data.persona;
      if (data.backed_by) document.getElementById('backed_by').value = data.backed_by;
      if (data.tier) document.getElementById('tier').value = data.tier;
      if (data.permission_mode) document.getElementById('permission_mode').value = data.permission_mode;
      if (data.memory) document.getElementById('memory').value = data.memory;
      if (data.cli) document.getElementById('cli').value = data.cli;
      if (data.model) document.getElementById('model').value = data.model;

      // Phases
      if (data.phases) {
        data.phases.forEach(phase => {
          const checkbox = document.getElementById(\`phase-\${phase}\`);
          if (checkbox) {
            checkbox.checked = true;
            checkbox.closest('.checkbox-item').classList.add('selected');
          }
        });
      }

      // Capabilities
      selectedSpecs = normalizeSpecRefs(data.specs || data.capabilities || []);
      selectedSpecId = selectedSpecs[0] || specDefinitions[0]?.id || '';
      renderCapabilities();

      // Constraints
      constraints = data.constraints || [];
      renderConstraints();
    }

    function collectFormData() {
      const phases = [];
      if (document.getElementById('phase-probe').checked) phases.push('probe');
      if (document.getElementById('phase-grasp').checked) phases.push('grasp');
      if (document.getElementById('phase-tangle').checked) phases.push('tangle');
      if (document.getElementById('phase-ink').checked) phases.push('ink');

      const data = {
        role: document.getElementById('role').value.trim(),
        slug: document.getElementById('slug').value.trim(),
        domain: document.getElementById('domain').value,
        persona: document.getElementById('persona').value.trim(),
        backed_by: document.getElementById('backed_by').value,
        tier: document.getElementById('tier').value,
        permission_mode: document.getElementById('permission_mode').value,
        memory: document.getElementById('memory').value || undefined,
        cli: document.getElementById('cli').value || undefined,
        model: document.getElementById('model').value || undefined,
        fallback_cli: currentData?.fallback_cli,
        isolation: currentData?.isolation,
        agent_profile: currentData?.agent_profile,
        default_platform: currentData?.default_platform,
        phases,
        specs: selectedSpecs,
        capabilities: [],
        constraints,
        created_at: currentData?.created_at,
        _originalSlug: currentData?._originalSlug
      };

      debug('collectFormData', {
        slug: data.slug,
        role: data.role,
        phases: data.phases,
        specs: data.specs.length,
        constraints: data.constraints.length
      });

      return data;
    }

    function validateAndSave() {
      debug('validateAndSave clicked');
      const data = collectFormData();

      // Basic validation
      const errors = [];

      if (!data.role) errors.push('Role name is required');
      if (!data.slug) errors.push('Slug is required');
      if (data.phases.length === 0) errors.push('At least one phase must be selected');

      if (errors.length > 0) {
        showValidationErrors(errors);
        return;
      }

      hideValidationErrors();

      // Send to extension for validation and save
      debug('posting save command', { slug: data.slug, originalSlug: data._originalSlug });
      vscode.postMessage({ command: 'save', data });
    }

    function showValidationErrors(errors) {
      const summary = document.getElementById('validationSummary');
      const list = document.getElementById('validationErrors');

      list.innerHTML = errors.map(e => \`<li class="error">\${e}</li>\`).join('');
      summary.classList.add('has-errors');
      summary.style.display = 'block';
    }

    function hideValidationErrors() {
      const summary = document.getElementById('validationSummary');
      summary.style.display = 'none';
    }

    function generateSlug() {
      const role = document.getElementById('role').value;
      debug('generateSlug triggered', { role });
      if (role) {
        vscode.postMessage({ command: 'generateSlug', role });
      }
    }

    function validateSlug() {
      const slug = document.getElementById('slug').value;
      const originalSlug = currentData?._originalSlug;
      debug('validateSlug triggered', { slug, originalSlug });

      if (slug) {
        vscode.postMessage({ command: 'validateSlug', slug, originalSlug });
      }
    }

    function handleSlugValidation(result) {
      debug('handleSlugValidation', result);
      const errorEl = document.getElementById('slugError');
      const successEl = document.getElementById('slugSuccess');

      if (result.valid) {
        errorEl.textContent = '';
        successEl.textContent = result.error ? '' : '✓ Slug is available';
      } else {
        errorEl.textContent = result.error;
        successEl.textContent = '';
      }
    }

    function togglePhase(element, phase, forceChecked) {
      const checkbox = element.querySelector('input');
      checkbox.checked = typeof forceChecked === 'boolean' ? forceChecked : !checkbox.checked;
      element.classList.toggle('selected', checkbox.checked);
      debug('togglePhase', { phase, checked: checkbox.checked });
    }

    function addCapability() {
      selectedSpecId = '';
      renderCapabilities();
    }

    function normalizeSpecRefs(values) {
      return values.map(value => {
        const matchById = specDefinitions.find(item => item.id === value);
        if (matchById) return matchById.id;

        const matchByLegacyCapability = specDefinitions.find(item => extractSpecTitle(item) === value);
        if (matchByLegacyCapability) {return matchByLegacyCapability.id;}

        return value;
      });
    }

    function extractSpecTitle(spec) {
      const titleMatch = spec.content.match(/^#\s+(.+)$/m);
      return titleMatch ? titleMatch[1].trim() : spec.id;
    }

    function getSelectedSpecDefinition() {
      return getSpecDefinition(selectedSpecId);
    }

    function getSpecDefinition(id) {
      return specDefinitions.find(item => item.id === id) || null;
    }

    function upsertSpec(definition) {
      const existingIndex = specDefinitions.findIndex(item => item.id === definition.id);
      if (existingIndex >= 0) {
        specDefinitions[existingIndex] = definition;
      } else {
        specDefinitions.push(definition);
      }

      specDefinitions.sort((a, b) => extractSpecTitle(a).localeCompare(extractSpecTitle(b)));
      if (!selectedSpecs.includes(definition.id)) {
        selectedSpecs.push(definition.id);
      }
      selectedSpecId = definition.id;
      renderCapabilities();
    }

    function removeSpecDefinition(id) {
      specDefinitions = specDefinitions.filter(spec => spec.id !== id);
      selectedSpecs = selectedSpecs.filter(specId => specId !== id);
      if (selectedSpecId === id) {
        selectedSpecId = selectedSpecs[0] || specDefinitions[0]?.id || '';
      }
      renderCapabilities();
    }

    function attachCapability(id) {
      if (!id) return;
      if (selectedSpecs.includes(id)) {
        debug('attachCapability skipped duplicate', { id });
        selectedSpecId = id;
        renderCapabilities();
        return;
      }

      debug('attachCapability clicked', { id, before: selectedSpecs.length });
      selectedSpecs.push(id);
      selectedSpecId = id;
      renderCapabilities();
    }

    function removeCapability(index) {
      debug('removeCapability clicked', { index, before: selectedSpecs.length });
      if (selectedSpecs[index] === selectedSpecId) {
        selectedSpecId = selectedSpecs.find((_, itemIndex) => itemIndex !== index) || specDefinitions[0]?.id || '';
      }
      selectedSpecs.splice(index, 1);
      renderCapabilities();
    }

    function renderCapabilityDetail() {
      const detail = document.getElementById('capabilityDetail');
      if (!detail) return;

      if (!selectedSpecId) {
        detail.innerHTML = \`
          <h3>Spec Detail</h3>
          <div class="form-group">
            <label>Spec ID</label>
            <input type="text" id="capabilitySpecId" placeholder="e.g., auth-contracts">
          </div>
          <div class="form-group">
            <label>Content</label>
            <textarea id="capabilityContent" placeholder="# Spec Title&#10;&#10;Describe the functional rule, scope, and expected behavior..."></textarea>
          </div>
          <p class="empty">Create a new spec file here, save it, then attach it to this expert.</p>
        \`;
        return;
      }

      const definition = getSelectedSpecDefinition();
      if (!definition) {
        detail.innerHTML = '<h3>Spec Detail</h3><p class="empty">Spec definition not found.</p>';
        return;
      }

      detail.innerHTML = \`
        <h3>Spec Detail</h3>
        <div class="form-group">
          <label>Spec ID</label>
          <input type="text" id="capabilitySpecId" value="\${definition.id.replace(/"/g, '&quot;')}" placeholder="e.g., auth-contracts">
        </div>
        <div class="form-group">
          <label>Content</label>
          <textarea id="capabilityContent" placeholder="Spec content">\${definition.content}</textarea>
        </div>
        <p>Scope: \${definition.scope} / Type: \${definition.type} / Version: \${definition.version}</p>
      \`;
    }

    function renderCapabilities() {
      debug('renderCapabilities', { count: selectedSpecs.length, available: specDefinitions.length });
      const presets = document.getElementById('capabilityPresets');
      const presetMeta = document.getElementById('capabilityPresetMeta');
      const container = document.getElementById('capabilitiesList');

      if (presets instanceof HTMLSelectElement) {
        presets.innerHTML = specDefinitions.map(spec => {
          const selected = selectedSpecs.includes(spec.id);
          const scopeTag = spec.scope === 'project' ? '[P]' : '[U]';
          const suffix = selected ? ' ✓' : '';
          return \`<option value="\${spec.id}">\${scopeTag} \${extractSpecTitle(spec)}\${suffix}</option>\`;
        }).join('');

        if (selectedSpecId) {
          presets.value = selectedSpecId;
        }
      }

      if (presetMeta) {
        const userCount = specDefinitions.filter(s => s.scope !== 'project').length;
        const projectCount = specDefinitions.filter(s => s.scope === 'project').length;
        presetMeta.textContent = \`\${specDefinitions.length} specs (\${userCount} user, \${projectCount} project)\`;
      }

      container.innerHTML = selectedSpecs.map((specId, i) => {
        const def = getSpecDefinition(specId);
        const scopeTag = def?.scope === 'project' ? '[P]' : '[U]';
        const label = (extractSpecTitle(def || { id: specId, content: '' })).replace(/"/g, '&quot;');
        return \`<div class="list-item\${specId === selectedSpecId ? ' selected' : ''}" data-action="select-capability-detail" data-value="\${specId}">
          <span style="font-size:10px;opacity:0.6;margin-right:4px">\${scopeTag}</span>
          <input type="text" value="\${label}" readonly>
          <button class="btn-small" data-action="remove-capability" data-index="\${i}" title="Remove">Remove</button>
        </div>\`;
      }).join('');

      renderCapabilityDetail();
    }

    function saveCapabilityDefinition() {
      const idInput = document.getElementById('capabilitySpecId');
      const contentInput = document.getElementById('capabilityContent');

      if (!(idInput instanceof HTMLInputElement) || !(contentInput instanceof HTMLTextAreaElement)) {
        return;
      }

      const id = idInput.value.trim();
      const content = contentInput.value.trim();

      if (!id) {
        showToast('Spec ID is required', 'error');
        return;
      }

      if (!content) {
        showToast('Spec content is required', 'error');
        return;
      }

      vscode.postMessage({
        command: 'saveSpec',
        spec: {
          id,
          type: 'spec',
          scope: 'project',
          version: getSelectedSpecDefinition()?.version || 1,
          tags: getSelectedSpecDefinition()?.tags || [],
          requires: getSelectedSpecDefinition()?.requires,
          conflicts_with: getSelectedSpecDefinition()?.conflicts_with,
          content
        }
      });
    }

    function deleteSelectedSpec() {
      if (!selectedSpecId) {
        showToast('Select a spec first', 'error');
        return;
      }

      vscode.postMessage({ command: 'deleteSpec', id: selectedSpecId });
    }

    function addConstraint() {
      debug('addConstraint clicked', { before: constraints.length });
      constraints.push('');
      renderConstraints();
    }

    function removeConstraint(index) {
      debug('removeConstraint clicked', { index, before: constraints.length });
      constraints.splice(index, 1);
      renderConstraints();
    }

    function updateConstraint(index, value) {
      constraints[index] = value;
    }

    function renderConstraints() {
      debug('renderConstraints', { count: constraints.length });
      const container = document.getElementById('constraintsList');
      container.innerHTML = constraints.map((con, i) => \`
        <div class="list-item">
          <input type="text" value="\${con}" placeholder="e.g., Always use TypeScript, No production code changes" data-action="update-constraint" data-index="\${i}">
          <button class="btn-small" data-action="remove-constraint" data-index="\${i}" title="Remove this constraint">Remove</button>
        </div>
      \`).join('');
    }

    function deleteExpert() {
      const slug = currentData?._originalSlug || currentData?.slug;
      debug('deleteExpert clicked', { slug });
      if (slug) {
        vscode.postMessage({ command: 'delete', slug });
      }
    }

    function duplicateExpert() {
      const slug = currentData?._originalSlug || currentData?.slug;
      debug('duplicateExpert clicked', { slug });
      if (slug) {
        vscode.postMessage({ command: 'duplicate', slug });
      }
    }

    function cancel() {
      debug('cancel clicked');
      vscode.postMessage({ command: 'cancel' });
    }

    function showToast(message, type = 'info') {
      const toast = document.getElementById('toast');
      toast.textContent = message;
      toast.className = \`toast show \${type}\`;

      setTimeout(() => {
        toast.classList.remove('show');
      }, 3000);
    }

    document.addEventListener('click', (event) => {
      const target = event.target.closest('[data-action]');
      if (!target) return;

      const action = target.dataset.action;
      const index = target.dataset.index ? Number(target.dataset.index) : undefined;

      switch (action) {
        case 'select-template':
          selectTemplate(target.dataset.templateId);
          break;
        case 'cancel':
          cancel();
          break;
        case 'duplicate-expert':
          duplicateExpert();
          break;
        case 'delete-expert':
          deleteExpert();
          break;
        case 'save-expert':
          validateAndSave();
          break;
        case 'generate-slug':
          generateSlug();
          break;
        case 'add-capability':
          addCapability();
          break;
        case 'add-selected-capability': {
          const presets = document.getElementById('capabilityPresets');
          if (presets instanceof HTMLSelectElement) {
            attachCapability(presets.value);
          }
          break;
        }
        case 'save-capability':
          saveCapabilityDefinition();
          break;
        case 'save-spec':
          saveCapabilityDefinition();
          break;
        case 'delete-spec':
          deleteSelectedSpec();
          break;
        case 'new-capability':
          addCapability();
          break;
        case 'remove-capability':
          if (index !== undefined) removeCapability(index);
          break;
        case 'select-capability-detail':
          if (!(target instanceof HTMLInputElement) && target.dataset.value !== undefined) {
            selectedSpecId = target.dataset.value;
            renderCapabilities();
          }
          break;
        case 'add-constraint':
          addConstraint();
          break;
        case 'remove-constraint':
          if (index !== undefined) removeConstraint(index);
          break;
        case 'toggle-phase':
          if (event.target instanceof HTMLInputElement) {
            target.classList.toggle('selected', event.target.checked);
            debug('togglePhase', { phase: target.dataset.phase, checked: event.target.checked });
          } else {
            togglePhase(target, target.dataset.phase);
          }
          break;
      }
    });

    document.addEventListener('change', (event) => {
      const target = event.target;
      if (target instanceof HTMLInputElement) {
        const action = target.dataset.action;
        const index = target.dataset.index ? Number(target.dataset.index) : undefined;

        if (action === 'update-constraint' && index !== undefined) {
          updateConstraint(index, target.value);
        }
      }

      if (target instanceof HTMLSelectElement && target.id === 'capabilityPresets') {
        selectedSpecId = target.value;
        renderCapabilities();
      }

      if (target instanceof HTMLInputElement && target.id.startsWith('phase-')) {
        const phaseItem = target.closest('.checkbox-item');
        if (phaseItem) {
          phaseItem.classList.toggle('selected', target.checked);
          debug('togglePhase', { phase: phaseItem.dataset.phase, checked: target.checked });
        }
      }
    });

    document.addEventListener('focusout', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.dataset.action === 'validate-slug-on-blur') {
        validateSlug();
      }
    });
  </script>
</body>
</html>`;
}

export function getExpertManagerHtmlForTest(): string {
  return getHtml({} as vscode.Webview, {} as vscode.Uri);
}
