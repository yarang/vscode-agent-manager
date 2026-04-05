/**
 * DomainSettings - Webview panel for domain and project configuration
 *
 * Features:
 * - Domain selection (general/development)
 * - Project name configuration
 * - Active packs management
 */

import * as vscode from 'vscode';
import { configService } from '../services/ConfigService';
import { getNonce } from '../utils/webview';

let currentPanel: vscode.WebviewPanel | undefined;

export function openDomainSettings(extensionUri: vscode.Uri): void {
  if (currentPanel) {
    currentPanel.reveal();
    return;
  }

  currentPanel = vscode.window.createWebviewPanel(
    'domainSettings',
    'Domain Settings',
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [extensionUri]
    }
  );

  currentPanel.webview.html = getHtml(currentPanel.webview);

  currentPanel.onDidDispose(() => {
    currentPanel = undefined;
  });

  currentPanel.webview.onDidReceiveMessage(
    async (message) => {
      const panel = currentPanel;
      if (!panel) {return;}

      switch (message.command) {
        case 'init':
          await handleInit(panel);
          break;
        case 'saveDomain':
          await handleSaveDomain(panel, message.domain);
          break;
        case 'saveProjectName':
          await handleSaveProjectName(panel, message.name);
          break;
        case 'addPack':
          await handleAddPack(panel, message.pack);
          break;
        case 'removePack':
          await handleRemovePack(panel, message.pack);
          break;
      }
    },
    undefined
  );
}

async function handleInit(panel: vscode.WebviewPanel) {
  const config = await configService.getDomainConfig();
  const structure = await configService.checkRelayStructure();

  panel.webview.postMessage({
    command: 'loadConfig',
    data: {
      config: config.data,
      structure: structure.data
    }
  });
}

async function handleSaveDomain(panel: vscode.WebviewPanel, domain: string) {
  const result = await configService.setDomain(domain as 'general' | 'development');
  if (result.success) {
    vscode.window.showInformationMessage(`Domain set to: ${domain}`);
    await handleInit(panel);
  } else {
    vscode.window.showErrorMessage(`Failed to set domain: ${result.error}`);
  }
}

async function handleSaveProjectName(panel: vscode.WebviewPanel, name: string) {
  const result = await configService.setProjectName(name);
  if (result.success) {
    vscode.window.showInformationMessage(`Project name set to: ${name}`);
    await handleInit(panel);
  } else {
    vscode.window.showErrorMessage(`Failed to set project name: ${result.error}`);
  }
}

async function handleAddPack(panel: vscode.WebviewPanel, pack: string) {
  const result = await configService.addActivePack(pack);
  if (result.success) {
    vscode.window.showInformationMessage(`Added pack: ${pack}`);
    await handleInit(panel);
  } else {
    vscode.window.showErrorMessage(`Failed to add pack: ${result.error}`);
  }
}

async function handleRemovePack(panel: vscode.WebviewPanel, pack: string) {
  const result = await configService.removeActivePack(pack);
  if (result.success) {
    vscode.window.showInformationMessage(`Removed pack: ${pack}`);
    await handleInit(panel);
  } else {
    vscode.window.showErrorMessage(`Failed to remove pack: ${result.error}`);
  }
}

function getHtml(webview: vscode.Webview): string {
  const nonce = getNonce();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline';">
  <title>Domain Settings</title>
  <style>
    :root {
      --bg-primary: var(--vscode-editor-background);
      --bg-secondary: var(--vscode-editorWidget-background);
      --fg-primary: var(--vscode-editor-foreground);
      --fg-secondary: var(--vscode-descriptionForeground);
      --border: var(--vscode-panel-border);
      --button-bg: var(--vscode-button-background);
      --button-fg: var(--vscode-button-foreground);
      --input-bg: var(--vscode-input-background);
      --input-border: var(--vscode-input-border);
    }

    body {
      font-family: var(--vscode-font-family);
      background: var(--bg-primary);
      color: var(--fg-primary);
      padding: 20px;
      max-width: 800px;
      margin: 0 auto;
    }

    h1 {
      font-size: 24px;
      margin-bottom: 8px;
    }

    h2 {
      font-size: 18px;
      margin-top: 24px;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--border);
    }

    .section {
      margin-bottom: 24px;
    }

    .info-card {
      background: var(--bg-secondary);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 16px;
      margin-bottom: 16px;
    }

    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid var(--border);
    }

    .info-row:last-child {
      border-bottom: none;
    }

    .info-label {
      color: var(--fg-secondary);
    }

    .info-value {
      font-weight: 600;
    }

    .domain-options {
      display: flex;
      gap: 16px;
      margin-top: 12px;
    }

    .domain-option {
      flex: 1;
      padding: 16px;
      border: 2px solid var(--border);
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .domain-option:hover {
      border-color: var(--button-bg);
    }

    .domain-option.selected {
      border-color: var(--button-bg);
      background: rgba(0, 120, 212, 0.1);
    }

    .domain-option h3 {
      margin: 0 0 8px 0;
      font-size: 16px;
    }

    .domain-option p {
      margin: 0;
      font-size: 13px;
      color: var(--fg-secondary);
    }

    input[type="text"] {
      width: 100%;
      padding: 8px 12px;
      background: var(--input-bg);
      border: 1px solid var(--input-border);
      border-radius: 4px;
      color: var(--fg-primary);
      font-size: 14px;
      margin-top: 8px;
    }

    button {
      padding: 8px 16px;
      background: var(--button-bg);
      color: var(--button-fg);
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      margin-top: 12px;
    }

    button:hover {
      opacity: 0.9;
    }

    .packs-list {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 12px;
    }

    .pack-tag {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 12px;
      background: var(--bg-secondary);
      border: 1px solid var(--border);
      border-radius: 16px;
      font-size: 13px;
    }

    .pack-tag button {
      padding: 2px 6px;
      margin: 0;
      background: transparent;
      color: var(--fg-secondary);
      font-size: 12px;
    }

    .pack-tag button:hover {
      color: #f44336;
    }

    .add-pack-form {
      display: flex;
      gap: 8px;
      margin-top: 12px;
    }

    .add-pack-form input {
      flex: 1;
      margin-top: 0;
    }

    .add-pack-form button {
      margin-top: 0;
    }

    .status-ok {
      color: #4caf50;
    }

    .status-warning {
      color: #ff9800;
    }

    .status-error {
      color: #f44336;
    }
  </style>
</head>
<body>
  <h1>🌐 Domain Settings</h1>
  <p>Configure your relay-plugin domain and project settings.</p>

  <div class="section">
    <h2>📁 Project Info</h2>
    <div class="info-card" id="projectInfo">
      <div class="info-row">
        <span class="info-label">Relay Status</span>
        <span class="info-value" id="relayStatus">Loading...</span>
      </div>
      <div class="info-row">
        <span class="info-label">Experts Count</span>
        <span class="info-value" id="expertsCount">-</span>
      </div>
      <div class="info-row">
        <span class="info-label">Teams Count</span>
        <span class="info-value" id="teamsCount">-</span>
      </div>
      <div class="info-row">
        <span class="info-label">Relay Root</span>
        <span class="info-value" id="relayRoot" style="font-size: 12px;">-</span>
      </div>
    </div>
  </div>

  <div class="section">
    <h2>🎯 Domain Selection</h2>
    <p>Choose the domain for your project. This determines which skills and agents are available.</p>
    <div class="domain-options">
      <div class="domain-option" data-domain="general" onclick="selectDomain('general')">
        <h3>🌍 General</h3>
        <p>Marketing, legal, planning, sales, and general business tasks.</p>
        <p><strong>Packs:</strong> moai-foundation, business-writing</p>
      </div>
      <div class="domain-option" data-domain="development" onclick="selectDomain('development')">
        <h3>💻 Development</h3>
        <p>Software development teams with TDD, DDD, and code review skills.</p>
        <p><strong>Packs:</strong> moai-foundation, tdd, ddd, code-review</p>
      </div>
    </div>
  </div>

  <div class="section">
    <h2>📝 Project Name</h2>
    <input type="text" id="projectName" placeholder="Enter project name" />
    <button onclick="saveProjectName()">Save Project Name</button>
  </div>

  <div class="section">
    <h2>📦 Active Packs</h2>
    <p>Additional skill packs to enable for this project.</p>
    <div class="packs-list" id="packsList">
      <!-- Packs will be loaded here -->
    </div>
    <div class="add-pack-form">
      <input type="text" id="newPack" placeholder="Enter pack name (e.g., tdd, ddd, api-design)" />
      <button onclick="addPack()">Add Pack</button>
    </div>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();

    // Initialize
    vscode.postMessage({ command: 'init' });

    // Listen for messages from extension
    window.addEventListener('message', event => {
      const message = event.data;
      if (message.command === 'loadConfig') {
        loadConfig(message.data);
      }
    });

    function loadConfig(data) {
      const config = data.config;
      const structure = data.structure;

      // Update project info
      if (structure) {
        document.getElementById('relayStatus').textContent = structure.exists ? '✓ Configured' : '⚠ Not configured';
        document.getElementById('relayStatus').className = 'info-value ' + (structure.exists ? 'status-ok' : 'status-warning');
        document.getElementById('expertsCount').textContent = structure.expertsCount || '0';
        document.getElementById('teamsCount').textContent = structure.teamsCount || '0';
        document.getElementById('relayRoot').textContent = structure.relayDir || '-';
      }

      // Update domain selection
      if (config) {
        document.querySelectorAll('.domain-option').forEach(el => {
          el.classList.toggle('selected', el.dataset.domain === config.domain);
        });

        // Update project name
        document.getElementById('projectName').value = config.project_name || '';

        // Update packs
        updatePacksList(config.active_packs || []);
      }
    }

    function selectDomain(domain) {
      document.querySelectorAll('.domain-option').forEach(el => {
        el.classList.toggle('selected', el.dataset.domain === domain);
      });
      vscode.postMessage({ command: 'saveDomain', domain });
    }

    function saveProjectName() {
      const name = document.getElementById('projectName').value;
      vscode.postMessage({ command: 'saveProjectName', name });
    }

    function addPack() {
      const input = document.getElementById('newPack');
      const pack = input.value.trim();
      if (pack) {
        vscode.postMessage({ command: 'addPack', pack });
        input.value = '';
      }
    }

    function removePack(pack) {
      vscode.postMessage({ command: 'removePack', pack });
    }

    function updatePacksList(packs) {
      const container = document.getElementById('packsList');
      if (packs.length === 0) {
        container.innerHTML = '<span style="color: var(--fg-secondary);">No active packs</span>';
        return;
      }

      container.innerHTML = packs.map(pack => \`
        <span class="pack-tag">
          \${pack}
          <button onclick="removePack('\${pack}')" title="Remove">×</button>
        </span>
      \`).join('');
    }
  </script>
</body>
</html>`;
}
