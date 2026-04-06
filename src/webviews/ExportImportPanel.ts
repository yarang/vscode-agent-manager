/**
 * ExportImportPanel - Export and import project scope templates
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { FileService } from '../services/FileService';
import { TemplateService } from '../services/TemplateService';
import { getNonce } from '../utils/webview';

let currentPanel: vscode.WebviewPanel | undefined;

export function openExportImportPanel(
  extensionUri: vscode.Uri,
  fileService: FileService,
  templateService: TemplateService,
  defaultTab: 'export' | 'import' = 'export'
): void {
  if (currentPanel) {
    currentPanel.reveal();
    return;
  }

  currentPanel = vscode.window.createWebviewPanel(
    'exportImport',
    'Templates: Export / Import',
    vscode.ViewColumn.Beside,
    { enableScripts: true, retainContextWhenHidden: true }
  );

  currentPanel.onDidDispose(() => { currentPanel = undefined; });
  currentPanel.webview.html = getHtml(currentPanel.webview, defaultTab);

  currentPanel.webview.onDidReceiveMessage(async (msg) => {
    const panel = currentPanel;
    if (!panel) { return; }

    switch (msg.command) {
      case 'init':
        await sendInitData(panel, fileService, templateService);
        break;

      case 'browseExportPath':
        await handleBrowseExport(panel);
        break;

      case 'browseImportPath':
        await handleBrowseImport(panel);
        break;

      case 'export':
        await handleExport(panel, fileService, msg.outputPath as string);
        break;

      case 'import':
        await handleImport(
          panel, fileService,
          msg.sourcePath as string,
          msg.conflictMode as 'skip' | 'overwrite' | 'rename'
        );
        break;
    }
  });
}

// ==========================================================================
// Handlers
// ==========================================================================

async function sendInitData(
  panel: vscode.WebviewPanel,
  fileService: FileService,
  templateService: TemplateService
): Promise<void> {
  const projectSpecs = await templateService.listProjectSpecs();
  const config = await fileService.readDomainConfig();
  const projectName = config.data?.project_name ?? 'unknown';
  const defaultExportPath = `./relay-templates-${projectName}-export`;

  panel.webview.postMessage({
    command: 'initData',
    projectSpecCount: projectSpecs.length,
    projectName,
    defaultExportPath,
    relayRoot: fileService.getRelayRoot()
  });
}

async function handleBrowseExport(panel: vscode.WebviewPanel): Promise<void> {
  const selected = await vscode.window.showOpenDialog({
    canSelectFolders: true,
    canSelectFiles: false,
    canSelectMany: false,
    openLabel: 'Select Export Directory'
  });

  if (selected && selected.length > 0) {
    panel.webview.postMessage({ command: 'exportPathSelected', path: selected[0].fsPath });
  }
}

async function handleBrowseImport(panel: vscode.WebviewPanel): Promise<void> {
  const selected = await vscode.window.showOpenDialog({
    canSelectFolders: true,
    canSelectFiles: false,
    canSelectMany: false,
    openLabel: 'Select Import Directory'
  });

  if (selected && selected.length > 0) {
    panel.webview.postMessage({ command: 'importPathSelected', path: selected[0].fsPath });
  }
}

async function handleExport(
  panel: vscode.WebviewPanel,
  fileService: FileService,
  outputPath: string
): Promise<void> {
  panel.webview.postMessage({ command: 'exportStarted' });

  const result = await fileService.exportProjectTemplates(outputPath);

  if (result.success && result.data) {
    panel.webview.postMessage({
      command: 'exportDone',
      meta: result.data,
      outputPath
    });
    const openFolder = await vscode.window.showInformationMessage(
      `Exported ${result.data.files.length} files to ${outputPath}`,
      'Open Folder'
    );
    if (openFolder === 'Open Folder') {
      await vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(outputPath));
    }
  } else {
    panel.webview.postMessage({ command: 'exportError', message: result.error });
    vscode.window.showErrorMessage(`Export failed: ${result.error}`);
  }
}

async function handleImport(
  panel: vscode.WebviewPanel,
  fileService: FileService,
  sourcePath: string,
  conflictMode: 'skip' | 'overwrite' | 'rename'
): Promise<void> {
  panel.webview.postMessage({ command: 'importStarted' });

  const result = await fileService.importProjectTemplates(sourcePath, conflictMode);

  if (result.success && result.data) {
    panel.webview.postMessage({
      command: 'importDone',
      imported: result.data.imported,
      skipped: result.data.skipped
    });
    vscode.window.showInformationMessage(
      `Import complete: ${result.data.imported} imported, ${result.data.skipped} skipped.`
    );
    vscode.commands.executeCommand('agentManager.refreshTree');
  } else {
    panel.webview.postMessage({ command: 'importError', message: result.error });
    vscode.window.showErrorMessage(`Import failed: ${result.error}`);
  }
}

// ==========================================================================
// HTML
// ==========================================================================

function getHtml(webview: vscode.Webview, defaultTab: 'export' | 'import'): string {
  const nonce = getNonce();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline';">
  <title>Templates: Export / Import</title>
  <style>
    :root {
      --bg: var(--vscode-editor-background);
      --bg2: var(--vscode-editorWidget-background);
      --border: var(--vscode-editorWidget-border);
      --fg: var(--vscode-editor-foreground);
      --fg2: var(--vscode-descriptionForeground);
      --accent: var(--vscode-textLink-foreground);
      --btn-bg: var(--vscode-button-background);
      --btn-fg: var(--vscode-button-foreground);
      --btn-hover: var(--vscode-button-hoverBackground);
      --input-bg: var(--vscode-input-background);
      --input-border: var(--vscode-input-border);
      --warn-bg: var(--vscode-inputValidation-warningBackground);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: var(--vscode-font-family); background: var(--bg); color: var(--fg);
           padding: 24px; font-size: 13px; max-width: 680px; }
    h1 { font-size: 16px; font-weight: 600; margin-bottom: 20px; }
    .tabs { display: flex; gap: 0; border-bottom: 1px solid var(--border); margin-bottom: 24px; }
    .tab { padding: 8px 20px; cursor: pointer; border-bottom: 2px solid transparent;
           color: var(--fg2); font-size: 13px; }
    .tab.active { border-bottom-color: var(--accent); color: var(--fg); }
    .panel { display: none; }
    .panel.active { display: block; }
    .field { margin-bottom: 16px; }
    label { display: block; font-size: 11px; color: var(--fg2); margin-bottom: 6px;
            text-transform: uppercase; letter-spacing: 0.4px; }
    .input-row { display: flex; gap: 8px; }
    input[type="text"] { flex: 1; background: var(--input-bg); border: 1px solid var(--input-border);
                          color: var(--fg); padding: 6px 10px; border-radius: 4px; font-size: 13px; }
    input[type="text"]:focus { outline: none; border-color: var(--accent); }
    .btn { background: var(--btn-bg); color: var(--btn-fg); border: none; padding: 6px 16px;
           border-radius: 4px; cursor: pointer; font-size: 13px; }
    .btn:hover { background: var(--btn-hover); }
    .btn-secondary { background: var(--bg2); color: var(--fg); border: 1px solid var(--border); }
    .btn-secondary:hover { background: var(--border); }
    .radio-group { display: flex; flex-direction: column; gap: 8px; }
    .radio-row { display: flex; align-items: flex-start; gap: 8px; }
    .radio-row input { margin-top: 2px; }
    .radio-label { font-size: 13px; }
    .radio-desc { font-size: 11px; color: var(--fg2); }
    .info-box { background: var(--bg2); border: 1px solid var(--border); border-radius: 4px;
                padding: 12px; margin-bottom: 16px; }
    .info-box .title { font-weight: 600; margin-bottom: 6px; }
    .info-box .detail { font-size: 12px; color: var(--fg2); line-height: 1.6; }
    .status { padding: 10px 14px; border-radius: 4px; margin-top: 16px; display: none; }
    .status.info  { background: var(--vscode-inputValidation-infoBackground); }
    .status.success { background: var(--vscode-inputValidation-infoBackground); }
    .status.error { background: var(--vscode-inputValidation-errorBackground); }
    .actions-row { display: flex; gap: 8px; margin-top: 20px; }
    .file-list { margin-top: 8px; font-size: 11px; color: var(--fg2); line-height: 1.8;
                 max-height: 120px; overflow-y: auto; }
  </style>
</head>
<body>
  <h1>Templates: Export / Import</h1>

  <div class="tabs">
    <div class="tab ${defaultTab === 'export' ? 'active' : ''}" onclick="switchTab('export')">Export</div>
    <div class="tab ${defaultTab === 'import' ? 'active' : ''}" onclick="switchTab('import')">Import</div>
  </div>

  <!-- Export Panel -->
  <div id="exportPanel" class="panel ${defaultTab === 'export' ? 'active' : ''}">
    <div class="info-box">
      <div class="title">Export Project Scope Templates</div>
      <div class="detail" id="exportInfo">Loading...</div>
    </div>

    <div class="field">
      <label>Output Directory</label>
      <div class="input-row">
        <input type="text" id="exportPath" placeholder="./relay-templates-export">
        <button class="btn btn-secondary" onclick="browseExport()">Browse</button>
      </div>
    </div>

    <div class="actions-row">
      <button class="btn" id="exportBtn" onclick="doExport()">Export</button>
    </div>

    <div id="exportStatus" class="status"></div>
  </div>

  <!-- Import Panel -->
  <div id="importPanel" class="panel ${defaultTab === 'import' ? 'active' : ''}">
    <div class="field">
      <label>Source Directory</label>
      <div class="input-row">
        <input type="text" id="importPath" placeholder="/path/to/relay-templates-export">
        <button class="btn btn-secondary" onclick="browseImport()">Browse</button>
      </div>
    </div>

    <div class="field">
      <label>Conflict Resolution</label>
      <div class="radio-group">
        <div class="radio-row">
          <input type="radio" name="conflict" value="skip" id="r-skip" checked>
          <div>
            <div class="radio-label"><label for="r-skip" style="text-transform:none;letter-spacing:0">Skip</label></div>
            <div class="radio-desc">Keep existing files. Conflicting imports are ignored.</div>
          </div>
        </div>
        <div class="radio-row">
          <input type="radio" name="conflict" value="overwrite" id="r-overwrite">
          <div>
            <div class="radio-label"><label for="r-overwrite" style="text-transform:none;letter-spacing:0">Overwrite</label></div>
            <div class="radio-desc">Replace all existing files with imported versions.</div>
          </div>
        </div>
        <div class="radio-row">
          <input type="radio" name="conflict" value="rename" id="r-rename">
          <div>
            <div class="radio-label"><label for="r-rename" style="text-transform:none;letter-spacing:0">Rename</label></div>
            <div class="radio-desc">Save conflicting imports with .imported suffix.</div>
          </div>
        </div>
      </div>
    </div>

    <div class="actions-row">
      <button class="btn" id="importBtn" onclick="doImport()">Import</button>
    </div>

    <div id="importStatus" class="status"></div>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();

    vscode.postMessage({ command: 'init' });

    window.addEventListener('message', (e) => {
      const msg = e.data;
      switch (msg.command) {
        case 'initData':
          document.getElementById('exportPath').value = msg.defaultExportPath;
          document.getElementById('exportInfo').textContent =
            msg.projectSpecCount + ' project scope files will be exported from ' + msg.relayRoot + '/templates/';
          break;
        case 'exportPathSelected':
          document.getElementById('exportPath').value = msg.path;
          break;
        case 'importPathSelected':
          document.getElementById('importPath').value = msg.path;
          break;
        case 'exportStarted':
          setStatus('exportStatus', 'info', 'Exporting...');
          document.getElementById('exportBtn').disabled = true;
          break;
        case 'exportDone':
          setStatus('exportStatus', 'success',
            'Exported ' + msg.meta.files.length + ' files to ' + msg.outputPath);
          document.getElementById('exportBtn').disabled = false;
          break;
        case 'exportError':
          setStatus('exportStatus', 'error', 'Error: ' + msg.message);
          document.getElementById('exportBtn').disabled = false;
          break;
        case 'importStarted':
          setStatus('importStatus', 'info', 'Importing...');
          document.getElementById('importBtn').disabled = true;
          break;
        case 'importDone':
          setStatus('importStatus', 'success',
            'Imported ' + msg.imported + ' files. Skipped: ' + msg.skipped);
          document.getElementById('importBtn').disabled = false;
          break;
        case 'importError':
          setStatus('importStatus', 'error', 'Error: ' + msg.message);
          document.getElementById('importBtn').disabled = false;
          break;
      }
    });

    function switchTab(tab) {
      document.querySelectorAll('.tab').forEach((t, i) => {
        t.classList.toggle('active', ['export','import'][i] === tab);
      });
      document.querySelectorAll('.panel').forEach((p, i) => {
        p.classList.toggle('active', ['export','import'][i] === tab);
      });
    }

    function browseExport() { vscode.postMessage({ command: 'browseExportPath' }); }
    function browseImport() { vscode.postMessage({ command: 'browseImportPath' }); }

    function doExport() {
      const outputPath = document.getElementById('exportPath').value.trim();
      if (!outputPath) { alert('Enter an output directory.'); return; }
      vscode.postMessage({ command: 'export', outputPath });
    }

    function doImport() {
      const sourcePath = document.getElementById('importPath').value.trim();
      if (!sourcePath) { alert('Enter a source directory.'); return; }
      const conflictMode = document.querySelector('input[name="conflict"]:checked').value;
      vscode.postMessage({ command: 'import', sourcePath, conflictMode });
    }

    function setStatus(id, type, text) {
      const el = document.getElementById(id);
      el.style.display = 'block';
      el.className = 'status ' + type;
      el.textContent = text;
    }
  </script>
</body>
</html>`;
}
