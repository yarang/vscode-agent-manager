/**
 * ExpertManager Webview - Expert creation and editing interface
 *
 * Provides a rich UI for creating, editing, and managing expert definitions.
 */

import * as vscode from 'vscode';
import { Expert } from '../types';
import { expertManagerService } from '../services/ExpertManagerService';

let currentPanel: vscode.WebviewPanel | undefined;

export function openExpertManager(
  extensionUri: vscode.Uri,
  expertSlug?: string
): void {
  if (currentPanel) {
    currentPanel.reveal();
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
  });

  // Handle messages from webview
  currentPanel.webview.onDidReceiveMessage(
    async (message) => {
      const panel = currentPanel;
      if (!panel) return;

      switch (message.command) {
        case 'init':
          await handleInit(panel, expertSlug);
          break;
        case 'save':
          await handleSave(panel, message.data);
          break;
        case 'delete':
          await handleDelete(panel, message.slug);
          break;
        case 'duplicate':
          await handleDuplicate(panel, message.slug);
          break;
        case 'loadTemplate':
          await handleLoadTemplate(panel, message.templateId);
          break;
        case 'generateSlug':
          handleGenerateSlug(panel, message.role);
          break;
        case 'validateSlug':
          await handleValidateSlug(panel, message.slug, message.originalSlug);
          break;
      }
    },
    undefined
  );
}

// Type for expert data with additional fields
interface ExpertFormData extends Partial<Expert> {
  _originalSlug?: string;
}

// ==========================================================================
// Message Handlers
// ==========================================================================

async function handleInit(panel: vscode.WebviewPanel, expertSlug?: string) {
  if (expertSlug) {
    // Load existing expert
    const { fileService } = await import('../services/FileService');
    const result = await fileService.readExpert(expertSlug);

    if (result.success && result.data) {
      panel.webview.postMessage({
        command: 'loadExpert',
        data: result.data
      });
    } else {
      panel.webview.postMessage({
        command: 'error',
        message: `Expert not found: ${expertSlug}`
      });
    }
  } else {
    // New expert - send templates
    panel.webview.postMessage({
      command: 'loadTemplates',
      templates: expertManagerService.getTemplates(),
      categories: expertManagerService.getCategories(),
      formData: expertManagerService.getFormData()
    });
  }
}

async function handleSave(panel: vscode.WebviewPanel, data: ExpertFormData) {
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
    panel.webview.postMessage({
      command: 'saved',
      data: result.data
    });

    vscode.window.showInformationMessage(
      `Expert ${isEdit ? 'updated' : 'created'} successfully!`
    );

    // Refresh tree
    vscode.commands.executeCommand('agentManager.refreshTree');
  } else {
    panel.webview.postMessage({
      command: 'error',
      message: result.error || 'Failed to save expert'
    });
  }
}

async function handleDelete(panel: vscode.WebviewPanel, slug: string) {
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
  const newSlug = await vscode.window.showInputBox({
    prompt: 'Enter slug for the duplicate',
    value: `${slug}-copy`,
    validateInput: (value) => {
      const validation = expertManagerService.validateSlug(value);
      return validation.valid ? null : validation.error;
    }
  });

  if (!newSlug) return;

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

async function handleLoadTemplate(panel: vscode.WebviewPanel, templateId: string) {
  const template = expertManagerService.getTemplate(templateId);

  if (template) {
    panel.webview.postMessage({
      command: 'loadTemplate',
      template
    });
  }
}

function handleGenerateSlug(panel: vscode.WebviewPanel, role: string) {
  const slug = expertManagerService.generateSlug(role);
  panel.webview.postMessage({
    command: 'slugGenerated',
    slug
  });
}

async function handleValidateSlug(
  panel: vscode.WebviewPanel,
  slug: string,
  originalSlug?: string
) {
  // Basic format validation
  const formatValidation = expertManagerService.validateSlug(slug);
  if (!formatValidation.valid) {
    panel.webview.postMessage({
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

    panel.webview.postMessage({
      command: 'slugValidation',
      valid: isUnique,
      error: isUnique ? undefined : 'Slug already exists'
    });
  } else {
    panel.webview.postMessage({
      command: 'slugValidation',
      valid: true
    });
  }
}

// ==========================================================================
// HTML Generation
// ==========================================================================

function getHtml(webview: vscode.Webview, extensionUri: vscode.Uri): string {
  const { getNonce } = require('../utils/webview');
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
    }

    .header h1 {
      font-size: 18px;
      font-weight: 600;
    }

    .header-actions {
      display: flex;
      gap: var(--spacing-sm);
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

    .list-item {
      display: flex;
      gap: var(--spacing-sm);
      margin-bottom: var(--spacing-sm);
      align-items: center;
    }

    .list-item input {
      flex: 1;
      background: var(--bg-input);
      border: 1px solid var(--input-border);
      border-radius: var(--radius);
      padding: 4px 8px;
      color: var(--text-primary);
      font-size: 12px;
    }

    .btn-small {
      background: none;
      border: none;
      color: var(--text-secondary);
      cursor: pointer;
      padding: 4px;
      border-radius: 4px;
    }

    .btn-small:hover {
      background: var(--border-color);
      color: var(--error-color);
    }

    .btn-add {
      background: none;
      border: 1px dashed var(--border-color);
      color: var(--text-secondary);
      cursor: pointer;
      padding: 6px 12px;
      border-radius: var(--radius);
      font-size: 12px;
      width: 100%;
    }

    .btn-add:hover {
      border-color: var(--accent-color);
      color: var(--accent-color);
    }

    .actions {
      display: flex;
      justify-content: flex-end;
      gap: var(--spacing-sm);
      margin-top: var(--spacing-lg);
      padding-top: var(--spacing-lg);
      border-top: 1px solid var(--border-color);
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
    let capabilities = [];
    let constraints = [];

    // Request initialization
    vscode.postMessage({ command: 'init' });

    // Handle messages from extension
    window.addEventListener('message', (event) => {
      const message = event.data;

      switch (message.command) {
        case 'loadTemplates':
          renderTemplateSelection(message);
          break;
        case 'loadTemplate':
          loadTemplate(message.template);
          break;
        case 'loadExpert':
          loadExpert(message.data);
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
              <div class="template-card" onclick="selectTemplate('\${t.id}')">
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
      selectedTemplate = templateId;
      vscode.postMessage({ command: 'loadTemplate', templateId });
    }

    function loadTemplate(template) {
      currentData = { ...template.defaults };

      const html = getFormHtml(template);
      document.getElementById('app').innerHTML = html;

      // Populate form
      populateForm(currentData);
    }

    function loadExpert(expert) {
      currentData = { ...expert, _originalSlug: expert.slug };

      const html = getFormHtml(null, true);
      document.getElementById('app').innerHTML = html;

      // Populate form
      populateForm(currentData);
    }

    function getFormHtml(template, isEdit = false) {
      const title = isEdit ? 'Edit Expert' : 'Create Expert';
      const selectedTemplateInfo = template ? \`<span class="badge badge-\${template.category}">\${template.name}</span>\` : '';

      return \`
        <div class="header">
          <h1>\${title} \${selectedTemplateInfo}</h1>
          <div class="header-actions">
            \${isEdit ? '<button class="btn btn-danger" onclick="deleteExpert()">Delete</button>' : ''}
            <button class="btn btn-secondary" onclick="duplicateExpert()">Duplicate</button>
            <button class="btn" onclick="validateAndSave()">Save</button>
          </div>
        </div>

        <div id="validationSummary" class="validation-summary" style="display: none;">
          <h3>Validation</h3>
          <ul id="validationErrors"></ul>
        </div>

        <div class="form-section">
          <h2>Basic Information</h2>
          <div class="form-row">
            <div class="form-group">
              <label class="required">Role Name</label>
              <input type="text" id="role" placeholder="e.g., Frontend Developer" onchange="generateSlug()">
              <div class="help-text">The display name for this expert</div>
            </div>
            <div class="slug-row">
              <div class="form-group" style="flex: 1;">
                <label class="required">Slug</label>
                <input type="text" id="slug" placeholder="e.g., frontend-developer" onblur="validateSlug()">
                <div id="slugError" class="error"></div>
                <div id="slugSuccess" class="success"></div>
              </div>
              <button class="btn-icon" onclick="generateSlug()" title="Auto-generate from role name">⚡</button>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="required">Domain</label>
              <select id="domain">
                <option value="general">General</option>
                <option value="development">Development</option>
              </select>
            </div>
            <div class="form-group">
              <label>Persona Description</label>
              <textarea id="persona" placeholder="Describe this expert's role and approach..."></textarea>
            </div>
          </div>
        </div>

        <div class="form-section">
          <h2>Configuration</h2>
          <div class="form-row">
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
          </div>
          <div class="form-row">
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
          </div>
          <div class="form-row">
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

        <div class="form-section">
          <h2>Phase Assignment</h2>
          <div class="checkbox-group">
            <label class="checkbox-item" onclick="togglePhase(this, 'probe')">
              <input type="checkbox" id="phase-probe">
              <span>Probe (Research)</span>
            </label>
            <label class="checkbox-item" onclick="togglePhase(this, 'grasp')">
              <input type="checkbox" id="phase-grasp">
              <span>Grasp (Analysis)</span>
            </label>
            <label class="checkbox-item" onclick="togglePhase(this, 'tangle')">
              <input type="checkbox" id="phase-tangle">
              <span>Tangle (Implementation)</span>
            </label>
            <label class="checkbox-item" onclick="togglePhase(this, 'ink')">
              <input type="checkbox" id="phase-ink">
              <span>Ink (Documentation)</span>
            </label>
          </div>
        </div>

        <div class="form-section">
          <h2>Capabilities</h2>
          <div id="capabilitiesList" class="list-editor"></div>
          <button class="btn-add" onclick="addCapability()">+ Add Capability</button>
        </div>

        <div class="form-section">
          <h2>Constraints</h2>
          <div id="constraintsList" class="list-editor"></div>
          <button class="btn-add" onclick="addConstraint()">+ Add Constraint</button>
        </div>

        <div class="actions">
          <button class="btn btn-secondary" onclick="cancel()">Cancel</button>
          <button class="btn btn-primary" onclick="validateAndSave()">Save Expert</button>
        </div>
      \`;
    }

    function populateForm(data) {
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
      capabilities = data.capabilities || [];
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

      return {
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
        phases,
        capabilities,
        constraints,
        _originalSlug: currentData?._originalSlug
      };
    }

    function validateAndSave() {
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
      if (role) {
        vscode.postMessage({ command: 'generateSlug', role });
      }
    }

    function validateSlug() {
      const slug = document.getElementById('slug').value;
      const originalSlug = currentData?._originalSlug;

      if (slug) {
        vscode.postMessage({ command: 'validateSlug', slug, originalSlug });
      }
    }

    function handleSlugValidation(result) {
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

    function togglePhase(element, phase) {
      const checkbox = element.querySelector('input');
      checkbox.checked = !checkbox.checked;
      element.classList.toggle('selected', checkbox.checked);
    }

    function addCapability() {
      capabilities.push('');
      renderCapabilities();
    }

    function removeCapability(index) {
      capabilities.splice(index, 1);
      renderCapabilities();
    }

    function updateCapability(index, value) {
      capabilities[index] = value;
    }

    function renderCapabilities() {
      const container = document.getElementById('capabilitiesList');
      container.innerHTML = capabilities.map((cap, i) => \`
        <div class="list-item">
          <input type="text" value="\${cap}" placeholder="e.g., React development" onchange="updateCapability(\${i}, this.value)">
          <button class="btn-small" onclick="removeCapability(\${i})" title="Remove">×</button>
        </div>
      \`).join('');
    }

    function addConstraint() {
      constraints.push('');
      renderConstraints();
    }

    function removeConstraint(index) {
      constraints.splice(index, 1);
      renderConstraints();
    }

    function updateConstraint(index, value) {
      constraints[index] = value;
    }

    function renderConstraints() {
      const container = document.getElementById('constraintsList');
      container.innerHTML = constraints.map((con, i) => \`
        <div class="list-item">
          <input type="text" value="\${con}" placeholder="e.g., Always use TypeScript" onchange="updateConstraint(\${i}, this.value)">
          <button class="btn-small" onclick="removeConstraint(\${i})" title="Remove">×</button>
        </div>
      \`).join('');
    }

    function deleteExpert() {
      const slug = currentData?._originalSlug || currentData?.slug;
      if (slug) {
        vscode.postMessage({ command: 'delete', slug });
      }
    }

    function duplicateExpert() {
      const slug = currentData?._originalSlug || currentData?.slug;
      if (slug) {
        vscode.postMessage({ command: 'duplicate', slug });
      }
    }

    function cancel() {
      vscode.postMessage({ command: 'cancel' });
      // Actually just close the panel
      window.parent.postMessage({ command: 'closePanel' }, '*');
    }

    function showToast(message, type = 'info') {
      const toast = document.getElementById('toast');
      toast.textContent = message;
      toast.className = \`toast show \${type}\`;

      setTimeout(() => {
        toast.classList.remove('show');
      }, 3000);
    }
  </script>
</body>
</html>`;
}
