/**
 * SpecBrowserPanel - Browse and manage user/project scope spec modules
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { TemplateService } from '../services/TemplateService';
import { FileService } from '../services/FileService';
import { ResolvedSpec, SpecType } from '../types';
import { getNonce } from '../utils/webview';

let currentPanel: vscode.WebviewPanel | undefined;

export function openSpecBrowser(
  extensionUri: vscode.Uri,
  templateService: TemplateService,
  fileService: FileService
): void {
  if (currentPanel) {
    currentPanel.reveal();
    return;
  }

  currentPanel = vscode.window.createWebviewPanel(
    'specBrowser',
    'Spec Browser',
    vscode.ViewColumn.One,
    { enableScripts: true, retainContextWhenHidden: true }
  );

  currentPanel.onDidDispose(() => { currentPanel = undefined; });

  currentPanel.webview.html = getHtml(currentPanel.webview);

  currentPanel.webview.onDidReceiveMessage(async (msg) => {
    const panel = currentPanel;
    if (!panel) { return; }

    switch (msg.command) {
      case 'init':
        await sendSpecList(panel, templateService, msg.filter as SpecType | undefined);
        break;

      case 'filter':
        await sendSpecList(panel, templateService, msg.type as SpecType | undefined);
        break;

      case 'fork':
        await handleFork(panel, templateService, msg.id as string, msg.specType as string);
        break;

      case 'deleteProjectSpec':
        await handleDelete(panel, templateService, fileService, msg.id as string, msg.specType as string);
        break;

      case 'openFile':
        await handleOpenFile(fileService, templateService, msg.id as string, msg.scope as string, msg.specType as string);
        break;

      case 'diff':
        await handleDiff(fileService, templateService, msg.id as string, msg.specType as string);
        break;

      case 'newSpec':
        await handleNewSpec(panel, templateService, fileService);
        break;
    }
  });
}

// ==========================================================================
// Handlers
// ==========================================================================

async function sendSpecList(
  panel: vscode.WebviewPanel,
  templateService: TemplateService,
  filter?: SpecType
): Promise<void> {
  const specs = await templateService.listSpecs(filter);
  const hasUserScope = templateService.hasUserScope();

  panel.webview.postMessage({
    command: 'specs',
    specs: specs.map(s => ({
      id: s.id,
      type: s.effective.type,
      scope: s.effective.scope,
      version: s.effective.version,
      tags: s.effective.tags ?? [],
      overridden: !!s.overridden_by,
      content: s.effective.content.slice(0, 200)
    })),
    hasUserScope
  });
}

async function handleFork(
  panel: vscode.WebviewPanel,
  templateService: TemplateService,
  id: string,
  _specType?: string
): Promise<void> {
  try {
    await templateService.forkToProject(id);
    panel.webview.postMessage({ command: 'forkSuccess', id });
    vscode.window.showInformationMessage(`Spec "${id}" forked to project scope.`);
    vscode.commands.executeCommand('agentManager.refreshTree');
    await sendSpecList(panel, templateService);
  } catch (err) {
    panel.webview.postMessage({ command: 'error', message: String(err) });
  }
}

async function handleDelete(
  panel: vscode.WebviewPanel,
  templateService: TemplateService,
  fileService: FileService,
  id: string,
  specType: string
): Promise<void> {
  const confirmed = await vscode.window.showWarningMessage(
    `Delete project spec "${id}"?`, 'Delete', 'Cancel'
  );
  if (confirmed !== 'Delete') { return; }

  await templateService.deleteProjectSpec(id, specType as any);
  vscode.window.showInformationMessage(`Spec "${id}" deleted.`);
  vscode.commands.executeCommand('agentManager.refreshTree');
  await sendSpecList(panel, templateService);
}

async function handleOpenFile(
  fileService: FileService,
  templateService: TemplateService,
  id: string,
  scope: string,
  specType: string
): Promise<void> {
  const pluginRoot = templateService.getPluginRoot();
  const subDir = specTypeToSubDir(specType, pluginRoot);
  if (scope === 'project') {
    const dir = fileService.getProjectDirForType(specType as any);
    const filePath = `${dir}/${id}.md`;
    await vscode.window.showTextDocument(vscode.Uri.file(filePath));
  } else {
    if (!pluginRoot) {
      vscode.window.showWarningMessage('User scope not detected.');
      return;
    }
    const filePath = `${pluginRoot}/docs/templates/modules/${subDir}/${id}.md`;
    await vscode.window.showTextDocument(vscode.Uri.file(filePath), { preview: true });
  }
}

async function handleDiff(
  fileService: FileService,
  templateService: TemplateService,
  id: string,
  specType: string
): Promise<void> {
  const pluginRoot = templateService.getPluginRoot();
  if (!pluginRoot) {
    vscode.window.showWarningMessage('User scope not detected — cannot diff.');
    return;
  }
  const subDir = specTypeToSubDir(specType, pluginRoot);
  const userUri = vscode.Uri.file(`${pluginRoot}/docs/templates/modules/${subDir}/${id}.md`);
  const projectUri = vscode.Uri.file(`${fileService.getProjectDirForType(specType as any)}/${id}.md`);
  await vscode.commands.executeCommand('vscode.diff', userUri, projectUri,
    `${id}: user scope ↔ project scope`);
}

function specTypeToSubDir(type: string, pluginRoot?: string): string {
  if (type === 'platform') { return 'platforms'; }
  if (type === 'policy')   { return 'policies'; }
  if (type === 'base')     { return 'base'; }
  // spec: prefer 'specs/', fall back to 'capabilities/' for older installs
  if (pluginRoot) {
    const specsDir = path.join(pluginRoot, 'docs', 'templates', 'modules', 'specs');
    if (!fs.existsSync(specsDir)) { return 'capabilities'; }
  }
  return 'specs';
}

async function handleNewSpec(
  panel: vscode.WebviewPanel,
  templateService: TemplateService,
  fileService: FileService
): Promise<void> {
  const specType = await vscode.window.showQuickPick(
    ['spec', 'platform', 'policy'],
    { placeHolder: 'Select spec type' }
  );
  if (!specType) { return; }

  const id = await vscode.window.showInputBox({
    prompt: `${specType} ID (e.g. my-feature)`,
    validateInput: v => /^[a-z0-9-]+$/.test(v) ? null : 'Lowercase letters, numbers, and hyphens only'
  });
  if (!id) { return; }

  await templateService.createProjectSpec(id, `# ${id}\n\n<!-- Describe the ${specType} here -->\n`, {
    type: specType as any
  });
  const dir = fileService.getProjectDirForType(specType as any);
  const filePath = `${dir}/${id}.md`;
  await vscode.window.showTextDocument(vscode.Uri.file(filePath));
  vscode.commands.executeCommand('agentManager.refreshTree');
  await sendSpecList(panel, templateService);
}

// ==========================================================================
// HTML
// ==========================================================================

function getHtml(webview: vscode.Webview): string {
  const nonce = getNonce();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline';">
  <title>Spec Browser</title>
  <style>
    :root {
      --bg: var(--vscode-editor-background);
      --bg2: var(--vscode-editorWidget-background);
      --border: var(--vscode-editorWidget-border);
      --fg: var(--vscode-editor-foreground);
      --fg2: var(--vscode-descriptionForeground);
      --accent: var(--vscode-textLink-foreground);
      --badge-bg: var(--vscode-badge-background);
      --badge-fg: var(--vscode-badge-foreground);
      --btn-bg: var(--vscode-button-background);
      --btn-fg: var(--vscode-button-foreground);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: var(--vscode-font-family); background: var(--bg); color: var(--fg);
           padding: 20px; font-size: 13px; }
    .toolbar { display: flex; justify-content: space-between; align-items: center;
               margin-bottom: 16px; gap: 8px; flex-wrap: wrap; }
    .toolbar h1 { font-size: 16px; font-weight: 600; }
    .filters { display: flex; gap: 6px; }
    .filter-btn { background: var(--bg2); border: 1px solid var(--border); color: var(--fg);
                  padding: 4px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; }
    .filter-btn.active { background: var(--accent); color: var(--bg); border-color: var(--accent); }
    .btn { background: var(--btn-bg); color: var(--btn-fg); border: none; padding: 6px 14px;
           border-radius: 4px; cursor: pointer; font-size: 12px; }
    .btn:hover { opacity: 0.85; }
    .legend { display: flex; gap: 16px; margin-bottom: 12px; font-size: 11px; color: var(--fg2); }
    .legend-item { display: flex; align-items: center; gap: 4px; }
    .badge { display: inline-block; padding: 1px 6px; border-radius: 3px;
             font-size: 10px; font-weight: 600; }
    .badge-user    { background: #1f77b4; color: #fff; }
    .badge-project { background: #2ca02c; color: #fff; }
    .badge-override { background: #e07b00; color: #fff; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; padding: 8px 10px; font-size: 11px; color: var(--fg2);
         border-bottom: 1px solid var(--border); text-transform: uppercase; letter-spacing: 0.4px; }
    td { padding: 8px 10px; border-bottom: 1px solid var(--border); vertical-align: middle; }
    tr:hover td { background: var(--vscode-list-hoverBackground); }
    .id-cell { font-family: monospace; font-size: 12px; cursor: pointer; color: var(--accent); }
    .id-cell:hover { text-decoration: underline; }
    .actions { display: flex; gap: 4px; }
    .action-btn { background: none; border: 1px solid var(--border); color: var(--fg2);
                  padding: 2px 8px; border-radius: 3px; cursor: pointer; font-size: 11px; }
    .action-btn:hover { background: var(--bg2); color: var(--fg); }
    .action-btn.danger:hover { border-color: #e03030; color: #e03030; }
    .tag { display: inline-block; background: var(--badge-bg); color: var(--badge-fg);
           padding: 1px 6px; border-radius: 3px; font-size: 10px; margin-right: 3px; }
    .empty { text-align: center; padding: 40px; color: var(--fg2); }
    .no-user-scope { background: var(--vscode-inputValidation-warningBackground);
                     border: 1px solid var(--vscode-inputValidation-warningBorder);
                     padding: 8px 12px; border-radius: 4px; margin-bottom: 12px;
                     font-size: 12px; color: var(--fg2); }
  </style>
</head>
<body>
  <div class="toolbar">
    <h1>Spec Browser</h1>
    <div style="display:flex;gap:8px;align-items:center">
      <div class="filters">
        <button class="filter-btn active" onclick="setFilter(null)">All</button>
        <button class="filter-btn" onclick="setFilter('spec')">Specs</button>
        <button class="filter-btn" onclick="setFilter('base')">Base</button>
        <button class="filter-btn" onclick="setFilter('platform')">Platforms</button>
        <button class="filter-btn" onclick="setFilter('policy')">Policies</button>
      </div>
      <button class="btn" onclick="newSpec()">+ New Spec</button>
    </div>
  </div>

  <div id="noUserScope" class="no-user-scope" style="display:none">
    User scope (relay-plugin) not detected. Only project scope specs are shown.
    Set the RELAY_PLUGIN_PATH environment variable or place relay-plugin adjacent to the workspace.
  </div>

  <div class="legend">
    <span class="legend-item"><span class="badge badge-user">[U]</span> user scope (read-only)</span>
    <span class="legend-item"><span class="badge badge-project">[P]</span> project scope (editable)</span>
    <span class="legend-item"><span class="badge badge-override">[P]</span> project overrides user</span>
  </div>

  <table>
    <thead>
      <tr>
        <th>ID</th>
        <th>Type</th>
        <th>Scope</th>
        <th>Tags</th>
        <th>Actions</th>
      </tr>
    </thead>
    <tbody id="specTable">
      <tr><td colspan="5" class="empty">Loading...</td></tr>
    </tbody>
  </table>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    let allSpecs = [];
    let currentFilter = null;

    vscode.postMessage({ command: 'init' });

    window.addEventListener('message', (e) => {
      const msg = e.data;
      if (msg.command === 'specs') {
        allSpecs = msg.specs;
        if (!msg.hasUserScope) {
          document.getElementById('noUserScope').style.display = 'block';
        }
        renderTable(allSpecs);
      }
    });

    function setFilter(type) {
      currentFilter = type;
      document.querySelectorAll('.filter-btn').forEach((btn, i) => {
        const types = [null, 'spec', 'base', 'platform', 'policy'];
        btn.classList.toggle('active', types[i] === type);
      });
      const filtered = type ? allSpecs.filter(s => s.type === type) : allSpecs;
      renderTable(filtered);
    }

    function renderTable(specs) {
      const tbody = document.getElementById('specTable');
      if (specs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty">No specs found.</td></tr>';
        return;
      }

      tbody.innerHTML = specs.map(s => {
        const isProject = s.scope === 'project';
        const badgeClass = s.overridden ? 'badge-override' : (isProject ? 'badge-project' : 'badge-user');
        const badge = isProject ? '[P]' : '[U]';
        const tags = (s.tags || []).map(t => \`<span class="tag">\${t}</span>\`).join('');

        const actions = [];
        if (!isProject) {
          actions.push(\`<button class="action-btn" onclick="fork('\${s.id}', '\${s.type}')">Fork to Project</button>\`);
          actions.push(\`<button class="action-btn" onclick="openFile('\${s.id}', 'user', '\${s.type}')">View</button>\`);
        } else {
          actions.push(\`<button class="action-btn" onclick="openFile('\${s.id}', 'project', '\${s.type}')">Edit</button>\`);
          if (s.overridden) {
            actions.push(\`<button class="action-btn" onclick="diff('\${s.id}', '\${s.type}')">Diff</button>\`);
          }
          actions.push(\`<button class="action-btn danger" onclick="deleteSpec('\${s.id}', '\${s.type}')">Delete</button>\`);
        }

        return \`<tr>
          <td class="id-cell" onclick="openFile('\${s.id}', '\${s.scope}', '\${s.type}')">\${s.id}</td>
          <td><span class="badge badge-user" style="background:transparent;color:var(--fg2)">\${s.type}</span></td>
          <td><span class="badge \${badgeClass}">\${badge}</span></td>
          <td>\${tags}</td>
          <td><div class="actions">\${actions.join('')}</div></td>
        </tr>\`;
      }).join('');
    }

    function fork(id, specType) { vscode.postMessage({ command: 'fork', id, specType }); }
    function deleteSpec(id, specType) { vscode.postMessage({ command: 'deleteProjectSpec', id, specType }); }
    function openFile(id, scope, specType) { vscode.postMessage({ command: 'openFile', id, scope, specType }); }
    function diff(id, specType) { vscode.postMessage({ command: 'diff', id, specType }); }
    function newSpec() { vscode.postMessage({ command: 'newSpec' }); }
  </script>
</body>
</html>`;
}
