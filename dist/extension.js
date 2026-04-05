/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ([
/* 0 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


/**
 * Agent Manager - VS Code Extension Entry Point
 *
 * Provides GUI for relay-plugin agent configuration and team management.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(__webpack_require__(1));
const AgentTreeProvider_1 = __webpack_require__(2);
const FileService_1 = __webpack_require__(3);
const VisualizationService_1 = __webpack_require__(80);
const TeamBuilderPanel_1 = __webpack_require__(81);
const ExpertManager_1 = __webpack_require__(87);
const webview_1 = __webpack_require__(86);
let treeProvider;
let currentDashboardPanel;
function activate(context) {
    console.log('Agent Manager extension is activating...');
    // Initialize services
    const fileServiceInstance = new FileService_1.FileService();
    // Register tree data provider
    treeProvider = new AgentTreeProvider_1.AgentTreeProvider(fileServiceInstance, context);
    vscode.window.registerTreeDataProvider('agentManager.treeView', treeProvider);
    // Register tree view commands
    (0, AgentTreeProvider_1.registerTreeCommands)(context, fileServiceInstance);
    // Register commands
    const commands = [
        vscode.commands.registerCommand('agentManager.openDashboard', () => openDashboard(fileServiceInstance)),
        vscode.commands.registerCommand('agentManager.createExpert', () => createExpert(fileServiceInstance)),
        vscode.commands.registerCommand('agentManager.buildTeam', () => buildTeam(fileServiceInstance)),
        vscode.commands.registerCommand('agentManager.editAgent', () => editAgent(fileServiceInstance)),
        vscode.commands.registerCommand('agentManager.openSettings', () => openSettings(fileServiceInstance)),
        vscode.commands.registerCommand('agentManager.refreshTree', () => treeProvider.refresh()),
        vscode.commands.registerCommand('agentManager.viewTeamDiagram', (teamSlug) => viewTeamDiagram(fileServiceInstance, teamSlug)),
        vscode.commands.registerCommand('agentManager.viewExpertDiagram', (expertSlug) => viewExpertDiagram(fileServiceInstance, expertSlug)),
        vscode.commands.registerCommand('agentManager.openExpertManager', (expertSlug) => {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (workspaceFolders && workspaceFolders.length > 0) {
                (0, ExpertManager_1.openExpertManager)(workspaceFolders[0].uri, expertSlug);
            }
        }),
    ];
    commands.forEach(cmd => context.subscriptions.push(cmd));
    // Check for relay setup
    checkRelaySetup(fileServiceInstance);
    console.log('Agent Manager extension activated successfully!');
}
function deactivate() {
    console.log('Agent Manager extension deactivated');
}
// ==========================================================================
// Command Handlers
// ==========================================================================
async function openDashboard(fileService) {
    if (currentDashboardPanel) {
        currentDashboardPanel.reveal();
        return;
    }
    currentDashboardPanel = vscode.window.createWebviewPanel('agentManagerDashboard', 'Agent Manager Dashboard', vscode.ViewColumn.One, {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
            vscode.Uri.joinPath(vscode.Uri.file(fileService.getRelayRoot()), 'experts'),
            vscode.Uri.joinPath(vscode.Uri.file(fileService.getRelayRoot()), 'teams')
        ]
    });
    currentDashboardPanel.onDidDispose(() => {
        currentDashboardPanel = undefined;
    });
    // Handle messages from webview
    currentDashboardPanel.webview.onDidReceiveMessage(async (message) => {
        switch (message.command) {
            case 'requestData':
                await handleDataRequest(currentDashboardPanel, fileService);
                break;
            case 'createExpert':
                vscode.commands.executeCommand('agentManager.createExpert');
                break;
            case 'buildTeam':
                vscode.commands.executeCommand('agentManager.buildTeam');
                break;
            case 'refresh':
                await handleDataRequest(currentDashboardPanel, fileService);
                break;
            case 'openExpert':
                await openExpertInEditor(fileService, message.slug);
                break;
            case 'openTeam':
                await openTeamInEditor(fileService, message.slug);
                break;
        }
    }, undefined);
    currentDashboardPanel.webview.html = getDashboardHtml(currentDashboardPanel.webview);
}
async function handleDataRequest(panel, fileService) {
    const [expertsResult, teamsResult, configResult] = await Promise.all([
        fileService.listExperts(),
        fileService.listTeams(),
        fileService.readDomainConfig()
    ]);
    const experts = expertsResult.success ? expertsResult.data || [] : [];
    const teams = teamsResult.success ? teamsResult.data || [] : [];
    const config = configResult.success ? configResult.data : null;
    const expertStats = VisualizationService_1.visualizationService.getExpertStats(experts);
    const teamStats = VisualizationService_1.visualizationService.getTeamStats(teams);
    const overviewDiagram = VisualizationService_1.visualizationService.generateOverviewDiagram(teams, experts);
    const teamDiagram = VisualizationService_1.visualizationService.generateTeamDiagram(teams);
    panel.webview.postMessage({
        command: 'data',
        data: {
            experts,
            teams,
            config,
            stats: {
                experts: expertStats,
                teams: teamStats
            },
            diagrams: {
                overview: overviewDiagram,
                teams: teamDiagram
            }
        }
    });
}
async function openExpertInEditor(fileService, slug) {
    const filePath = fileService.getExpertsDir() + `/${slug}.md`;
    const uri = vscode.Uri.file(filePath);
    await vscode.commands.executeCommand('vscode.openWith', uri, 'default');
}
async function openTeamInEditor(fileService, slug) {
    const filePath = fileService.getTeamsDir() + `/${slug}.json`;
    const uri = vscode.Uri.file(filePath);
    await vscode.commands.executeCommand('vscode.openWith', uri, 'default');
}
async function createExpert(fileService) {
    // Open Expert Manager webview
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
        (0, ExpertManager_1.openExpertManager)(workspaceFolders[0].uri);
    }
    else {
        vscode.window.showErrorMessage('Please open a workspace folder first');
    }
}
async function buildTeam(fileService, editingSlug) {
    const extensionUri = vscode.Uri.file(fileService.getRelayRoot()).with({ scheme: 'file' });
    // Navigate to extension root
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
        await TeamBuilderPanel_1.TeamBuilderPanel.createOrShow(workspaceFolders[0].uri, editingSlug);
    }
    else {
        vscode.window.showErrorMessage('Please open a workspace folder first');
    }
}
async function editAgent(fileService, expertSlug) {
    if (expertSlug) {
        // Direct edit from tree view
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
            (0, ExpertManager_1.openExpertManager)(workspaceFolders[0].uri, expertSlug);
        }
        return;
    }
    // Show picker to select expert
    const agents = await fileService.listExperts();
    if (!agents.success || !agents.data || agents.data.length === 0) {
        vscode.window.showInformationMessage('No experts found. Create one first!');
        return;
    }
    const items = agents.data.map(e => ({
        label: e.role,
        description: e.slug,
        slug: e.slug
    }));
    const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select expert to edit'
    });
    if (selected) {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
            (0, ExpertManager_1.openExpertManager)(workspaceFolders[0].uri, selected.slug);
        }
    }
}
async function openSettings(fileService) {
    const config = await fileService.readDomainConfig();
    if (config.success && config.data) {
        vscode.window.showInformationMessage(`Domain: ${config.data.domain}, Project: ${config.data.project_name}`);
    }
    else {
        const action = await vscode.window.showWarningMessage('Relay plugin not configured. Would you like to set it up?', 'Setup Now', 'Cancel');
        if (action === 'Setup Now') {
            vscode.window.showInformationMessage('Please run /relay:setup in the chat to configure relay plugin.');
        }
    }
}
async function viewTeamDiagram(fileService, teamSlug) {
    const result = await fileService.readTeam(teamSlug);
    if (!result.success || !result.data) {
        vscode.window.showErrorMessage(`Team not found: ${teamSlug}`);
        return;
    }
    const diagram = VisualizationService_1.visualizationService.generateSingleTeamDiagram(result.data);
    showDiagramViewer(`${result.data.name} Structure`, diagram);
}
async function viewExpertDiagram(fileService, expertSlug) {
    const result = await fileService.readExpert(expertSlug);
    if (!result.success || !result.data) {
        vscode.window.showErrorMessage(`Expert not found: ${expertSlug}`);
        return;
    }
    const diagram = VisualizationService_1.visualizationService.generateExpertMindMap(result.data);
    showDiagramViewer(`${result.data.role} Mind Map`, diagram);
}
function showDiagramViewer(title, mermaidCode) {
    const panel = vscode.window.createWebviewPanel('agentDiagramViewer', title, vscode.ViewColumn.Two, { enableScripts: true });
    panel.webview.html = getDiagramViewerHtml(mermaidCode);
}
// ==========================================================================
// Helpers
// ==========================================================================
async function checkRelaySetup(fileService) {
    const config = await fileService.readDomainConfig();
    if (!config.success || !config.data) {
        vscode.window.showWarningMessage('Relay plugin not configured. Run /relay:setup to initialize.');
    }
}
function getDashboardHtml(webview) {
    const nonce = (0, webview_1.getNonce)();
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline';">
  <title>Agent Manager Dashboard</title>
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js" nonce="${nonce}"></script>
  <style>
    :root {
      --bg-primary: var(--vscode-editor-background);
      --bg-secondary: var(--vscode-editorWidget-background);
      --border-color: var(--vscode-editorWidget-border);
      --text-primary: var(--vscode-editor-foreground);
      --text-secondary: var(--vscode-descriptionForeground);
      --accent-color: var(--vscode-textLink-foreground);
      --accent-hover: var(--vscode-textLink-activeForeground);
      --success-color: var(--vscode-testing-iconPassed);
      --warning-color: var(--vscode-testing-iconSkipped);
      --error-color: var(--vscode-errorForeground);
      --card-radius: 8px;
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
      font-size: 24px;
      font-weight: 600;
    }

    .refresh-btn {
      background: var(--accent-color);
      color: var(--bg-primary);
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
      transition: background 0.2s;
    }

    .refresh-btn:hover {
      background: var(--accent-hover);
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: var(--spacing-md);
      margin-bottom: var(--spacing-lg);
    }

    .stat-card {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: var(--card-radius);
      padding: var(--spacing-md);
      text-align: center;
    }

    .stat-value {
      font-size: 36px;
      font-weight: 700;
      color: var(--accent-color);
    }

    .stat-label {
      color: var(--text-secondary);
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-top: var(--spacing-sm);
    }

    .stat-breakdown {
      display: flex;
      justify-content: center;
      gap: var(--spacing-md);
      margin-top: var(--spacing-sm);
      font-size: 12px;
      color: var(--text-secondary);
    }

    .section {
      margin-bottom: var(--spacing-lg);
    }

    .section-title {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: var(--spacing-md);
      display: flex;
      align-items: center;
      gap: var(--spacing-sm);
    }

    .section-title::before {
      content: '';
      width: 4px;
      height: 18px;
      background: var(--accent-color);
      border-radius: 2px;
    }

    .card {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: var(--card-radius);
      overflow: hidden;
    }

    .card-header {
      padding: var(--spacing-md);
      border-bottom: 1px solid var(--border-color);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .card-title {
      font-weight: 600;
    }

    .card-body {
      padding: var(--spacing-md);
    }

    .actions {
      display: flex;
      gap: var(--spacing-sm);
      flex-wrap: wrap;
    }

    .btn {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      color: var(--text-primary);
      padding: 10px 20px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: all 0.2s;
    }

    .btn:hover {
      background: var(--accent-color);
      color: var(--bg-primary);
      border-color: var(--accent-color);
    }

    .btn-primary {
      background: var(--accent-color);
      color: var(--bg-primary);
      border-color: var(--accent-color);
    }

    .btn-primary:hover {
      background: var(--accent-hover);
      border-color: var(--accent-hover);
    }

    .list-item {
      padding: var(--spacing-sm) 0;
      border-bottom: 1px solid var(--border-color);
      display: flex;
      justify-content: space-between;
      align-items: center;
      cursor: pointer;
    }

    .list-item:last-child {
      border-bottom: none;
    }

    .list-item:hover {
      background: var(--vscode-list-hoverBackground);
    }

    .list-item-info {
      flex: 1;
    }

    .list-item-title {
      font-weight: 500;
    }

    .list-item-desc {
      font-size: 12px;
      color: var(--text-secondary);
    }

    .list-item-badge {
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
    }

    .diagram-container {
      background: var(--bg-primary);
      border-radius: var(--card-radius);
      padding: var(--spacing-md);
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 300px;
    }

    .diagram-tabs {
      display: flex;
      gap: var(--spacing-sm);
      margin-bottom: var(--spacing-md);
      border-bottom: 1px solid var(--border-color);
      padding-bottom: var(--spacing-sm);
    }

    .tab {
      padding: 8px 16px;
      border: none;
      background: none;
      color: var(--text-secondary);
      cursor: pointer;
      border-radius: 4px 4px 0 0;
      font-size: 14px;
    }

    .tab.active {
      color: var(--accent-color);
      background: var(--bg-secondary);
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
      width: 40px;
      height: 40px;
      animation: spin 1s linear infinite;
      margin: 0 auto var(--spacing-md);
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .empty-state {
      text-align: center;
      padding: var(--spacing-lg);
      color: var(--text-secondary);
    }

    .domain-tag {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      margin-right: 4px;
    }

    .domain-general { background: #1f77b4; color: white; }
    .domain-development { background: #2ca02c; color: white; }

    .tier-tag {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
    }

    .tier-trivial { background: #95a5a6; color: white; }
    .tier-standard { background: #3498db; color: white; }
    .tier-premium { background: #f39c12; color: white; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Agent Manager Dashboard</h1>
    <button class="refresh-btn" onclick="requestRefresh()">🔄 Refresh</button>
  </div>

  <div class="stats-grid">
    <div class="stat-card">
      <div class="stat-value" id="totalExperts">-</div>
      <div class="stat-label">Total Experts</div>
      <div class="stat-breakdown" id="expertBreakdown"></div>
    </div>
    <div class="stat-card">
      <div class="stat-value" id="totalTeams">-</div>
      <div class="stat-label">Active Teams</div>
      <div class="stat-breakdown" id="teamBreakdown"></div>
    </div>
    <div class="stat-card">
      <div class="stat-value" id="totalMembers">-</div>
      <div class="stat-label">Team Members</div>
    </div>
  </div>

  <div class="section">
    <h2 class="section-title">Quick Actions</h2>
    <div class="card">
      <div class="card-body">
        <div class="actions">
          <button class="btn btn-primary" onclick="createExpert()">
            <span>➕</span> Create Expert
          </button>
          <button class="btn btn-primary" onclick="buildTeam()">
            <span>👥</span> Build Team
          </button>
          <button class="btn" onclick="editAgent()">
            <span>✏️</span> Edit Agent
          </button>
          <button class="btn" onclick="openSettings()">
            <span>⚙️</span> Settings
          </button>
        </div>
      </div>
    </div>
  </div>

  <div class="section">
    <h2 class="section-title">Overview Diagram</h2>
    <div class="card">
      <div class="card-body">
        <div class="diagram-container">
          <div class="mermaid" id="overviewDiagram">Loading diagram...</div>
        </div>
      </div>
    </div>
  </div>

  <div class="section">
    <h2 class="section-title">Team Structure</h2>
    <div class="card">
      <div class="card-body">
        <div class="diagram-container">
          <div class="mermaid" id="teamDiagram">Loading diagram...</div>
        </div>
      </div>
    </div>
  </div>

  <div class="section">
    <h2 class="section-title">Experts</h2>
    <div class="card">
      <div class="card-body" id="expertsList">
        <div class="loading">
          <div class="spinner"></div>
          <p>Loading experts...</p>
        </div>
      </div>
    </div>
  </div>

  <div class="section">
    <h2 class="section-title">Teams</h2>
    <div class="card">
      <div class="card-body" id="teamsList">
        <div class="loading">
          <div class="spinner"></div>
          <p>Loading teams...</p>
        </div>
      </div>
    </div>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    let currentData = null;

    // Initialize Mermaid
    mermaid.initialize({
      startOnLoad: false,
      theme: 'base',
      themeVariables: {
        primaryColor: '#1f77b4',
        primaryTextColor: '#fff',
        primaryBorderColor: '#08519c',
        lineColor: '#7f8c8d',
        secondaryColor: '#2ca02c',
        tertiaryColor: '#34495e',
        background: 'transparent',
        mainBkg: '#34495e',
        nodeBorder: '#2c3e50',
        clusterBkg: '#34495e',
        clusterBorder: '#2c3e50',
        titleColor: '#fff',
        edgeLabelBackground: '#ecf0f1'
      },
      securityLevel: 'loose'
    });

    // Request initial data
    requestRefresh();

    function requestRefresh() {
      vscode.postMessage({ command: 'requestData' });
    }

    // Handle messages from extension
    window.addEventListener('message', async (event) => {
      const message = event.data;

      if (message.command === 'data') {
        currentData = message.data;
        await renderDashboard(message.data);
      }
    });

    async function renderDashboard(data) {
      const { stats, diagrams, experts, teams, config } = data;

      // Update stats
      document.getElementById('totalExperts').textContent = stats.experts.total;
      document.getElementById('totalTeams').textContent = stats.teams.total;
      document.getElementById('totalMembers').textContent = stats.teams.totalMembers;

      // Expert breakdown
      const expertBreakdown = Object.entries(stats.experts.byBackedBy)
        .map(([k, v]) => \`\${k}: \${v}\`)
        .join(' | ');
      document.getElementById('expertBreakdown').textContent = expertBreakdown;

      // Team breakdown
      const teamBreakdown = \`Upper: \${stats.teams.upper} | Lower: \${stats.teams.lower}\`;
      document.getElementById('teamBreakdown').textContent = teamBreakdown;

      // Render diagrams
      await renderMermaidDiagram('overviewDiagram', diagrams.overview);
      await renderMermaidDiagram('teamDiagram', diagrams.teams);

      // Render experts list
      renderExpertsList(experts);

      // Render teams list
      renderTeamsList(teams);
    }

    async function renderMermaidDiagram(elementId, mermaidCode) {
      const element = document.getElementById(elementId);
      try {
        const { svg } = await mermaid.render(\`\${elementId}-svg\`, mermaidCode);
        element.innerHTML = svg;
      } catch (error) {
        element.innerHTML = \`<p>Diagram error: \${error.message}</p>\`;
      }
    }

    function renderExpertsList(experts) {
      const container = document.getElementById('expertsList');

      if (experts.length === 0) {
        container.innerHTML = '<div class="empty-state">No experts configured. Click "Create Expert" to get started.</div>';
        return;
      }

      container.innerHTML = experts.map(expert => \`
        <div class="list-item" onclick="openExpert('\${expert.slug}')">
          <div class="list-item-info">
            <div class="list-item-title">
              \${expert.role}
              <span class="domain-tag domain-\${expert.domain}">\${expert.domain}</span>
              <span class="tier-tag tier-\${expert.tier}">\${expert.tier}</span>
            </div>
            <div class="list-item-desc">\${expert.slug} • \${expert.backed_by}</div>
          </div>
          <div class="list-item-badge">\${expert.capabilities?.length || 0} capabilities</div>
        </div>
      \`).join('');
    }

    function renderTeamsList(teams) {
      const container = document.getElementById('teamsList');

      if (teams.length === 0) {
        container.innerHTML = '<div class="empty-state">No teams configured. Click "Build Team" to get started.</div>';
        return;
      }

      container.innerHTML = teams.map(team => \`
        <div class="list-item" onclick="openTeam('\${team.slug}')">
          <div class="list-item-info">
            <div class="list-item-title">
              \${team.name}
              <span class="list-item-badge">\${team.type}</span>
            </div>
            <div class="list-item-desc">\${team.purpose?.substring(0, 80) || 'No description'}\${team.purpose?.length > 80 ? '...' : ''}</div>
          </div>
          <div class="list-item-badge">\${team.members.length} members</div>
        </div>
      \`).join('');
    }

    function createExpert() {
      vscode.postMessage({ command: 'createExpert' });
    }

    function buildTeam() {
      vscode.postMessage({ command: 'buildTeam' });
    }

    function editAgent() {
      vscode.postMessage({ command: 'editAgent' });
    }

    function openSettings() {
      vscode.postMessage({ command: 'openSettings' });
    }

    function openExpert(slug) {
      vscode.postMessage({ command: 'openExpert', slug });
    }

    function openTeam(slug) {
      vscode.postMessage({ command: 'openTeam', slug });
    }
  </script>
</body>
</html>`;
}
function getDiagramViewerHtml(mermaidCode) {
    const nonce = (0, webview_1.getNonce)();
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline';">
  <title>Diagram Viewer</title>
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js" nonce="${nonce}"></script>
  <style>
    body {
      font-family: var(--vscode-font-family);
      background: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
      margin: 0;
      padding: 20px;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
    }
    .mermaid {
      background: var(--vscode-editor-background);
    }
  </style>
</head>
<body>
  <div class="mermaid">${mermaidCode}</div>
  <script nonce="${nonce}">
    mermaid.initialize({
      startOnLoad: true,
      theme: 'base',
      themeVariables: {
        primaryColor: '#1f77b4',
        primaryTextColor: '#fff',
        primaryBorderColor: '#08519c',
        lineColor: '#7f8c8d',
        secondaryColor: '#2ca02c',
        tertiaryColor: '#34495e',
        background: 'transparent'
      },
      securityLevel: 'loose'
    });
  </script>
</body>
</html>`;
}
// getNonce moved to utils/webview.ts


/***/ }),
/* 1 */
/***/ ((module) => {

module.exports = require("vscode");

/***/ }),
/* 2 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


/**
 * AgentTreeProvider - Tree view provider for Agent Manager sidebar
 *
 * Displays teams, experts, agents, and configuration in a hierarchical tree.
 * Enhanced with context menus, icons, and click handlers.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.AgentTreeProvider = void 0;
exports.registerTreeCommands = registerTreeCommands;
const vscode = __importStar(__webpack_require__(1));
class AgentTreeProvider {
    fileService;
    extensionContext;
    _onDidChangeTreeData = new vscode.EventEmitter();
    onDidChangeTreeData = this._onDidChangeTreeData.event;
    constructor(fileService, extensionContext) {
        this.fileService = fileService;
        this.extensionContext = extensionContext;
    }
    refresh() {
        this._onDidChangeTreeData.fire();
    }
    getTreeItem(element) {
        return element;
    }
    async getChildren(element) {
        if (!element) {
            // Root level items
            return this.getRootItems();
        }
        switch (element.contextValue) {
            case 'teams':
                return this.getTeamItems();
            case 'experts':
                return this.getExpertItems();
            case 'modules':
                return this.getModuleItems();
            case 'config':
                return this.getConfigItems();
            case 'team':
                return this.getTeamMembers(element.metadata?.id);
            default:
                return [];
        }
    }
    async getRootItems() {
        const items = [
            new TreeItem('Teams', vscode.TreeItemCollapsibleState.Collapsed, 'teams', 'account-group', { description: 'All configured teams' }),
            new TreeItem('Experts', vscode.TreeItemCollapsibleState.Collapsed, 'experts', 'symbol-namespace', { description: 'All expert definitions' }),
            new TreeItem('Modules', vscode.TreeItemCollapsibleState.Collapsed, 'modules', 'library', { description: 'Agent modules and components' }),
            new TreeItem('Configuration', vscode.TreeItemCollapsibleState.Collapsed, 'config', 'settings-gear', { description: 'Domain and project settings' })
        ];
        return items;
    }
    async getTeamItems() {
        const result = await this.fileService.listTeams();
        if (!result.success || !result.data || result.data.length === 0) {
            return [
                new TreeItem('No teams configured', vscode.TreeItemCollapsibleState.None, 'empty', 'warning')
            ];
        }
        return result.data.map(team => {
            const icon = team.type === 'upper' ? 'server' : 'server-environment';
            const item = new TreeItem(team.name, vscode.TreeItemCollapsibleState.Collapsed, 'team', icon, {
                description: `${team.members.length} members`,
                tooltip: this.getTeamTooltip(team),
                metadata: { id: team.slug, name: team.name }
            });
            // Add context value for command handling
            item.command = {
                command: 'agentManager.viewTeamDetails',
                title: 'View Team Details',
                arguments: [team.slug]
            };
            return item;
        });
    }
    async getExpertItems() {
        const result = await this.fileService.listExperts();
        if (!result.success || !result.data || result.data.length === 0) {
            return [
                new TreeItem('No experts defined', vscode.TreeItemCollapsibleState.None, 'empty', 'warning')
            ];
        }
        // Group by domain
        const byDomain = result.data.reduce((acc, expert) => {
            if (!acc[expert.domain]) {
                acc[expert.domain] = [];
            }
            acc[expert.domain].push(expert);
            return acc;
        }, {});
        const items = [];
        Object.entries(byDomain).forEach(([domain, experts]) => {
            // Domain folder
            const domainIcon = domain === 'development' ? 'code' : 'globe';
            const domainItem = new TreeItem(domain.charAt(0).toUpperCase() + domain.slice(1), vscode.TreeItemCollapsibleState.Expanded, 'domain-folder', domainIcon, { description: `${experts.length} experts` });
            items.push(domainItem);
            // Add experts for this domain
            experts.forEach(expert => {
                const item = new TreeItem(expert.role, vscode.TreeItemCollapsibleState.None, 'expert', this.getExpertIcon(expert), {
                    description: expert.slug,
                    tooltip: this.getExpertTooltip(expert),
                    metadata: { slug: expert.slug, role: expert.role }
                });
                // Add tier badge
                item.resourceUri = vscode.Uri.parse(`tier://${expert.tier}`);
                // Make clickable
                item.command = {
                    command: 'agentManager.openExpert',
                    title: 'Open Expert',
                    arguments: [expert.slug]
                };
                items.push(item);
            });
        });
        return items;
    }
    async getModuleItems() {
        const modules = [
            {
                name: 'Base',
                desc: 'Role cores',
                icon: 'circle-outline',
                path: 'agent-library/base'
            },
            {
                name: 'Capabilities',
                desc: 'Feature modules',
                icon: 'extensions',
                path: 'agent-library/capabilities'
            },
            {
                name: 'Platforms',
                desc: 'Execution environments',
                icon: 'server',
                path: 'agent-library/platforms'
            },
            {
                name: 'Policies',
                desc: 'Project rules',
                icon: 'file-code',
                path: 'agent-library/policies'
            }
        ];
        return modules.map(mod => new TreeItem(mod.name, vscode.TreeItemCollapsibleState.None, 'module-folder', mod.icon, { description: mod.desc, metadata: { path: mod.path } }));
    }
    async getConfigItems() {
        const config = await this.fileService.readDomainConfig();
        const items = [
            new TreeItem('Domain', vscode.TreeItemCollapsibleState.None, 'config-item', 'globe', {
                description: config.data?.domain || 'Not set',
                metadata: { key: 'domain' }
            }),
            new TreeItem('Project', vscode.TreeItemCollapsibleState.None, 'config-item', 'project', {
                description: config.data?.project_name || 'Not set',
                metadata: { key: 'project' }
            }),
            new TreeItem('Active Packs', vscode.TreeItemCollapsibleState.None, 'config-item', 'package', {
                description: config.data?.active_packs?.length.toString() || '0',
                metadata: { key: 'packs' }
            }),
            new TreeItem('Relay Root', vscode.TreeItemCollapsibleState.None, 'config-item', 'folder-opened', {
                description: this.fileService.getRelayRoot(),
                metadata: { key: 'root' }
            })
        ];
        return items;
    }
    async getTeamMembers(teamId) {
        if (!teamId) {
            return [];
        }
        const result = await this.fileService.readTeam(teamId);
        if (!result.success || !result.data) {
            return [
                new TreeItem('Failed to load team', vscode.TreeItemCollapsibleState.None, 'error', 'error')
            ];
        }
        const team = result.data;
        const items = [];
        // Coordinator
        items.push(new TreeItem(`Coordinator: ${team.coordinator}`, vscode.TreeItemCollapsibleState.None, 'coordinator', 'star-full', {
            description: team.coordinator_model,
            tooltip: `Decision mode: ${team.decision_mode}`
        }));
        // Separator
        items.push(new TreeItem('Members', vscode.TreeItemCollapsibleState.None, 'separator', 'separator'));
        // Team members
        team.members.forEach(member => {
            const icon = member.is_leader ? 'star-full' : 'person';
            const item = new TreeItem(member.role, vscode.TreeItemCollapsibleState.None, 'team-member', icon, {
                description: `${member.expert_slug}${member.is_bridge ? ' 🌉' : ''}`,
                tooltip: this.getMemberTooltip(member),
                metadata: {
                    expertSlug: member.expert_slug,
                    role: member.role,
                    teamSlug: team.slug
                }
            });
            if (member.is_bridge) {
                item.resourceUri = vscode.Uri.parse('bridge://true');
            }
            items.push(item);
        });
        return items;
    }
    // ==========================================================================
    // Tooltip Helpers
    // ==========================================================================
    getTeamTooltip(team) {
        const lines = [
            `**${team.name}**`,
            '',
            `Type: ${team.type}`,
            `Mode: ${team.execution_mode}`,
            `Coordinator: ${team.coordinator} (${team.coordinator_model})`,
            `Decision: ${team.decision_mode}`,
            '',
            `Members: ${team.members.length}`,
            team.purpose ? `Purpose: ${team.purpose}` : ''
        ].filter(Boolean);
        return lines.join('\n');
    }
    getExpertTooltip(expert) {
        const lines = [
            `**${expert.role}**`,
            '',
            `Slug: \`${expert.slug}\``,
            `Domain: ${expert.domain}`,
            `Tier: ${expert.tier}`,
            `Backed by: ${expert.backed_by}`,
            `Permission: ${expert.permission_mode}`,
            '',
            `Capabilities: ${expert.capabilities?.length || 0}`,
            `Phases: ${expert.phases?.join(', ') || 'none'}`
        ];
        if (expert.isolation) {
            lines.push(`Isolation: ${expert.isolation}`);
        }
        return lines.join('\n');
    }
    getMemberTooltip(member) {
        const lines = [
            `**${member.role}**`,
            '',
            `Expert: ${member.expert_slug}`,
            `Tier: ${member.tier}`,
            `Permission: ${member.permission_mode}`
        ];
        if (member.is_leader) {
            lines.push('⭐ Team Leader');
        }
        if (member.is_bridge) {
            lines.push('🌉 Bridge Agent');
        }
        return lines.join('\n');
    }
    getExpertIcon(expert) {
        // Return icon based on backed_by property
        const iconMap = {
            'claude': 'symbol-namespace',
            'codex': 'symbol-interface',
            'gemini': 'symbol-misc',
            'zai': 'symbol-boolean'
        };
        return iconMap[expert.backed_by] || 'symbol-namespace';
    }
}
exports.AgentTreeProvider = AgentTreeProvider;
/**
 * Custom TreeItem with extended metadata support
 */
class TreeItem extends vscode.TreeItem {
    label;
    collapsibleState;
    contextValue;
    metadata;
    constructor(label, collapsibleState, contextValue, iconName, options) {
        super(label, collapsibleState);
        this.label = label;
        this.collapsibleState = collapsibleState;
        this.contextValue = contextValue;
        this.contextValue = contextValue;
        if (iconName) {
            this.iconPath = new vscode.ThemeIcon(iconName);
        }
        if (options?.description) {
            this.description = options.description;
        }
        if (options?.tooltip) {
            this.tooltip = new vscode.MarkdownString(options.tooltip);
        }
        if (options?.metadata) {
            this.metadata = options.metadata;
        }
    }
    withDescription(desc) {
        this.description = desc;
        return this;
    }
}
/**
 * Register all tree item context menu commands
 */
function registerTreeCommands(context, fileService) {
    // Expert context menu
    context.subscriptions.push(vscode.commands.registerCommand('agentManager.openExpert', async (slug) => {
        // Open Expert Manager for editing
        vscode.commands.executeCommand('agentManager.editAgent', slug);
    }));
    // Team context menu
    context.subscriptions.push(vscode.commands.registerCommand('agentManager.viewTeamDetails', async (slug) => {
        vscode.commands.executeCommand('agentManager.viewTeamDiagram', slug);
    }));
    // Create expert from context menu
    context.subscriptions.push(vscode.commands.registerCommand('agentManager.createExpertFromTree', async () => {
        vscode.commands.executeCommand('agentManager.createExpert');
    }));
    // Build team from context menu
    context.subscriptions.push(vscode.commands.registerCommand('agentManager.buildTeamFromTree', async () => {
        vscode.commands.executeCommand('agentManager.buildTeam');
    }));
    // Refresh from context menu
    context.subscriptions.push(vscode.commands.registerCommand('agentManager.refreshFromTree', async () => {
        vscode.commands.executeCommand('agentManager.refreshTree');
    }));
    // Delete expert
    context.subscriptions.push(vscode.commands.registerCommand('agentManager.deleteExpert', async (slug) => {
        const confirmed = await vscode.window.showWarningMessage(`Delete expert "${slug}"? This action cannot be undone.`, 'Delete', 'Cancel');
        if (confirmed === 'Delete') {
            const result = await fileService.deleteExpert(slug);
            if (result.success) {
                vscode.window.showInformationMessage(`Expert "${slug}" deleted.`);
                vscode.commands.executeCommand('agentManager.refreshTree');
            }
            else {
                vscode.window.showErrorMessage(`Failed to delete expert: ${result.error}`);
            }
        }
    }));
    // Delete team
    context.subscriptions.push(vscode.commands.registerCommand('agentManager.deleteTeam', async (slug) => {
        const confirmed = await vscode.window.showWarningMessage(`Delete team "${slug}"? This action cannot be undone.`, 'Delete', 'Cancel');
        if (confirmed === 'Delete') {
            const result = await fileService.deleteTeam(slug);
            if (result.success) {
                vscode.window.showInformationMessage(`Team "${slug}" deleted.`);
                vscode.commands.executeCommand('agentManager.refreshTree');
            }
            else {
                vscode.window.showErrorMessage(`Failed to delete team: ${result.error}`);
            }
        }
    }));
    // Duplicate expert
    context.subscriptions.push(vscode.commands.registerCommand('agentManager.duplicateExpert', async (slug) => {
        const result = await fileService.readExpert(slug);
        if (!result.success || !result.data) {
            vscode.window.showErrorMessage(`Expert not found: ${slug}`);
            return;
        }
        const newSlug = await vscode.window.showInputBox({
            prompt: 'Enter new expert slug',
            placeHolder: `${slug}-copy`,
            value: `${slug}-copy`
        });
        if (!newSlug) {
            return;
        }
        const newExpert = { ...result.data, slug: newSlug, role: `${result.data.role} (Copy)` };
        const createResult = await fileService.createExpert(newExpert);
        if (createResult.success) {
            vscode.window.showInformationMessage(`Expert duplicated as "${newSlug}".`);
            vscode.commands.executeCommand('agentManager.refreshTree');
        }
        else {
            vscode.window.showErrorMessage(`Failed to duplicate expert: ${createResult.error}`);
        }
    }));
    // Open relay folder
    context.subscriptions.push(vscode.commands.registerCommand('agentManager.openRelayFolder', async () => {
        const relayRoot = fileService.getRelayRoot();
        const uri = vscode.Uri.file(relayRoot);
        await vscode.commands.executeCommand('vscode.openFolder', uri, { forceNewWindow: false });
    }));
    // View diagram for expert
    context.subscriptions.push(vscode.commands.registerCommand('agentManager.viewExpertDiagram', async (slug) => {
        vscode.commands.executeCommand('agentManager.viewExpertDiagram', slug);
    }));
}


/***/ }),
/* 3 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


/**
 * FileService - Core file operations for relay-plugin data
 *
 * Handles reading/writing expert definitions, team configurations,
 * agent definitions, and domain config from .claude/relay/ directory.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.fileService = exports.FileService = void 0;
const vscode = __importStar(__webpack_require__(1));
const path = __importStar(__webpack_require__(4));
const fs = __importStar(__webpack_require__(5));
const yaml = __importStar(__webpack_require__(6));
class FileService {
    workspaceRoot;
    relayRoot;
    constructor() {
        this.workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
        this.relayRoot = path.join(this.workspaceRoot, '.claude', 'relay');
    }
    // ==========================================================================
    // Path Helpers
    // ==========================================================================
    getRelayRoot() {
        return this.relayRoot;
    }
    getExpertsDir() {
        return path.join(this.relayRoot, 'experts');
    }
    getTeamsDir() {
        return path.join(this.relayRoot, 'teams');
    }
    getAgentDefinitionsDir() {
        return path.join(this.relayRoot, 'agent-library', 'definitions');
    }
    getDomainConfigPath() {
        return path.join(this.relayRoot, 'domain-config.json');
    }
    // ==========================================================================
    // Expert Operations
    // ==========================================================================
    async listExperts() {
        try {
            const expertsDir = this.getExpertsDir();
            if (!fs.existsSync(expertsDir)) {
                return { success: true, data: [] };
            }
            const files = fs.readdirSync(expertsDir).filter(f => f.endsWith('.md'));
            const experts = [];
            for (const file of files) {
                const filePath = path.join(expertsDir, file);
                const expert = await this.readExpert(path.parse(file).name);
                if (expert.success && expert.data) {
                    experts.push(expert.data);
                }
            }
            return { success: true, data: experts };
        }
        catch (error) {
            return { success: false, error: String(error) };
        }
    }
    async readExpert(slug) {
        try {
            const filePath = path.join(this.getExpertsDir(), `${slug}.md`);
            if (!fs.existsSync(filePath)) {
                return { success: false, error: `Expert not found: ${slug}` };
            }
            const content = fs.readFileSync(filePath, 'utf-8');
            const expert = this.parseExpertMarkdown(content);
            expert.slug = slug;
            return { success: true, data: expert };
        }
        catch (error) {
            return { success: false, error: String(error) };
        }
    }
    async createExpert(expert) {
        try {
            const filePath = path.join(this.getExpertsDir(), `${expert.slug}.md`);
            // Ensure directory exists
            if (!fs.existsSync(this.getExpertsDir())) {
                fs.mkdirSync(this.getExpertsDir(), { recursive: true });
            }
            const content = this.generateExpertMarkdown(expert);
            fs.writeFileSync(filePath, content, 'utf-8');
            return { success: true, data: filePath };
        }
        catch (error) {
            return { success: false, error: String(error) };
        }
    }
    async updateExpert(slug, expert) {
        try {
            const filePath = path.join(this.getExpertsDir(), `${slug}.md`);
            if (!fs.existsSync(filePath)) {
                return { success: false, error: `Expert not found: ${slug}` };
            }
            const content = this.generateExpertMarkdown(expert);
            fs.writeFileSync(filePath, content, 'utf-8');
            return { success: true };
        }
        catch (error) {
            return { success: false, error: String(error) };
        }
    }
    async deleteExpert(slug) {
        try {
            const filePath = path.join(this.getExpertsDir(), `${slug}.md`);
            if (!fs.existsSync(filePath)) {
                return { success: false, error: `Expert not found: ${slug}` };
            }
            fs.unlinkSync(filePath);
            return { success: true };
        }
        catch (error) {
            return { success: false, error: String(error) };
        }
    }
    // ==========================================================================
    // Team Operations
    // ==========================================================================
    async listTeams() {
        try {
            const teamsDir = this.getTeamsDir();
            if (!fs.existsSync(teamsDir)) {
                return { success: true, data: [] };
            }
            const files = fs.readdirSync(teamsDir).filter(f => f.endsWith('.json'));
            const teams = [];
            for (const file of files) {
                const filePath = path.join(teamsDir, file);
                const content = fs.readFileSync(filePath, 'utf-8');
                const team = JSON.parse(content);
                teams.push(team);
            }
            return { success: true, data: teams };
        }
        catch (error) {
            return { success: false, error: String(error) };
        }
    }
    async readTeam(id) {
        try {
            const filePath = path.join(this.getTeamsDir(), `${id}.json`);
            if (!fs.existsSync(filePath)) {
                return { success: false, error: `Team not found: ${id}` };
            }
            const content = fs.readFileSync(filePath, 'utf-8');
            const team = JSON.parse(content);
            return { success: true, data: team };
        }
        catch (error) {
            return { success: false, error: String(error) };
        }
    }
    async createTeam(team) {
        try {
            const filePath = path.join(this.getTeamsDir(), `${team.slug}.json`);
            if (!fs.existsSync(this.getTeamsDir())) {
                fs.mkdirSync(this.getTeamsDir(), { recursive: true });
            }
            fs.writeFileSync(filePath, JSON.stringify(team, null, 2), 'utf-8');
            return { success: true, data: filePath };
        }
        catch (error) {
            return { success: false, error: String(error) };
        }
    }
    async updateTeam(slug, team) {
        try {
            const filePath = path.join(this.getTeamsDir(), `${slug}.json`);
            if (!fs.existsSync(filePath)) {
                return { success: false, error: `Team not found: ${slug}` };
            }
            fs.writeFileSync(filePath, JSON.stringify(team, null, 2), 'utf-8');
            return { success: true };
        }
        catch (error) {
            return { success: false, error: String(error) };
        }
    }
    async deleteTeam(slug) {
        try {
            const filePath = path.join(this.getTeamsDir(), `${slug}.json`);
            if (!fs.existsSync(filePath)) {
                return { success: false, error: `Team not found: ${slug}` };
            }
            fs.unlinkSync(filePath);
            return { success: true };
        }
        catch (error) {
            return { success: false, error: String(error) };
        }
    }
    // ==========================================================================
    // Domain Config Operations
    // ==========================================================================
    async readDomainConfig() {
        try {
            const filePath = this.getDomainConfigPath();
            if (!fs.existsSync(filePath)) {
                return { success: true, data: null };
            }
            const content = fs.readFileSync(filePath, 'utf-8');
            const config = JSON.parse(content);
            return { success: true, data: config };
        }
        catch (error) {
            return { success: false, error: String(error) };
        }
    }
    async writeDomainConfig(config) {
        try {
            const filePath = this.getDomainConfigPath();
            fs.writeFileSync(filePath, JSON.stringify(config, null, 2), 'utf-8');
            return { success: true };
        }
        catch (error) {
            return { success: false, error: String(error) };
        }
    }
    // ==========================================================================
    // Helpers
    // ==========================================================================
    parseExpertMarkdown(content) {
        const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
        if (!frontmatterMatch) {
            throw new Error('No YAML frontmatter found');
        }
        const frontmatter = yaml.parse(frontmatterMatch[1]);
        return {
            role: frontmatter.role || '',
            slug: frontmatter.slug || '',
            domain: frontmatter.domain || 'general',
            backed_by: frontmatter.backed_by || 'claude',
            cli: frontmatter.cli,
            model: frontmatter.model,
            fallback_cli: frontmatter.fallback_cli,
            tier: frontmatter.tier || 'standard',
            permission_mode: frontmatter.permission_mode || 'default',
            memory: frontmatter.memory,
            isolation: frontmatter.isolation,
            phases: frontmatter.phases || [],
            agent_profile: frontmatter.agent_profile,
            default_platform: frontmatter.default_platform,
            persona: '',
            capabilities: [],
            constraints: [],
            created_at: frontmatter.created_at || new Date().toISOString().split('T')[0]
        };
    }
    generateExpertMarkdown(expert) {
        const frontmatter = {
            role: expert.role,
            slug: expert.slug,
            domain: expert.domain,
            backed_by: expert.backed_by,
            cli: expert.cli,
            model: expert.model,
            fallback_cli: expert.fallback_cli,
            tier: expert.tier,
            permission_mode: expert.permission_mode,
            memory: expert.memory,
            isolation: expert.isolation,
            phases: expert.phases,
            agent_profile: expert.agent_profile,
            default_platform: expert.default_platform,
            created_at: expert.created_at
        };
        let content = `---\n${yaml.stringify(frontmatter)}---\n\n`;
        content += `# ${expert.role}\n\n`;
        if (expert.persona) {
            content += `## 페르소나\n\n${expert.persona}\n\n`;
        }
        if (expert.capabilities && expert.capabilities.length > 0) {
            content += `## 역량\n\n`;
            expert.capabilities.forEach(cap => {
                content += `- ${cap}\n`;
            });
            content += '\n';
        }
        if (expert.constraints && expert.constraints.length > 0) {
            content += `## 제약\n\n`;
            expert.constraints.forEach(con => {
                content += `- ${con}\n`;
            });
            content += '\n';
        }
        return content;
    }
}
exports.FileService = FileService;
// Singleton export
exports.fileService = new FileService();


/***/ }),
/* 4 */
/***/ ((module) => {

module.exports = require("path");

/***/ }),
/* 5 */
/***/ ((module) => {

module.exports = require("fs");

/***/ }),
/* 6 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var composer = __webpack_require__(7);
var Document = __webpack_require__(12);
var Schema = __webpack_require__(30);
var errors = __webpack_require__(56);
var Alias = __webpack_require__(13);
var identity = __webpack_require__(10);
var Pair = __webpack_require__(21);
var Scalar = __webpack_require__(20);
var YAMLMap = __webpack_require__(32);
var YAMLSeq = __webpack_require__(35);
var cst = __webpack_require__(72);
var lexer = __webpack_require__(76);
var lineCounter = __webpack_require__(77);
var parser = __webpack_require__(78);
var publicApi = __webpack_require__(79);
var visit = __webpack_require__(11);



exports.Composer = composer.Composer;
exports.Document = Document.Document;
exports.Schema = Schema.Schema;
exports.YAMLError = errors.YAMLError;
exports.YAMLParseError = errors.YAMLParseError;
exports.YAMLWarning = errors.YAMLWarning;
exports.Alias = Alias.Alias;
exports.isAlias = identity.isAlias;
exports.isCollection = identity.isCollection;
exports.isDocument = identity.isDocument;
exports.isMap = identity.isMap;
exports.isNode = identity.isNode;
exports.isPair = identity.isPair;
exports.isScalar = identity.isScalar;
exports.isSeq = identity.isSeq;
exports.Pair = Pair.Pair;
exports.Scalar = Scalar.Scalar;
exports.YAMLMap = YAMLMap.YAMLMap;
exports.YAMLSeq = YAMLSeq.YAMLSeq;
exports.CST = cst;
exports.Lexer = lexer.Lexer;
exports.LineCounter = lineCounter.LineCounter;
exports.Parser = parser.Parser;
exports.parse = publicApi.parse;
exports.parseAllDocuments = publicApi.parseAllDocuments;
exports.parseDocument = publicApi.parseDocument;
exports.stringify = publicApi.stringify;
exports.visit = visit.visit;
exports.visitAsync = visit.visitAsync;


/***/ }),
/* 7 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var node_process = __webpack_require__(8);
var directives = __webpack_require__(9);
var Document = __webpack_require__(12);
var errors = __webpack_require__(56);
var identity = __webpack_require__(10);
var composeDoc = __webpack_require__(57);
var resolveEnd = __webpack_require__(67);

function getErrorPos(src) {
    if (typeof src === 'number')
        return [src, src + 1];
    if (Array.isArray(src))
        return src.length === 2 ? src : [src[0], src[1]];
    const { offset, source } = src;
    return [offset, offset + (typeof source === 'string' ? source.length : 1)];
}
function parsePrelude(prelude) {
    let comment = '';
    let atComment = false;
    let afterEmptyLine = false;
    for (let i = 0; i < prelude.length; ++i) {
        const source = prelude[i];
        switch (source[0]) {
            case '#':
                comment +=
                    (comment === '' ? '' : afterEmptyLine ? '\n\n' : '\n') +
                        (source.substring(1) || ' ');
                atComment = true;
                afterEmptyLine = false;
                break;
            case '%':
                if (prelude[i + 1]?.[0] !== '#')
                    i += 1;
                atComment = false;
                break;
            default:
                // This may be wrong after doc-end, but in that case it doesn't matter
                if (!atComment)
                    afterEmptyLine = true;
                atComment = false;
        }
    }
    return { comment, afterEmptyLine };
}
/**
 * Compose a stream of CST nodes into a stream of YAML Documents.
 *
 * ```ts
 * import { Composer, Parser } from 'yaml'
 *
 * const src: string = ...
 * const tokens = new Parser().parse(src)
 * const docs = new Composer().compose(tokens)
 * ```
 */
class Composer {
    constructor(options = {}) {
        this.doc = null;
        this.atDirectives = false;
        this.prelude = [];
        this.errors = [];
        this.warnings = [];
        this.onError = (source, code, message, warning) => {
            const pos = getErrorPos(source);
            if (warning)
                this.warnings.push(new errors.YAMLWarning(pos, code, message));
            else
                this.errors.push(new errors.YAMLParseError(pos, code, message));
        };
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
        this.directives = new directives.Directives({ version: options.version || '1.2' });
        this.options = options;
    }
    decorate(doc, afterDoc) {
        const { comment, afterEmptyLine } = parsePrelude(this.prelude);
        //console.log({ dc: doc.comment, prelude, comment })
        if (comment) {
            const dc = doc.contents;
            if (afterDoc) {
                doc.comment = doc.comment ? `${doc.comment}\n${comment}` : comment;
            }
            else if (afterEmptyLine || doc.directives.docStart || !dc) {
                doc.commentBefore = comment;
            }
            else if (identity.isCollection(dc) && !dc.flow && dc.items.length > 0) {
                let it = dc.items[0];
                if (identity.isPair(it))
                    it = it.key;
                const cb = it.commentBefore;
                it.commentBefore = cb ? `${comment}\n${cb}` : comment;
            }
            else {
                const cb = dc.commentBefore;
                dc.commentBefore = cb ? `${comment}\n${cb}` : comment;
            }
        }
        if (afterDoc) {
            Array.prototype.push.apply(doc.errors, this.errors);
            Array.prototype.push.apply(doc.warnings, this.warnings);
        }
        else {
            doc.errors = this.errors;
            doc.warnings = this.warnings;
        }
        this.prelude = [];
        this.errors = [];
        this.warnings = [];
    }
    /**
     * Current stream status information.
     *
     * Mostly useful at the end of input for an empty stream.
     */
    streamInfo() {
        return {
            comment: parsePrelude(this.prelude).comment,
            directives: this.directives,
            errors: this.errors,
            warnings: this.warnings
        };
    }
    /**
     * Compose tokens into documents.
     *
     * @param forceDoc - If the stream contains no document, still emit a final document including any comments and directives that would be applied to a subsequent document.
     * @param endOffset - Should be set if `forceDoc` is also set, to set the document range end and to indicate errors correctly.
     */
    *compose(tokens, forceDoc = false, endOffset = -1) {
        for (const token of tokens)
            yield* this.next(token);
        yield* this.end(forceDoc, endOffset);
    }
    /** Advance the composer by one CST token. */
    *next(token) {
        if (node_process.env.LOG_STREAM)
            console.dir(token, { depth: null });
        switch (token.type) {
            case 'directive':
                this.directives.add(token.source, (offset, message, warning) => {
                    const pos = getErrorPos(token);
                    pos[0] += offset;
                    this.onError(pos, 'BAD_DIRECTIVE', message, warning);
                });
                this.prelude.push(token.source);
                this.atDirectives = true;
                break;
            case 'document': {
                const doc = composeDoc.composeDoc(this.options, this.directives, token, this.onError);
                if (this.atDirectives && !doc.directives.docStart)
                    this.onError(token, 'MISSING_CHAR', 'Missing directives-end/doc-start indicator line');
                this.decorate(doc, false);
                if (this.doc)
                    yield this.doc;
                this.doc = doc;
                this.atDirectives = false;
                break;
            }
            case 'byte-order-mark':
            case 'space':
                break;
            case 'comment':
            case 'newline':
                this.prelude.push(token.source);
                break;
            case 'error': {
                const msg = token.source
                    ? `${token.message}: ${JSON.stringify(token.source)}`
                    : token.message;
                const error = new errors.YAMLParseError(getErrorPos(token), 'UNEXPECTED_TOKEN', msg);
                if (this.atDirectives || !this.doc)
                    this.errors.push(error);
                else
                    this.doc.errors.push(error);
                break;
            }
            case 'doc-end': {
                if (!this.doc) {
                    const msg = 'Unexpected doc-end without preceding document';
                    this.errors.push(new errors.YAMLParseError(getErrorPos(token), 'UNEXPECTED_TOKEN', msg));
                    break;
                }
                this.doc.directives.docEnd = true;
                const end = resolveEnd.resolveEnd(token.end, token.offset + token.source.length, this.doc.options.strict, this.onError);
                this.decorate(this.doc, true);
                if (end.comment) {
                    const dc = this.doc.comment;
                    this.doc.comment = dc ? `${dc}\n${end.comment}` : end.comment;
                }
                this.doc.range[2] = end.offset;
                break;
            }
            default:
                this.errors.push(new errors.YAMLParseError(getErrorPos(token), 'UNEXPECTED_TOKEN', `Unsupported token ${token.type}`));
        }
    }
    /**
     * Call at end of input to yield any remaining document.
     *
     * @param forceDoc - If the stream contains no document, still emit a final document including any comments and directives that would be applied to a subsequent document.
     * @param endOffset - Should be set if `forceDoc` is also set, to set the document range end and to indicate errors correctly.
     */
    *end(forceDoc = false, endOffset = -1) {
        if (this.doc) {
            this.decorate(this.doc, true);
            yield this.doc;
            this.doc = null;
        }
        else if (forceDoc) {
            const opts = Object.assign({ _directives: this.directives }, this.options);
            const doc = new Document.Document(undefined, opts);
            if (this.atDirectives)
                this.onError(endOffset, 'MISSING_CHAR', 'Missing directives-end indicator line');
            doc.range = [0, endOffset, endOffset];
            this.decorate(doc, false);
            yield doc;
        }
    }
}

exports.Composer = Composer;


/***/ }),
/* 8 */
/***/ ((module) => {

module.exports = require("process");

/***/ }),
/* 9 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var identity = __webpack_require__(10);
var visit = __webpack_require__(11);

const escapeChars = {
    '!': '%21',
    ',': '%2C',
    '[': '%5B',
    ']': '%5D',
    '{': '%7B',
    '}': '%7D'
};
const escapeTagName = (tn) => tn.replace(/[!,[\]{}]/g, ch => escapeChars[ch]);
class Directives {
    constructor(yaml, tags) {
        /**
         * The directives-end/doc-start marker `---`. If `null`, a marker may still be
         * included in the document's stringified representation.
         */
        this.docStart = null;
        /** The doc-end marker `...`.  */
        this.docEnd = false;
        this.yaml = Object.assign({}, Directives.defaultYaml, yaml);
        this.tags = Object.assign({}, Directives.defaultTags, tags);
    }
    clone() {
        const copy = new Directives(this.yaml, this.tags);
        copy.docStart = this.docStart;
        return copy;
    }
    /**
     * During parsing, get a Directives instance for the current document and
     * update the stream state according to the current version's spec.
     */
    atDocument() {
        const res = new Directives(this.yaml, this.tags);
        switch (this.yaml.version) {
            case '1.1':
                this.atNextDocument = true;
                break;
            case '1.2':
                this.atNextDocument = false;
                this.yaml = {
                    explicit: Directives.defaultYaml.explicit,
                    version: '1.2'
                };
                this.tags = Object.assign({}, Directives.defaultTags);
                break;
        }
        return res;
    }
    /**
     * @param onError - May be called even if the action was successful
     * @returns `true` on success
     */
    add(line, onError) {
        if (this.atNextDocument) {
            this.yaml = { explicit: Directives.defaultYaml.explicit, version: '1.1' };
            this.tags = Object.assign({}, Directives.defaultTags);
            this.atNextDocument = false;
        }
        const parts = line.trim().split(/[ \t]+/);
        const name = parts.shift();
        switch (name) {
            case '%TAG': {
                if (parts.length !== 2) {
                    onError(0, '%TAG directive should contain exactly two parts');
                    if (parts.length < 2)
                        return false;
                }
                const [handle, prefix] = parts;
                this.tags[handle] = prefix;
                return true;
            }
            case '%YAML': {
                this.yaml.explicit = true;
                if (parts.length !== 1) {
                    onError(0, '%YAML directive should contain exactly one part');
                    return false;
                }
                const [version] = parts;
                if (version === '1.1' || version === '1.2') {
                    this.yaml.version = version;
                    return true;
                }
                else {
                    const isValid = /^\d+\.\d+$/.test(version);
                    onError(6, `Unsupported YAML version ${version}`, isValid);
                    return false;
                }
            }
            default:
                onError(0, `Unknown directive ${name}`, true);
                return false;
        }
    }
    /**
     * Resolves a tag, matching handles to those defined in %TAG directives.
     *
     * @returns Resolved tag, which may also be the non-specific tag `'!'` or a
     *   `'!local'` tag, or `null` if unresolvable.
     */
    tagName(source, onError) {
        if (source === '!')
            return '!'; // non-specific tag
        if (source[0] !== '!') {
            onError(`Not a valid tag: ${source}`);
            return null;
        }
        if (source[1] === '<') {
            const verbatim = source.slice(2, -1);
            if (verbatim === '!' || verbatim === '!!') {
                onError(`Verbatim tags aren't resolved, so ${source} is invalid.`);
                return null;
            }
            if (source[source.length - 1] !== '>')
                onError('Verbatim tags must end with a >');
            return verbatim;
        }
        const [, handle, suffix] = source.match(/^(.*!)([^!]*)$/s);
        if (!suffix)
            onError(`The ${source} tag has no suffix`);
        const prefix = this.tags[handle];
        if (prefix) {
            try {
                return prefix + decodeURIComponent(suffix);
            }
            catch (error) {
                onError(String(error));
                return null;
            }
        }
        if (handle === '!')
            return source; // local tag
        onError(`Could not resolve tag: ${source}`);
        return null;
    }
    /**
     * Given a fully resolved tag, returns its printable string form,
     * taking into account current tag prefixes and defaults.
     */
    tagString(tag) {
        for (const [handle, prefix] of Object.entries(this.tags)) {
            if (tag.startsWith(prefix))
                return handle + escapeTagName(tag.substring(prefix.length));
        }
        return tag[0] === '!' ? tag : `!<${tag}>`;
    }
    toString(doc) {
        const lines = this.yaml.explicit
            ? [`%YAML ${this.yaml.version || '1.2'}`]
            : [];
        const tagEntries = Object.entries(this.tags);
        let tagNames;
        if (doc && tagEntries.length > 0 && identity.isNode(doc.contents)) {
            const tags = {};
            visit.visit(doc.contents, (_key, node) => {
                if (identity.isNode(node) && node.tag)
                    tags[node.tag] = true;
            });
            tagNames = Object.keys(tags);
        }
        else
            tagNames = [];
        for (const [handle, prefix] of tagEntries) {
            if (handle === '!!' && prefix === 'tag:yaml.org,2002:')
                continue;
            if (!doc || tagNames.some(tn => tn.startsWith(prefix)))
                lines.push(`%TAG ${handle} ${prefix}`);
        }
        return lines.join('\n');
    }
}
Directives.defaultYaml = { explicit: false, version: '1.2' };
Directives.defaultTags = { '!!': 'tag:yaml.org,2002:' };

exports.Directives = Directives;


/***/ }),
/* 10 */
/***/ ((__unused_webpack_module, exports) => {



const ALIAS = Symbol.for('yaml.alias');
const DOC = Symbol.for('yaml.document');
const MAP = Symbol.for('yaml.map');
const PAIR = Symbol.for('yaml.pair');
const SCALAR = Symbol.for('yaml.scalar');
const SEQ = Symbol.for('yaml.seq');
const NODE_TYPE = Symbol.for('yaml.node.type');
const isAlias = (node) => !!node && typeof node === 'object' && node[NODE_TYPE] === ALIAS;
const isDocument = (node) => !!node && typeof node === 'object' && node[NODE_TYPE] === DOC;
const isMap = (node) => !!node && typeof node === 'object' && node[NODE_TYPE] === MAP;
const isPair = (node) => !!node && typeof node === 'object' && node[NODE_TYPE] === PAIR;
const isScalar = (node) => !!node && typeof node === 'object' && node[NODE_TYPE] === SCALAR;
const isSeq = (node) => !!node && typeof node === 'object' && node[NODE_TYPE] === SEQ;
function isCollection(node) {
    if (node && typeof node === 'object')
        switch (node[NODE_TYPE]) {
            case MAP:
            case SEQ:
                return true;
        }
    return false;
}
function isNode(node) {
    if (node && typeof node === 'object')
        switch (node[NODE_TYPE]) {
            case ALIAS:
            case MAP:
            case SCALAR:
            case SEQ:
                return true;
        }
    return false;
}
const hasAnchor = (node) => (isScalar(node) || isCollection(node)) && !!node.anchor;

exports.ALIAS = ALIAS;
exports.DOC = DOC;
exports.MAP = MAP;
exports.NODE_TYPE = NODE_TYPE;
exports.PAIR = PAIR;
exports.SCALAR = SCALAR;
exports.SEQ = SEQ;
exports.hasAnchor = hasAnchor;
exports.isAlias = isAlias;
exports.isCollection = isCollection;
exports.isDocument = isDocument;
exports.isMap = isMap;
exports.isNode = isNode;
exports.isPair = isPair;
exports.isScalar = isScalar;
exports.isSeq = isSeq;


/***/ }),
/* 11 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var identity = __webpack_require__(10);

const BREAK = Symbol('break visit');
const SKIP = Symbol('skip children');
const REMOVE = Symbol('remove node');
/**
 * Apply a visitor to an AST node or document.
 *
 * Walks through the tree (depth-first) starting from `node`, calling a
 * `visitor` function with three arguments:
 *   - `key`: For sequence values and map `Pair`, the node's index in the
 *     collection. Within a `Pair`, `'key'` or `'value'`, correspondingly.
 *     `null` for the root node.
 *   - `node`: The current node.
 *   - `path`: The ancestry of the current node.
 *
 * The return value of the visitor may be used to control the traversal:
 *   - `undefined` (default): Do nothing and continue
 *   - `visit.SKIP`: Do not visit the children of this node, continue with next
 *     sibling
 *   - `visit.BREAK`: Terminate traversal completely
 *   - `visit.REMOVE`: Remove the current node, then continue with the next one
 *   - `Node`: Replace the current node, then continue by visiting it
 *   - `number`: While iterating the items of a sequence or map, set the index
 *     of the next step. This is useful especially if the index of the current
 *     node has changed.
 *
 * If `visitor` is a single function, it will be called with all values
 * encountered in the tree, including e.g. `null` values. Alternatively,
 * separate visitor functions may be defined for each `Map`, `Pair`, `Seq`,
 * `Alias` and `Scalar` node. To define the same visitor function for more than
 * one node type, use the `Collection` (map and seq), `Value` (map, seq & scalar)
 * and `Node` (alias, map, seq & scalar) targets. Of all these, only the most
 * specific defined one will be used for each node.
 */
function visit(node, visitor) {
    const visitor_ = initVisitor(visitor);
    if (identity.isDocument(node)) {
        const cd = visit_(null, node.contents, visitor_, Object.freeze([node]));
        if (cd === REMOVE)
            node.contents = null;
    }
    else
        visit_(null, node, visitor_, Object.freeze([]));
}
// Without the `as symbol` casts, TS declares these in the `visit`
// namespace using `var`, but then complains about that because
// `unique symbol` must be `const`.
/** Terminate visit traversal completely */
visit.BREAK = BREAK;
/** Do not visit the children of the current node */
visit.SKIP = SKIP;
/** Remove the current node */
visit.REMOVE = REMOVE;
function visit_(key, node, visitor, path) {
    const ctrl = callVisitor(key, node, visitor, path);
    if (identity.isNode(ctrl) || identity.isPair(ctrl)) {
        replaceNode(key, path, ctrl);
        return visit_(key, ctrl, visitor, path);
    }
    if (typeof ctrl !== 'symbol') {
        if (identity.isCollection(node)) {
            path = Object.freeze(path.concat(node));
            for (let i = 0; i < node.items.length; ++i) {
                const ci = visit_(i, node.items[i], visitor, path);
                if (typeof ci === 'number')
                    i = ci - 1;
                else if (ci === BREAK)
                    return BREAK;
                else if (ci === REMOVE) {
                    node.items.splice(i, 1);
                    i -= 1;
                }
            }
        }
        else if (identity.isPair(node)) {
            path = Object.freeze(path.concat(node));
            const ck = visit_('key', node.key, visitor, path);
            if (ck === BREAK)
                return BREAK;
            else if (ck === REMOVE)
                node.key = null;
            const cv = visit_('value', node.value, visitor, path);
            if (cv === BREAK)
                return BREAK;
            else if (cv === REMOVE)
                node.value = null;
        }
    }
    return ctrl;
}
/**
 * Apply an async visitor to an AST node or document.
 *
 * Walks through the tree (depth-first) starting from `node`, calling a
 * `visitor` function with three arguments:
 *   - `key`: For sequence values and map `Pair`, the node's index in the
 *     collection. Within a `Pair`, `'key'` or `'value'`, correspondingly.
 *     `null` for the root node.
 *   - `node`: The current node.
 *   - `path`: The ancestry of the current node.
 *
 * The return value of the visitor may be used to control the traversal:
 *   - `Promise`: Must resolve to one of the following values
 *   - `undefined` (default): Do nothing and continue
 *   - `visit.SKIP`: Do not visit the children of this node, continue with next
 *     sibling
 *   - `visit.BREAK`: Terminate traversal completely
 *   - `visit.REMOVE`: Remove the current node, then continue with the next one
 *   - `Node`: Replace the current node, then continue by visiting it
 *   - `number`: While iterating the items of a sequence or map, set the index
 *     of the next step. This is useful especially if the index of the current
 *     node has changed.
 *
 * If `visitor` is a single function, it will be called with all values
 * encountered in the tree, including e.g. `null` values. Alternatively,
 * separate visitor functions may be defined for each `Map`, `Pair`, `Seq`,
 * `Alias` and `Scalar` node. To define the same visitor function for more than
 * one node type, use the `Collection` (map and seq), `Value` (map, seq & scalar)
 * and `Node` (alias, map, seq & scalar) targets. Of all these, only the most
 * specific defined one will be used for each node.
 */
async function visitAsync(node, visitor) {
    const visitor_ = initVisitor(visitor);
    if (identity.isDocument(node)) {
        const cd = await visitAsync_(null, node.contents, visitor_, Object.freeze([node]));
        if (cd === REMOVE)
            node.contents = null;
    }
    else
        await visitAsync_(null, node, visitor_, Object.freeze([]));
}
// Without the `as symbol` casts, TS declares these in the `visit`
// namespace using `var`, but then complains about that because
// `unique symbol` must be `const`.
/** Terminate visit traversal completely */
visitAsync.BREAK = BREAK;
/** Do not visit the children of the current node */
visitAsync.SKIP = SKIP;
/** Remove the current node */
visitAsync.REMOVE = REMOVE;
async function visitAsync_(key, node, visitor, path) {
    const ctrl = await callVisitor(key, node, visitor, path);
    if (identity.isNode(ctrl) || identity.isPair(ctrl)) {
        replaceNode(key, path, ctrl);
        return visitAsync_(key, ctrl, visitor, path);
    }
    if (typeof ctrl !== 'symbol') {
        if (identity.isCollection(node)) {
            path = Object.freeze(path.concat(node));
            for (let i = 0; i < node.items.length; ++i) {
                const ci = await visitAsync_(i, node.items[i], visitor, path);
                if (typeof ci === 'number')
                    i = ci - 1;
                else if (ci === BREAK)
                    return BREAK;
                else if (ci === REMOVE) {
                    node.items.splice(i, 1);
                    i -= 1;
                }
            }
        }
        else if (identity.isPair(node)) {
            path = Object.freeze(path.concat(node));
            const ck = await visitAsync_('key', node.key, visitor, path);
            if (ck === BREAK)
                return BREAK;
            else if (ck === REMOVE)
                node.key = null;
            const cv = await visitAsync_('value', node.value, visitor, path);
            if (cv === BREAK)
                return BREAK;
            else if (cv === REMOVE)
                node.value = null;
        }
    }
    return ctrl;
}
function initVisitor(visitor) {
    if (typeof visitor === 'object' &&
        (visitor.Collection || visitor.Node || visitor.Value)) {
        return Object.assign({
            Alias: visitor.Node,
            Map: visitor.Node,
            Scalar: visitor.Node,
            Seq: visitor.Node
        }, visitor.Value && {
            Map: visitor.Value,
            Scalar: visitor.Value,
            Seq: visitor.Value
        }, visitor.Collection && {
            Map: visitor.Collection,
            Seq: visitor.Collection
        }, visitor);
    }
    return visitor;
}
function callVisitor(key, node, visitor, path) {
    if (typeof visitor === 'function')
        return visitor(key, node, path);
    if (identity.isMap(node))
        return visitor.Map?.(key, node, path);
    if (identity.isSeq(node))
        return visitor.Seq?.(key, node, path);
    if (identity.isPair(node))
        return visitor.Pair?.(key, node, path);
    if (identity.isScalar(node))
        return visitor.Scalar?.(key, node, path);
    if (identity.isAlias(node))
        return visitor.Alias?.(key, node, path);
    return undefined;
}
function replaceNode(key, path, node) {
    const parent = path[path.length - 1];
    if (identity.isCollection(parent)) {
        parent.items[key] = node;
    }
    else if (identity.isPair(parent)) {
        if (key === 'key')
            parent.key = node;
        else
            parent.value = node;
    }
    else if (identity.isDocument(parent)) {
        parent.contents = node;
    }
    else {
        const pt = identity.isAlias(parent) ? 'alias' : 'scalar';
        throw new Error(`Cannot replace node with ${pt} parent`);
    }
}

exports.visit = visit;
exports.visitAsync = visitAsync;


/***/ }),
/* 12 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var Alias = __webpack_require__(13);
var Collection = __webpack_require__(18);
var identity = __webpack_require__(10);
var Pair = __webpack_require__(21);
var toJS = __webpack_require__(17);
var Schema = __webpack_require__(30);
var stringifyDocument = __webpack_require__(55);
var anchors = __webpack_require__(14);
var applyReviver = __webpack_require__(16);
var createNode = __webpack_require__(19);
var directives = __webpack_require__(9);

class Document {
    constructor(value, replacer, options) {
        /** A comment before this Document */
        this.commentBefore = null;
        /** A comment immediately after this Document */
        this.comment = null;
        /** Errors encountered during parsing. */
        this.errors = [];
        /** Warnings encountered during parsing. */
        this.warnings = [];
        Object.defineProperty(this, identity.NODE_TYPE, { value: identity.DOC });
        let _replacer = null;
        if (typeof replacer === 'function' || Array.isArray(replacer)) {
            _replacer = replacer;
        }
        else if (options === undefined && replacer) {
            options = replacer;
            replacer = undefined;
        }
        const opt = Object.assign({
            intAsBigInt: false,
            keepSourceTokens: false,
            logLevel: 'warn',
            prettyErrors: true,
            strict: true,
            stringKeys: false,
            uniqueKeys: true,
            version: '1.2'
        }, options);
        this.options = opt;
        let { version } = opt;
        if (options?._directives) {
            this.directives = options._directives.atDocument();
            if (this.directives.yaml.explicit)
                version = this.directives.yaml.version;
        }
        else
            this.directives = new directives.Directives({ version });
        this.setSchema(version, options);
        // @ts-expect-error We can't really know that this matches Contents.
        this.contents =
            value === undefined ? null : this.createNode(value, _replacer, options);
    }
    /**
     * Create a deep copy of this Document and its contents.
     *
     * Custom Node values that inherit from `Object` still refer to their original instances.
     */
    clone() {
        const copy = Object.create(Document.prototype, {
            [identity.NODE_TYPE]: { value: identity.DOC }
        });
        copy.commentBefore = this.commentBefore;
        copy.comment = this.comment;
        copy.errors = this.errors.slice();
        copy.warnings = this.warnings.slice();
        copy.options = Object.assign({}, this.options);
        if (this.directives)
            copy.directives = this.directives.clone();
        copy.schema = this.schema.clone();
        // @ts-expect-error We can't really know that this matches Contents.
        copy.contents = identity.isNode(this.contents)
            ? this.contents.clone(copy.schema)
            : this.contents;
        if (this.range)
            copy.range = this.range.slice();
        return copy;
    }
    /** Adds a value to the document. */
    add(value) {
        if (assertCollection(this.contents))
            this.contents.add(value);
    }
    /** Adds a value to the document. */
    addIn(path, value) {
        if (assertCollection(this.contents))
            this.contents.addIn(path, value);
    }
    /**
     * Create a new `Alias` node, ensuring that the target `node` has the required anchor.
     *
     * If `node` already has an anchor, `name` is ignored.
     * Otherwise, the `node.anchor` value will be set to `name`,
     * or if an anchor with that name is already present in the document,
     * `name` will be used as a prefix for a new unique anchor.
     * If `name` is undefined, the generated anchor will use 'a' as a prefix.
     */
    createAlias(node, name) {
        if (!node.anchor) {
            const prev = anchors.anchorNames(this);
            node.anchor =
                // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
                !name || prev.has(name) ? anchors.findNewAnchor(name || 'a', prev) : name;
        }
        return new Alias.Alias(node.anchor);
    }
    createNode(value, replacer, options) {
        let _replacer = undefined;
        if (typeof replacer === 'function') {
            value = replacer.call({ '': value }, '', value);
            _replacer = replacer;
        }
        else if (Array.isArray(replacer)) {
            const keyToStr = (v) => typeof v === 'number' || v instanceof String || v instanceof Number;
            const asStr = replacer.filter(keyToStr).map(String);
            if (asStr.length > 0)
                replacer = replacer.concat(asStr);
            _replacer = replacer;
        }
        else if (options === undefined && replacer) {
            options = replacer;
            replacer = undefined;
        }
        const { aliasDuplicateObjects, anchorPrefix, flow, keepUndefined, onTagObj, tag } = options ?? {};
        const { onAnchor, setAnchors, sourceObjects } = anchors.createNodeAnchors(this, 
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
        anchorPrefix || 'a');
        const ctx = {
            aliasDuplicateObjects: aliasDuplicateObjects ?? true,
            keepUndefined: keepUndefined ?? false,
            onAnchor,
            onTagObj,
            replacer: _replacer,
            schema: this.schema,
            sourceObjects
        };
        const node = createNode.createNode(value, tag, ctx);
        if (flow && identity.isCollection(node))
            node.flow = true;
        setAnchors();
        return node;
    }
    /**
     * Convert a key and a value into a `Pair` using the current schema,
     * recursively wrapping all values as `Scalar` or `Collection` nodes.
     */
    createPair(key, value, options = {}) {
        const k = this.createNode(key, null, options);
        const v = this.createNode(value, null, options);
        return new Pair.Pair(k, v);
    }
    /**
     * Removes a value from the document.
     * @returns `true` if the item was found and removed.
     */
    delete(key) {
        return assertCollection(this.contents) ? this.contents.delete(key) : false;
    }
    /**
     * Removes a value from the document.
     * @returns `true` if the item was found and removed.
     */
    deleteIn(path) {
        if (Collection.isEmptyPath(path)) {
            if (this.contents == null)
                return false;
            // @ts-expect-error Presumed impossible if Strict extends false
            this.contents = null;
            return true;
        }
        return assertCollection(this.contents)
            ? this.contents.deleteIn(path)
            : false;
    }
    /**
     * Returns item at `key`, or `undefined` if not found. By default unwraps
     * scalar values from their surrounding node; to disable set `keepScalar` to
     * `true` (collections are always returned intact).
     */
    get(key, keepScalar) {
        return identity.isCollection(this.contents)
            ? this.contents.get(key, keepScalar)
            : undefined;
    }
    /**
     * Returns item at `path`, or `undefined` if not found. By default unwraps
     * scalar values from their surrounding node; to disable set `keepScalar` to
     * `true` (collections are always returned intact).
     */
    getIn(path, keepScalar) {
        if (Collection.isEmptyPath(path))
            return !keepScalar && identity.isScalar(this.contents)
                ? this.contents.value
                : this.contents;
        return identity.isCollection(this.contents)
            ? this.contents.getIn(path, keepScalar)
            : undefined;
    }
    /**
     * Checks if the document includes a value with the key `key`.
     */
    has(key) {
        return identity.isCollection(this.contents) ? this.contents.has(key) : false;
    }
    /**
     * Checks if the document includes a value at `path`.
     */
    hasIn(path) {
        if (Collection.isEmptyPath(path))
            return this.contents !== undefined;
        return identity.isCollection(this.contents) ? this.contents.hasIn(path) : false;
    }
    /**
     * Sets a value in this document. For `!!set`, `value` needs to be a
     * boolean to add/remove the item from the set.
     */
    set(key, value) {
        if (this.contents == null) {
            // @ts-expect-error We can't really know that this matches Contents.
            this.contents = Collection.collectionFromPath(this.schema, [key], value);
        }
        else if (assertCollection(this.contents)) {
            this.contents.set(key, value);
        }
    }
    /**
     * Sets a value in this document. For `!!set`, `value` needs to be a
     * boolean to add/remove the item from the set.
     */
    setIn(path, value) {
        if (Collection.isEmptyPath(path)) {
            // @ts-expect-error We can't really know that this matches Contents.
            this.contents = value;
        }
        else if (this.contents == null) {
            // @ts-expect-error We can't really know that this matches Contents.
            this.contents = Collection.collectionFromPath(this.schema, Array.from(path), value);
        }
        else if (assertCollection(this.contents)) {
            this.contents.setIn(path, value);
        }
    }
    /**
     * Change the YAML version and schema used by the document.
     * A `null` version disables support for directives, explicit tags, anchors, and aliases.
     * It also requires the `schema` option to be given as a `Schema` instance value.
     *
     * Overrides all previously set schema options.
     */
    setSchema(version, options = {}) {
        if (typeof version === 'number')
            version = String(version);
        let opt;
        switch (version) {
            case '1.1':
                if (this.directives)
                    this.directives.yaml.version = '1.1';
                else
                    this.directives = new directives.Directives({ version: '1.1' });
                opt = { resolveKnownTags: false, schema: 'yaml-1.1' };
                break;
            case '1.2':
            case 'next':
                if (this.directives)
                    this.directives.yaml.version = version;
                else
                    this.directives = new directives.Directives({ version });
                opt = { resolveKnownTags: true, schema: 'core' };
                break;
            case null:
                if (this.directives)
                    delete this.directives;
                opt = null;
                break;
            default: {
                const sv = JSON.stringify(version);
                throw new Error(`Expected '1.1', '1.2' or null as first argument, but found: ${sv}`);
            }
        }
        // Not using `instanceof Schema` to allow for duck typing
        if (options.schema instanceof Object)
            this.schema = options.schema;
        else if (opt)
            this.schema = new Schema.Schema(Object.assign(opt, options));
        else
            throw new Error(`With a null YAML version, the { schema: Schema } option is required`);
    }
    // json & jsonArg are only used from toJSON()
    toJS({ json, jsonArg, mapAsMap, maxAliasCount, onAnchor, reviver } = {}) {
        const ctx = {
            anchors: new Map(),
            doc: this,
            keep: !json,
            mapAsMap: mapAsMap === true,
            mapKeyWarned: false,
            maxAliasCount: typeof maxAliasCount === 'number' ? maxAliasCount : 100
        };
        const res = toJS.toJS(this.contents, jsonArg ?? '', ctx);
        if (typeof onAnchor === 'function')
            for (const { count, res } of ctx.anchors.values())
                onAnchor(res, count);
        return typeof reviver === 'function'
            ? applyReviver.applyReviver(reviver, { '': res }, '', res)
            : res;
    }
    /**
     * A JSON representation of the document `contents`.
     *
     * @param jsonArg Used by `JSON.stringify` to indicate the array index or
     *   property name.
     */
    toJSON(jsonArg, onAnchor) {
        return this.toJS({ json: true, jsonArg, mapAsMap: false, onAnchor });
    }
    /** A YAML representation of the document. */
    toString(options = {}) {
        if (this.errors.length > 0)
            throw new Error('Document with errors cannot be stringified');
        if ('indent' in options &&
            (!Number.isInteger(options.indent) || Number(options.indent) <= 0)) {
            const s = JSON.stringify(options.indent);
            throw new Error(`"indent" option must be a positive integer, not ${s}`);
        }
        return stringifyDocument.stringifyDocument(this, options);
    }
}
function assertCollection(contents) {
    if (identity.isCollection(contents))
        return true;
    throw new Error('Expected a YAML collection as document contents');
}

exports.Document = Document;


/***/ }),
/* 13 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var anchors = __webpack_require__(14);
var visit = __webpack_require__(11);
var identity = __webpack_require__(10);
var Node = __webpack_require__(15);
var toJS = __webpack_require__(17);

class Alias extends Node.NodeBase {
    constructor(source) {
        super(identity.ALIAS);
        this.source = source;
        Object.defineProperty(this, 'tag', {
            set() {
                throw new Error('Alias nodes cannot have tags');
            }
        });
    }
    /**
     * Resolve the value of this alias within `doc`, finding the last
     * instance of the `source` anchor before this node.
     */
    resolve(doc, ctx) {
        let nodes;
        if (ctx?.aliasResolveCache) {
            nodes = ctx.aliasResolveCache;
        }
        else {
            nodes = [];
            visit.visit(doc, {
                Node: (_key, node) => {
                    if (identity.isAlias(node) || identity.hasAnchor(node))
                        nodes.push(node);
                }
            });
            if (ctx)
                ctx.aliasResolveCache = nodes;
        }
        let found = undefined;
        for (const node of nodes) {
            if (node === this)
                break;
            if (node.anchor === this.source)
                found = node;
        }
        return found;
    }
    toJSON(_arg, ctx) {
        if (!ctx)
            return { source: this.source };
        const { anchors, doc, maxAliasCount } = ctx;
        const source = this.resolve(doc, ctx);
        if (!source) {
            const msg = `Unresolved alias (the anchor must be set before the alias): ${this.source}`;
            throw new ReferenceError(msg);
        }
        let data = anchors.get(source);
        if (!data) {
            // Resolve anchors for Node.prototype.toJS()
            toJS.toJS(source, null, ctx);
            data = anchors.get(source);
        }
        /* istanbul ignore if */
        if (data?.res === undefined) {
            const msg = 'This should not happen: Alias anchor was not resolved?';
            throw new ReferenceError(msg);
        }
        if (maxAliasCount >= 0) {
            data.count += 1;
            if (data.aliasCount === 0)
                data.aliasCount = getAliasCount(doc, source, anchors);
            if (data.count * data.aliasCount > maxAliasCount) {
                const msg = 'Excessive alias count indicates a resource exhaustion attack';
                throw new ReferenceError(msg);
            }
        }
        return data.res;
    }
    toString(ctx, _onComment, _onChompKeep) {
        const src = `*${this.source}`;
        if (ctx) {
            anchors.anchorIsValid(this.source);
            if (ctx.options.verifyAliasOrder && !ctx.anchors.has(this.source)) {
                const msg = `Unresolved alias (the anchor must be set before the alias): ${this.source}`;
                throw new Error(msg);
            }
            if (ctx.implicitKey)
                return `${src} `;
        }
        return src;
    }
}
function getAliasCount(doc, node, anchors) {
    if (identity.isAlias(node)) {
        const source = node.resolve(doc);
        const anchor = anchors && source && anchors.get(source);
        return anchor ? anchor.count * anchor.aliasCount : 0;
    }
    else if (identity.isCollection(node)) {
        let count = 0;
        for (const item of node.items) {
            const c = getAliasCount(doc, item, anchors);
            if (c > count)
                count = c;
        }
        return count;
    }
    else if (identity.isPair(node)) {
        const kc = getAliasCount(doc, node.key, anchors);
        const vc = getAliasCount(doc, node.value, anchors);
        return Math.max(kc, vc);
    }
    return 1;
}

exports.Alias = Alias;


/***/ }),
/* 14 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var identity = __webpack_require__(10);
var visit = __webpack_require__(11);

/**
 * Verify that the input string is a valid anchor.
 *
 * Will throw on errors.
 */
function anchorIsValid(anchor) {
    if (/[\x00-\x19\s,[\]{}]/.test(anchor)) {
        const sa = JSON.stringify(anchor);
        const msg = `Anchor must not contain whitespace or control characters: ${sa}`;
        throw new Error(msg);
    }
    return true;
}
function anchorNames(root) {
    const anchors = new Set();
    visit.visit(root, {
        Value(_key, node) {
            if (node.anchor)
                anchors.add(node.anchor);
        }
    });
    return anchors;
}
/** Find a new anchor name with the given `prefix` and a one-indexed suffix. */
function findNewAnchor(prefix, exclude) {
    for (let i = 1; true; ++i) {
        const name = `${prefix}${i}`;
        if (!exclude.has(name))
            return name;
    }
}
function createNodeAnchors(doc, prefix) {
    const aliasObjects = [];
    const sourceObjects = new Map();
    let prevAnchors = null;
    return {
        onAnchor: (source) => {
            aliasObjects.push(source);
            prevAnchors ?? (prevAnchors = anchorNames(doc));
            const anchor = findNewAnchor(prefix, prevAnchors);
            prevAnchors.add(anchor);
            return anchor;
        },
        /**
         * With circular references, the source node is only resolved after all
         * of its child nodes are. This is why anchors are set only after all of
         * the nodes have been created.
         */
        setAnchors: () => {
            for (const source of aliasObjects) {
                const ref = sourceObjects.get(source);
                if (typeof ref === 'object' &&
                    ref.anchor &&
                    (identity.isScalar(ref.node) || identity.isCollection(ref.node))) {
                    ref.node.anchor = ref.anchor;
                }
                else {
                    const error = new Error('Failed to resolve repeated object (this should not happen)');
                    error.source = source;
                    throw error;
                }
            }
        },
        sourceObjects
    };
}

exports.anchorIsValid = anchorIsValid;
exports.anchorNames = anchorNames;
exports.createNodeAnchors = createNodeAnchors;
exports.findNewAnchor = findNewAnchor;


/***/ }),
/* 15 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var applyReviver = __webpack_require__(16);
var identity = __webpack_require__(10);
var toJS = __webpack_require__(17);

class NodeBase {
    constructor(type) {
        Object.defineProperty(this, identity.NODE_TYPE, { value: type });
    }
    /** Create a copy of this node.  */
    clone() {
        const copy = Object.create(Object.getPrototypeOf(this), Object.getOwnPropertyDescriptors(this));
        if (this.range)
            copy.range = this.range.slice();
        return copy;
    }
    /** A plain JavaScript representation of this node. */
    toJS(doc, { mapAsMap, maxAliasCount, onAnchor, reviver } = {}) {
        if (!identity.isDocument(doc))
            throw new TypeError('A document argument is required');
        const ctx = {
            anchors: new Map(),
            doc,
            keep: true,
            mapAsMap: mapAsMap === true,
            mapKeyWarned: false,
            maxAliasCount: typeof maxAliasCount === 'number' ? maxAliasCount : 100
        };
        const res = toJS.toJS(this, '', ctx);
        if (typeof onAnchor === 'function')
            for (const { count, res } of ctx.anchors.values())
                onAnchor(res, count);
        return typeof reviver === 'function'
            ? applyReviver.applyReviver(reviver, { '': res }, '', res)
            : res;
    }
}

exports.NodeBase = NodeBase;


/***/ }),
/* 16 */
/***/ ((__unused_webpack_module, exports) => {



/**
 * Applies the JSON.parse reviver algorithm as defined in the ECMA-262 spec,
 * in section 24.5.1.1 "Runtime Semantics: InternalizeJSONProperty" of the
 * 2021 edition: https://tc39.es/ecma262/#sec-json.parse
 *
 * Includes extensions for handling Map and Set objects.
 */
function applyReviver(reviver, obj, key, val) {
    if (val && typeof val === 'object') {
        if (Array.isArray(val)) {
            for (let i = 0, len = val.length; i < len; ++i) {
                const v0 = val[i];
                const v1 = applyReviver(reviver, val, String(i), v0);
                // eslint-disable-next-line @typescript-eslint/no-array-delete
                if (v1 === undefined)
                    delete val[i];
                else if (v1 !== v0)
                    val[i] = v1;
            }
        }
        else if (val instanceof Map) {
            for (const k of Array.from(val.keys())) {
                const v0 = val.get(k);
                const v1 = applyReviver(reviver, val, k, v0);
                if (v1 === undefined)
                    val.delete(k);
                else if (v1 !== v0)
                    val.set(k, v1);
            }
        }
        else if (val instanceof Set) {
            for (const v0 of Array.from(val)) {
                const v1 = applyReviver(reviver, val, v0, v0);
                if (v1 === undefined)
                    val.delete(v0);
                else if (v1 !== v0) {
                    val.delete(v0);
                    val.add(v1);
                }
            }
        }
        else {
            for (const [k, v0] of Object.entries(val)) {
                const v1 = applyReviver(reviver, val, k, v0);
                if (v1 === undefined)
                    delete val[k];
                else if (v1 !== v0)
                    val[k] = v1;
            }
        }
    }
    return reviver.call(obj, key, val);
}

exports.applyReviver = applyReviver;


/***/ }),
/* 17 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var identity = __webpack_require__(10);

/**
 * Recursively convert any node or its contents to native JavaScript
 *
 * @param value - The input value
 * @param arg - If `value` defines a `toJSON()` method, use this
 *   as its first argument
 * @param ctx - Conversion context, originally set in Document#toJS(). If
 *   `{ keep: true }` is not set, output should be suitable for JSON
 *   stringification.
 */
function toJS(value, arg, ctx) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    if (Array.isArray(value))
        return value.map((v, i) => toJS(v, String(i), ctx));
    if (value && typeof value.toJSON === 'function') {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        if (!ctx || !identity.hasAnchor(value))
            return value.toJSON(arg, ctx);
        const data = { aliasCount: 0, count: 1, res: undefined };
        ctx.anchors.set(value, data);
        ctx.onCreate = res => {
            data.res = res;
            delete ctx.onCreate;
        };
        const res = value.toJSON(arg, ctx);
        if (ctx.onCreate)
            ctx.onCreate(res);
        return res;
    }
    if (typeof value === 'bigint' && !ctx?.keep)
        return Number(value);
    return value;
}

exports.toJS = toJS;


/***/ }),
/* 18 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var createNode = __webpack_require__(19);
var identity = __webpack_require__(10);
var Node = __webpack_require__(15);

function collectionFromPath(schema, path, value) {
    let v = value;
    for (let i = path.length - 1; i >= 0; --i) {
        const k = path[i];
        if (typeof k === 'number' && Number.isInteger(k) && k >= 0) {
            const a = [];
            a[k] = v;
            v = a;
        }
        else {
            v = new Map([[k, v]]);
        }
    }
    return createNode.createNode(v, undefined, {
        aliasDuplicateObjects: false,
        keepUndefined: false,
        onAnchor: () => {
            throw new Error('This should not happen, please report a bug.');
        },
        schema,
        sourceObjects: new Map()
    });
}
// Type guard is intentionally a little wrong so as to be more useful,
// as it does not cover untypable empty non-string iterables (e.g. []).
const isEmptyPath = (path) => path == null ||
    (typeof path === 'object' && !!path[Symbol.iterator]().next().done);
class Collection extends Node.NodeBase {
    constructor(type, schema) {
        super(type);
        Object.defineProperty(this, 'schema', {
            value: schema,
            configurable: true,
            enumerable: false,
            writable: true
        });
    }
    /**
     * Create a copy of this collection.
     *
     * @param schema - If defined, overwrites the original's schema
     */
    clone(schema) {
        const copy = Object.create(Object.getPrototypeOf(this), Object.getOwnPropertyDescriptors(this));
        if (schema)
            copy.schema = schema;
        copy.items = copy.items.map(it => identity.isNode(it) || identity.isPair(it) ? it.clone(schema) : it);
        if (this.range)
            copy.range = this.range.slice();
        return copy;
    }
    /**
     * Adds a value to the collection. For `!!map` and `!!omap` the value must
     * be a Pair instance or a `{ key, value }` object, which may not have a key
     * that already exists in the map.
     */
    addIn(path, value) {
        if (isEmptyPath(path))
            this.add(value);
        else {
            const [key, ...rest] = path;
            const node = this.get(key, true);
            if (identity.isCollection(node))
                node.addIn(rest, value);
            else if (node === undefined && this.schema)
                this.set(key, collectionFromPath(this.schema, rest, value));
            else
                throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
        }
    }
    /**
     * Removes a value from the collection.
     * @returns `true` if the item was found and removed.
     */
    deleteIn(path) {
        const [key, ...rest] = path;
        if (rest.length === 0)
            return this.delete(key);
        const node = this.get(key, true);
        if (identity.isCollection(node))
            return node.deleteIn(rest);
        else
            throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
    }
    /**
     * Returns item at `key`, or `undefined` if not found. By default unwraps
     * scalar values from their surrounding node; to disable set `keepScalar` to
     * `true` (collections are always returned intact).
     */
    getIn(path, keepScalar) {
        const [key, ...rest] = path;
        const node = this.get(key, true);
        if (rest.length === 0)
            return !keepScalar && identity.isScalar(node) ? node.value : node;
        else
            return identity.isCollection(node) ? node.getIn(rest, keepScalar) : undefined;
    }
    hasAllNullValues(allowScalar) {
        return this.items.every(node => {
            if (!identity.isPair(node))
                return false;
            const n = node.value;
            return (n == null ||
                (allowScalar &&
                    identity.isScalar(n) &&
                    n.value == null &&
                    !n.commentBefore &&
                    !n.comment &&
                    !n.tag));
        });
    }
    /**
     * Checks if the collection includes a value with the key `key`.
     */
    hasIn(path) {
        const [key, ...rest] = path;
        if (rest.length === 0)
            return this.has(key);
        const node = this.get(key, true);
        return identity.isCollection(node) ? node.hasIn(rest) : false;
    }
    /**
     * Sets a value in this collection. For `!!set`, `value` needs to be a
     * boolean to add/remove the item from the set.
     */
    setIn(path, value) {
        const [key, ...rest] = path;
        if (rest.length === 0) {
            this.set(key, value);
        }
        else {
            const node = this.get(key, true);
            if (identity.isCollection(node))
                node.setIn(rest, value);
            else if (node === undefined && this.schema)
                this.set(key, collectionFromPath(this.schema, rest, value));
            else
                throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
        }
    }
}

exports.Collection = Collection;
exports.collectionFromPath = collectionFromPath;
exports.isEmptyPath = isEmptyPath;


/***/ }),
/* 19 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var Alias = __webpack_require__(13);
var identity = __webpack_require__(10);
var Scalar = __webpack_require__(20);

const defaultTagPrefix = 'tag:yaml.org,2002:';
function findTagObject(value, tagName, tags) {
    if (tagName) {
        const match = tags.filter(t => t.tag === tagName);
        const tagObj = match.find(t => !t.format) ?? match[0];
        if (!tagObj)
            throw new Error(`Tag ${tagName} not found`);
        return tagObj;
    }
    return tags.find(t => t.identify?.(value) && !t.format);
}
function createNode(value, tagName, ctx) {
    if (identity.isDocument(value))
        value = value.contents;
    if (identity.isNode(value))
        return value;
    if (identity.isPair(value)) {
        const map = ctx.schema[identity.MAP].createNode?.(ctx.schema, null, ctx);
        map.items.push(value);
        return map;
    }
    if (value instanceof String ||
        value instanceof Number ||
        value instanceof Boolean ||
        (typeof BigInt !== 'undefined' && value instanceof BigInt) // not supported everywhere
    ) {
        // https://tc39.es/ecma262/#sec-serializejsonproperty
        value = value.valueOf();
    }
    const { aliasDuplicateObjects, onAnchor, onTagObj, schema, sourceObjects } = ctx;
    // Detect duplicate references to the same object & use Alias nodes for all
    // after first. The `ref` wrapper allows for circular references to resolve.
    let ref = undefined;
    if (aliasDuplicateObjects && value && typeof value === 'object') {
        ref = sourceObjects.get(value);
        if (ref) {
            ref.anchor ?? (ref.anchor = onAnchor(value));
            return new Alias.Alias(ref.anchor);
        }
        else {
            ref = { anchor: null, node: null };
            sourceObjects.set(value, ref);
        }
    }
    if (tagName?.startsWith('!!'))
        tagName = defaultTagPrefix + tagName.slice(2);
    let tagObj = findTagObject(value, tagName, schema.tags);
    if (!tagObj) {
        if (value && typeof value.toJSON === 'function') {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            value = value.toJSON();
        }
        if (!value || typeof value !== 'object') {
            const node = new Scalar.Scalar(value);
            if (ref)
                ref.node = node;
            return node;
        }
        tagObj =
            value instanceof Map
                ? schema[identity.MAP]
                : Symbol.iterator in Object(value)
                    ? schema[identity.SEQ]
                    : schema[identity.MAP];
    }
    if (onTagObj) {
        onTagObj(tagObj);
        delete ctx.onTagObj;
    }
    const node = tagObj?.createNode
        ? tagObj.createNode(ctx.schema, value, ctx)
        : typeof tagObj?.nodeClass?.from === 'function'
            ? tagObj.nodeClass.from(ctx.schema, value, ctx)
            : new Scalar.Scalar(value);
    if (tagName)
        node.tag = tagName;
    else if (!tagObj.default)
        node.tag = tagObj.tag;
    if (ref)
        ref.node = node;
    return node;
}

exports.createNode = createNode;


/***/ }),
/* 20 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var identity = __webpack_require__(10);
var Node = __webpack_require__(15);
var toJS = __webpack_require__(17);

const isScalarValue = (value) => !value || (typeof value !== 'function' && typeof value !== 'object');
class Scalar extends Node.NodeBase {
    constructor(value) {
        super(identity.SCALAR);
        this.value = value;
    }
    toJSON(arg, ctx) {
        return ctx?.keep ? this.value : toJS.toJS(this.value, arg, ctx);
    }
    toString() {
        return String(this.value);
    }
}
Scalar.BLOCK_FOLDED = 'BLOCK_FOLDED';
Scalar.BLOCK_LITERAL = 'BLOCK_LITERAL';
Scalar.PLAIN = 'PLAIN';
Scalar.QUOTE_DOUBLE = 'QUOTE_DOUBLE';
Scalar.QUOTE_SINGLE = 'QUOTE_SINGLE';

exports.Scalar = Scalar;
exports.isScalarValue = isScalarValue;


/***/ }),
/* 21 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var createNode = __webpack_require__(19);
var stringifyPair = __webpack_require__(22);
var addPairToJSMap = __webpack_require__(27);
var identity = __webpack_require__(10);

function createPair(key, value, ctx) {
    const k = createNode.createNode(key, undefined, ctx);
    const v = createNode.createNode(value, undefined, ctx);
    return new Pair(k, v);
}
class Pair {
    constructor(key, value = null) {
        Object.defineProperty(this, identity.NODE_TYPE, { value: identity.PAIR });
        this.key = key;
        this.value = value;
    }
    clone(schema) {
        let { key, value } = this;
        if (identity.isNode(key))
            key = key.clone(schema);
        if (identity.isNode(value))
            value = value.clone(schema);
        return new Pair(key, value);
    }
    toJSON(_, ctx) {
        const pair = ctx?.mapAsMap ? new Map() : {};
        return addPairToJSMap.addPairToJSMap(ctx, pair, this);
    }
    toString(ctx, onComment, onChompKeep) {
        return ctx?.doc
            ? stringifyPair.stringifyPair(this, ctx, onComment, onChompKeep)
            : JSON.stringify(this);
    }
}

exports.Pair = Pair;
exports.createPair = createPair;


/***/ }),
/* 22 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var identity = __webpack_require__(10);
var Scalar = __webpack_require__(20);
var stringify = __webpack_require__(23);
var stringifyComment = __webpack_require__(24);

function stringifyPair({ key, value }, ctx, onComment, onChompKeep) {
    const { allNullValues, doc, indent, indentStep, options: { commentString, indentSeq, simpleKeys } } = ctx;
    let keyComment = (identity.isNode(key) && key.comment) || null;
    if (simpleKeys) {
        if (keyComment) {
            throw new Error('With simple keys, key nodes cannot have comments');
        }
        if (identity.isCollection(key) || (!identity.isNode(key) && typeof key === 'object')) {
            const msg = 'With simple keys, collection cannot be used as a key value';
            throw new Error(msg);
        }
    }
    let explicitKey = !simpleKeys &&
        (!key ||
            (keyComment && value == null && !ctx.inFlow) ||
            identity.isCollection(key) ||
            (identity.isScalar(key)
                ? key.type === Scalar.Scalar.BLOCK_FOLDED || key.type === Scalar.Scalar.BLOCK_LITERAL
                : typeof key === 'object'));
    ctx = Object.assign({}, ctx, {
        allNullValues: false,
        implicitKey: !explicitKey && (simpleKeys || !allNullValues),
        indent: indent + indentStep
    });
    let keyCommentDone = false;
    let chompKeep = false;
    let str = stringify.stringify(key, ctx, () => (keyCommentDone = true), () => (chompKeep = true));
    if (!explicitKey && !ctx.inFlow && str.length > 1024) {
        if (simpleKeys)
            throw new Error('With simple keys, single line scalar must not span more than 1024 characters');
        explicitKey = true;
    }
    if (ctx.inFlow) {
        if (allNullValues || value == null) {
            if (keyCommentDone && onComment)
                onComment();
            return str === '' ? '?' : explicitKey ? `? ${str}` : str;
        }
    }
    else if ((allNullValues && !simpleKeys) || (value == null && explicitKey)) {
        str = `? ${str}`;
        if (keyComment && !keyCommentDone) {
            str += stringifyComment.lineComment(str, ctx.indent, commentString(keyComment));
        }
        else if (chompKeep && onChompKeep)
            onChompKeep();
        return str;
    }
    if (keyCommentDone)
        keyComment = null;
    if (explicitKey) {
        if (keyComment)
            str += stringifyComment.lineComment(str, ctx.indent, commentString(keyComment));
        str = `? ${str}\n${indent}:`;
    }
    else {
        str = `${str}:`;
        if (keyComment)
            str += stringifyComment.lineComment(str, ctx.indent, commentString(keyComment));
    }
    let vsb, vcb, valueComment;
    if (identity.isNode(value)) {
        vsb = !!value.spaceBefore;
        vcb = value.commentBefore;
        valueComment = value.comment;
    }
    else {
        vsb = false;
        vcb = null;
        valueComment = null;
        if (value && typeof value === 'object')
            value = doc.createNode(value);
    }
    ctx.implicitKey = false;
    if (!explicitKey && !keyComment && identity.isScalar(value))
        ctx.indentAtStart = str.length + 1;
    chompKeep = false;
    if (!indentSeq &&
        indentStep.length >= 2 &&
        !ctx.inFlow &&
        !explicitKey &&
        identity.isSeq(value) &&
        !value.flow &&
        !value.tag &&
        !value.anchor) {
        // If indentSeq === false, consider '- ' as part of indentation where possible
        ctx.indent = ctx.indent.substring(2);
    }
    let valueCommentDone = false;
    const valueStr = stringify.stringify(value, ctx, () => (valueCommentDone = true), () => (chompKeep = true));
    let ws = ' ';
    if (keyComment || vsb || vcb) {
        ws = vsb ? '\n' : '';
        if (vcb) {
            const cs = commentString(vcb);
            ws += `\n${stringifyComment.indentComment(cs, ctx.indent)}`;
        }
        if (valueStr === '' && !ctx.inFlow) {
            if (ws === '\n' && valueComment)
                ws = '\n\n';
        }
        else {
            ws += `\n${ctx.indent}`;
        }
    }
    else if (!explicitKey && identity.isCollection(value)) {
        const vs0 = valueStr[0];
        const nl0 = valueStr.indexOf('\n');
        const hasNewline = nl0 !== -1;
        const flow = ctx.inFlow ?? value.flow ?? value.items.length === 0;
        if (hasNewline || !flow) {
            let hasPropsLine = false;
            if (hasNewline && (vs0 === '&' || vs0 === '!')) {
                let sp0 = valueStr.indexOf(' ');
                if (vs0 === '&' &&
                    sp0 !== -1 &&
                    sp0 < nl0 &&
                    valueStr[sp0 + 1] === '!') {
                    sp0 = valueStr.indexOf(' ', sp0 + 1);
                }
                if (sp0 === -1 || nl0 < sp0)
                    hasPropsLine = true;
            }
            if (!hasPropsLine)
                ws = `\n${ctx.indent}`;
        }
    }
    else if (valueStr === '' || valueStr[0] === '\n') {
        ws = '';
    }
    str += ws + valueStr;
    if (ctx.inFlow) {
        if (valueCommentDone && onComment)
            onComment();
    }
    else if (valueComment && !valueCommentDone) {
        str += stringifyComment.lineComment(str, ctx.indent, commentString(valueComment));
    }
    else if (chompKeep && onChompKeep) {
        onChompKeep();
    }
    return str;
}

exports.stringifyPair = stringifyPair;


/***/ }),
/* 23 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var anchors = __webpack_require__(14);
var identity = __webpack_require__(10);
var stringifyComment = __webpack_require__(24);
var stringifyString = __webpack_require__(25);

function createStringifyContext(doc, options) {
    const opt = Object.assign({
        blockQuote: true,
        commentString: stringifyComment.stringifyComment,
        defaultKeyType: null,
        defaultStringType: 'PLAIN',
        directives: null,
        doubleQuotedAsJSON: false,
        doubleQuotedMinMultiLineLength: 40,
        falseStr: 'false',
        flowCollectionPadding: true,
        indentSeq: true,
        lineWidth: 80,
        minContentWidth: 20,
        nullStr: 'null',
        simpleKeys: false,
        singleQuote: null,
        trailingComma: false,
        trueStr: 'true',
        verifyAliasOrder: true
    }, doc.schema.toStringOptions, options);
    let inFlow;
    switch (opt.collectionStyle) {
        case 'block':
            inFlow = false;
            break;
        case 'flow':
            inFlow = true;
            break;
        default:
            inFlow = null;
    }
    return {
        anchors: new Set(),
        doc,
        flowCollectionPadding: opt.flowCollectionPadding ? ' ' : '',
        indent: '',
        indentStep: typeof opt.indent === 'number' ? ' '.repeat(opt.indent) : '  ',
        inFlow,
        options: opt
    };
}
function getTagObject(tags, item) {
    if (item.tag) {
        const match = tags.filter(t => t.tag === item.tag);
        if (match.length > 0)
            return match.find(t => t.format === item.format) ?? match[0];
    }
    let tagObj = undefined;
    let obj;
    if (identity.isScalar(item)) {
        obj = item.value;
        let match = tags.filter(t => t.identify?.(obj));
        if (match.length > 1) {
            const testMatch = match.filter(t => t.test);
            if (testMatch.length > 0)
                match = testMatch;
        }
        tagObj =
            match.find(t => t.format === item.format) ?? match.find(t => !t.format);
    }
    else {
        obj = item;
        tagObj = tags.find(t => t.nodeClass && obj instanceof t.nodeClass);
    }
    if (!tagObj) {
        const name = obj?.constructor?.name ?? (obj === null ? 'null' : typeof obj);
        throw new Error(`Tag not resolved for ${name} value`);
    }
    return tagObj;
}
// needs to be called before value stringifier to allow for circular anchor refs
function stringifyProps(node, tagObj, { anchors: anchors$1, doc }) {
    if (!doc.directives)
        return '';
    const props = [];
    const anchor = (identity.isScalar(node) || identity.isCollection(node)) && node.anchor;
    if (anchor && anchors.anchorIsValid(anchor)) {
        anchors$1.add(anchor);
        props.push(`&${anchor}`);
    }
    const tag = node.tag ?? (tagObj.default ? null : tagObj.tag);
    if (tag)
        props.push(doc.directives.tagString(tag));
    return props.join(' ');
}
function stringify(item, ctx, onComment, onChompKeep) {
    if (identity.isPair(item))
        return item.toString(ctx, onComment, onChompKeep);
    if (identity.isAlias(item)) {
        if (ctx.doc.directives)
            return item.toString(ctx);
        if (ctx.resolvedAliases?.has(item)) {
            throw new TypeError(`Cannot stringify circular structure without alias nodes`);
        }
        else {
            if (ctx.resolvedAliases)
                ctx.resolvedAliases.add(item);
            else
                ctx.resolvedAliases = new Set([item]);
            item = item.resolve(ctx.doc);
        }
    }
    let tagObj = undefined;
    const node = identity.isNode(item)
        ? item
        : ctx.doc.createNode(item, { onTagObj: o => (tagObj = o) });
    tagObj ?? (tagObj = getTagObject(ctx.doc.schema.tags, node));
    const props = stringifyProps(node, tagObj, ctx);
    if (props.length > 0)
        ctx.indentAtStart = (ctx.indentAtStart ?? 0) + props.length + 1;
    const str = typeof tagObj.stringify === 'function'
        ? tagObj.stringify(node, ctx, onComment, onChompKeep)
        : identity.isScalar(node)
            ? stringifyString.stringifyString(node, ctx, onComment, onChompKeep)
            : node.toString(ctx, onComment, onChompKeep);
    if (!props)
        return str;
    return identity.isScalar(node) || str[0] === '{' || str[0] === '['
        ? `${props} ${str}`
        : `${props}\n${ctx.indent}${str}`;
}

exports.createStringifyContext = createStringifyContext;
exports.stringify = stringify;


/***/ }),
/* 24 */
/***/ ((__unused_webpack_module, exports) => {



/**
 * Stringifies a comment.
 *
 * Empty comment lines are left empty,
 * lines consisting of a single space are replaced by `#`,
 * and all other lines are prefixed with a `#`.
 */
const stringifyComment = (str) => str.replace(/^(?!$)(?: $)?/gm, '#');
function indentComment(comment, indent) {
    if (/^\n+$/.test(comment))
        return comment.substring(1);
    return indent ? comment.replace(/^(?! *$)/gm, indent) : comment;
}
const lineComment = (str, indent, comment) => str.endsWith('\n')
    ? indentComment(comment, indent)
    : comment.includes('\n')
        ? '\n' + indentComment(comment, indent)
        : (str.endsWith(' ') ? '' : ' ') + comment;

exports.indentComment = indentComment;
exports.lineComment = lineComment;
exports.stringifyComment = stringifyComment;


/***/ }),
/* 25 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var Scalar = __webpack_require__(20);
var foldFlowLines = __webpack_require__(26);

const getFoldOptions = (ctx, isBlock) => ({
    indentAtStart: isBlock ? ctx.indent.length : ctx.indentAtStart,
    lineWidth: ctx.options.lineWidth,
    minContentWidth: ctx.options.minContentWidth
});
// Also checks for lines starting with %, as parsing the output as YAML 1.1 will
// presume that's starting a new document.
const containsDocumentMarker = (str) => /^(%|---|\.\.\.)/m.test(str);
function lineLengthOverLimit(str, lineWidth, indentLength) {
    if (!lineWidth || lineWidth < 0)
        return false;
    const limit = lineWidth - indentLength;
    const strLen = str.length;
    if (strLen <= limit)
        return false;
    for (let i = 0, start = 0; i < strLen; ++i) {
        if (str[i] === '\n') {
            if (i - start > limit)
                return true;
            start = i + 1;
            if (strLen - start <= limit)
                return false;
        }
    }
    return true;
}
function doubleQuotedString(value, ctx) {
    const json = JSON.stringify(value);
    if (ctx.options.doubleQuotedAsJSON)
        return json;
    const { implicitKey } = ctx;
    const minMultiLineLength = ctx.options.doubleQuotedMinMultiLineLength;
    const indent = ctx.indent || (containsDocumentMarker(value) ? '  ' : '');
    let str = '';
    let start = 0;
    for (let i = 0, ch = json[i]; ch; ch = json[++i]) {
        if (ch === ' ' && json[i + 1] === '\\' && json[i + 2] === 'n') {
            // space before newline needs to be escaped to not be folded
            str += json.slice(start, i) + '\\ ';
            i += 1;
            start = i;
            ch = '\\';
        }
        if (ch === '\\')
            switch (json[i + 1]) {
                case 'u':
                    {
                        str += json.slice(start, i);
                        const code = json.substr(i + 2, 4);
                        switch (code) {
                            case '0000':
                                str += '\\0';
                                break;
                            case '0007':
                                str += '\\a';
                                break;
                            case '000b':
                                str += '\\v';
                                break;
                            case '001b':
                                str += '\\e';
                                break;
                            case '0085':
                                str += '\\N';
                                break;
                            case '00a0':
                                str += '\\_';
                                break;
                            case '2028':
                                str += '\\L';
                                break;
                            case '2029':
                                str += '\\P';
                                break;
                            default:
                                if (code.substr(0, 2) === '00')
                                    str += '\\x' + code.substr(2);
                                else
                                    str += json.substr(i, 6);
                        }
                        i += 5;
                        start = i + 1;
                    }
                    break;
                case 'n':
                    if (implicitKey ||
                        json[i + 2] === '"' ||
                        json.length < minMultiLineLength) {
                        i += 1;
                    }
                    else {
                        // folding will eat first newline
                        str += json.slice(start, i) + '\n\n';
                        while (json[i + 2] === '\\' &&
                            json[i + 3] === 'n' &&
                            json[i + 4] !== '"') {
                            str += '\n';
                            i += 2;
                        }
                        str += indent;
                        // space after newline needs to be escaped to not be folded
                        if (json[i + 2] === ' ')
                            str += '\\';
                        i += 1;
                        start = i + 1;
                    }
                    break;
                default:
                    i += 1;
            }
    }
    str = start ? str + json.slice(start) : json;
    return implicitKey
        ? str
        : foldFlowLines.foldFlowLines(str, indent, foldFlowLines.FOLD_QUOTED, getFoldOptions(ctx, false));
}
function singleQuotedString(value, ctx) {
    if (ctx.options.singleQuote === false ||
        (ctx.implicitKey && value.includes('\n')) ||
        /[ \t]\n|\n[ \t]/.test(value) // single quoted string can't have leading or trailing whitespace around newline
    )
        return doubleQuotedString(value, ctx);
    const indent = ctx.indent || (containsDocumentMarker(value) ? '  ' : '');
    const res = "'" + value.replace(/'/g, "''").replace(/\n+/g, `$&\n${indent}`) + "'";
    return ctx.implicitKey
        ? res
        : foldFlowLines.foldFlowLines(res, indent, foldFlowLines.FOLD_FLOW, getFoldOptions(ctx, false));
}
function quotedString(value, ctx) {
    const { singleQuote } = ctx.options;
    let qs;
    if (singleQuote === false)
        qs = doubleQuotedString;
    else {
        const hasDouble = value.includes('"');
        const hasSingle = value.includes("'");
        if (hasDouble && !hasSingle)
            qs = singleQuotedString;
        else if (hasSingle && !hasDouble)
            qs = doubleQuotedString;
        else
            qs = singleQuote ? singleQuotedString : doubleQuotedString;
    }
    return qs(value, ctx);
}
// The negative lookbehind avoids a polynomial search,
// but isn't supported yet on Safari: https://caniuse.com/js-regexp-lookbehind
let blockEndNewlines;
try {
    blockEndNewlines = new RegExp('(^|(?<!\n))\n+(?!\n|$)', 'g');
}
catch {
    blockEndNewlines = /\n+(?!\n|$)/g;
}
function blockString({ comment, type, value }, ctx, onComment, onChompKeep) {
    const { blockQuote, commentString, lineWidth } = ctx.options;
    // 1. Block can't end in whitespace unless the last line is non-empty.
    // 2. Strings consisting of only whitespace are best rendered explicitly.
    if (!blockQuote || /\n[\t ]+$/.test(value)) {
        return quotedString(value, ctx);
    }
    const indent = ctx.indent ||
        (ctx.forceBlockIndent || containsDocumentMarker(value) ? '  ' : '');
    const literal = blockQuote === 'literal'
        ? true
        : blockQuote === 'folded' || type === Scalar.Scalar.BLOCK_FOLDED
            ? false
            : type === Scalar.Scalar.BLOCK_LITERAL
                ? true
                : !lineLengthOverLimit(value, lineWidth, indent.length);
    if (!value)
        return literal ? '|\n' : '>\n';
    // determine chomping from whitespace at value end
    let chomp;
    let endStart;
    for (endStart = value.length; endStart > 0; --endStart) {
        const ch = value[endStart - 1];
        if (ch !== '\n' && ch !== '\t' && ch !== ' ')
            break;
    }
    let end = value.substring(endStart);
    const endNlPos = end.indexOf('\n');
    if (endNlPos === -1) {
        chomp = '-'; // strip
    }
    else if (value === end || endNlPos !== end.length - 1) {
        chomp = '+'; // keep
        if (onChompKeep)
            onChompKeep();
    }
    else {
        chomp = ''; // clip
    }
    if (end) {
        value = value.slice(0, -end.length);
        if (end[end.length - 1] === '\n')
            end = end.slice(0, -1);
        end = end.replace(blockEndNewlines, `$&${indent}`);
    }
    // determine indent indicator from whitespace at value start
    let startWithSpace = false;
    let startEnd;
    let startNlPos = -1;
    for (startEnd = 0; startEnd < value.length; ++startEnd) {
        const ch = value[startEnd];
        if (ch === ' ')
            startWithSpace = true;
        else if (ch === '\n')
            startNlPos = startEnd;
        else
            break;
    }
    let start = value.substring(0, startNlPos < startEnd ? startNlPos + 1 : startEnd);
    if (start) {
        value = value.substring(start.length);
        start = start.replace(/\n+/g, `$&${indent}`);
    }
    const indentSize = indent ? '2' : '1'; // root is at -1
    // Leading | or > is added later
    let header = (startWithSpace ? indentSize : '') + chomp;
    if (comment) {
        header += ' ' + commentString(comment.replace(/ ?[\r\n]+/g, ' '));
        if (onComment)
            onComment();
    }
    if (!literal) {
        const foldedValue = value
            .replace(/\n+/g, '\n$&')
            .replace(/(?:^|\n)([\t ].*)(?:([\n\t ]*)\n(?![\n\t ]))?/g, '$1$2') // more-indented lines aren't folded
            //                ^ more-ind. ^ empty     ^ capture next empty lines only at end of indent
            .replace(/\n+/g, `$&${indent}`);
        let literalFallback = false;
        const foldOptions = getFoldOptions(ctx, true);
        if (blockQuote !== 'folded' && type !== Scalar.Scalar.BLOCK_FOLDED) {
            foldOptions.onOverflow = () => {
                literalFallback = true;
            };
        }
        const body = foldFlowLines.foldFlowLines(`${start}${foldedValue}${end}`, indent, foldFlowLines.FOLD_BLOCK, foldOptions);
        if (!literalFallback)
            return `>${header}\n${indent}${body}`;
    }
    value = value.replace(/\n+/g, `$&${indent}`);
    return `|${header}\n${indent}${start}${value}${end}`;
}
function plainString(item, ctx, onComment, onChompKeep) {
    const { type, value } = item;
    const { actualString, implicitKey, indent, indentStep, inFlow } = ctx;
    if ((implicitKey && value.includes('\n')) ||
        (inFlow && /[[\]{},]/.test(value))) {
        return quotedString(value, ctx);
    }
    if (/^[\n\t ,[\]{}#&*!|>'"%@`]|^[?-]$|^[?-][ \t]|[\n:][ \t]|[ \t]\n|[\n\t ]#|[\n\t :]$/.test(value)) {
        // not allowed:
        // - '-' or '?'
        // - start with an indicator character (except [?:-]) or /[?-] /
        // - '\n ', ': ' or ' \n' anywhere
        // - '#' not preceded by a non-space char
        // - end with ' ' or ':'
        return implicitKey || inFlow || !value.includes('\n')
            ? quotedString(value, ctx)
            : blockString(item, ctx, onComment, onChompKeep);
    }
    if (!implicitKey &&
        !inFlow &&
        type !== Scalar.Scalar.PLAIN &&
        value.includes('\n')) {
        // Where allowed & type not set explicitly, prefer block style for multiline strings
        return blockString(item, ctx, onComment, onChompKeep);
    }
    if (containsDocumentMarker(value)) {
        if (indent === '') {
            ctx.forceBlockIndent = true;
            return blockString(item, ctx, onComment, onChompKeep);
        }
        else if (implicitKey && indent === indentStep) {
            return quotedString(value, ctx);
        }
    }
    const str = value.replace(/\n+/g, `$&\n${indent}`);
    // Verify that output will be parsed as a string, as e.g. plain numbers and
    // booleans get parsed with those types in v1.2 (e.g. '42', 'true' & '0.9e-3'),
    // and others in v1.1.
    if (actualString) {
        const test = (tag) => tag.default && tag.tag !== 'tag:yaml.org,2002:str' && tag.test?.test(str);
        const { compat, tags } = ctx.doc.schema;
        if (tags.some(test) || compat?.some(test))
            return quotedString(value, ctx);
    }
    return implicitKey
        ? str
        : foldFlowLines.foldFlowLines(str, indent, foldFlowLines.FOLD_FLOW, getFoldOptions(ctx, false));
}
function stringifyString(item, ctx, onComment, onChompKeep) {
    const { implicitKey, inFlow } = ctx;
    const ss = typeof item.value === 'string'
        ? item
        : Object.assign({}, item, { value: String(item.value) });
    let { type } = item;
    if (type !== Scalar.Scalar.QUOTE_DOUBLE) {
        // force double quotes on control characters & unpaired surrogates
        if (/[\x00-\x08\x0b-\x1f\x7f-\x9f\u{D800}-\u{DFFF}]/u.test(ss.value))
            type = Scalar.Scalar.QUOTE_DOUBLE;
    }
    const _stringify = (_type) => {
        switch (_type) {
            case Scalar.Scalar.BLOCK_FOLDED:
            case Scalar.Scalar.BLOCK_LITERAL:
                return implicitKey || inFlow
                    ? quotedString(ss.value, ctx) // blocks are not valid inside flow containers
                    : blockString(ss, ctx, onComment, onChompKeep);
            case Scalar.Scalar.QUOTE_DOUBLE:
                return doubleQuotedString(ss.value, ctx);
            case Scalar.Scalar.QUOTE_SINGLE:
                return singleQuotedString(ss.value, ctx);
            case Scalar.Scalar.PLAIN:
                return plainString(ss, ctx, onComment, onChompKeep);
            default:
                return null;
        }
    };
    let res = _stringify(type);
    if (res === null) {
        const { defaultKeyType, defaultStringType } = ctx.options;
        const t = (implicitKey && defaultKeyType) || defaultStringType;
        res = _stringify(t);
        if (res === null)
            throw new Error(`Unsupported default string type ${t}`);
    }
    return res;
}

exports.stringifyString = stringifyString;


/***/ }),
/* 26 */
/***/ ((__unused_webpack_module, exports) => {



const FOLD_FLOW = 'flow';
const FOLD_BLOCK = 'block';
const FOLD_QUOTED = 'quoted';
/**
 * Tries to keep input at up to `lineWidth` characters, splitting only on spaces
 * not followed by newlines or spaces unless `mode` is `'quoted'`. Lines are
 * terminated with `\n` and started with `indent`.
 */
function foldFlowLines(text, indent, mode = 'flow', { indentAtStart, lineWidth = 80, minContentWidth = 20, onFold, onOverflow } = {}) {
    if (!lineWidth || lineWidth < 0)
        return text;
    if (lineWidth < minContentWidth)
        minContentWidth = 0;
    const endStep = Math.max(1 + minContentWidth, 1 + lineWidth - indent.length);
    if (text.length <= endStep)
        return text;
    const folds = [];
    const escapedFolds = {};
    let end = lineWidth - indent.length;
    if (typeof indentAtStart === 'number') {
        if (indentAtStart > lineWidth - Math.max(2, minContentWidth))
            folds.push(0);
        else
            end = lineWidth - indentAtStart;
    }
    let split = undefined;
    let prev = undefined;
    let overflow = false;
    let i = -1;
    let escStart = -1;
    let escEnd = -1;
    if (mode === FOLD_BLOCK) {
        i = consumeMoreIndentedLines(text, i, indent.length);
        if (i !== -1)
            end = i + endStep;
    }
    for (let ch; (ch = text[(i += 1)]);) {
        if (mode === FOLD_QUOTED && ch === '\\') {
            escStart = i;
            switch (text[i + 1]) {
                case 'x':
                    i += 3;
                    break;
                case 'u':
                    i += 5;
                    break;
                case 'U':
                    i += 9;
                    break;
                default:
                    i += 1;
            }
            escEnd = i;
        }
        if (ch === '\n') {
            if (mode === FOLD_BLOCK)
                i = consumeMoreIndentedLines(text, i, indent.length);
            end = i + indent.length + endStep;
            split = undefined;
        }
        else {
            if (ch === ' ' &&
                prev &&
                prev !== ' ' &&
                prev !== '\n' &&
                prev !== '\t') {
                // space surrounded by non-space can be replaced with newline + indent
                const next = text[i + 1];
                if (next && next !== ' ' && next !== '\n' && next !== '\t')
                    split = i;
            }
            if (i >= end) {
                if (split) {
                    folds.push(split);
                    end = split + endStep;
                    split = undefined;
                }
                else if (mode === FOLD_QUOTED) {
                    // white-space collected at end may stretch past lineWidth
                    while (prev === ' ' || prev === '\t') {
                        prev = ch;
                        ch = text[(i += 1)];
                        overflow = true;
                    }
                    // Account for newline escape, but don't break preceding escape
                    const j = i > escEnd + 1 ? i - 2 : escStart - 1;
                    // Bail out if lineWidth & minContentWidth are shorter than an escape string
                    if (escapedFolds[j])
                        return text;
                    folds.push(j);
                    escapedFolds[j] = true;
                    end = j + endStep;
                    split = undefined;
                }
                else {
                    overflow = true;
                }
            }
        }
        prev = ch;
    }
    if (overflow && onOverflow)
        onOverflow();
    if (folds.length === 0)
        return text;
    if (onFold)
        onFold();
    let res = text.slice(0, folds[0]);
    for (let i = 0; i < folds.length; ++i) {
        const fold = folds[i];
        const end = folds[i + 1] || text.length;
        if (fold === 0)
            res = `\n${indent}${text.slice(0, end)}`;
        else {
            if (mode === FOLD_QUOTED && escapedFolds[fold])
                res += `${text[fold]}\\`;
            res += `\n${indent}${text.slice(fold + 1, end)}`;
        }
    }
    return res;
}
/**
 * Presumes `i + 1` is at the start of a line
 * @returns index of last newline in more-indented block
 */
function consumeMoreIndentedLines(text, i, indent) {
    let end = i;
    let start = i + 1;
    let ch = text[start];
    while (ch === ' ' || ch === '\t') {
        if (i < start + indent) {
            ch = text[++i];
        }
        else {
            do {
                ch = text[++i];
            } while (ch && ch !== '\n');
            end = i;
            start = i + 1;
            ch = text[start];
        }
    }
    return end;
}

exports.FOLD_BLOCK = FOLD_BLOCK;
exports.FOLD_FLOW = FOLD_FLOW;
exports.FOLD_QUOTED = FOLD_QUOTED;
exports.foldFlowLines = foldFlowLines;


/***/ }),
/* 27 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var log = __webpack_require__(28);
var merge = __webpack_require__(29);
var stringify = __webpack_require__(23);
var identity = __webpack_require__(10);
var toJS = __webpack_require__(17);

function addPairToJSMap(ctx, map, { key, value }) {
    if (identity.isNode(key) && key.addToJSMap)
        key.addToJSMap(ctx, map, value);
    // TODO: Should drop this special case for bare << handling
    else if (merge.isMergeKey(ctx, key))
        merge.addMergeToJSMap(ctx, map, value);
    else {
        const jsKey = toJS.toJS(key, '', ctx);
        if (map instanceof Map) {
            map.set(jsKey, toJS.toJS(value, jsKey, ctx));
        }
        else if (map instanceof Set) {
            map.add(jsKey);
        }
        else {
            const stringKey = stringifyKey(key, jsKey, ctx);
            const jsValue = toJS.toJS(value, stringKey, ctx);
            if (stringKey in map)
                Object.defineProperty(map, stringKey, {
                    value: jsValue,
                    writable: true,
                    enumerable: true,
                    configurable: true
                });
            else
                map[stringKey] = jsValue;
        }
    }
    return map;
}
function stringifyKey(key, jsKey, ctx) {
    if (jsKey === null)
        return '';
    // eslint-disable-next-line @typescript-eslint/no-base-to-string
    if (typeof jsKey !== 'object')
        return String(jsKey);
    if (identity.isNode(key) && ctx?.doc) {
        const strCtx = stringify.createStringifyContext(ctx.doc, {});
        strCtx.anchors = new Set();
        for (const node of ctx.anchors.keys())
            strCtx.anchors.add(node.anchor);
        strCtx.inFlow = true;
        strCtx.inStringifyKey = true;
        const strKey = key.toString(strCtx);
        if (!ctx.mapKeyWarned) {
            let jsonStr = JSON.stringify(strKey);
            if (jsonStr.length > 40)
                jsonStr = jsonStr.substring(0, 36) + '..."';
            log.warn(ctx.doc.options.logLevel, `Keys with collection values will be stringified due to JS Object restrictions: ${jsonStr}. Set mapAsMap: true to use object keys.`);
            ctx.mapKeyWarned = true;
        }
        return strKey;
    }
    return JSON.stringify(jsKey);
}

exports.addPairToJSMap = addPairToJSMap;


/***/ }),
/* 28 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var node_process = __webpack_require__(8);

function debug(logLevel, ...messages) {
    if (logLevel === 'debug')
        console.log(...messages);
}
function warn(logLevel, warning) {
    if (logLevel === 'debug' || logLevel === 'warn') {
        if (typeof node_process.emitWarning === 'function')
            node_process.emitWarning(warning);
        else
            console.warn(warning);
    }
}

exports.debug = debug;
exports.warn = warn;


/***/ }),
/* 29 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var identity = __webpack_require__(10);
var Scalar = __webpack_require__(20);

// If the value associated with a merge key is a single mapping node, each of
// its key/value pairs is inserted into the current mapping, unless the key
// already exists in it. If the value associated with the merge key is a
// sequence, then this sequence is expected to contain mapping nodes and each
// of these nodes is merged in turn according to its order in the sequence.
// Keys in mapping nodes earlier in the sequence override keys specified in
// later mapping nodes. -- http://yaml.org/type/merge.html
const MERGE_KEY = '<<';
const merge = {
    identify: value => value === MERGE_KEY ||
        (typeof value === 'symbol' && value.description === MERGE_KEY),
    default: 'key',
    tag: 'tag:yaml.org,2002:merge',
    test: /^<<$/,
    resolve: () => Object.assign(new Scalar.Scalar(Symbol(MERGE_KEY)), {
        addToJSMap: addMergeToJSMap
    }),
    stringify: () => MERGE_KEY
};
const isMergeKey = (ctx, key) => (merge.identify(key) ||
    (identity.isScalar(key) &&
        (!key.type || key.type === Scalar.Scalar.PLAIN) &&
        merge.identify(key.value))) &&
    ctx?.doc.schema.tags.some(tag => tag.tag === merge.tag && tag.default);
function addMergeToJSMap(ctx, map, value) {
    value = ctx && identity.isAlias(value) ? value.resolve(ctx.doc) : value;
    if (identity.isSeq(value))
        for (const it of value.items)
            mergeValue(ctx, map, it);
    else if (Array.isArray(value))
        for (const it of value)
            mergeValue(ctx, map, it);
    else
        mergeValue(ctx, map, value);
}
function mergeValue(ctx, map, value) {
    const source = ctx && identity.isAlias(value) ? value.resolve(ctx.doc) : value;
    if (!identity.isMap(source))
        throw new Error('Merge sources must be maps or map aliases');
    const srcMap = source.toJSON(null, ctx, Map);
    for (const [key, value] of srcMap) {
        if (map instanceof Map) {
            if (!map.has(key))
                map.set(key, value);
        }
        else if (map instanceof Set) {
            map.add(key);
        }
        else if (!Object.prototype.hasOwnProperty.call(map, key)) {
            Object.defineProperty(map, key, {
                value,
                writable: true,
                enumerable: true,
                configurable: true
            });
        }
    }
    return map;
}

exports.addMergeToJSMap = addMergeToJSMap;
exports.isMergeKey = isMergeKey;
exports.merge = merge;


/***/ }),
/* 30 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var identity = __webpack_require__(10);
var map = __webpack_require__(31);
var seq = __webpack_require__(34);
var string = __webpack_require__(36);
var tags = __webpack_require__(37);

const sortMapEntriesByKey = (a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
class Schema {
    constructor({ compat, customTags, merge, resolveKnownTags, schema, sortMapEntries, toStringDefaults }) {
        this.compat = Array.isArray(compat)
            ? tags.getTags(compat, 'compat')
            : compat
                ? tags.getTags(null, compat)
                : null;
        this.name = (typeof schema === 'string' && schema) || 'core';
        this.knownTags = resolveKnownTags ? tags.coreKnownTags : {};
        this.tags = tags.getTags(customTags, this.name, merge);
        this.toStringOptions = toStringDefaults ?? null;
        Object.defineProperty(this, identity.MAP, { value: map.map });
        Object.defineProperty(this, identity.SCALAR, { value: string.string });
        Object.defineProperty(this, identity.SEQ, { value: seq.seq });
        // Used by createMap()
        this.sortMapEntries =
            typeof sortMapEntries === 'function'
                ? sortMapEntries
                : sortMapEntries === true
                    ? sortMapEntriesByKey
                    : null;
    }
    clone() {
        const copy = Object.create(Schema.prototype, Object.getOwnPropertyDescriptors(this));
        copy.tags = this.tags.slice();
        return copy;
    }
}

exports.Schema = Schema;


/***/ }),
/* 31 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var identity = __webpack_require__(10);
var YAMLMap = __webpack_require__(32);

const map = {
    collection: 'map',
    default: true,
    nodeClass: YAMLMap.YAMLMap,
    tag: 'tag:yaml.org,2002:map',
    resolve(map, onError) {
        if (!identity.isMap(map))
            onError('Expected a mapping for this tag');
        return map;
    },
    createNode: (schema, obj, ctx) => YAMLMap.YAMLMap.from(schema, obj, ctx)
};

exports.map = map;


/***/ }),
/* 32 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var stringifyCollection = __webpack_require__(33);
var addPairToJSMap = __webpack_require__(27);
var Collection = __webpack_require__(18);
var identity = __webpack_require__(10);
var Pair = __webpack_require__(21);
var Scalar = __webpack_require__(20);

function findPair(items, key) {
    const k = identity.isScalar(key) ? key.value : key;
    for (const it of items) {
        if (identity.isPair(it)) {
            if (it.key === key || it.key === k)
                return it;
            if (identity.isScalar(it.key) && it.key.value === k)
                return it;
        }
    }
    return undefined;
}
class YAMLMap extends Collection.Collection {
    static get tagName() {
        return 'tag:yaml.org,2002:map';
    }
    constructor(schema) {
        super(identity.MAP, schema);
        this.items = [];
    }
    /**
     * A generic collection parsing method that can be extended
     * to other node classes that inherit from YAMLMap
     */
    static from(schema, obj, ctx) {
        const { keepUndefined, replacer } = ctx;
        const map = new this(schema);
        const add = (key, value) => {
            if (typeof replacer === 'function')
                value = replacer.call(obj, key, value);
            else if (Array.isArray(replacer) && !replacer.includes(key))
                return;
            if (value !== undefined || keepUndefined)
                map.items.push(Pair.createPair(key, value, ctx));
        };
        if (obj instanceof Map) {
            for (const [key, value] of obj)
                add(key, value);
        }
        else if (obj && typeof obj === 'object') {
            for (const key of Object.keys(obj))
                add(key, obj[key]);
        }
        if (typeof schema.sortMapEntries === 'function') {
            map.items.sort(schema.sortMapEntries);
        }
        return map;
    }
    /**
     * Adds a value to the collection.
     *
     * @param overwrite - If not set `true`, using a key that is already in the
     *   collection will throw. Otherwise, overwrites the previous value.
     */
    add(pair, overwrite) {
        let _pair;
        if (identity.isPair(pair))
            _pair = pair;
        else if (!pair || typeof pair !== 'object' || !('key' in pair)) {
            // In TypeScript, this never happens.
            _pair = new Pair.Pair(pair, pair?.value);
        }
        else
            _pair = new Pair.Pair(pair.key, pair.value);
        const prev = findPair(this.items, _pair.key);
        const sortEntries = this.schema?.sortMapEntries;
        if (prev) {
            if (!overwrite)
                throw new Error(`Key ${_pair.key} already set`);
            // For scalars, keep the old node & its comments and anchors
            if (identity.isScalar(prev.value) && Scalar.isScalarValue(_pair.value))
                prev.value.value = _pair.value;
            else
                prev.value = _pair.value;
        }
        else if (sortEntries) {
            const i = this.items.findIndex(item => sortEntries(_pair, item) < 0);
            if (i === -1)
                this.items.push(_pair);
            else
                this.items.splice(i, 0, _pair);
        }
        else {
            this.items.push(_pair);
        }
    }
    delete(key) {
        const it = findPair(this.items, key);
        if (!it)
            return false;
        const del = this.items.splice(this.items.indexOf(it), 1);
        return del.length > 0;
    }
    get(key, keepScalar) {
        const it = findPair(this.items, key);
        const node = it?.value;
        return (!keepScalar && identity.isScalar(node) ? node.value : node) ?? undefined;
    }
    has(key) {
        return !!findPair(this.items, key);
    }
    set(key, value) {
        this.add(new Pair.Pair(key, value), true);
    }
    /**
     * @param ctx - Conversion context, originally set in Document#toJS()
     * @param {Class} Type - If set, forces the returned collection type
     * @returns Instance of Type, Map, or Object
     */
    toJSON(_, ctx, Type) {
        const map = Type ? new Type() : ctx?.mapAsMap ? new Map() : {};
        if (ctx?.onCreate)
            ctx.onCreate(map);
        for (const item of this.items)
            addPairToJSMap.addPairToJSMap(ctx, map, item);
        return map;
    }
    toString(ctx, onComment, onChompKeep) {
        if (!ctx)
            return JSON.stringify(this);
        for (const item of this.items) {
            if (!identity.isPair(item))
                throw new Error(`Map items must all be pairs; found ${JSON.stringify(item)} instead`);
        }
        if (!ctx.allNullValues && this.hasAllNullValues(false))
            ctx = Object.assign({}, ctx, { allNullValues: true });
        return stringifyCollection.stringifyCollection(this, ctx, {
            blockItemPrefix: '',
            flowChars: { start: '{', end: '}' },
            itemIndent: ctx.indent || '',
            onChompKeep,
            onComment
        });
    }
}

exports.YAMLMap = YAMLMap;
exports.findPair = findPair;


/***/ }),
/* 33 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var identity = __webpack_require__(10);
var stringify = __webpack_require__(23);
var stringifyComment = __webpack_require__(24);

function stringifyCollection(collection, ctx, options) {
    const flow = ctx.inFlow ?? collection.flow;
    const stringify = flow ? stringifyFlowCollection : stringifyBlockCollection;
    return stringify(collection, ctx, options);
}
function stringifyBlockCollection({ comment, items }, ctx, { blockItemPrefix, flowChars, itemIndent, onChompKeep, onComment }) {
    const { indent, options: { commentString } } = ctx;
    const itemCtx = Object.assign({}, ctx, { indent: itemIndent, type: null });
    let chompKeep = false; // flag for the preceding node's status
    const lines = [];
    for (let i = 0; i < items.length; ++i) {
        const item = items[i];
        let comment = null;
        if (identity.isNode(item)) {
            if (!chompKeep && item.spaceBefore)
                lines.push('');
            addCommentBefore(ctx, lines, item.commentBefore, chompKeep);
            if (item.comment)
                comment = item.comment;
        }
        else if (identity.isPair(item)) {
            const ik = identity.isNode(item.key) ? item.key : null;
            if (ik) {
                if (!chompKeep && ik.spaceBefore)
                    lines.push('');
                addCommentBefore(ctx, lines, ik.commentBefore, chompKeep);
            }
        }
        chompKeep = false;
        let str = stringify.stringify(item, itemCtx, () => (comment = null), () => (chompKeep = true));
        if (comment)
            str += stringifyComment.lineComment(str, itemIndent, commentString(comment));
        if (chompKeep && comment)
            chompKeep = false;
        lines.push(blockItemPrefix + str);
    }
    let str;
    if (lines.length === 0) {
        str = flowChars.start + flowChars.end;
    }
    else {
        str = lines[0];
        for (let i = 1; i < lines.length; ++i) {
            const line = lines[i];
            str += line ? `\n${indent}${line}` : '\n';
        }
    }
    if (comment) {
        str += '\n' + stringifyComment.indentComment(commentString(comment), indent);
        if (onComment)
            onComment();
    }
    else if (chompKeep && onChompKeep)
        onChompKeep();
    return str;
}
function stringifyFlowCollection({ items }, ctx, { flowChars, itemIndent }) {
    const { indent, indentStep, flowCollectionPadding: fcPadding, options: { commentString } } = ctx;
    itemIndent += indentStep;
    const itemCtx = Object.assign({}, ctx, {
        indent: itemIndent,
        inFlow: true,
        type: null
    });
    let reqNewline = false;
    let linesAtValue = 0;
    const lines = [];
    for (let i = 0; i < items.length; ++i) {
        const item = items[i];
        let comment = null;
        if (identity.isNode(item)) {
            if (item.spaceBefore)
                lines.push('');
            addCommentBefore(ctx, lines, item.commentBefore, false);
            if (item.comment)
                comment = item.comment;
        }
        else if (identity.isPair(item)) {
            const ik = identity.isNode(item.key) ? item.key : null;
            if (ik) {
                if (ik.spaceBefore)
                    lines.push('');
                addCommentBefore(ctx, lines, ik.commentBefore, false);
                if (ik.comment)
                    reqNewline = true;
            }
            const iv = identity.isNode(item.value) ? item.value : null;
            if (iv) {
                if (iv.comment)
                    comment = iv.comment;
                if (iv.commentBefore)
                    reqNewline = true;
            }
            else if (item.value == null && ik?.comment) {
                comment = ik.comment;
            }
        }
        if (comment)
            reqNewline = true;
        let str = stringify.stringify(item, itemCtx, () => (comment = null));
        reqNewline || (reqNewline = lines.length > linesAtValue || str.includes('\n'));
        if (i < items.length - 1) {
            str += ',';
        }
        else if (ctx.options.trailingComma) {
            if (ctx.options.lineWidth > 0) {
                reqNewline || (reqNewline = lines.reduce((sum, line) => sum + line.length + 2, 2) +
                    (str.length + 2) >
                    ctx.options.lineWidth);
            }
            if (reqNewline) {
                str += ',';
            }
        }
        if (comment)
            str += stringifyComment.lineComment(str, itemIndent, commentString(comment));
        lines.push(str);
        linesAtValue = lines.length;
    }
    const { start, end } = flowChars;
    if (lines.length === 0) {
        return start + end;
    }
    else {
        if (!reqNewline) {
            const len = lines.reduce((sum, line) => sum + line.length + 2, 2);
            reqNewline = ctx.options.lineWidth > 0 && len > ctx.options.lineWidth;
        }
        if (reqNewline) {
            let str = start;
            for (const line of lines)
                str += line ? `\n${indentStep}${indent}${line}` : '\n';
            return `${str}\n${indent}${end}`;
        }
        else {
            return `${start}${fcPadding}${lines.join(' ')}${fcPadding}${end}`;
        }
    }
}
function addCommentBefore({ indent, options: { commentString } }, lines, comment, chompKeep) {
    if (comment && chompKeep)
        comment = comment.replace(/^\n+/, '');
    if (comment) {
        const ic = stringifyComment.indentComment(commentString(comment), indent);
        lines.push(ic.trimStart()); // Avoid double indent on first line
    }
}

exports.stringifyCollection = stringifyCollection;


/***/ }),
/* 34 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var identity = __webpack_require__(10);
var YAMLSeq = __webpack_require__(35);

const seq = {
    collection: 'seq',
    default: true,
    nodeClass: YAMLSeq.YAMLSeq,
    tag: 'tag:yaml.org,2002:seq',
    resolve(seq, onError) {
        if (!identity.isSeq(seq))
            onError('Expected a sequence for this tag');
        return seq;
    },
    createNode: (schema, obj, ctx) => YAMLSeq.YAMLSeq.from(schema, obj, ctx)
};

exports.seq = seq;


/***/ }),
/* 35 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var createNode = __webpack_require__(19);
var stringifyCollection = __webpack_require__(33);
var Collection = __webpack_require__(18);
var identity = __webpack_require__(10);
var Scalar = __webpack_require__(20);
var toJS = __webpack_require__(17);

class YAMLSeq extends Collection.Collection {
    static get tagName() {
        return 'tag:yaml.org,2002:seq';
    }
    constructor(schema) {
        super(identity.SEQ, schema);
        this.items = [];
    }
    add(value) {
        this.items.push(value);
    }
    /**
     * Removes a value from the collection.
     *
     * `key` must contain a representation of an integer for this to succeed.
     * It may be wrapped in a `Scalar`.
     *
     * @returns `true` if the item was found and removed.
     */
    delete(key) {
        const idx = asItemIndex(key);
        if (typeof idx !== 'number')
            return false;
        const del = this.items.splice(idx, 1);
        return del.length > 0;
    }
    get(key, keepScalar) {
        const idx = asItemIndex(key);
        if (typeof idx !== 'number')
            return undefined;
        const it = this.items[idx];
        return !keepScalar && identity.isScalar(it) ? it.value : it;
    }
    /**
     * Checks if the collection includes a value with the key `key`.
     *
     * `key` must contain a representation of an integer for this to succeed.
     * It may be wrapped in a `Scalar`.
     */
    has(key) {
        const idx = asItemIndex(key);
        return typeof idx === 'number' && idx < this.items.length;
    }
    /**
     * Sets a value in this collection. For `!!set`, `value` needs to be a
     * boolean to add/remove the item from the set.
     *
     * If `key` does not contain a representation of an integer, this will throw.
     * It may be wrapped in a `Scalar`.
     */
    set(key, value) {
        const idx = asItemIndex(key);
        if (typeof idx !== 'number')
            throw new Error(`Expected a valid index, not ${key}.`);
        const prev = this.items[idx];
        if (identity.isScalar(prev) && Scalar.isScalarValue(value))
            prev.value = value;
        else
            this.items[idx] = value;
    }
    toJSON(_, ctx) {
        const seq = [];
        if (ctx?.onCreate)
            ctx.onCreate(seq);
        let i = 0;
        for (const item of this.items)
            seq.push(toJS.toJS(item, String(i++), ctx));
        return seq;
    }
    toString(ctx, onComment, onChompKeep) {
        if (!ctx)
            return JSON.stringify(this);
        return stringifyCollection.stringifyCollection(this, ctx, {
            blockItemPrefix: '- ',
            flowChars: { start: '[', end: ']' },
            itemIndent: (ctx.indent || '') + '  ',
            onChompKeep,
            onComment
        });
    }
    static from(schema, obj, ctx) {
        const { replacer } = ctx;
        const seq = new this(schema);
        if (obj && Symbol.iterator in Object(obj)) {
            let i = 0;
            for (let it of obj) {
                if (typeof replacer === 'function') {
                    const key = obj instanceof Set ? it : String(i++);
                    it = replacer.call(obj, key, it);
                }
                seq.items.push(createNode.createNode(it, undefined, ctx));
            }
        }
        return seq;
    }
}
function asItemIndex(key) {
    let idx = identity.isScalar(key) ? key.value : key;
    if (idx && typeof idx === 'string')
        idx = Number(idx);
    return typeof idx === 'number' && Number.isInteger(idx) && idx >= 0
        ? idx
        : null;
}

exports.YAMLSeq = YAMLSeq;


/***/ }),
/* 36 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var stringifyString = __webpack_require__(25);

const string = {
    identify: value => typeof value === 'string',
    default: true,
    tag: 'tag:yaml.org,2002:str',
    resolve: str => str,
    stringify(item, ctx, onComment, onChompKeep) {
        ctx = Object.assign({ actualString: true }, ctx);
        return stringifyString.stringifyString(item, ctx, onComment, onChompKeep);
    }
};

exports.string = string;


/***/ }),
/* 37 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var map = __webpack_require__(31);
var _null = __webpack_require__(38);
var seq = __webpack_require__(34);
var string = __webpack_require__(36);
var bool = __webpack_require__(39);
var float = __webpack_require__(40);
var int = __webpack_require__(42);
var schema = __webpack_require__(43);
var schema$1 = __webpack_require__(44);
var binary = __webpack_require__(45);
var merge = __webpack_require__(29);
var omap = __webpack_require__(47);
var pairs = __webpack_require__(48);
var schema$2 = __webpack_require__(49);
var set = __webpack_require__(53);
var timestamp = __webpack_require__(54);

const schemas = new Map([
    ['core', schema.schema],
    ['failsafe', [map.map, seq.seq, string.string]],
    ['json', schema$1.schema],
    ['yaml11', schema$2.schema],
    ['yaml-1.1', schema$2.schema]
]);
const tagsByName = {
    binary: binary.binary,
    bool: bool.boolTag,
    float: float.float,
    floatExp: float.floatExp,
    floatNaN: float.floatNaN,
    floatTime: timestamp.floatTime,
    int: int.int,
    intHex: int.intHex,
    intOct: int.intOct,
    intTime: timestamp.intTime,
    map: map.map,
    merge: merge.merge,
    null: _null.nullTag,
    omap: omap.omap,
    pairs: pairs.pairs,
    seq: seq.seq,
    set: set.set,
    timestamp: timestamp.timestamp
};
const coreKnownTags = {
    'tag:yaml.org,2002:binary': binary.binary,
    'tag:yaml.org,2002:merge': merge.merge,
    'tag:yaml.org,2002:omap': omap.omap,
    'tag:yaml.org,2002:pairs': pairs.pairs,
    'tag:yaml.org,2002:set': set.set,
    'tag:yaml.org,2002:timestamp': timestamp.timestamp
};
function getTags(customTags, schemaName, addMergeTag) {
    const schemaTags = schemas.get(schemaName);
    if (schemaTags && !customTags) {
        return addMergeTag && !schemaTags.includes(merge.merge)
            ? schemaTags.concat(merge.merge)
            : schemaTags.slice();
    }
    let tags = schemaTags;
    if (!tags) {
        if (Array.isArray(customTags))
            tags = [];
        else {
            const keys = Array.from(schemas.keys())
                .filter(key => key !== 'yaml11')
                .map(key => JSON.stringify(key))
                .join(', ');
            throw new Error(`Unknown schema "${schemaName}"; use one of ${keys} or define customTags array`);
        }
    }
    if (Array.isArray(customTags)) {
        for (const tag of customTags)
            tags = tags.concat(tag);
    }
    else if (typeof customTags === 'function') {
        tags = customTags(tags.slice());
    }
    if (addMergeTag)
        tags = tags.concat(merge.merge);
    return tags.reduce((tags, tag) => {
        const tagObj = typeof tag === 'string' ? tagsByName[tag] : tag;
        if (!tagObj) {
            const tagName = JSON.stringify(tag);
            const keys = Object.keys(tagsByName)
                .map(key => JSON.stringify(key))
                .join(', ');
            throw new Error(`Unknown custom tag ${tagName}; use one of ${keys}`);
        }
        if (!tags.includes(tagObj))
            tags.push(tagObj);
        return tags;
    }, []);
}

exports.coreKnownTags = coreKnownTags;
exports.getTags = getTags;


/***/ }),
/* 38 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var Scalar = __webpack_require__(20);

const nullTag = {
    identify: value => value == null,
    createNode: () => new Scalar.Scalar(null),
    default: true,
    tag: 'tag:yaml.org,2002:null',
    test: /^(?:~|[Nn]ull|NULL)?$/,
    resolve: () => new Scalar.Scalar(null),
    stringify: ({ source }, ctx) => typeof source === 'string' && nullTag.test.test(source)
        ? source
        : ctx.options.nullStr
};

exports.nullTag = nullTag;


/***/ }),
/* 39 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var Scalar = __webpack_require__(20);

const boolTag = {
    identify: value => typeof value === 'boolean',
    default: true,
    tag: 'tag:yaml.org,2002:bool',
    test: /^(?:[Tt]rue|TRUE|[Ff]alse|FALSE)$/,
    resolve: str => new Scalar.Scalar(str[0] === 't' || str[0] === 'T'),
    stringify({ source, value }, ctx) {
        if (source && boolTag.test.test(source)) {
            const sv = source[0] === 't' || source[0] === 'T';
            if (value === sv)
                return source;
        }
        return value ? ctx.options.trueStr : ctx.options.falseStr;
    }
};

exports.boolTag = boolTag;


/***/ }),
/* 40 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var Scalar = __webpack_require__(20);
var stringifyNumber = __webpack_require__(41);

const floatNaN = {
    identify: value => typeof value === 'number',
    default: true,
    tag: 'tag:yaml.org,2002:float',
    test: /^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,
    resolve: str => str.slice(-3).toLowerCase() === 'nan'
        ? NaN
        : str[0] === '-'
            ? Number.NEGATIVE_INFINITY
            : Number.POSITIVE_INFINITY,
    stringify: stringifyNumber.stringifyNumber
};
const floatExp = {
    identify: value => typeof value === 'number',
    default: true,
    tag: 'tag:yaml.org,2002:float',
    format: 'EXP',
    test: /^[-+]?(?:\.[0-9]+|[0-9]+(?:\.[0-9]*)?)[eE][-+]?[0-9]+$/,
    resolve: str => parseFloat(str),
    stringify(node) {
        const num = Number(node.value);
        return isFinite(num) ? num.toExponential() : stringifyNumber.stringifyNumber(node);
    }
};
const float = {
    identify: value => typeof value === 'number',
    default: true,
    tag: 'tag:yaml.org,2002:float',
    test: /^[-+]?(?:\.[0-9]+|[0-9]+\.[0-9]*)$/,
    resolve(str) {
        const node = new Scalar.Scalar(parseFloat(str));
        const dot = str.indexOf('.');
        if (dot !== -1 && str[str.length - 1] === '0')
            node.minFractionDigits = str.length - dot - 1;
        return node;
    },
    stringify: stringifyNumber.stringifyNumber
};

exports.float = float;
exports.floatExp = floatExp;
exports.floatNaN = floatNaN;


/***/ }),
/* 41 */
/***/ ((__unused_webpack_module, exports) => {



function stringifyNumber({ format, minFractionDigits, tag, value }) {
    if (typeof value === 'bigint')
        return String(value);
    const num = typeof value === 'number' ? value : Number(value);
    if (!isFinite(num))
        return isNaN(num) ? '.nan' : num < 0 ? '-.inf' : '.inf';
    let n = Object.is(value, -0) ? '-0' : JSON.stringify(value);
    if (!format &&
        minFractionDigits &&
        (!tag || tag === 'tag:yaml.org,2002:float') &&
        /^\d/.test(n)) {
        let i = n.indexOf('.');
        if (i < 0) {
            i = n.length;
            n += '.';
        }
        let d = minFractionDigits - (n.length - i - 1);
        while (d-- > 0)
            n += '0';
    }
    return n;
}

exports.stringifyNumber = stringifyNumber;


/***/ }),
/* 42 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var stringifyNumber = __webpack_require__(41);

const intIdentify = (value) => typeof value === 'bigint' || Number.isInteger(value);
const intResolve = (str, offset, radix, { intAsBigInt }) => (intAsBigInt ? BigInt(str) : parseInt(str.substring(offset), radix));
function intStringify(node, radix, prefix) {
    const { value } = node;
    if (intIdentify(value) && value >= 0)
        return prefix + value.toString(radix);
    return stringifyNumber.stringifyNumber(node);
}
const intOct = {
    identify: value => intIdentify(value) && value >= 0,
    default: true,
    tag: 'tag:yaml.org,2002:int',
    format: 'OCT',
    test: /^0o[0-7]+$/,
    resolve: (str, _onError, opt) => intResolve(str, 2, 8, opt),
    stringify: node => intStringify(node, 8, '0o')
};
const int = {
    identify: intIdentify,
    default: true,
    tag: 'tag:yaml.org,2002:int',
    test: /^[-+]?[0-9]+$/,
    resolve: (str, _onError, opt) => intResolve(str, 0, 10, opt),
    stringify: stringifyNumber.stringifyNumber
};
const intHex = {
    identify: value => intIdentify(value) && value >= 0,
    default: true,
    tag: 'tag:yaml.org,2002:int',
    format: 'HEX',
    test: /^0x[0-9a-fA-F]+$/,
    resolve: (str, _onError, opt) => intResolve(str, 2, 16, opt),
    stringify: node => intStringify(node, 16, '0x')
};

exports.int = int;
exports.intHex = intHex;
exports.intOct = intOct;


/***/ }),
/* 43 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var map = __webpack_require__(31);
var _null = __webpack_require__(38);
var seq = __webpack_require__(34);
var string = __webpack_require__(36);
var bool = __webpack_require__(39);
var float = __webpack_require__(40);
var int = __webpack_require__(42);

const schema = [
    map.map,
    seq.seq,
    string.string,
    _null.nullTag,
    bool.boolTag,
    int.intOct,
    int.int,
    int.intHex,
    float.floatNaN,
    float.floatExp,
    float.float
];

exports.schema = schema;


/***/ }),
/* 44 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var Scalar = __webpack_require__(20);
var map = __webpack_require__(31);
var seq = __webpack_require__(34);

function intIdentify(value) {
    return typeof value === 'bigint' || Number.isInteger(value);
}
const stringifyJSON = ({ value }) => JSON.stringify(value);
const jsonScalars = [
    {
        identify: value => typeof value === 'string',
        default: true,
        tag: 'tag:yaml.org,2002:str',
        resolve: str => str,
        stringify: stringifyJSON
    },
    {
        identify: value => value == null,
        createNode: () => new Scalar.Scalar(null),
        default: true,
        tag: 'tag:yaml.org,2002:null',
        test: /^null$/,
        resolve: () => null,
        stringify: stringifyJSON
    },
    {
        identify: value => typeof value === 'boolean',
        default: true,
        tag: 'tag:yaml.org,2002:bool',
        test: /^true$|^false$/,
        resolve: str => str === 'true',
        stringify: stringifyJSON
    },
    {
        identify: intIdentify,
        default: true,
        tag: 'tag:yaml.org,2002:int',
        test: /^-?(?:0|[1-9][0-9]*)$/,
        resolve: (str, _onError, { intAsBigInt }) => intAsBigInt ? BigInt(str) : parseInt(str, 10),
        stringify: ({ value }) => intIdentify(value) ? value.toString() : JSON.stringify(value)
    },
    {
        identify: value => typeof value === 'number',
        default: true,
        tag: 'tag:yaml.org,2002:float',
        test: /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]*)?(?:[eE][-+]?[0-9]+)?$/,
        resolve: str => parseFloat(str),
        stringify: stringifyJSON
    }
];
const jsonError = {
    default: true,
    tag: '',
    test: /^/,
    resolve(str, onError) {
        onError(`Unresolved plain scalar ${JSON.stringify(str)}`);
        return str;
    }
};
const schema = [map.map, seq.seq].concat(jsonScalars, jsonError);

exports.schema = schema;


/***/ }),
/* 45 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var node_buffer = __webpack_require__(46);
var Scalar = __webpack_require__(20);
var stringifyString = __webpack_require__(25);

const binary = {
    identify: value => value instanceof Uint8Array, // Buffer inherits from Uint8Array
    default: false,
    tag: 'tag:yaml.org,2002:binary',
    /**
     * Returns a Buffer in node and an Uint8Array in browsers
     *
     * To use the resulting buffer as an image, you'll want to do something like:
     *
     *   const blob = new Blob([buffer], { type: 'image/jpeg' })
     *   document.querySelector('#photo').src = URL.createObjectURL(blob)
     */
    resolve(src, onError) {
        if (typeof node_buffer.Buffer === 'function') {
            return node_buffer.Buffer.from(src, 'base64');
        }
        else if (typeof atob === 'function') {
            // On IE 11, atob() can't handle newlines
            const str = atob(src.replace(/[\n\r]/g, ''));
            const buffer = new Uint8Array(str.length);
            for (let i = 0; i < str.length; ++i)
                buffer[i] = str.charCodeAt(i);
            return buffer;
        }
        else {
            onError('This environment does not support reading binary tags; either Buffer or atob is required');
            return src;
        }
    },
    stringify({ comment, type, value }, ctx, onComment, onChompKeep) {
        if (!value)
            return '';
        const buf = value; // checked earlier by binary.identify()
        let str;
        if (typeof node_buffer.Buffer === 'function') {
            str =
                buf instanceof node_buffer.Buffer
                    ? buf.toString('base64')
                    : node_buffer.Buffer.from(buf.buffer).toString('base64');
        }
        else if (typeof btoa === 'function') {
            let s = '';
            for (let i = 0; i < buf.length; ++i)
                s += String.fromCharCode(buf[i]);
            str = btoa(s);
        }
        else {
            throw new Error('This environment does not support writing binary tags; either Buffer or btoa is required');
        }
        type ?? (type = Scalar.Scalar.BLOCK_LITERAL);
        if (type !== Scalar.Scalar.QUOTE_DOUBLE) {
            const lineWidth = Math.max(ctx.options.lineWidth - ctx.indent.length, ctx.options.minContentWidth);
            const n = Math.ceil(str.length / lineWidth);
            const lines = new Array(n);
            for (let i = 0, o = 0; i < n; ++i, o += lineWidth) {
                lines[i] = str.substr(o, lineWidth);
            }
            str = lines.join(type === Scalar.Scalar.BLOCK_LITERAL ? '\n' : ' ');
        }
        return stringifyString.stringifyString({ comment, type, value: str }, ctx, onComment, onChompKeep);
    }
};

exports.binary = binary;


/***/ }),
/* 46 */
/***/ ((module) => {

module.exports = require("buffer");

/***/ }),
/* 47 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var identity = __webpack_require__(10);
var toJS = __webpack_require__(17);
var YAMLMap = __webpack_require__(32);
var YAMLSeq = __webpack_require__(35);
var pairs = __webpack_require__(48);

class YAMLOMap extends YAMLSeq.YAMLSeq {
    constructor() {
        super();
        this.add = YAMLMap.YAMLMap.prototype.add.bind(this);
        this.delete = YAMLMap.YAMLMap.prototype.delete.bind(this);
        this.get = YAMLMap.YAMLMap.prototype.get.bind(this);
        this.has = YAMLMap.YAMLMap.prototype.has.bind(this);
        this.set = YAMLMap.YAMLMap.prototype.set.bind(this);
        this.tag = YAMLOMap.tag;
    }
    /**
     * If `ctx` is given, the return type is actually `Map<unknown, unknown>`,
     * but TypeScript won't allow widening the signature of a child method.
     */
    toJSON(_, ctx) {
        if (!ctx)
            return super.toJSON(_);
        const map = new Map();
        if (ctx?.onCreate)
            ctx.onCreate(map);
        for (const pair of this.items) {
            let key, value;
            if (identity.isPair(pair)) {
                key = toJS.toJS(pair.key, '', ctx);
                value = toJS.toJS(pair.value, key, ctx);
            }
            else {
                key = toJS.toJS(pair, '', ctx);
            }
            if (map.has(key))
                throw new Error('Ordered maps must not include duplicate keys');
            map.set(key, value);
        }
        return map;
    }
    static from(schema, iterable, ctx) {
        const pairs$1 = pairs.createPairs(schema, iterable, ctx);
        const omap = new this();
        omap.items = pairs$1.items;
        return omap;
    }
}
YAMLOMap.tag = 'tag:yaml.org,2002:omap';
const omap = {
    collection: 'seq',
    identify: value => value instanceof Map,
    nodeClass: YAMLOMap,
    default: false,
    tag: 'tag:yaml.org,2002:omap',
    resolve(seq, onError) {
        const pairs$1 = pairs.resolvePairs(seq, onError);
        const seenKeys = [];
        for (const { key } of pairs$1.items) {
            if (identity.isScalar(key)) {
                if (seenKeys.includes(key.value)) {
                    onError(`Ordered maps must not include duplicate keys: ${key.value}`);
                }
                else {
                    seenKeys.push(key.value);
                }
            }
        }
        return Object.assign(new YAMLOMap(), pairs$1);
    },
    createNode: (schema, iterable, ctx) => YAMLOMap.from(schema, iterable, ctx)
};

exports.YAMLOMap = YAMLOMap;
exports.omap = omap;


/***/ }),
/* 48 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var identity = __webpack_require__(10);
var Pair = __webpack_require__(21);
var Scalar = __webpack_require__(20);
var YAMLSeq = __webpack_require__(35);

function resolvePairs(seq, onError) {
    if (identity.isSeq(seq)) {
        for (let i = 0; i < seq.items.length; ++i) {
            let item = seq.items[i];
            if (identity.isPair(item))
                continue;
            else if (identity.isMap(item)) {
                if (item.items.length > 1)
                    onError('Each pair must have its own sequence indicator');
                const pair = item.items[0] || new Pair.Pair(new Scalar.Scalar(null));
                if (item.commentBefore)
                    pair.key.commentBefore = pair.key.commentBefore
                        ? `${item.commentBefore}\n${pair.key.commentBefore}`
                        : item.commentBefore;
                if (item.comment) {
                    const cn = pair.value ?? pair.key;
                    cn.comment = cn.comment
                        ? `${item.comment}\n${cn.comment}`
                        : item.comment;
                }
                item = pair;
            }
            seq.items[i] = identity.isPair(item) ? item : new Pair.Pair(item);
        }
    }
    else
        onError('Expected a sequence for this tag');
    return seq;
}
function createPairs(schema, iterable, ctx) {
    const { replacer } = ctx;
    const pairs = new YAMLSeq.YAMLSeq(schema);
    pairs.tag = 'tag:yaml.org,2002:pairs';
    let i = 0;
    if (iterable && Symbol.iterator in Object(iterable))
        for (let it of iterable) {
            if (typeof replacer === 'function')
                it = replacer.call(iterable, String(i++), it);
            let key, value;
            if (Array.isArray(it)) {
                if (it.length === 2) {
                    key = it[0];
                    value = it[1];
                }
                else
                    throw new TypeError(`Expected [key, value] tuple: ${it}`);
            }
            else if (it && it instanceof Object) {
                const keys = Object.keys(it);
                if (keys.length === 1) {
                    key = keys[0];
                    value = it[key];
                }
                else {
                    throw new TypeError(`Expected tuple with one key, not ${keys.length} keys`);
                }
            }
            else {
                key = it;
            }
            pairs.items.push(Pair.createPair(key, value, ctx));
        }
    return pairs;
}
const pairs = {
    collection: 'seq',
    default: false,
    tag: 'tag:yaml.org,2002:pairs',
    resolve: resolvePairs,
    createNode: createPairs
};

exports.createPairs = createPairs;
exports.pairs = pairs;
exports.resolvePairs = resolvePairs;


/***/ }),
/* 49 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var map = __webpack_require__(31);
var _null = __webpack_require__(38);
var seq = __webpack_require__(34);
var string = __webpack_require__(36);
var binary = __webpack_require__(45);
var bool = __webpack_require__(50);
var float = __webpack_require__(51);
var int = __webpack_require__(52);
var merge = __webpack_require__(29);
var omap = __webpack_require__(47);
var pairs = __webpack_require__(48);
var set = __webpack_require__(53);
var timestamp = __webpack_require__(54);

const schema = [
    map.map,
    seq.seq,
    string.string,
    _null.nullTag,
    bool.trueTag,
    bool.falseTag,
    int.intBin,
    int.intOct,
    int.int,
    int.intHex,
    float.floatNaN,
    float.floatExp,
    float.float,
    binary.binary,
    merge.merge,
    omap.omap,
    pairs.pairs,
    set.set,
    timestamp.intTime,
    timestamp.floatTime,
    timestamp.timestamp
];

exports.schema = schema;


/***/ }),
/* 50 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var Scalar = __webpack_require__(20);

function boolStringify({ value, source }, ctx) {
    const boolObj = value ? trueTag : falseTag;
    if (source && boolObj.test.test(source))
        return source;
    return value ? ctx.options.trueStr : ctx.options.falseStr;
}
const trueTag = {
    identify: value => value === true,
    default: true,
    tag: 'tag:yaml.org,2002:bool',
    test: /^(?:Y|y|[Yy]es|YES|[Tt]rue|TRUE|[Oo]n|ON)$/,
    resolve: () => new Scalar.Scalar(true),
    stringify: boolStringify
};
const falseTag = {
    identify: value => value === false,
    default: true,
    tag: 'tag:yaml.org,2002:bool',
    test: /^(?:N|n|[Nn]o|NO|[Ff]alse|FALSE|[Oo]ff|OFF)$/,
    resolve: () => new Scalar.Scalar(false),
    stringify: boolStringify
};

exports.falseTag = falseTag;
exports.trueTag = trueTag;


/***/ }),
/* 51 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var Scalar = __webpack_require__(20);
var stringifyNumber = __webpack_require__(41);

const floatNaN = {
    identify: value => typeof value === 'number',
    default: true,
    tag: 'tag:yaml.org,2002:float',
    test: /^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,
    resolve: (str) => str.slice(-3).toLowerCase() === 'nan'
        ? NaN
        : str[0] === '-'
            ? Number.NEGATIVE_INFINITY
            : Number.POSITIVE_INFINITY,
    stringify: stringifyNumber.stringifyNumber
};
const floatExp = {
    identify: value => typeof value === 'number',
    default: true,
    tag: 'tag:yaml.org,2002:float',
    format: 'EXP',
    test: /^[-+]?(?:[0-9][0-9_]*)?(?:\.[0-9_]*)?[eE][-+]?[0-9]+$/,
    resolve: (str) => parseFloat(str.replace(/_/g, '')),
    stringify(node) {
        const num = Number(node.value);
        return isFinite(num) ? num.toExponential() : stringifyNumber.stringifyNumber(node);
    }
};
const float = {
    identify: value => typeof value === 'number',
    default: true,
    tag: 'tag:yaml.org,2002:float',
    test: /^[-+]?(?:[0-9][0-9_]*)?\.[0-9_]*$/,
    resolve(str) {
        const node = new Scalar.Scalar(parseFloat(str.replace(/_/g, '')));
        const dot = str.indexOf('.');
        if (dot !== -1) {
            const f = str.substring(dot + 1).replace(/_/g, '');
            if (f[f.length - 1] === '0')
                node.minFractionDigits = f.length;
        }
        return node;
    },
    stringify: stringifyNumber.stringifyNumber
};

exports.float = float;
exports.floatExp = floatExp;
exports.floatNaN = floatNaN;


/***/ }),
/* 52 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var stringifyNumber = __webpack_require__(41);

const intIdentify = (value) => typeof value === 'bigint' || Number.isInteger(value);
function intResolve(str, offset, radix, { intAsBigInt }) {
    const sign = str[0];
    if (sign === '-' || sign === '+')
        offset += 1;
    str = str.substring(offset).replace(/_/g, '');
    if (intAsBigInt) {
        switch (radix) {
            case 2:
                str = `0b${str}`;
                break;
            case 8:
                str = `0o${str}`;
                break;
            case 16:
                str = `0x${str}`;
                break;
        }
        const n = BigInt(str);
        return sign === '-' ? BigInt(-1) * n : n;
    }
    const n = parseInt(str, radix);
    return sign === '-' ? -1 * n : n;
}
function intStringify(node, radix, prefix) {
    const { value } = node;
    if (intIdentify(value)) {
        const str = value.toString(radix);
        return value < 0 ? '-' + prefix + str.substr(1) : prefix + str;
    }
    return stringifyNumber.stringifyNumber(node);
}
const intBin = {
    identify: intIdentify,
    default: true,
    tag: 'tag:yaml.org,2002:int',
    format: 'BIN',
    test: /^[-+]?0b[0-1_]+$/,
    resolve: (str, _onError, opt) => intResolve(str, 2, 2, opt),
    stringify: node => intStringify(node, 2, '0b')
};
const intOct = {
    identify: intIdentify,
    default: true,
    tag: 'tag:yaml.org,2002:int',
    format: 'OCT',
    test: /^[-+]?0[0-7_]+$/,
    resolve: (str, _onError, opt) => intResolve(str, 1, 8, opt),
    stringify: node => intStringify(node, 8, '0')
};
const int = {
    identify: intIdentify,
    default: true,
    tag: 'tag:yaml.org,2002:int',
    test: /^[-+]?[0-9][0-9_]*$/,
    resolve: (str, _onError, opt) => intResolve(str, 0, 10, opt),
    stringify: stringifyNumber.stringifyNumber
};
const intHex = {
    identify: intIdentify,
    default: true,
    tag: 'tag:yaml.org,2002:int',
    format: 'HEX',
    test: /^[-+]?0x[0-9a-fA-F_]+$/,
    resolve: (str, _onError, opt) => intResolve(str, 2, 16, opt),
    stringify: node => intStringify(node, 16, '0x')
};

exports.int = int;
exports.intBin = intBin;
exports.intHex = intHex;
exports.intOct = intOct;


/***/ }),
/* 53 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var identity = __webpack_require__(10);
var Pair = __webpack_require__(21);
var YAMLMap = __webpack_require__(32);

class YAMLSet extends YAMLMap.YAMLMap {
    constructor(schema) {
        super(schema);
        this.tag = YAMLSet.tag;
    }
    add(key) {
        let pair;
        if (identity.isPair(key))
            pair = key;
        else if (key &&
            typeof key === 'object' &&
            'key' in key &&
            'value' in key &&
            key.value === null)
            pair = new Pair.Pair(key.key, null);
        else
            pair = new Pair.Pair(key, null);
        const prev = YAMLMap.findPair(this.items, pair.key);
        if (!prev)
            this.items.push(pair);
    }
    /**
     * If `keepPair` is `true`, returns the Pair matching `key`.
     * Otherwise, returns the value of that Pair's key.
     */
    get(key, keepPair) {
        const pair = YAMLMap.findPair(this.items, key);
        return !keepPair && identity.isPair(pair)
            ? identity.isScalar(pair.key)
                ? pair.key.value
                : pair.key
            : pair;
    }
    set(key, value) {
        if (typeof value !== 'boolean')
            throw new Error(`Expected boolean value for set(key, value) in a YAML set, not ${typeof value}`);
        const prev = YAMLMap.findPair(this.items, key);
        if (prev && !value) {
            this.items.splice(this.items.indexOf(prev), 1);
        }
        else if (!prev && value) {
            this.items.push(new Pair.Pair(key));
        }
    }
    toJSON(_, ctx) {
        return super.toJSON(_, ctx, Set);
    }
    toString(ctx, onComment, onChompKeep) {
        if (!ctx)
            return JSON.stringify(this);
        if (this.hasAllNullValues(true))
            return super.toString(Object.assign({}, ctx, { allNullValues: true }), onComment, onChompKeep);
        else
            throw new Error('Set items must all have null values');
    }
    static from(schema, iterable, ctx) {
        const { replacer } = ctx;
        const set = new this(schema);
        if (iterable && Symbol.iterator in Object(iterable))
            for (let value of iterable) {
                if (typeof replacer === 'function')
                    value = replacer.call(iterable, value, value);
                set.items.push(Pair.createPair(value, null, ctx));
            }
        return set;
    }
}
YAMLSet.tag = 'tag:yaml.org,2002:set';
const set = {
    collection: 'map',
    identify: value => value instanceof Set,
    nodeClass: YAMLSet,
    default: false,
    tag: 'tag:yaml.org,2002:set',
    createNode: (schema, iterable, ctx) => YAMLSet.from(schema, iterable, ctx),
    resolve(map, onError) {
        if (identity.isMap(map)) {
            if (map.hasAllNullValues(true))
                return Object.assign(new YAMLSet(), map);
            else
                onError('Set items must all have null values');
        }
        else
            onError('Expected a mapping for this tag');
        return map;
    }
};

exports.YAMLSet = YAMLSet;
exports.set = set;


/***/ }),
/* 54 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var stringifyNumber = __webpack_require__(41);

/** Internal types handle bigint as number, because TS can't figure it out. */
function parseSexagesimal(str, asBigInt) {
    const sign = str[0];
    const parts = sign === '-' || sign === '+' ? str.substring(1) : str;
    const num = (n) => asBigInt ? BigInt(n) : Number(n);
    const res = parts
        .replace(/_/g, '')
        .split(':')
        .reduce((res, p) => res * num(60) + num(p), num(0));
    return (sign === '-' ? num(-1) * res : res);
}
/**
 * hhhh:mm:ss.sss
 *
 * Internal types handle bigint as number, because TS can't figure it out.
 */
function stringifySexagesimal(node) {
    let { value } = node;
    let num = (n) => n;
    if (typeof value === 'bigint')
        num = n => BigInt(n);
    else if (isNaN(value) || !isFinite(value))
        return stringifyNumber.stringifyNumber(node);
    let sign = '';
    if (value < 0) {
        sign = '-';
        value *= num(-1);
    }
    const _60 = num(60);
    const parts = [value % _60]; // seconds, including ms
    if (value < 60) {
        parts.unshift(0); // at least one : is required
    }
    else {
        value = (value - parts[0]) / _60;
        parts.unshift(value % _60); // minutes
        if (value >= 60) {
            value = (value - parts[0]) / _60;
            parts.unshift(value); // hours
        }
    }
    return (sign +
        parts
            .map(n => String(n).padStart(2, '0'))
            .join(':')
            .replace(/000000\d*$/, '') // % 60 may introduce error
    );
}
const intTime = {
    identify: value => typeof value === 'bigint' || Number.isInteger(value),
    default: true,
    tag: 'tag:yaml.org,2002:int',
    format: 'TIME',
    test: /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+$/,
    resolve: (str, _onError, { intAsBigInt }) => parseSexagesimal(str, intAsBigInt),
    stringify: stringifySexagesimal
};
const floatTime = {
    identify: value => typeof value === 'number',
    default: true,
    tag: 'tag:yaml.org,2002:float',
    format: 'TIME',
    test: /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+\.[0-9_]*$/,
    resolve: str => parseSexagesimal(str, false),
    stringify: stringifySexagesimal
};
const timestamp = {
    identify: value => value instanceof Date,
    default: true,
    tag: 'tag:yaml.org,2002:timestamp',
    // If the time zone is omitted, the timestamp is assumed to be specified in UTC. The time part
    // may be omitted altogether, resulting in a date format. In such a case, the time part is
    // assumed to be 00:00:00Z (start of day, UTC).
    test: RegExp('^([0-9]{4})-([0-9]{1,2})-([0-9]{1,2})' + // YYYY-Mm-Dd
        '(?:' + // time is optional
        '(?:t|T|[ \\t]+)' + // t | T | whitespace
        '([0-9]{1,2}):([0-9]{1,2}):([0-9]{1,2}(\\.[0-9]+)?)' + // Hh:Mm:Ss(.ss)?
        '(?:[ \\t]*(Z|[-+][012]?[0-9](?::[0-9]{2})?))?' + // Z | +5 | -03:30
        ')?$'),
    resolve(str) {
        const match = str.match(timestamp.test);
        if (!match)
            throw new Error('!!timestamp expects a date, starting with yyyy-mm-dd');
        const [, year, month, day, hour, minute, second] = match.map(Number);
        const millisec = match[7] ? Number((match[7] + '00').substr(1, 3)) : 0;
        let date = Date.UTC(year, month - 1, day, hour || 0, minute || 0, second || 0, millisec);
        const tz = match[8];
        if (tz && tz !== 'Z') {
            let d = parseSexagesimal(tz, false);
            if (Math.abs(d) < 30)
                d *= 60;
            date -= 60000 * d;
        }
        return new Date(date);
    },
    stringify: ({ value }) => value?.toISOString().replace(/(T00:00:00)?\.000Z$/, '') ?? ''
};

exports.floatTime = floatTime;
exports.intTime = intTime;
exports.timestamp = timestamp;


/***/ }),
/* 55 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var identity = __webpack_require__(10);
var stringify = __webpack_require__(23);
var stringifyComment = __webpack_require__(24);

function stringifyDocument(doc, options) {
    const lines = [];
    let hasDirectives = options.directives === true;
    if (options.directives !== false && doc.directives) {
        const dir = doc.directives.toString(doc);
        if (dir) {
            lines.push(dir);
            hasDirectives = true;
        }
        else if (doc.directives.docStart)
            hasDirectives = true;
    }
    if (hasDirectives)
        lines.push('---');
    const ctx = stringify.createStringifyContext(doc, options);
    const { commentString } = ctx.options;
    if (doc.commentBefore) {
        if (lines.length !== 1)
            lines.unshift('');
        const cs = commentString(doc.commentBefore);
        lines.unshift(stringifyComment.indentComment(cs, ''));
    }
    let chompKeep = false;
    let contentComment = null;
    if (doc.contents) {
        if (identity.isNode(doc.contents)) {
            if (doc.contents.spaceBefore && hasDirectives)
                lines.push('');
            if (doc.contents.commentBefore) {
                const cs = commentString(doc.contents.commentBefore);
                lines.push(stringifyComment.indentComment(cs, ''));
            }
            // top-level block scalars need to be indented if followed by a comment
            ctx.forceBlockIndent = !!doc.comment;
            contentComment = doc.contents.comment;
        }
        const onChompKeep = contentComment ? undefined : () => (chompKeep = true);
        let body = stringify.stringify(doc.contents, ctx, () => (contentComment = null), onChompKeep);
        if (contentComment)
            body += stringifyComment.lineComment(body, '', commentString(contentComment));
        if ((body[0] === '|' || body[0] === '>') &&
            lines[lines.length - 1] === '---') {
            // Top-level block scalars with a preceding doc marker ought to use the
            // same line for their header.
            lines[lines.length - 1] = `--- ${body}`;
        }
        else
            lines.push(body);
    }
    else {
        lines.push(stringify.stringify(doc.contents, ctx));
    }
    if (doc.directives?.docEnd) {
        if (doc.comment) {
            const cs = commentString(doc.comment);
            if (cs.includes('\n')) {
                lines.push('...');
                lines.push(stringifyComment.indentComment(cs, ''));
            }
            else {
                lines.push(`... ${cs}`);
            }
        }
        else {
            lines.push('...');
        }
    }
    else {
        let dc = doc.comment;
        if (dc && chompKeep)
            dc = dc.replace(/^\n+/, '');
        if (dc) {
            if ((!chompKeep || contentComment) && lines[lines.length - 1] !== '')
                lines.push('');
            lines.push(stringifyComment.indentComment(commentString(dc), ''));
        }
    }
    return lines.join('\n') + '\n';
}

exports.stringifyDocument = stringifyDocument;


/***/ }),
/* 56 */
/***/ ((__unused_webpack_module, exports) => {



class YAMLError extends Error {
    constructor(name, pos, code, message) {
        super();
        this.name = name;
        this.code = code;
        this.message = message;
        this.pos = pos;
    }
}
class YAMLParseError extends YAMLError {
    constructor(pos, code, message) {
        super('YAMLParseError', pos, code, message);
    }
}
class YAMLWarning extends YAMLError {
    constructor(pos, code, message) {
        super('YAMLWarning', pos, code, message);
    }
}
const prettifyError = (src, lc) => (error) => {
    if (error.pos[0] === -1)
        return;
    error.linePos = error.pos.map(pos => lc.linePos(pos));
    const { line, col } = error.linePos[0];
    error.message += ` at line ${line}, column ${col}`;
    let ci = col - 1;
    let lineStr = src
        .substring(lc.lineStarts[line - 1], lc.lineStarts[line])
        .replace(/[\n\r]+$/, '');
    // Trim to max 80 chars, keeping col position near the middle
    if (ci >= 60 && lineStr.length > 80) {
        const trimStart = Math.min(ci - 39, lineStr.length - 79);
        lineStr = '…' + lineStr.substring(trimStart);
        ci -= trimStart - 1;
    }
    if (lineStr.length > 80)
        lineStr = lineStr.substring(0, 79) + '…';
    // Include previous line in context if pointing at line start
    if (line > 1 && /^ *$/.test(lineStr.substring(0, ci))) {
        // Regexp won't match if start is trimmed
        let prev = src.substring(lc.lineStarts[line - 2], lc.lineStarts[line - 1]);
        if (prev.length > 80)
            prev = prev.substring(0, 79) + '…\n';
        lineStr = prev + lineStr;
    }
    if (/[^ ]/.test(lineStr)) {
        let count = 1;
        const end = error.linePos[1];
        if (end?.line === line && end.col > col) {
            count = Math.max(1, Math.min(end.col - col, 80 - ci));
        }
        const pointer = ' '.repeat(ci) + '^'.repeat(count);
        error.message += `:\n\n${lineStr}\n${pointer}\n`;
    }
};

exports.YAMLError = YAMLError;
exports.YAMLParseError = YAMLParseError;
exports.YAMLWarning = YAMLWarning;
exports.prettifyError = prettifyError;


/***/ }),
/* 57 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var Document = __webpack_require__(12);
var composeNode = __webpack_require__(58);
var resolveEnd = __webpack_require__(67);
var resolveProps = __webpack_require__(61);

function composeDoc(options, directives, { offset, start, value, end }, onError) {
    const opts = Object.assign({ _directives: directives }, options);
    const doc = new Document.Document(undefined, opts);
    const ctx = {
        atKey: false,
        atRoot: true,
        directives: doc.directives,
        options: doc.options,
        schema: doc.schema
    };
    const props = resolveProps.resolveProps(start, {
        indicator: 'doc-start',
        next: value ?? end?.[0],
        offset,
        onError,
        parentIndent: 0,
        startOnNewline: true
    });
    if (props.found) {
        doc.directives.docStart = true;
        if (value &&
            (value.type === 'block-map' || value.type === 'block-seq') &&
            !props.hasNewline)
            onError(props.end, 'MISSING_CHAR', 'Block collection cannot start on same line with directives-end marker');
    }
    // @ts-expect-error If Contents is set, let's trust the user
    doc.contents = value
        ? composeNode.composeNode(ctx, value, props, onError)
        : composeNode.composeEmptyNode(ctx, props.end, start, null, props, onError);
    const contentEnd = doc.contents.range[2];
    const re = resolveEnd.resolveEnd(end, contentEnd, false, onError);
    if (re.comment)
        doc.comment = re.comment;
    doc.range = [offset, contentEnd, re.offset];
    return doc;
}

exports.composeDoc = composeDoc;


/***/ }),
/* 58 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var Alias = __webpack_require__(13);
var identity = __webpack_require__(10);
var composeCollection = __webpack_require__(59);
var composeScalar = __webpack_require__(68);
var resolveEnd = __webpack_require__(67);
var utilEmptyScalarPosition = __webpack_require__(71);

const CN = { composeNode, composeEmptyNode };
function composeNode(ctx, token, props, onError) {
    const atKey = ctx.atKey;
    const { spaceBefore, comment, anchor, tag } = props;
    let node;
    let isSrcToken = true;
    switch (token.type) {
        case 'alias':
            node = composeAlias(ctx, token, onError);
            if (anchor || tag)
                onError(token, 'ALIAS_PROPS', 'An alias node must not specify any properties');
            break;
        case 'scalar':
        case 'single-quoted-scalar':
        case 'double-quoted-scalar':
        case 'block-scalar':
            node = composeScalar.composeScalar(ctx, token, tag, onError);
            if (anchor)
                node.anchor = anchor.source.substring(1);
            break;
        case 'block-map':
        case 'block-seq':
        case 'flow-collection':
            try {
                node = composeCollection.composeCollection(CN, ctx, token, props, onError);
                if (anchor)
                    node.anchor = anchor.source.substring(1);
            }
            catch (error) {
                // Almost certainly here due to a stack overflow
                const message = error instanceof Error ? error.message : String(error);
                onError(token, 'RESOURCE_EXHAUSTION', message);
            }
            break;
        default: {
            const message = token.type === 'error'
                ? token.message
                : `Unsupported token (type: ${token.type})`;
            onError(token, 'UNEXPECTED_TOKEN', message);
            isSrcToken = false;
        }
    }
    node ?? (node = composeEmptyNode(ctx, token.offset, undefined, null, props, onError));
    if (anchor && node.anchor === '')
        onError(anchor, 'BAD_ALIAS', 'Anchor cannot be an empty string');
    if (atKey &&
        ctx.options.stringKeys &&
        (!identity.isScalar(node) ||
            typeof node.value !== 'string' ||
            (node.tag && node.tag !== 'tag:yaml.org,2002:str'))) {
        const msg = 'With stringKeys, all keys must be strings';
        onError(tag ?? token, 'NON_STRING_KEY', msg);
    }
    if (spaceBefore)
        node.spaceBefore = true;
    if (comment) {
        if (token.type === 'scalar' && token.source === '')
            node.comment = comment;
        else
            node.commentBefore = comment;
    }
    // @ts-expect-error Type checking misses meaning of isSrcToken
    if (ctx.options.keepSourceTokens && isSrcToken)
        node.srcToken = token;
    return node;
}
function composeEmptyNode(ctx, offset, before, pos, { spaceBefore, comment, anchor, tag, end }, onError) {
    const token = {
        type: 'scalar',
        offset: utilEmptyScalarPosition.emptyScalarPosition(offset, before, pos),
        indent: -1,
        source: ''
    };
    const node = composeScalar.composeScalar(ctx, token, tag, onError);
    if (anchor) {
        node.anchor = anchor.source.substring(1);
        if (node.anchor === '')
            onError(anchor, 'BAD_ALIAS', 'Anchor cannot be an empty string');
    }
    if (spaceBefore)
        node.spaceBefore = true;
    if (comment) {
        node.comment = comment;
        node.range[2] = end;
    }
    return node;
}
function composeAlias({ options }, { offset, source, end }, onError) {
    const alias = new Alias.Alias(source.substring(1));
    if (alias.source === '')
        onError(offset, 'BAD_ALIAS', 'Alias cannot be an empty string');
    if (alias.source.endsWith(':'))
        onError(offset + source.length - 1, 'BAD_ALIAS', 'Alias ending in : is ambiguous', true);
    const valueEnd = offset + source.length;
    const re = resolveEnd.resolveEnd(end, valueEnd, options.strict, onError);
    alias.range = [offset, valueEnd, re.offset];
    if (re.comment)
        alias.comment = re.comment;
    return alias;
}

exports.composeEmptyNode = composeEmptyNode;
exports.composeNode = composeNode;


/***/ }),
/* 59 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var identity = __webpack_require__(10);
var Scalar = __webpack_require__(20);
var YAMLMap = __webpack_require__(32);
var YAMLSeq = __webpack_require__(35);
var resolveBlockMap = __webpack_require__(60);
var resolveBlockSeq = __webpack_require__(65);
var resolveFlowCollection = __webpack_require__(66);

function resolveCollection(CN, ctx, token, onError, tagName, tag) {
    const coll = token.type === 'block-map'
        ? resolveBlockMap.resolveBlockMap(CN, ctx, token, onError, tag)
        : token.type === 'block-seq'
            ? resolveBlockSeq.resolveBlockSeq(CN, ctx, token, onError, tag)
            : resolveFlowCollection.resolveFlowCollection(CN, ctx, token, onError, tag);
    const Coll = coll.constructor;
    // If we got a tagName matching the class, or the tag name is '!',
    // then use the tagName from the node class used to create it.
    if (tagName === '!' || tagName === Coll.tagName) {
        coll.tag = Coll.tagName;
        return coll;
    }
    if (tagName)
        coll.tag = tagName;
    return coll;
}
function composeCollection(CN, ctx, token, props, onError) {
    const tagToken = props.tag;
    const tagName = !tagToken
        ? null
        : ctx.directives.tagName(tagToken.source, msg => onError(tagToken, 'TAG_RESOLVE_FAILED', msg));
    if (token.type === 'block-seq') {
        const { anchor, newlineAfterProp: nl } = props;
        const lastProp = anchor && tagToken
            ? anchor.offset > tagToken.offset
                ? anchor
                : tagToken
            : (anchor ?? tagToken);
        if (lastProp && (!nl || nl.offset < lastProp.offset)) {
            const message = 'Missing newline after block sequence props';
            onError(lastProp, 'MISSING_CHAR', message);
        }
    }
    const expType = token.type === 'block-map'
        ? 'map'
        : token.type === 'block-seq'
            ? 'seq'
            : token.start.source === '{'
                ? 'map'
                : 'seq';
    // shortcut: check if it's a generic YAMLMap or YAMLSeq
    // before jumping into the custom tag logic.
    if (!tagToken ||
        !tagName ||
        tagName === '!' ||
        (tagName === YAMLMap.YAMLMap.tagName && expType === 'map') ||
        (tagName === YAMLSeq.YAMLSeq.tagName && expType === 'seq')) {
        return resolveCollection(CN, ctx, token, onError, tagName);
    }
    let tag = ctx.schema.tags.find(t => t.tag === tagName && t.collection === expType);
    if (!tag) {
        const kt = ctx.schema.knownTags[tagName];
        if (kt?.collection === expType) {
            ctx.schema.tags.push(Object.assign({}, kt, { default: false }));
            tag = kt;
        }
        else {
            if (kt) {
                onError(tagToken, 'BAD_COLLECTION_TYPE', `${kt.tag} used for ${expType} collection, but expects ${kt.collection ?? 'scalar'}`, true);
            }
            else {
                onError(tagToken, 'TAG_RESOLVE_FAILED', `Unresolved tag: ${tagName}`, true);
            }
            return resolveCollection(CN, ctx, token, onError, tagName);
        }
    }
    const coll = resolveCollection(CN, ctx, token, onError, tagName, tag);
    const res = tag.resolve?.(coll, msg => onError(tagToken, 'TAG_RESOLVE_FAILED', msg), ctx.options) ?? coll;
    const node = identity.isNode(res)
        ? res
        : new Scalar.Scalar(res);
    node.range = coll.range;
    node.tag = tagName;
    if (tag?.format)
        node.format = tag.format;
    return node;
}

exports.composeCollection = composeCollection;


/***/ }),
/* 60 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var Pair = __webpack_require__(21);
var YAMLMap = __webpack_require__(32);
var resolveProps = __webpack_require__(61);
var utilContainsNewline = __webpack_require__(62);
var utilFlowIndentCheck = __webpack_require__(63);
var utilMapIncludes = __webpack_require__(64);

const startColMsg = 'All mapping items must start at the same column';
function resolveBlockMap({ composeNode, composeEmptyNode }, ctx, bm, onError, tag) {
    const NodeClass = tag?.nodeClass ?? YAMLMap.YAMLMap;
    const map = new NodeClass(ctx.schema);
    if (ctx.atRoot)
        ctx.atRoot = false;
    let offset = bm.offset;
    let commentEnd = null;
    for (const collItem of bm.items) {
        const { start, key, sep, value } = collItem;
        // key properties
        const keyProps = resolveProps.resolveProps(start, {
            indicator: 'explicit-key-ind',
            next: key ?? sep?.[0],
            offset,
            onError,
            parentIndent: bm.indent,
            startOnNewline: true
        });
        const implicitKey = !keyProps.found;
        if (implicitKey) {
            if (key) {
                if (key.type === 'block-seq')
                    onError(offset, 'BLOCK_AS_IMPLICIT_KEY', 'A block sequence may not be used as an implicit map key');
                else if ('indent' in key && key.indent !== bm.indent)
                    onError(offset, 'BAD_INDENT', startColMsg);
            }
            if (!keyProps.anchor && !keyProps.tag && !sep) {
                commentEnd = keyProps.end;
                if (keyProps.comment) {
                    if (map.comment)
                        map.comment += '\n' + keyProps.comment;
                    else
                        map.comment = keyProps.comment;
                }
                continue;
            }
            if (keyProps.newlineAfterProp || utilContainsNewline.containsNewline(key)) {
                onError(key ?? start[start.length - 1], 'MULTILINE_IMPLICIT_KEY', 'Implicit keys need to be on a single line');
            }
        }
        else if (keyProps.found?.indent !== bm.indent) {
            onError(offset, 'BAD_INDENT', startColMsg);
        }
        // key value
        ctx.atKey = true;
        const keyStart = keyProps.end;
        const keyNode = key
            ? composeNode(ctx, key, keyProps, onError)
            : composeEmptyNode(ctx, keyStart, start, null, keyProps, onError);
        if (ctx.schema.compat)
            utilFlowIndentCheck.flowIndentCheck(bm.indent, key, onError);
        ctx.atKey = false;
        if (utilMapIncludes.mapIncludes(ctx, map.items, keyNode))
            onError(keyStart, 'DUPLICATE_KEY', 'Map keys must be unique');
        // value properties
        const valueProps = resolveProps.resolveProps(sep ?? [], {
            indicator: 'map-value-ind',
            next: value,
            offset: keyNode.range[2],
            onError,
            parentIndent: bm.indent,
            startOnNewline: !key || key.type === 'block-scalar'
        });
        offset = valueProps.end;
        if (valueProps.found) {
            if (implicitKey) {
                if (value?.type === 'block-map' && !valueProps.hasNewline)
                    onError(offset, 'BLOCK_AS_IMPLICIT_KEY', 'Nested mappings are not allowed in compact mappings');
                if (ctx.options.strict &&
                    keyProps.start < valueProps.found.offset - 1024)
                    onError(keyNode.range, 'KEY_OVER_1024_CHARS', 'The : indicator must be at most 1024 chars after the start of an implicit block mapping key');
            }
            // value value
            const valueNode = value
                ? composeNode(ctx, value, valueProps, onError)
                : composeEmptyNode(ctx, offset, sep, null, valueProps, onError);
            if (ctx.schema.compat)
                utilFlowIndentCheck.flowIndentCheck(bm.indent, value, onError);
            offset = valueNode.range[2];
            const pair = new Pair.Pair(keyNode, valueNode);
            if (ctx.options.keepSourceTokens)
                pair.srcToken = collItem;
            map.items.push(pair);
        }
        else {
            // key with no value
            if (implicitKey)
                onError(keyNode.range, 'MISSING_CHAR', 'Implicit map keys need to be followed by map values');
            if (valueProps.comment) {
                if (keyNode.comment)
                    keyNode.comment += '\n' + valueProps.comment;
                else
                    keyNode.comment = valueProps.comment;
            }
            const pair = new Pair.Pair(keyNode);
            if (ctx.options.keepSourceTokens)
                pair.srcToken = collItem;
            map.items.push(pair);
        }
    }
    if (commentEnd && commentEnd < offset)
        onError(commentEnd, 'IMPOSSIBLE', 'Map comment with trailing content');
    map.range = [bm.offset, offset, commentEnd ?? offset];
    return map;
}

exports.resolveBlockMap = resolveBlockMap;


/***/ }),
/* 61 */
/***/ ((__unused_webpack_module, exports) => {



function resolveProps(tokens, { flow, indicator, next, offset, onError, parentIndent, startOnNewline }) {
    let spaceBefore = false;
    let atNewline = startOnNewline;
    let hasSpace = startOnNewline;
    let comment = '';
    let commentSep = '';
    let hasNewline = false;
    let reqSpace = false;
    let tab = null;
    let anchor = null;
    let tag = null;
    let newlineAfterProp = null;
    let comma = null;
    let found = null;
    let start = null;
    for (const token of tokens) {
        if (reqSpace) {
            if (token.type !== 'space' &&
                token.type !== 'newline' &&
                token.type !== 'comma')
                onError(token.offset, 'MISSING_CHAR', 'Tags and anchors must be separated from the next token by white space');
            reqSpace = false;
        }
        if (tab) {
            if (atNewline && token.type !== 'comment' && token.type !== 'newline') {
                onError(tab, 'TAB_AS_INDENT', 'Tabs are not allowed as indentation');
            }
            tab = null;
        }
        switch (token.type) {
            case 'space':
                // At the doc level, tabs at line start may be parsed
                // as leading white space rather than indentation.
                // In a flow collection, only the parser handles indent.
                if (!flow &&
                    (indicator !== 'doc-start' || next?.type !== 'flow-collection') &&
                    token.source.includes('\t')) {
                    tab = token;
                }
                hasSpace = true;
                break;
            case 'comment': {
                if (!hasSpace)
                    onError(token, 'MISSING_CHAR', 'Comments must be separated from other tokens by white space characters');
                const cb = token.source.substring(1) || ' ';
                if (!comment)
                    comment = cb;
                else
                    comment += commentSep + cb;
                commentSep = '';
                atNewline = false;
                break;
            }
            case 'newline':
                if (atNewline) {
                    if (comment)
                        comment += token.source;
                    else if (!found || indicator !== 'seq-item-ind')
                        spaceBefore = true;
                }
                else
                    commentSep += token.source;
                atNewline = true;
                hasNewline = true;
                if (anchor || tag)
                    newlineAfterProp = token;
                hasSpace = true;
                break;
            case 'anchor':
                if (anchor)
                    onError(token, 'MULTIPLE_ANCHORS', 'A node can have at most one anchor');
                if (token.source.endsWith(':'))
                    onError(token.offset + token.source.length - 1, 'BAD_ALIAS', 'Anchor ending in : is ambiguous', true);
                anchor = token;
                start ?? (start = token.offset);
                atNewline = false;
                hasSpace = false;
                reqSpace = true;
                break;
            case 'tag': {
                if (tag)
                    onError(token, 'MULTIPLE_TAGS', 'A node can have at most one tag');
                tag = token;
                start ?? (start = token.offset);
                atNewline = false;
                hasSpace = false;
                reqSpace = true;
                break;
            }
            case indicator:
                // Could here handle preceding comments differently
                if (anchor || tag)
                    onError(token, 'BAD_PROP_ORDER', `Anchors and tags must be after the ${token.source} indicator`);
                if (found)
                    onError(token, 'UNEXPECTED_TOKEN', `Unexpected ${token.source} in ${flow ?? 'collection'}`);
                found = token;
                atNewline =
                    indicator === 'seq-item-ind' || indicator === 'explicit-key-ind';
                hasSpace = false;
                break;
            case 'comma':
                if (flow) {
                    if (comma)
                        onError(token, 'UNEXPECTED_TOKEN', `Unexpected , in ${flow}`);
                    comma = token;
                    atNewline = false;
                    hasSpace = false;
                    break;
                }
            // else fallthrough
            default:
                onError(token, 'UNEXPECTED_TOKEN', `Unexpected ${token.type} token`);
                atNewline = false;
                hasSpace = false;
        }
    }
    const last = tokens[tokens.length - 1];
    const end = last ? last.offset + last.source.length : offset;
    if (reqSpace &&
        next &&
        next.type !== 'space' &&
        next.type !== 'newline' &&
        next.type !== 'comma' &&
        (next.type !== 'scalar' || next.source !== '')) {
        onError(next.offset, 'MISSING_CHAR', 'Tags and anchors must be separated from the next token by white space');
    }
    if (tab &&
        ((atNewline && tab.indent <= parentIndent) ||
            next?.type === 'block-map' ||
            next?.type === 'block-seq'))
        onError(tab, 'TAB_AS_INDENT', 'Tabs are not allowed as indentation');
    return {
        comma,
        found,
        spaceBefore,
        comment,
        hasNewline,
        anchor,
        tag,
        newlineAfterProp,
        end,
        start: start ?? end
    };
}

exports.resolveProps = resolveProps;


/***/ }),
/* 62 */
/***/ ((__unused_webpack_module, exports) => {



function containsNewline(key) {
    if (!key)
        return null;
    switch (key.type) {
        case 'alias':
        case 'scalar':
        case 'double-quoted-scalar':
        case 'single-quoted-scalar':
            if (key.source.includes('\n'))
                return true;
            if (key.end)
                for (const st of key.end)
                    if (st.type === 'newline')
                        return true;
            return false;
        case 'flow-collection':
            for (const it of key.items) {
                for (const st of it.start)
                    if (st.type === 'newline')
                        return true;
                if (it.sep)
                    for (const st of it.sep)
                        if (st.type === 'newline')
                            return true;
                if (containsNewline(it.key) || containsNewline(it.value))
                    return true;
            }
            return false;
        default:
            return true;
    }
}

exports.containsNewline = containsNewline;


/***/ }),
/* 63 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var utilContainsNewline = __webpack_require__(62);

function flowIndentCheck(indent, fc, onError) {
    if (fc?.type === 'flow-collection') {
        const end = fc.end[0];
        if (end.indent === indent &&
            (end.source === ']' || end.source === '}') &&
            utilContainsNewline.containsNewline(fc)) {
            const msg = 'Flow end indicator should be more indented than parent';
            onError(end, 'BAD_INDENT', msg, true);
        }
    }
}

exports.flowIndentCheck = flowIndentCheck;


/***/ }),
/* 64 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var identity = __webpack_require__(10);

function mapIncludes(ctx, items, search) {
    const { uniqueKeys } = ctx.options;
    if (uniqueKeys === false)
        return false;
    const isEqual = typeof uniqueKeys === 'function'
        ? uniqueKeys
        : (a, b) => a === b || (identity.isScalar(a) && identity.isScalar(b) && a.value === b.value);
    return items.some(pair => isEqual(pair.key, search));
}

exports.mapIncludes = mapIncludes;


/***/ }),
/* 65 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var YAMLSeq = __webpack_require__(35);
var resolveProps = __webpack_require__(61);
var utilFlowIndentCheck = __webpack_require__(63);

function resolveBlockSeq({ composeNode, composeEmptyNode }, ctx, bs, onError, tag) {
    const NodeClass = tag?.nodeClass ?? YAMLSeq.YAMLSeq;
    const seq = new NodeClass(ctx.schema);
    if (ctx.atRoot)
        ctx.atRoot = false;
    if (ctx.atKey)
        ctx.atKey = false;
    let offset = bs.offset;
    let commentEnd = null;
    for (const { start, value } of bs.items) {
        const props = resolveProps.resolveProps(start, {
            indicator: 'seq-item-ind',
            next: value,
            offset,
            onError,
            parentIndent: bs.indent,
            startOnNewline: true
        });
        if (!props.found) {
            if (props.anchor || props.tag || value) {
                if (value?.type === 'block-seq')
                    onError(props.end, 'BAD_INDENT', 'All sequence items must start at the same column');
                else
                    onError(offset, 'MISSING_CHAR', 'Sequence item without - indicator');
            }
            else {
                commentEnd = props.end;
                if (props.comment)
                    seq.comment = props.comment;
                continue;
            }
        }
        const node = value
            ? composeNode(ctx, value, props, onError)
            : composeEmptyNode(ctx, props.end, start, null, props, onError);
        if (ctx.schema.compat)
            utilFlowIndentCheck.flowIndentCheck(bs.indent, value, onError);
        offset = node.range[2];
        seq.items.push(node);
    }
    seq.range = [bs.offset, offset, commentEnd ?? offset];
    return seq;
}

exports.resolveBlockSeq = resolveBlockSeq;


/***/ }),
/* 66 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var identity = __webpack_require__(10);
var Pair = __webpack_require__(21);
var YAMLMap = __webpack_require__(32);
var YAMLSeq = __webpack_require__(35);
var resolveEnd = __webpack_require__(67);
var resolveProps = __webpack_require__(61);
var utilContainsNewline = __webpack_require__(62);
var utilMapIncludes = __webpack_require__(64);

const blockMsg = 'Block collections are not allowed within flow collections';
const isBlock = (token) => token && (token.type === 'block-map' || token.type === 'block-seq');
function resolveFlowCollection({ composeNode, composeEmptyNode }, ctx, fc, onError, tag) {
    const isMap = fc.start.source === '{';
    const fcName = isMap ? 'flow map' : 'flow sequence';
    const NodeClass = (tag?.nodeClass ?? (isMap ? YAMLMap.YAMLMap : YAMLSeq.YAMLSeq));
    const coll = new NodeClass(ctx.schema);
    coll.flow = true;
    const atRoot = ctx.atRoot;
    if (atRoot)
        ctx.atRoot = false;
    if (ctx.atKey)
        ctx.atKey = false;
    let offset = fc.offset + fc.start.source.length;
    for (let i = 0; i < fc.items.length; ++i) {
        const collItem = fc.items[i];
        const { start, key, sep, value } = collItem;
        const props = resolveProps.resolveProps(start, {
            flow: fcName,
            indicator: 'explicit-key-ind',
            next: key ?? sep?.[0],
            offset,
            onError,
            parentIndent: fc.indent,
            startOnNewline: false
        });
        if (!props.found) {
            if (!props.anchor && !props.tag && !sep && !value) {
                if (i === 0 && props.comma)
                    onError(props.comma, 'UNEXPECTED_TOKEN', `Unexpected , in ${fcName}`);
                else if (i < fc.items.length - 1)
                    onError(props.start, 'UNEXPECTED_TOKEN', `Unexpected empty item in ${fcName}`);
                if (props.comment) {
                    if (coll.comment)
                        coll.comment += '\n' + props.comment;
                    else
                        coll.comment = props.comment;
                }
                offset = props.end;
                continue;
            }
            if (!isMap && ctx.options.strict && utilContainsNewline.containsNewline(key))
                onError(key, // checked by containsNewline()
                'MULTILINE_IMPLICIT_KEY', 'Implicit keys of flow sequence pairs need to be on a single line');
        }
        if (i === 0) {
            if (props.comma)
                onError(props.comma, 'UNEXPECTED_TOKEN', `Unexpected , in ${fcName}`);
        }
        else {
            if (!props.comma)
                onError(props.start, 'MISSING_CHAR', `Missing , between ${fcName} items`);
            if (props.comment) {
                let prevItemComment = '';
                loop: for (const st of start) {
                    switch (st.type) {
                        case 'comma':
                        case 'space':
                            break;
                        case 'comment':
                            prevItemComment = st.source.substring(1);
                            break loop;
                        default:
                            break loop;
                    }
                }
                if (prevItemComment) {
                    let prev = coll.items[coll.items.length - 1];
                    if (identity.isPair(prev))
                        prev = prev.value ?? prev.key;
                    if (prev.comment)
                        prev.comment += '\n' + prevItemComment;
                    else
                        prev.comment = prevItemComment;
                    props.comment = props.comment.substring(prevItemComment.length + 1);
                }
            }
        }
        if (!isMap && !sep && !props.found) {
            // item is a value in a seq
            // → key & sep are empty, start does not include ? or :
            const valueNode = value
                ? composeNode(ctx, value, props, onError)
                : composeEmptyNode(ctx, props.end, sep, null, props, onError);
            coll.items.push(valueNode);
            offset = valueNode.range[2];
            if (isBlock(value))
                onError(valueNode.range, 'BLOCK_IN_FLOW', blockMsg);
        }
        else {
            // item is a key+value pair
            // key value
            ctx.atKey = true;
            const keyStart = props.end;
            const keyNode = key
                ? composeNode(ctx, key, props, onError)
                : composeEmptyNode(ctx, keyStart, start, null, props, onError);
            if (isBlock(key))
                onError(keyNode.range, 'BLOCK_IN_FLOW', blockMsg);
            ctx.atKey = false;
            // value properties
            const valueProps = resolveProps.resolveProps(sep ?? [], {
                flow: fcName,
                indicator: 'map-value-ind',
                next: value,
                offset: keyNode.range[2],
                onError,
                parentIndent: fc.indent,
                startOnNewline: false
            });
            if (valueProps.found) {
                if (!isMap && !props.found && ctx.options.strict) {
                    if (sep)
                        for (const st of sep) {
                            if (st === valueProps.found)
                                break;
                            if (st.type === 'newline') {
                                onError(st, 'MULTILINE_IMPLICIT_KEY', 'Implicit keys of flow sequence pairs need to be on a single line');
                                break;
                            }
                        }
                    if (props.start < valueProps.found.offset - 1024)
                        onError(valueProps.found, 'KEY_OVER_1024_CHARS', 'The : indicator must be at most 1024 chars after the start of an implicit flow sequence key');
                }
            }
            else if (value) {
                if ('source' in value && value.source?.[0] === ':')
                    onError(value, 'MISSING_CHAR', `Missing space after : in ${fcName}`);
                else
                    onError(valueProps.start, 'MISSING_CHAR', `Missing , or : between ${fcName} items`);
            }
            // value value
            const valueNode = value
                ? composeNode(ctx, value, valueProps, onError)
                : valueProps.found
                    ? composeEmptyNode(ctx, valueProps.end, sep, null, valueProps, onError)
                    : null;
            if (valueNode) {
                if (isBlock(value))
                    onError(valueNode.range, 'BLOCK_IN_FLOW', blockMsg);
            }
            else if (valueProps.comment) {
                if (keyNode.comment)
                    keyNode.comment += '\n' + valueProps.comment;
                else
                    keyNode.comment = valueProps.comment;
            }
            const pair = new Pair.Pair(keyNode, valueNode);
            if (ctx.options.keepSourceTokens)
                pair.srcToken = collItem;
            if (isMap) {
                const map = coll;
                if (utilMapIncludes.mapIncludes(ctx, map.items, keyNode))
                    onError(keyStart, 'DUPLICATE_KEY', 'Map keys must be unique');
                map.items.push(pair);
            }
            else {
                const map = new YAMLMap.YAMLMap(ctx.schema);
                map.flow = true;
                map.items.push(pair);
                const endRange = (valueNode ?? keyNode).range;
                map.range = [keyNode.range[0], endRange[1], endRange[2]];
                coll.items.push(map);
            }
            offset = valueNode ? valueNode.range[2] : valueProps.end;
        }
    }
    const expectedEnd = isMap ? '}' : ']';
    const [ce, ...ee] = fc.end;
    let cePos = offset;
    if (ce?.source === expectedEnd)
        cePos = ce.offset + ce.source.length;
    else {
        const name = fcName[0].toUpperCase() + fcName.substring(1);
        const msg = atRoot
            ? `${name} must end with a ${expectedEnd}`
            : `${name} in block collection must be sufficiently indented and end with a ${expectedEnd}`;
        onError(offset, atRoot ? 'MISSING_CHAR' : 'BAD_INDENT', msg);
        if (ce && ce.source.length !== 1)
            ee.unshift(ce);
    }
    if (ee.length > 0) {
        const end = resolveEnd.resolveEnd(ee, cePos, ctx.options.strict, onError);
        if (end.comment) {
            if (coll.comment)
                coll.comment += '\n' + end.comment;
            else
                coll.comment = end.comment;
        }
        coll.range = [fc.offset, cePos, end.offset];
    }
    else {
        coll.range = [fc.offset, cePos, cePos];
    }
    return coll;
}

exports.resolveFlowCollection = resolveFlowCollection;


/***/ }),
/* 67 */
/***/ ((__unused_webpack_module, exports) => {



function resolveEnd(end, offset, reqSpace, onError) {
    let comment = '';
    if (end) {
        let hasSpace = false;
        let sep = '';
        for (const token of end) {
            const { source, type } = token;
            switch (type) {
                case 'space':
                    hasSpace = true;
                    break;
                case 'comment': {
                    if (reqSpace && !hasSpace)
                        onError(token, 'MISSING_CHAR', 'Comments must be separated from other tokens by white space characters');
                    const cb = source.substring(1) || ' ';
                    if (!comment)
                        comment = cb;
                    else
                        comment += sep + cb;
                    sep = '';
                    break;
                }
                case 'newline':
                    if (comment)
                        sep += source;
                    hasSpace = true;
                    break;
                default:
                    onError(token, 'UNEXPECTED_TOKEN', `Unexpected ${type} at node end`);
            }
            offset += source.length;
        }
    }
    return { comment, offset };
}

exports.resolveEnd = resolveEnd;


/***/ }),
/* 68 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var identity = __webpack_require__(10);
var Scalar = __webpack_require__(20);
var resolveBlockScalar = __webpack_require__(69);
var resolveFlowScalar = __webpack_require__(70);

function composeScalar(ctx, token, tagToken, onError) {
    const { value, type, comment, range } = token.type === 'block-scalar'
        ? resolveBlockScalar.resolveBlockScalar(ctx, token, onError)
        : resolveFlowScalar.resolveFlowScalar(token, ctx.options.strict, onError);
    const tagName = tagToken
        ? ctx.directives.tagName(tagToken.source, msg => onError(tagToken, 'TAG_RESOLVE_FAILED', msg))
        : null;
    let tag;
    if (ctx.options.stringKeys && ctx.atKey) {
        tag = ctx.schema[identity.SCALAR];
    }
    else if (tagName)
        tag = findScalarTagByName(ctx.schema, value, tagName, tagToken, onError);
    else if (token.type === 'scalar')
        tag = findScalarTagByTest(ctx, value, token, onError);
    else
        tag = ctx.schema[identity.SCALAR];
    let scalar;
    try {
        const res = tag.resolve(value, msg => onError(tagToken ?? token, 'TAG_RESOLVE_FAILED', msg), ctx.options);
        scalar = identity.isScalar(res) ? res : new Scalar.Scalar(res);
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        onError(tagToken ?? token, 'TAG_RESOLVE_FAILED', msg);
        scalar = new Scalar.Scalar(value);
    }
    scalar.range = range;
    scalar.source = value;
    if (type)
        scalar.type = type;
    if (tagName)
        scalar.tag = tagName;
    if (tag.format)
        scalar.format = tag.format;
    if (comment)
        scalar.comment = comment;
    return scalar;
}
function findScalarTagByName(schema, value, tagName, tagToken, onError) {
    if (tagName === '!')
        return schema[identity.SCALAR]; // non-specific tag
    const matchWithTest = [];
    for (const tag of schema.tags) {
        if (!tag.collection && tag.tag === tagName) {
            if (tag.default && tag.test)
                matchWithTest.push(tag);
            else
                return tag;
        }
    }
    for (const tag of matchWithTest)
        if (tag.test?.test(value))
            return tag;
    const kt = schema.knownTags[tagName];
    if (kt && !kt.collection) {
        // Ensure that the known tag is available for stringifying,
        // but does not get used by default.
        schema.tags.push(Object.assign({}, kt, { default: false, test: undefined }));
        return kt;
    }
    onError(tagToken, 'TAG_RESOLVE_FAILED', `Unresolved tag: ${tagName}`, tagName !== 'tag:yaml.org,2002:str');
    return schema[identity.SCALAR];
}
function findScalarTagByTest({ atKey, directives, schema }, value, token, onError) {
    const tag = schema.tags.find(tag => (tag.default === true || (atKey && tag.default === 'key')) &&
        tag.test?.test(value)) || schema[identity.SCALAR];
    if (schema.compat) {
        const compat = schema.compat.find(tag => tag.default && tag.test?.test(value)) ??
            schema[identity.SCALAR];
        if (tag.tag !== compat.tag) {
            const ts = directives.tagString(tag.tag);
            const cs = directives.tagString(compat.tag);
            const msg = `Value may be parsed as either ${ts} or ${cs}`;
            onError(token, 'TAG_RESOLVE_FAILED', msg, true);
        }
    }
    return tag;
}

exports.composeScalar = composeScalar;


/***/ }),
/* 69 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var Scalar = __webpack_require__(20);

function resolveBlockScalar(ctx, scalar, onError) {
    const start = scalar.offset;
    const header = parseBlockScalarHeader(scalar, ctx.options.strict, onError);
    if (!header)
        return { value: '', type: null, comment: '', range: [start, start, start] };
    const type = header.mode === '>' ? Scalar.Scalar.BLOCK_FOLDED : Scalar.Scalar.BLOCK_LITERAL;
    const lines = scalar.source ? splitLines(scalar.source) : [];
    // determine the end of content & start of chomping
    let chompStart = lines.length;
    for (let i = lines.length - 1; i >= 0; --i) {
        const content = lines[i][1];
        if (content === '' || content === '\r')
            chompStart = i;
        else
            break;
    }
    // shortcut for empty contents
    if (chompStart === 0) {
        const value = header.chomp === '+' && lines.length > 0
            ? '\n'.repeat(Math.max(1, lines.length - 1))
            : '';
        let end = start + header.length;
        if (scalar.source)
            end += scalar.source.length;
        return { value, type, comment: header.comment, range: [start, end, end] };
    }
    // find the indentation level to trim from start
    let trimIndent = scalar.indent + header.indent;
    let offset = scalar.offset + header.length;
    let contentStart = 0;
    for (let i = 0; i < chompStart; ++i) {
        const [indent, content] = lines[i];
        if (content === '' || content === '\r') {
            if (header.indent === 0 && indent.length > trimIndent)
                trimIndent = indent.length;
        }
        else {
            if (indent.length < trimIndent) {
                const message = 'Block scalars with more-indented leading empty lines must use an explicit indentation indicator';
                onError(offset + indent.length, 'MISSING_CHAR', message);
            }
            if (header.indent === 0)
                trimIndent = indent.length;
            contentStart = i;
            if (trimIndent === 0 && !ctx.atRoot) {
                const message = 'Block scalar values in collections must be indented';
                onError(offset, 'BAD_INDENT', message);
            }
            break;
        }
        offset += indent.length + content.length + 1;
    }
    // include trailing more-indented empty lines in content
    for (let i = lines.length - 1; i >= chompStart; --i) {
        if (lines[i][0].length > trimIndent)
            chompStart = i + 1;
    }
    let value = '';
    let sep = '';
    let prevMoreIndented = false;
    // leading whitespace is kept intact
    for (let i = 0; i < contentStart; ++i)
        value += lines[i][0].slice(trimIndent) + '\n';
    for (let i = contentStart; i < chompStart; ++i) {
        let [indent, content] = lines[i];
        offset += indent.length + content.length + 1;
        const crlf = content[content.length - 1] === '\r';
        if (crlf)
            content = content.slice(0, -1);
        /* istanbul ignore if already caught in lexer */
        if (content && indent.length < trimIndent) {
            const src = header.indent
                ? 'explicit indentation indicator'
                : 'first line';
            const message = `Block scalar lines must not be less indented than their ${src}`;
            onError(offset - content.length - (crlf ? 2 : 1), 'BAD_INDENT', message);
            indent = '';
        }
        if (type === Scalar.Scalar.BLOCK_LITERAL) {
            value += sep + indent.slice(trimIndent) + content;
            sep = '\n';
        }
        else if (indent.length > trimIndent || content[0] === '\t') {
            // more-indented content within a folded block
            if (sep === ' ')
                sep = '\n';
            else if (!prevMoreIndented && sep === '\n')
                sep = '\n\n';
            value += sep + indent.slice(trimIndent) + content;
            sep = '\n';
            prevMoreIndented = true;
        }
        else if (content === '') {
            // empty line
            if (sep === '\n')
                value += '\n';
            else
                sep = '\n';
        }
        else {
            value += sep + content;
            sep = ' ';
            prevMoreIndented = false;
        }
    }
    switch (header.chomp) {
        case '-':
            break;
        case '+':
            for (let i = chompStart; i < lines.length; ++i)
                value += '\n' + lines[i][0].slice(trimIndent);
            if (value[value.length - 1] !== '\n')
                value += '\n';
            break;
        default:
            value += '\n';
    }
    const end = start + header.length + scalar.source.length;
    return { value, type, comment: header.comment, range: [start, end, end] };
}
function parseBlockScalarHeader({ offset, props }, strict, onError) {
    /* istanbul ignore if should not happen */
    if (props[0].type !== 'block-scalar-header') {
        onError(props[0], 'IMPOSSIBLE', 'Block scalar header not found');
        return null;
    }
    const { source } = props[0];
    const mode = source[0];
    let indent = 0;
    let chomp = '';
    let error = -1;
    for (let i = 1; i < source.length; ++i) {
        const ch = source[i];
        if (!chomp && (ch === '-' || ch === '+'))
            chomp = ch;
        else {
            const n = Number(ch);
            if (!indent && n)
                indent = n;
            else if (error === -1)
                error = offset + i;
        }
    }
    if (error !== -1)
        onError(error, 'UNEXPECTED_TOKEN', `Block scalar header includes extra characters: ${source}`);
    let hasSpace = false;
    let comment = '';
    let length = source.length;
    for (let i = 1; i < props.length; ++i) {
        const token = props[i];
        switch (token.type) {
            case 'space':
                hasSpace = true;
            // fallthrough
            case 'newline':
                length += token.source.length;
                break;
            case 'comment':
                if (strict && !hasSpace) {
                    const message = 'Comments must be separated from other tokens by white space characters';
                    onError(token, 'MISSING_CHAR', message);
                }
                length += token.source.length;
                comment = token.source.substring(1);
                break;
            case 'error':
                onError(token, 'UNEXPECTED_TOKEN', token.message);
                length += token.source.length;
                break;
            /* istanbul ignore next should not happen */
            default: {
                const message = `Unexpected token in block scalar header: ${token.type}`;
                onError(token, 'UNEXPECTED_TOKEN', message);
                const ts = token.source;
                if (ts && typeof ts === 'string')
                    length += ts.length;
            }
        }
    }
    return { mode, indent, chomp, comment, length };
}
/** @returns Array of lines split up as `[indent, content]` */
function splitLines(source) {
    const split = source.split(/\n( *)/);
    const first = split[0];
    const m = first.match(/^( *)/);
    const line0 = m?.[1]
        ? [m[1], first.slice(m[1].length)]
        : ['', first];
    const lines = [line0];
    for (let i = 1; i < split.length; i += 2)
        lines.push([split[i], split[i + 1]]);
    return lines;
}

exports.resolveBlockScalar = resolveBlockScalar;


/***/ }),
/* 70 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var Scalar = __webpack_require__(20);
var resolveEnd = __webpack_require__(67);

function resolveFlowScalar(scalar, strict, onError) {
    const { offset, type, source, end } = scalar;
    let _type;
    let value;
    const _onError = (rel, code, msg) => onError(offset + rel, code, msg);
    switch (type) {
        case 'scalar':
            _type = Scalar.Scalar.PLAIN;
            value = plainValue(source, _onError);
            break;
        case 'single-quoted-scalar':
            _type = Scalar.Scalar.QUOTE_SINGLE;
            value = singleQuotedValue(source, _onError);
            break;
        case 'double-quoted-scalar':
            _type = Scalar.Scalar.QUOTE_DOUBLE;
            value = doubleQuotedValue(source, _onError);
            break;
        /* istanbul ignore next should not happen */
        default:
            onError(scalar, 'UNEXPECTED_TOKEN', `Expected a flow scalar value, but found: ${type}`);
            return {
                value: '',
                type: null,
                comment: '',
                range: [offset, offset + source.length, offset + source.length]
            };
    }
    const valueEnd = offset + source.length;
    const re = resolveEnd.resolveEnd(end, valueEnd, strict, onError);
    return {
        value,
        type: _type,
        comment: re.comment,
        range: [offset, valueEnd, re.offset]
    };
}
function plainValue(source, onError) {
    let badChar = '';
    switch (source[0]) {
        /* istanbul ignore next should not happen */
        case '\t':
            badChar = 'a tab character';
            break;
        case ',':
            badChar = 'flow indicator character ,';
            break;
        case '%':
            badChar = 'directive indicator character %';
            break;
        case '|':
        case '>': {
            badChar = `block scalar indicator ${source[0]}`;
            break;
        }
        case '@':
        case '`': {
            badChar = `reserved character ${source[0]}`;
            break;
        }
    }
    if (badChar)
        onError(0, 'BAD_SCALAR_START', `Plain value cannot start with ${badChar}`);
    return foldLines(source);
}
function singleQuotedValue(source, onError) {
    if (source[source.length - 1] !== "'" || source.length === 1)
        onError(source.length, 'MISSING_CHAR', "Missing closing 'quote");
    return foldLines(source.slice(1, -1)).replace(/''/g, "'");
}
function foldLines(source) {
    /**
     * The negative lookbehind here and in the `re` RegExp is to
     * prevent causing a polynomial search time in certain cases.
     *
     * The try-catch is for Safari, which doesn't support this yet:
     * https://caniuse.com/js-regexp-lookbehind
     */
    let first, line;
    try {
        first = new RegExp('(.*?)(?<![ \t])[ \t]*\r?\n', 'sy');
        line = new RegExp('[ \t]*(.*?)(?:(?<![ \t])[ \t]*)?\r?\n', 'sy');
    }
    catch {
        first = /(.*?)[ \t]*\r?\n/sy;
        line = /[ \t]*(.*?)[ \t]*\r?\n/sy;
    }
    let match = first.exec(source);
    if (!match)
        return source;
    let res = match[1];
    let sep = ' ';
    let pos = first.lastIndex;
    line.lastIndex = pos;
    while ((match = line.exec(source))) {
        if (match[1] === '') {
            if (sep === '\n')
                res += sep;
            else
                sep = '\n';
        }
        else {
            res += sep + match[1];
            sep = ' ';
        }
        pos = line.lastIndex;
    }
    const last = /[ \t]*(.*)/sy;
    last.lastIndex = pos;
    match = last.exec(source);
    return res + sep + (match?.[1] ?? '');
}
function doubleQuotedValue(source, onError) {
    let res = '';
    for (let i = 1; i < source.length - 1; ++i) {
        const ch = source[i];
        if (ch === '\r' && source[i + 1] === '\n')
            continue;
        if (ch === '\n') {
            const { fold, offset } = foldNewline(source, i);
            res += fold;
            i = offset;
        }
        else if (ch === '\\') {
            let next = source[++i];
            const cc = escapeCodes[next];
            if (cc)
                res += cc;
            else if (next === '\n') {
                // skip escaped newlines, but still trim the following line
                next = source[i + 1];
                while (next === ' ' || next === '\t')
                    next = source[++i + 1];
            }
            else if (next === '\r' && source[i + 1] === '\n') {
                // skip escaped CRLF newlines, but still trim the following line
                next = source[++i + 1];
                while (next === ' ' || next === '\t')
                    next = source[++i + 1];
            }
            else if (next === 'x' || next === 'u' || next === 'U') {
                const length = { x: 2, u: 4, U: 8 }[next];
                res += parseCharCode(source, i + 1, length, onError);
                i += length;
            }
            else {
                const raw = source.substr(i - 1, 2);
                onError(i - 1, 'BAD_DQ_ESCAPE', `Invalid escape sequence ${raw}`);
                res += raw;
            }
        }
        else if (ch === ' ' || ch === '\t') {
            // trim trailing whitespace
            const wsStart = i;
            let next = source[i + 1];
            while (next === ' ' || next === '\t')
                next = source[++i + 1];
            if (next !== '\n' && !(next === '\r' && source[i + 2] === '\n'))
                res += i > wsStart ? source.slice(wsStart, i + 1) : ch;
        }
        else {
            res += ch;
        }
    }
    if (source[source.length - 1] !== '"' || source.length === 1)
        onError(source.length, 'MISSING_CHAR', 'Missing closing "quote');
    return res;
}
/**
 * Fold a single newline into a space, multiple newlines to N - 1 newlines.
 * Presumes `source[offset] === '\n'`
 */
function foldNewline(source, offset) {
    let fold = '';
    let ch = source[offset + 1];
    while (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
        if (ch === '\r' && source[offset + 2] !== '\n')
            break;
        if (ch === '\n')
            fold += '\n';
        offset += 1;
        ch = source[offset + 1];
    }
    if (!fold)
        fold = ' ';
    return { fold, offset };
}
const escapeCodes = {
    '0': '\0', // null character
    a: '\x07', // bell character
    b: '\b', // backspace
    e: '\x1b', // escape character
    f: '\f', // form feed
    n: '\n', // line feed
    r: '\r', // carriage return
    t: '\t', // horizontal tab
    v: '\v', // vertical tab
    N: '\u0085', // Unicode next line
    _: '\u00a0', // Unicode non-breaking space
    L: '\u2028', // Unicode line separator
    P: '\u2029', // Unicode paragraph separator
    ' ': ' ',
    '"': '"',
    '/': '/',
    '\\': '\\',
    '\t': '\t'
};
function parseCharCode(source, offset, length, onError) {
    const cc = source.substr(offset, length);
    const ok = cc.length === length && /^[0-9a-fA-F]+$/.test(cc);
    const code = ok ? parseInt(cc, 16) : NaN;
    if (isNaN(code)) {
        const raw = source.substr(offset - 2, length + 2);
        onError(offset - 2, 'BAD_DQ_ESCAPE', `Invalid escape sequence ${raw}`);
        return raw;
    }
    return String.fromCodePoint(code);
}

exports.resolveFlowScalar = resolveFlowScalar;


/***/ }),
/* 71 */
/***/ ((__unused_webpack_module, exports) => {



function emptyScalarPosition(offset, before, pos) {
    if (before) {
        pos ?? (pos = before.length);
        for (let i = pos - 1; i >= 0; --i) {
            let st = before[i];
            switch (st.type) {
                case 'space':
                case 'comment':
                case 'newline':
                    offset -= st.source.length;
                    continue;
            }
            // Technically, an empty scalar is immediately after the last non-empty
            // node, but it's more useful to place it after any whitespace.
            st = before[++i];
            while (st?.type === 'space') {
                offset += st.source.length;
                st = before[++i];
            }
            break;
        }
    }
    return offset;
}

exports.emptyScalarPosition = emptyScalarPosition;


/***/ }),
/* 72 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var cstScalar = __webpack_require__(73);
var cstStringify = __webpack_require__(74);
var cstVisit = __webpack_require__(75);

/** The byte order mark */
const BOM = '\u{FEFF}';
/** Start of doc-mode */
const DOCUMENT = '\x02'; // C0: Start of Text
/** Unexpected end of flow-mode */
const FLOW_END = '\x18'; // C0: Cancel
/** Next token is a scalar value */
const SCALAR = '\x1f'; // C0: Unit Separator
/** @returns `true` if `token` is a flow or block collection */
const isCollection = (token) => !!token && 'items' in token;
/** @returns `true` if `token` is a flow or block scalar; not an alias */
const isScalar = (token) => !!token &&
    (token.type === 'scalar' ||
        token.type === 'single-quoted-scalar' ||
        token.type === 'double-quoted-scalar' ||
        token.type === 'block-scalar');
/* istanbul ignore next */
/** Get a printable representation of a lexer token */
function prettyToken(token) {
    switch (token) {
        case BOM:
            return '<BOM>';
        case DOCUMENT:
            return '<DOC>';
        case FLOW_END:
            return '<FLOW_END>';
        case SCALAR:
            return '<SCALAR>';
        default:
            return JSON.stringify(token);
    }
}
/** Identify the type of a lexer token. May return `null` for unknown tokens. */
function tokenType(source) {
    switch (source) {
        case BOM:
            return 'byte-order-mark';
        case DOCUMENT:
            return 'doc-mode';
        case FLOW_END:
            return 'flow-error-end';
        case SCALAR:
            return 'scalar';
        case '---':
            return 'doc-start';
        case '...':
            return 'doc-end';
        case '':
        case '\n':
        case '\r\n':
            return 'newline';
        case '-':
            return 'seq-item-ind';
        case '?':
            return 'explicit-key-ind';
        case ':':
            return 'map-value-ind';
        case '{':
            return 'flow-map-start';
        case '}':
            return 'flow-map-end';
        case '[':
            return 'flow-seq-start';
        case ']':
            return 'flow-seq-end';
        case ',':
            return 'comma';
    }
    switch (source[0]) {
        case ' ':
        case '\t':
            return 'space';
        case '#':
            return 'comment';
        case '%':
            return 'directive-line';
        case '*':
            return 'alias';
        case '&':
            return 'anchor';
        case '!':
            return 'tag';
        case "'":
            return 'single-quoted-scalar';
        case '"':
            return 'double-quoted-scalar';
        case '|':
        case '>':
            return 'block-scalar-header';
    }
    return null;
}

exports.createScalarToken = cstScalar.createScalarToken;
exports.resolveAsScalar = cstScalar.resolveAsScalar;
exports.setScalarValue = cstScalar.setScalarValue;
exports.stringify = cstStringify.stringify;
exports.visit = cstVisit.visit;
exports.BOM = BOM;
exports.DOCUMENT = DOCUMENT;
exports.FLOW_END = FLOW_END;
exports.SCALAR = SCALAR;
exports.isCollection = isCollection;
exports.isScalar = isScalar;
exports.prettyToken = prettyToken;
exports.tokenType = tokenType;


/***/ }),
/* 73 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var resolveBlockScalar = __webpack_require__(69);
var resolveFlowScalar = __webpack_require__(70);
var errors = __webpack_require__(56);
var stringifyString = __webpack_require__(25);

function resolveAsScalar(token, strict = true, onError) {
    if (token) {
        const _onError = (pos, code, message) => {
            const offset = typeof pos === 'number' ? pos : Array.isArray(pos) ? pos[0] : pos.offset;
            if (onError)
                onError(offset, code, message);
            else
                throw new errors.YAMLParseError([offset, offset + 1], code, message);
        };
        switch (token.type) {
            case 'scalar':
            case 'single-quoted-scalar':
            case 'double-quoted-scalar':
                return resolveFlowScalar.resolveFlowScalar(token, strict, _onError);
            case 'block-scalar':
                return resolveBlockScalar.resolveBlockScalar({ options: { strict } }, token, _onError);
        }
    }
    return null;
}
/**
 * Create a new scalar token with `value`
 *
 * Values that represent an actual string but may be parsed as a different type should use a `type` other than `'PLAIN'`,
 * as this function does not support any schema operations and won't check for such conflicts.
 *
 * @param value The string representation of the value, which will have its content properly indented.
 * @param context.end Comments and whitespace after the end of the value, or after the block scalar header. If undefined, a newline will be added.
 * @param context.implicitKey Being within an implicit key may affect the resolved type of the token's value.
 * @param context.indent The indent level of the token.
 * @param context.inFlow Is this scalar within a flow collection? This may affect the resolved type of the token's value.
 * @param context.offset The offset position of the token.
 * @param context.type The preferred type of the scalar token. If undefined, the previous type of the `token` will be used, defaulting to `'PLAIN'`.
 */
function createScalarToken(value, context) {
    const { implicitKey = false, indent, inFlow = false, offset = -1, type = 'PLAIN' } = context;
    const source = stringifyString.stringifyString({ type, value }, {
        implicitKey,
        indent: indent > 0 ? ' '.repeat(indent) : '',
        inFlow,
        options: { blockQuote: true, lineWidth: -1 }
    });
    const end = context.end ?? [
        { type: 'newline', offset: -1, indent, source: '\n' }
    ];
    switch (source[0]) {
        case '|':
        case '>': {
            const he = source.indexOf('\n');
            const head = source.substring(0, he);
            const body = source.substring(he + 1) + '\n';
            const props = [
                { type: 'block-scalar-header', offset, indent, source: head }
            ];
            if (!addEndtoBlockProps(props, end))
                props.push({ type: 'newline', offset: -1, indent, source: '\n' });
            return { type: 'block-scalar', offset, indent, props, source: body };
        }
        case '"':
            return { type: 'double-quoted-scalar', offset, indent, source, end };
        case "'":
            return { type: 'single-quoted-scalar', offset, indent, source, end };
        default:
            return { type: 'scalar', offset, indent, source, end };
    }
}
/**
 * Set the value of `token` to the given string `value`, overwriting any previous contents and type that it may have.
 *
 * Best efforts are made to retain any comments previously associated with the `token`,
 * though all contents within a collection's `items` will be overwritten.
 *
 * Values that represent an actual string but may be parsed as a different type should use a `type` other than `'PLAIN'`,
 * as this function does not support any schema operations and won't check for such conflicts.
 *
 * @param token Any token. If it does not include an `indent` value, the value will be stringified as if it were an implicit key.
 * @param value The string representation of the value, which will have its content properly indented.
 * @param context.afterKey In most cases, values after a key should have an additional level of indentation.
 * @param context.implicitKey Being within an implicit key may affect the resolved type of the token's value.
 * @param context.inFlow Being within a flow collection may affect the resolved type of the token's value.
 * @param context.type The preferred type of the scalar token. If undefined, the previous type of the `token` will be used, defaulting to `'PLAIN'`.
 */
function setScalarValue(token, value, context = {}) {
    let { afterKey = false, implicitKey = false, inFlow = false, type } = context;
    let indent = 'indent' in token ? token.indent : null;
    if (afterKey && typeof indent === 'number')
        indent += 2;
    if (!type)
        switch (token.type) {
            case 'single-quoted-scalar':
                type = 'QUOTE_SINGLE';
                break;
            case 'double-quoted-scalar':
                type = 'QUOTE_DOUBLE';
                break;
            case 'block-scalar': {
                const header = token.props[0];
                if (header.type !== 'block-scalar-header')
                    throw new Error('Invalid block scalar header');
                type = header.source[0] === '>' ? 'BLOCK_FOLDED' : 'BLOCK_LITERAL';
                break;
            }
            default:
                type = 'PLAIN';
        }
    const source = stringifyString.stringifyString({ type, value }, {
        implicitKey: implicitKey || indent === null,
        indent: indent !== null && indent > 0 ? ' '.repeat(indent) : '',
        inFlow,
        options: { blockQuote: true, lineWidth: -1 }
    });
    switch (source[0]) {
        case '|':
        case '>':
            setBlockScalarValue(token, source);
            break;
        case '"':
            setFlowScalarValue(token, source, 'double-quoted-scalar');
            break;
        case "'":
            setFlowScalarValue(token, source, 'single-quoted-scalar');
            break;
        default:
            setFlowScalarValue(token, source, 'scalar');
    }
}
function setBlockScalarValue(token, source) {
    const he = source.indexOf('\n');
    const head = source.substring(0, he);
    const body = source.substring(he + 1) + '\n';
    if (token.type === 'block-scalar') {
        const header = token.props[0];
        if (header.type !== 'block-scalar-header')
            throw new Error('Invalid block scalar header');
        header.source = head;
        token.source = body;
    }
    else {
        const { offset } = token;
        const indent = 'indent' in token ? token.indent : -1;
        const props = [
            { type: 'block-scalar-header', offset, indent, source: head }
        ];
        if (!addEndtoBlockProps(props, 'end' in token ? token.end : undefined))
            props.push({ type: 'newline', offset: -1, indent, source: '\n' });
        for (const key of Object.keys(token))
            if (key !== 'type' && key !== 'offset')
                delete token[key];
        Object.assign(token, { type: 'block-scalar', indent, props, source: body });
    }
}
/** @returns `true` if last token is a newline */
function addEndtoBlockProps(props, end) {
    if (end)
        for (const st of end)
            switch (st.type) {
                case 'space':
                case 'comment':
                    props.push(st);
                    break;
                case 'newline':
                    props.push(st);
                    return true;
            }
    return false;
}
function setFlowScalarValue(token, source, type) {
    switch (token.type) {
        case 'scalar':
        case 'double-quoted-scalar':
        case 'single-quoted-scalar':
            token.type = type;
            token.source = source;
            break;
        case 'block-scalar': {
            const end = token.props.slice(1);
            let oa = source.length;
            if (token.props[0].type === 'block-scalar-header')
                oa -= token.props[0].source.length;
            for (const tok of end)
                tok.offset += oa;
            delete token.props;
            Object.assign(token, { type, source, end });
            break;
        }
        case 'block-map':
        case 'block-seq': {
            const offset = token.offset + source.length;
            const nl = { type: 'newline', offset, indent: token.indent, source: '\n' };
            delete token.items;
            Object.assign(token, { type, source, end: [nl] });
            break;
        }
        default: {
            const indent = 'indent' in token ? token.indent : -1;
            const end = 'end' in token && Array.isArray(token.end)
                ? token.end.filter(st => st.type === 'space' ||
                    st.type === 'comment' ||
                    st.type === 'newline')
                : [];
            for (const key of Object.keys(token))
                if (key !== 'type' && key !== 'offset')
                    delete token[key];
            Object.assign(token, { type, indent, source, end });
        }
    }
}

exports.createScalarToken = createScalarToken;
exports.resolveAsScalar = resolveAsScalar;
exports.setScalarValue = setScalarValue;


/***/ }),
/* 74 */
/***/ ((__unused_webpack_module, exports) => {



/**
 * Stringify a CST document, token, or collection item
 *
 * Fair warning: This applies no validation whatsoever, and
 * simply concatenates the sources in their logical order.
 */
const stringify = (cst) => 'type' in cst ? stringifyToken(cst) : stringifyItem(cst);
function stringifyToken(token) {
    switch (token.type) {
        case 'block-scalar': {
            let res = '';
            for (const tok of token.props)
                res += stringifyToken(tok);
            return res + token.source;
        }
        case 'block-map':
        case 'block-seq': {
            let res = '';
            for (const item of token.items)
                res += stringifyItem(item);
            return res;
        }
        case 'flow-collection': {
            let res = token.start.source;
            for (const item of token.items)
                res += stringifyItem(item);
            for (const st of token.end)
                res += st.source;
            return res;
        }
        case 'document': {
            let res = stringifyItem(token);
            if (token.end)
                for (const st of token.end)
                    res += st.source;
            return res;
        }
        default: {
            let res = token.source;
            if ('end' in token && token.end)
                for (const st of token.end)
                    res += st.source;
            return res;
        }
    }
}
function stringifyItem({ start, key, sep, value }) {
    let res = '';
    for (const st of start)
        res += st.source;
    if (key)
        res += stringifyToken(key);
    if (sep)
        for (const st of sep)
            res += st.source;
    if (value)
        res += stringifyToken(value);
    return res;
}

exports.stringify = stringify;


/***/ }),
/* 75 */
/***/ ((__unused_webpack_module, exports) => {



const BREAK = Symbol('break visit');
const SKIP = Symbol('skip children');
const REMOVE = Symbol('remove item');
/**
 * Apply a visitor to a CST document or item.
 *
 * Walks through the tree (depth-first) starting from the root, calling a
 * `visitor` function with two arguments when entering each item:
 *   - `item`: The current item, which included the following members:
 *     - `start: SourceToken[]` – Source tokens before the key or value,
 *       possibly including its anchor or tag.
 *     - `key?: Token | null` – Set for pair values. May then be `null`, if
 *       the key before the `:` separator is empty.
 *     - `sep?: SourceToken[]` – Source tokens between the key and the value,
 *       which should include the `:` map value indicator if `value` is set.
 *     - `value?: Token` – The value of a sequence item, or of a map pair.
 *   - `path`: The steps from the root to the current node, as an array of
 *     `['key' | 'value', number]` tuples.
 *
 * The return value of the visitor may be used to control the traversal:
 *   - `undefined` (default): Do nothing and continue
 *   - `visit.SKIP`: Do not visit the children of this token, continue with
 *      next sibling
 *   - `visit.BREAK`: Terminate traversal completely
 *   - `visit.REMOVE`: Remove the current item, then continue with the next one
 *   - `number`: Set the index of the next step. This is useful especially if
 *     the index of the current token has changed.
 *   - `function`: Define the next visitor for this item. After the original
 *     visitor is called on item entry, next visitors are called after handling
 *     a non-empty `key` and when exiting the item.
 */
function visit(cst, visitor) {
    if ('type' in cst && cst.type === 'document')
        cst = { start: cst.start, value: cst.value };
    _visit(Object.freeze([]), cst, visitor);
}
// Without the `as symbol` casts, TS declares these in the `visit`
// namespace using `var`, but then complains about that because
// `unique symbol` must be `const`.
/** Terminate visit traversal completely */
visit.BREAK = BREAK;
/** Do not visit the children of the current item */
visit.SKIP = SKIP;
/** Remove the current item */
visit.REMOVE = REMOVE;
/** Find the item at `path` from `cst` as the root */
visit.itemAtPath = (cst, path) => {
    let item = cst;
    for (const [field, index] of path) {
        const tok = item?.[field];
        if (tok && 'items' in tok) {
            item = tok.items[index];
        }
        else
            return undefined;
    }
    return item;
};
/**
 * Get the immediate parent collection of the item at `path` from `cst` as the root.
 *
 * Throws an error if the collection is not found, which should never happen if the item itself exists.
 */
visit.parentCollection = (cst, path) => {
    const parent = visit.itemAtPath(cst, path.slice(0, -1));
    const field = path[path.length - 1][0];
    const coll = parent?.[field];
    if (coll && 'items' in coll)
        return coll;
    throw new Error('Parent collection not found');
};
function _visit(path, item, visitor) {
    let ctrl = visitor(item, path);
    if (typeof ctrl === 'symbol')
        return ctrl;
    for (const field of ['key', 'value']) {
        const token = item[field];
        if (token && 'items' in token) {
            for (let i = 0; i < token.items.length; ++i) {
                const ci = _visit(Object.freeze(path.concat([[field, i]])), token.items[i], visitor);
                if (typeof ci === 'number')
                    i = ci - 1;
                else if (ci === BREAK)
                    return BREAK;
                else if (ci === REMOVE) {
                    token.items.splice(i, 1);
                    i -= 1;
                }
            }
            if (typeof ctrl === 'function' && field === 'key')
                ctrl = ctrl(item, path);
        }
    }
    return typeof ctrl === 'function' ? ctrl(item, path) : ctrl;
}

exports.visit = visit;


/***/ }),
/* 76 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var cst = __webpack_require__(72);

/*
START -> stream

stream
  directive -> line-end -> stream
  indent + line-end -> stream
  [else] -> line-start

line-end
  comment -> line-end
  newline -> .
  input-end -> END

line-start
  doc-start -> doc
  doc-end -> stream
  [else] -> indent -> block-start

block-start
  seq-item-start -> block-start
  explicit-key-start -> block-start
  map-value-start -> block-start
  [else] -> doc

doc
  line-end -> line-start
  spaces -> doc
  anchor -> doc
  tag -> doc
  flow-start -> flow -> doc
  flow-end -> error -> doc
  seq-item-start -> error -> doc
  explicit-key-start -> error -> doc
  map-value-start -> doc
  alias -> doc
  quote-start -> quoted-scalar -> doc
  block-scalar-header -> line-end -> block-scalar(min) -> line-start
  [else] -> plain-scalar(false, min) -> doc

flow
  line-end -> flow
  spaces -> flow
  anchor -> flow
  tag -> flow
  flow-start -> flow -> flow
  flow-end -> .
  seq-item-start -> error -> flow
  explicit-key-start -> flow
  map-value-start -> flow
  alias -> flow
  quote-start -> quoted-scalar -> flow
  comma -> flow
  [else] -> plain-scalar(true, 0) -> flow

quoted-scalar
  quote-end -> .
  [else] -> quoted-scalar

block-scalar(min)
  newline + peek(indent < min) -> .
  [else] -> block-scalar(min)

plain-scalar(is-flow, min)
  scalar-end(is-flow) -> .
  peek(newline + (indent < min)) -> .
  [else] -> plain-scalar(min)
*/
function isEmpty(ch) {
    switch (ch) {
        case undefined:
        case ' ':
        case '\n':
        case '\r':
        case '\t':
            return true;
        default:
            return false;
    }
}
const hexDigits = new Set('0123456789ABCDEFabcdef');
const tagChars = new Set("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-#;/?:@&=+$_.!~*'()");
const flowIndicatorChars = new Set(',[]{}');
const invalidAnchorChars = new Set(' ,[]{}\n\r\t');
const isNotAnchorChar = (ch) => !ch || invalidAnchorChars.has(ch);
/**
 * Splits an input string into lexical tokens, i.e. smaller strings that are
 * easily identifiable by `tokens.tokenType()`.
 *
 * Lexing starts always in a "stream" context. Incomplete input may be buffered
 * until a complete token can be emitted.
 *
 * In addition to slices of the original input, the following control characters
 * may also be emitted:
 *
 * - `\x02` (Start of Text): A document starts with the next token
 * - `\x18` (Cancel): Unexpected end of flow-mode (indicates an error)
 * - `\x1f` (Unit Separator): Next token is a scalar value
 * - `\u{FEFF}` (Byte order mark): Emitted separately outside documents
 */
class Lexer {
    constructor() {
        /**
         * Flag indicating whether the end of the current buffer marks the end of
         * all input
         */
        this.atEnd = false;
        /**
         * Explicit indent set in block scalar header, as an offset from the current
         * minimum indent, so e.g. set to 1 from a header `|2+`. Set to -1 if not
         * explicitly set.
         */
        this.blockScalarIndent = -1;
        /**
         * Block scalars that include a + (keep) chomping indicator in their header
         * include trailing empty lines, which are otherwise excluded from the
         * scalar's contents.
         */
        this.blockScalarKeep = false;
        /** Current input */
        this.buffer = '';
        /**
         * Flag noting whether the map value indicator : can immediately follow this
         * node within a flow context.
         */
        this.flowKey = false;
        /** Count of surrounding flow collection levels. */
        this.flowLevel = 0;
        /**
         * Minimum level of indentation required for next lines to be parsed as a
         * part of the current scalar value.
         */
        this.indentNext = 0;
        /** Indentation level of the current line. */
        this.indentValue = 0;
        /** Position of the next \n character. */
        this.lineEndPos = null;
        /** Stores the state of the lexer if reaching the end of incpomplete input */
        this.next = null;
        /** A pointer to `buffer`; the current position of the lexer. */
        this.pos = 0;
    }
    /**
     * Generate YAML tokens from the `source` string. If `incomplete`,
     * a part of the last line may be left as a buffer for the next call.
     *
     * @returns A generator of lexical tokens
     */
    *lex(source, incomplete = false) {
        if (source) {
            if (typeof source !== 'string')
                throw TypeError('source is not a string');
            this.buffer = this.buffer ? this.buffer + source : source;
            this.lineEndPos = null;
        }
        this.atEnd = !incomplete;
        let next = this.next ?? 'stream';
        while (next && (incomplete || this.hasChars(1)))
            next = yield* this.parseNext(next);
    }
    atLineEnd() {
        let i = this.pos;
        let ch = this.buffer[i];
        while (ch === ' ' || ch === '\t')
            ch = this.buffer[++i];
        if (!ch || ch === '#' || ch === '\n')
            return true;
        if (ch === '\r')
            return this.buffer[i + 1] === '\n';
        return false;
    }
    charAt(n) {
        return this.buffer[this.pos + n];
    }
    continueScalar(offset) {
        let ch = this.buffer[offset];
        if (this.indentNext > 0) {
            let indent = 0;
            while (ch === ' ')
                ch = this.buffer[++indent + offset];
            if (ch === '\r') {
                const next = this.buffer[indent + offset + 1];
                if (next === '\n' || (!next && !this.atEnd))
                    return offset + indent + 1;
            }
            return ch === '\n' || indent >= this.indentNext || (!ch && !this.atEnd)
                ? offset + indent
                : -1;
        }
        if (ch === '-' || ch === '.') {
            const dt = this.buffer.substr(offset, 3);
            if ((dt === '---' || dt === '...') && isEmpty(this.buffer[offset + 3]))
                return -1;
        }
        return offset;
    }
    getLine() {
        let end = this.lineEndPos;
        if (typeof end !== 'number' || (end !== -1 && end < this.pos)) {
            end = this.buffer.indexOf('\n', this.pos);
            this.lineEndPos = end;
        }
        if (end === -1)
            return this.atEnd ? this.buffer.substring(this.pos) : null;
        if (this.buffer[end - 1] === '\r')
            end -= 1;
        return this.buffer.substring(this.pos, end);
    }
    hasChars(n) {
        return this.pos + n <= this.buffer.length;
    }
    setNext(state) {
        this.buffer = this.buffer.substring(this.pos);
        this.pos = 0;
        this.lineEndPos = null;
        this.next = state;
        return null;
    }
    peek(n) {
        return this.buffer.substr(this.pos, n);
    }
    *parseNext(next) {
        switch (next) {
            case 'stream':
                return yield* this.parseStream();
            case 'line-start':
                return yield* this.parseLineStart();
            case 'block-start':
                return yield* this.parseBlockStart();
            case 'doc':
                return yield* this.parseDocument();
            case 'flow':
                return yield* this.parseFlowCollection();
            case 'quoted-scalar':
                return yield* this.parseQuotedScalar();
            case 'block-scalar':
                return yield* this.parseBlockScalar();
            case 'plain-scalar':
                return yield* this.parsePlainScalar();
        }
    }
    *parseStream() {
        let line = this.getLine();
        if (line === null)
            return this.setNext('stream');
        if (line[0] === cst.BOM) {
            yield* this.pushCount(1);
            line = line.substring(1);
        }
        if (line[0] === '%') {
            let dirEnd = line.length;
            let cs = line.indexOf('#');
            while (cs !== -1) {
                const ch = line[cs - 1];
                if (ch === ' ' || ch === '\t') {
                    dirEnd = cs - 1;
                    break;
                }
                else {
                    cs = line.indexOf('#', cs + 1);
                }
            }
            while (true) {
                const ch = line[dirEnd - 1];
                if (ch === ' ' || ch === '\t')
                    dirEnd -= 1;
                else
                    break;
            }
            const n = (yield* this.pushCount(dirEnd)) + (yield* this.pushSpaces(true));
            yield* this.pushCount(line.length - n); // possible comment
            this.pushNewline();
            return 'stream';
        }
        if (this.atLineEnd()) {
            const sp = yield* this.pushSpaces(true);
            yield* this.pushCount(line.length - sp);
            yield* this.pushNewline();
            return 'stream';
        }
        yield cst.DOCUMENT;
        return yield* this.parseLineStart();
    }
    *parseLineStart() {
        const ch = this.charAt(0);
        if (!ch && !this.atEnd)
            return this.setNext('line-start');
        if (ch === '-' || ch === '.') {
            if (!this.atEnd && !this.hasChars(4))
                return this.setNext('line-start');
            const s = this.peek(3);
            if ((s === '---' || s === '...') && isEmpty(this.charAt(3))) {
                yield* this.pushCount(3);
                this.indentValue = 0;
                this.indentNext = 0;
                return s === '---' ? 'doc' : 'stream';
            }
        }
        this.indentValue = yield* this.pushSpaces(false);
        if (this.indentNext > this.indentValue && !isEmpty(this.charAt(1)))
            this.indentNext = this.indentValue;
        return yield* this.parseBlockStart();
    }
    *parseBlockStart() {
        const [ch0, ch1] = this.peek(2);
        if (!ch1 && !this.atEnd)
            return this.setNext('block-start');
        if ((ch0 === '-' || ch0 === '?' || ch0 === ':') && isEmpty(ch1)) {
            const n = (yield* this.pushCount(1)) + (yield* this.pushSpaces(true));
            this.indentNext = this.indentValue + 1;
            this.indentValue += n;
            return yield* this.parseBlockStart();
        }
        return 'doc';
    }
    *parseDocument() {
        yield* this.pushSpaces(true);
        const line = this.getLine();
        if (line === null)
            return this.setNext('doc');
        let n = yield* this.pushIndicators();
        switch (line[n]) {
            case '#':
                yield* this.pushCount(line.length - n);
            // fallthrough
            case undefined:
                yield* this.pushNewline();
                return yield* this.parseLineStart();
            case '{':
            case '[':
                yield* this.pushCount(1);
                this.flowKey = false;
                this.flowLevel = 1;
                return 'flow';
            case '}':
            case ']':
                // this is an error
                yield* this.pushCount(1);
                return 'doc';
            case '*':
                yield* this.pushUntil(isNotAnchorChar);
                return 'doc';
            case '"':
            case "'":
                return yield* this.parseQuotedScalar();
            case '|':
            case '>':
                n += yield* this.parseBlockScalarHeader();
                n += yield* this.pushSpaces(true);
                yield* this.pushCount(line.length - n);
                yield* this.pushNewline();
                return yield* this.parseBlockScalar();
            default:
                return yield* this.parsePlainScalar();
        }
    }
    *parseFlowCollection() {
        let nl, sp;
        let indent = -1;
        do {
            nl = yield* this.pushNewline();
            if (nl > 0) {
                sp = yield* this.pushSpaces(false);
                this.indentValue = indent = sp;
            }
            else {
                sp = 0;
            }
            sp += yield* this.pushSpaces(true);
        } while (nl + sp > 0);
        const line = this.getLine();
        if (line === null)
            return this.setNext('flow');
        if ((indent !== -1 && indent < this.indentNext && line[0] !== '#') ||
            (indent === 0 &&
                (line.startsWith('---') || line.startsWith('...')) &&
                isEmpty(line[3]))) {
            // Allowing for the terminal ] or } at the same (rather than greater)
            // indent level as the initial [ or { is technically invalid, but
            // failing here would be surprising to users.
            const atFlowEndMarker = indent === this.indentNext - 1 &&
                this.flowLevel === 1 &&
                (line[0] === ']' || line[0] === '}');
            if (!atFlowEndMarker) {
                // this is an error
                this.flowLevel = 0;
                yield cst.FLOW_END;
                return yield* this.parseLineStart();
            }
        }
        let n = 0;
        while (line[n] === ',') {
            n += yield* this.pushCount(1);
            n += yield* this.pushSpaces(true);
            this.flowKey = false;
        }
        n += yield* this.pushIndicators();
        switch (line[n]) {
            case undefined:
                return 'flow';
            case '#':
                yield* this.pushCount(line.length - n);
                return 'flow';
            case '{':
            case '[':
                yield* this.pushCount(1);
                this.flowKey = false;
                this.flowLevel += 1;
                return 'flow';
            case '}':
            case ']':
                yield* this.pushCount(1);
                this.flowKey = true;
                this.flowLevel -= 1;
                return this.flowLevel ? 'flow' : 'doc';
            case '*':
                yield* this.pushUntil(isNotAnchorChar);
                return 'flow';
            case '"':
            case "'":
                this.flowKey = true;
                return yield* this.parseQuotedScalar();
            case ':': {
                const next = this.charAt(1);
                if (this.flowKey || isEmpty(next) || next === ',') {
                    this.flowKey = false;
                    yield* this.pushCount(1);
                    yield* this.pushSpaces(true);
                    return 'flow';
                }
            }
            // fallthrough
            default:
                this.flowKey = false;
                return yield* this.parsePlainScalar();
        }
    }
    *parseQuotedScalar() {
        const quote = this.charAt(0);
        let end = this.buffer.indexOf(quote, this.pos + 1);
        if (quote === "'") {
            while (end !== -1 && this.buffer[end + 1] === "'")
                end = this.buffer.indexOf("'", end + 2);
        }
        else {
            // double-quote
            while (end !== -1) {
                let n = 0;
                while (this.buffer[end - 1 - n] === '\\')
                    n += 1;
                if (n % 2 === 0)
                    break;
                end = this.buffer.indexOf('"', end + 1);
            }
        }
        // Only looking for newlines within the quotes
        const qb = this.buffer.substring(0, end);
        let nl = qb.indexOf('\n', this.pos);
        if (nl !== -1) {
            while (nl !== -1) {
                const cs = this.continueScalar(nl + 1);
                if (cs === -1)
                    break;
                nl = qb.indexOf('\n', cs);
            }
            if (nl !== -1) {
                // this is an error caused by an unexpected unindent
                end = nl - (qb[nl - 1] === '\r' ? 2 : 1);
            }
        }
        if (end === -1) {
            if (!this.atEnd)
                return this.setNext('quoted-scalar');
            end = this.buffer.length;
        }
        yield* this.pushToIndex(end + 1, false);
        return this.flowLevel ? 'flow' : 'doc';
    }
    *parseBlockScalarHeader() {
        this.blockScalarIndent = -1;
        this.blockScalarKeep = false;
        let i = this.pos;
        while (true) {
            const ch = this.buffer[++i];
            if (ch === '+')
                this.blockScalarKeep = true;
            else if (ch > '0' && ch <= '9')
                this.blockScalarIndent = Number(ch) - 1;
            else if (ch !== '-')
                break;
        }
        return yield* this.pushUntil(ch => isEmpty(ch) || ch === '#');
    }
    *parseBlockScalar() {
        let nl = this.pos - 1; // may be -1 if this.pos === 0
        let indent = 0;
        let ch;
        loop: for (let i = this.pos; (ch = this.buffer[i]); ++i) {
            switch (ch) {
                case ' ':
                    indent += 1;
                    break;
                case '\n':
                    nl = i;
                    indent = 0;
                    break;
                case '\r': {
                    const next = this.buffer[i + 1];
                    if (!next && !this.atEnd)
                        return this.setNext('block-scalar');
                    if (next === '\n')
                        break;
                } // fallthrough
                default:
                    break loop;
            }
        }
        if (!ch && !this.atEnd)
            return this.setNext('block-scalar');
        if (indent >= this.indentNext) {
            if (this.blockScalarIndent === -1)
                this.indentNext = indent;
            else {
                this.indentNext =
                    this.blockScalarIndent + (this.indentNext === 0 ? 1 : this.indentNext);
            }
            do {
                const cs = this.continueScalar(nl + 1);
                if (cs === -1)
                    break;
                nl = this.buffer.indexOf('\n', cs);
            } while (nl !== -1);
            if (nl === -1) {
                if (!this.atEnd)
                    return this.setNext('block-scalar');
                nl = this.buffer.length;
            }
        }
        // Trailing insufficiently indented tabs are invalid.
        // To catch that during parsing, we include them in the block scalar value.
        let i = nl + 1;
        ch = this.buffer[i];
        while (ch === ' ')
            ch = this.buffer[++i];
        if (ch === '\t') {
            while (ch === '\t' || ch === ' ' || ch === '\r' || ch === '\n')
                ch = this.buffer[++i];
            nl = i - 1;
        }
        else if (!this.blockScalarKeep) {
            do {
                let i = nl - 1;
                let ch = this.buffer[i];
                if (ch === '\r')
                    ch = this.buffer[--i];
                const lastChar = i; // Drop the line if last char not more indented
                while (ch === ' ')
                    ch = this.buffer[--i];
                if (ch === '\n' && i >= this.pos && i + 1 + indent > lastChar)
                    nl = i;
                else
                    break;
            } while (true);
        }
        yield cst.SCALAR;
        yield* this.pushToIndex(nl + 1, true);
        return yield* this.parseLineStart();
    }
    *parsePlainScalar() {
        const inFlow = this.flowLevel > 0;
        let end = this.pos - 1;
        let i = this.pos - 1;
        let ch;
        while ((ch = this.buffer[++i])) {
            if (ch === ':') {
                const next = this.buffer[i + 1];
                if (isEmpty(next) || (inFlow && flowIndicatorChars.has(next)))
                    break;
                end = i;
            }
            else if (isEmpty(ch)) {
                let next = this.buffer[i + 1];
                if (ch === '\r') {
                    if (next === '\n') {
                        i += 1;
                        ch = '\n';
                        next = this.buffer[i + 1];
                    }
                    else
                        end = i;
                }
                if (next === '#' || (inFlow && flowIndicatorChars.has(next)))
                    break;
                if (ch === '\n') {
                    const cs = this.continueScalar(i + 1);
                    if (cs === -1)
                        break;
                    i = Math.max(i, cs - 2); // to advance, but still account for ' #'
                }
            }
            else {
                if (inFlow && flowIndicatorChars.has(ch))
                    break;
                end = i;
            }
        }
        if (!ch && !this.atEnd)
            return this.setNext('plain-scalar');
        yield cst.SCALAR;
        yield* this.pushToIndex(end + 1, true);
        return inFlow ? 'flow' : 'doc';
    }
    *pushCount(n) {
        if (n > 0) {
            yield this.buffer.substr(this.pos, n);
            this.pos += n;
            return n;
        }
        return 0;
    }
    *pushToIndex(i, allowEmpty) {
        const s = this.buffer.slice(this.pos, i);
        if (s) {
            yield s;
            this.pos += s.length;
            return s.length;
        }
        else if (allowEmpty)
            yield '';
        return 0;
    }
    *pushIndicators() {
        switch (this.charAt(0)) {
            case '!':
                return ((yield* this.pushTag()) +
                    (yield* this.pushSpaces(true)) +
                    (yield* this.pushIndicators()));
            case '&':
                return ((yield* this.pushUntil(isNotAnchorChar)) +
                    (yield* this.pushSpaces(true)) +
                    (yield* this.pushIndicators()));
            case '-': // this is an error
            case '?': // this is an error outside flow collections
            case ':': {
                const inFlow = this.flowLevel > 0;
                const ch1 = this.charAt(1);
                if (isEmpty(ch1) || (inFlow && flowIndicatorChars.has(ch1))) {
                    if (!inFlow)
                        this.indentNext = this.indentValue + 1;
                    else if (this.flowKey)
                        this.flowKey = false;
                    return ((yield* this.pushCount(1)) +
                        (yield* this.pushSpaces(true)) +
                        (yield* this.pushIndicators()));
                }
            }
        }
        return 0;
    }
    *pushTag() {
        if (this.charAt(1) === '<') {
            let i = this.pos + 2;
            let ch = this.buffer[i];
            while (!isEmpty(ch) && ch !== '>')
                ch = this.buffer[++i];
            return yield* this.pushToIndex(ch === '>' ? i + 1 : i, false);
        }
        else {
            let i = this.pos + 1;
            let ch = this.buffer[i];
            while (ch) {
                if (tagChars.has(ch))
                    ch = this.buffer[++i];
                else if (ch === '%' &&
                    hexDigits.has(this.buffer[i + 1]) &&
                    hexDigits.has(this.buffer[i + 2])) {
                    ch = this.buffer[(i += 3)];
                }
                else
                    break;
            }
            return yield* this.pushToIndex(i, false);
        }
    }
    *pushNewline() {
        const ch = this.buffer[this.pos];
        if (ch === '\n')
            return yield* this.pushCount(1);
        else if (ch === '\r' && this.charAt(1) === '\n')
            return yield* this.pushCount(2);
        else
            return 0;
    }
    *pushSpaces(allowTabs) {
        let i = this.pos - 1;
        let ch;
        do {
            ch = this.buffer[++i];
        } while (ch === ' ' || (allowTabs && ch === '\t'));
        const n = i - this.pos;
        if (n > 0) {
            yield this.buffer.substr(this.pos, n);
            this.pos = i;
        }
        return n;
    }
    *pushUntil(test) {
        let i = this.pos;
        let ch = this.buffer[i];
        while (!test(ch))
            ch = this.buffer[++i];
        return yield* this.pushToIndex(i, false);
    }
}

exports.Lexer = Lexer;


/***/ }),
/* 77 */
/***/ ((__unused_webpack_module, exports) => {



/**
 * Tracks newlines during parsing in order to provide an efficient API for
 * determining the one-indexed `{ line, col }` position for any offset
 * within the input.
 */
class LineCounter {
    constructor() {
        this.lineStarts = [];
        /**
         * Should be called in ascending order. Otherwise, call
         * `lineCounter.lineStarts.sort()` before calling `linePos()`.
         */
        this.addNewLine = (offset) => this.lineStarts.push(offset);
        /**
         * Performs a binary search and returns the 1-indexed { line, col }
         * position of `offset`. If `line === 0`, `addNewLine` has never been
         * called or `offset` is before the first known newline.
         */
        this.linePos = (offset) => {
            let low = 0;
            let high = this.lineStarts.length;
            while (low < high) {
                const mid = (low + high) >> 1; // Math.floor((low + high) / 2)
                if (this.lineStarts[mid] < offset)
                    low = mid + 1;
                else
                    high = mid;
            }
            if (this.lineStarts[low] === offset)
                return { line: low + 1, col: 1 };
            if (low === 0)
                return { line: 0, col: offset };
            const start = this.lineStarts[low - 1];
            return { line: low, col: offset - start + 1 };
        };
    }
}

exports.LineCounter = LineCounter;


/***/ }),
/* 78 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var node_process = __webpack_require__(8);
var cst = __webpack_require__(72);
var lexer = __webpack_require__(76);

function includesToken(list, type) {
    for (let i = 0; i < list.length; ++i)
        if (list[i].type === type)
            return true;
    return false;
}
function findNonEmptyIndex(list) {
    for (let i = 0; i < list.length; ++i) {
        switch (list[i].type) {
            case 'space':
            case 'comment':
            case 'newline':
                break;
            default:
                return i;
        }
    }
    return -1;
}
function isFlowToken(token) {
    switch (token?.type) {
        case 'alias':
        case 'scalar':
        case 'single-quoted-scalar':
        case 'double-quoted-scalar':
        case 'flow-collection':
            return true;
        default:
            return false;
    }
}
function getPrevProps(parent) {
    switch (parent.type) {
        case 'document':
            return parent.start;
        case 'block-map': {
            const it = parent.items[parent.items.length - 1];
            return it.sep ?? it.start;
        }
        case 'block-seq':
            return parent.items[parent.items.length - 1].start;
        /* istanbul ignore next should not happen */
        default:
            return [];
    }
}
/** Note: May modify input array */
function getFirstKeyStartProps(prev) {
    if (prev.length === 0)
        return [];
    let i = prev.length;
    loop: while (--i >= 0) {
        switch (prev[i].type) {
            case 'doc-start':
            case 'explicit-key-ind':
            case 'map-value-ind':
            case 'seq-item-ind':
            case 'newline':
                break loop;
        }
    }
    while (prev[++i]?.type === 'space') {
        /* loop */
    }
    return prev.splice(i, prev.length);
}
function fixFlowSeqItems(fc) {
    if (fc.start.type === 'flow-seq-start') {
        for (const it of fc.items) {
            if (it.sep &&
                !it.value &&
                !includesToken(it.start, 'explicit-key-ind') &&
                !includesToken(it.sep, 'map-value-ind')) {
                if (it.key)
                    it.value = it.key;
                delete it.key;
                if (isFlowToken(it.value)) {
                    if (it.value.end)
                        Array.prototype.push.apply(it.value.end, it.sep);
                    else
                        it.value.end = it.sep;
                }
                else
                    Array.prototype.push.apply(it.start, it.sep);
                delete it.sep;
            }
        }
    }
}
/**
 * A YAML concrete syntax tree (CST) parser
 *
 * ```ts
 * const src: string = ...
 * for (const token of new Parser().parse(src)) {
 *   // token: Token
 * }
 * ```
 *
 * To use the parser with a user-provided lexer:
 *
 * ```ts
 * function* parse(source: string, lexer: Lexer) {
 *   const parser = new Parser()
 *   for (const lexeme of lexer.lex(source))
 *     yield* parser.next(lexeme)
 *   yield* parser.end()
 * }
 *
 * const src: string = ...
 * const lexer = new Lexer()
 * for (const token of parse(src, lexer)) {
 *   // token: Token
 * }
 * ```
 */
class Parser {
    /**
     * @param onNewLine - If defined, called separately with the start position of
     *   each new line (in `parse()`, including the start of input).
     */
    constructor(onNewLine) {
        /** If true, space and sequence indicators count as indentation */
        this.atNewLine = true;
        /** If true, next token is a scalar value */
        this.atScalar = false;
        /** Current indentation level */
        this.indent = 0;
        /** Current offset since the start of parsing */
        this.offset = 0;
        /** On the same line with a block map key */
        this.onKeyLine = false;
        /** Top indicates the node that's currently being built */
        this.stack = [];
        /** The source of the current token, set in parse() */
        this.source = '';
        /** The type of the current token, set in parse() */
        this.type = '';
        // Must be defined after `next()`
        this.lexer = new lexer.Lexer();
        this.onNewLine = onNewLine;
    }
    /**
     * Parse `source` as a YAML stream.
     * If `incomplete`, a part of the last line may be left as a buffer for the next call.
     *
     * Errors are not thrown, but yielded as `{ type: 'error', message }` tokens.
     *
     * @returns A generator of tokens representing each directive, document, and other structure.
     */
    *parse(source, incomplete = false) {
        if (this.onNewLine && this.offset === 0)
            this.onNewLine(0);
        for (const lexeme of this.lexer.lex(source, incomplete))
            yield* this.next(lexeme);
        if (!incomplete)
            yield* this.end();
    }
    /**
     * Advance the parser by the `source` of one lexical token.
     */
    *next(source) {
        this.source = source;
        if (node_process.env.LOG_TOKENS)
            console.log('|', cst.prettyToken(source));
        if (this.atScalar) {
            this.atScalar = false;
            yield* this.step();
            this.offset += source.length;
            return;
        }
        const type = cst.tokenType(source);
        if (!type) {
            const message = `Not a YAML token: ${source}`;
            yield* this.pop({ type: 'error', offset: this.offset, message, source });
            this.offset += source.length;
        }
        else if (type === 'scalar') {
            this.atNewLine = false;
            this.atScalar = true;
            this.type = 'scalar';
        }
        else {
            this.type = type;
            yield* this.step();
            switch (type) {
                case 'newline':
                    this.atNewLine = true;
                    this.indent = 0;
                    if (this.onNewLine)
                        this.onNewLine(this.offset + source.length);
                    break;
                case 'space':
                    if (this.atNewLine && source[0] === ' ')
                        this.indent += source.length;
                    break;
                case 'explicit-key-ind':
                case 'map-value-ind':
                case 'seq-item-ind':
                    if (this.atNewLine)
                        this.indent += source.length;
                    break;
                case 'doc-mode':
                case 'flow-error-end':
                    return;
                default:
                    this.atNewLine = false;
            }
            this.offset += source.length;
        }
    }
    /** Call at end of input to push out any remaining constructions */
    *end() {
        while (this.stack.length > 0)
            yield* this.pop();
    }
    get sourceToken() {
        const st = {
            type: this.type,
            offset: this.offset,
            indent: this.indent,
            source: this.source
        };
        return st;
    }
    *step() {
        const top = this.peek(1);
        if (this.type === 'doc-end' && top?.type !== 'doc-end') {
            while (this.stack.length > 0)
                yield* this.pop();
            this.stack.push({
                type: 'doc-end',
                offset: this.offset,
                source: this.source
            });
            return;
        }
        if (!top)
            return yield* this.stream();
        switch (top.type) {
            case 'document':
                return yield* this.document(top);
            case 'alias':
            case 'scalar':
            case 'single-quoted-scalar':
            case 'double-quoted-scalar':
                return yield* this.scalar(top);
            case 'block-scalar':
                return yield* this.blockScalar(top);
            case 'block-map':
                return yield* this.blockMap(top);
            case 'block-seq':
                return yield* this.blockSequence(top);
            case 'flow-collection':
                return yield* this.flowCollection(top);
            case 'doc-end':
                return yield* this.documentEnd(top);
        }
        /* istanbul ignore next should not happen */
        yield* this.pop();
    }
    peek(n) {
        return this.stack[this.stack.length - n];
    }
    *pop(error) {
        const token = error ?? this.stack.pop();
        /* istanbul ignore if should not happen */
        if (!token) {
            const message = 'Tried to pop an empty stack';
            yield { type: 'error', offset: this.offset, source: '', message };
        }
        else if (this.stack.length === 0) {
            yield token;
        }
        else {
            const top = this.peek(1);
            if (token.type === 'block-scalar') {
                // Block scalars use their parent rather than header indent
                token.indent = 'indent' in top ? top.indent : 0;
            }
            else if (token.type === 'flow-collection' && top.type === 'document') {
                // Ignore all indent for top-level flow collections
                token.indent = 0;
            }
            if (token.type === 'flow-collection')
                fixFlowSeqItems(token);
            switch (top.type) {
                case 'document':
                    top.value = token;
                    break;
                case 'block-scalar':
                    top.props.push(token); // error
                    break;
                case 'block-map': {
                    const it = top.items[top.items.length - 1];
                    if (it.value) {
                        top.items.push({ start: [], key: token, sep: [] });
                        this.onKeyLine = true;
                        return;
                    }
                    else if (it.sep) {
                        it.value = token;
                    }
                    else {
                        Object.assign(it, { key: token, sep: [] });
                        this.onKeyLine = !it.explicitKey;
                        return;
                    }
                    break;
                }
                case 'block-seq': {
                    const it = top.items[top.items.length - 1];
                    if (it.value)
                        top.items.push({ start: [], value: token });
                    else
                        it.value = token;
                    break;
                }
                case 'flow-collection': {
                    const it = top.items[top.items.length - 1];
                    if (!it || it.value)
                        top.items.push({ start: [], key: token, sep: [] });
                    else if (it.sep)
                        it.value = token;
                    else
                        Object.assign(it, { key: token, sep: [] });
                    return;
                }
                /* istanbul ignore next should not happen */
                default:
                    yield* this.pop();
                    yield* this.pop(token);
            }
            if ((top.type === 'document' ||
                top.type === 'block-map' ||
                top.type === 'block-seq') &&
                (token.type === 'block-map' || token.type === 'block-seq')) {
                const last = token.items[token.items.length - 1];
                if (last &&
                    !last.sep &&
                    !last.value &&
                    last.start.length > 0 &&
                    findNonEmptyIndex(last.start) === -1 &&
                    (token.indent === 0 ||
                        last.start.every(st => st.type !== 'comment' || st.indent < token.indent))) {
                    if (top.type === 'document')
                        top.end = last.start;
                    else
                        top.items.push({ start: last.start });
                    token.items.splice(-1, 1);
                }
            }
        }
    }
    *stream() {
        switch (this.type) {
            case 'directive-line':
                yield { type: 'directive', offset: this.offset, source: this.source };
                return;
            case 'byte-order-mark':
            case 'space':
            case 'comment':
            case 'newline':
                yield this.sourceToken;
                return;
            case 'doc-mode':
            case 'doc-start': {
                const doc = {
                    type: 'document',
                    offset: this.offset,
                    start: []
                };
                if (this.type === 'doc-start')
                    doc.start.push(this.sourceToken);
                this.stack.push(doc);
                return;
            }
        }
        yield {
            type: 'error',
            offset: this.offset,
            message: `Unexpected ${this.type} token in YAML stream`,
            source: this.source
        };
    }
    *document(doc) {
        if (doc.value)
            return yield* this.lineEnd(doc);
        switch (this.type) {
            case 'doc-start': {
                if (findNonEmptyIndex(doc.start) !== -1) {
                    yield* this.pop();
                    yield* this.step();
                }
                else
                    doc.start.push(this.sourceToken);
                return;
            }
            case 'anchor':
            case 'tag':
            case 'space':
            case 'comment':
            case 'newline':
                doc.start.push(this.sourceToken);
                return;
        }
        const bv = this.startBlockValue(doc);
        if (bv)
            this.stack.push(bv);
        else {
            yield {
                type: 'error',
                offset: this.offset,
                message: `Unexpected ${this.type} token in YAML document`,
                source: this.source
            };
        }
    }
    *scalar(scalar) {
        if (this.type === 'map-value-ind') {
            const prev = getPrevProps(this.peek(2));
            const start = getFirstKeyStartProps(prev);
            let sep;
            if (scalar.end) {
                sep = scalar.end;
                sep.push(this.sourceToken);
                delete scalar.end;
            }
            else
                sep = [this.sourceToken];
            const map = {
                type: 'block-map',
                offset: scalar.offset,
                indent: scalar.indent,
                items: [{ start, key: scalar, sep }]
            };
            this.onKeyLine = true;
            this.stack[this.stack.length - 1] = map;
        }
        else
            yield* this.lineEnd(scalar);
    }
    *blockScalar(scalar) {
        switch (this.type) {
            case 'space':
            case 'comment':
            case 'newline':
                scalar.props.push(this.sourceToken);
                return;
            case 'scalar':
                scalar.source = this.source;
                // block-scalar source includes trailing newline
                this.atNewLine = true;
                this.indent = 0;
                if (this.onNewLine) {
                    let nl = this.source.indexOf('\n') + 1;
                    while (nl !== 0) {
                        this.onNewLine(this.offset + nl);
                        nl = this.source.indexOf('\n', nl) + 1;
                    }
                }
                yield* this.pop();
                break;
            /* istanbul ignore next should not happen */
            default:
                yield* this.pop();
                yield* this.step();
        }
    }
    *blockMap(map) {
        const it = map.items[map.items.length - 1];
        // it.sep is true-ish if pair already has key or : separator
        switch (this.type) {
            case 'newline':
                this.onKeyLine = false;
                if (it.value) {
                    const end = 'end' in it.value ? it.value.end : undefined;
                    const last = Array.isArray(end) ? end[end.length - 1] : undefined;
                    if (last?.type === 'comment')
                        end?.push(this.sourceToken);
                    else
                        map.items.push({ start: [this.sourceToken] });
                }
                else if (it.sep) {
                    it.sep.push(this.sourceToken);
                }
                else {
                    it.start.push(this.sourceToken);
                }
                return;
            case 'space':
            case 'comment':
                if (it.value) {
                    map.items.push({ start: [this.sourceToken] });
                }
                else if (it.sep) {
                    it.sep.push(this.sourceToken);
                }
                else {
                    if (this.atIndentedComment(it.start, map.indent)) {
                        const prev = map.items[map.items.length - 2];
                        const end = prev?.value?.end;
                        if (Array.isArray(end)) {
                            Array.prototype.push.apply(end, it.start);
                            end.push(this.sourceToken);
                            map.items.pop();
                            return;
                        }
                    }
                    it.start.push(this.sourceToken);
                }
                return;
        }
        if (this.indent >= map.indent) {
            const atMapIndent = !this.onKeyLine && this.indent === map.indent;
            const atNextItem = atMapIndent &&
                (it.sep || it.explicitKey) &&
                this.type !== 'seq-item-ind';
            // For empty nodes, assign newline-separated not indented empty tokens to following node
            let start = [];
            if (atNextItem && it.sep && !it.value) {
                const nl = [];
                for (let i = 0; i < it.sep.length; ++i) {
                    const st = it.sep[i];
                    switch (st.type) {
                        case 'newline':
                            nl.push(i);
                            break;
                        case 'space':
                            break;
                        case 'comment':
                            if (st.indent > map.indent)
                                nl.length = 0;
                            break;
                        default:
                            nl.length = 0;
                    }
                }
                if (nl.length >= 2)
                    start = it.sep.splice(nl[1]);
            }
            switch (this.type) {
                case 'anchor':
                case 'tag':
                    if (atNextItem || it.value) {
                        start.push(this.sourceToken);
                        map.items.push({ start });
                        this.onKeyLine = true;
                    }
                    else if (it.sep) {
                        it.sep.push(this.sourceToken);
                    }
                    else {
                        it.start.push(this.sourceToken);
                    }
                    return;
                case 'explicit-key-ind':
                    if (!it.sep && !it.explicitKey) {
                        it.start.push(this.sourceToken);
                        it.explicitKey = true;
                    }
                    else if (atNextItem || it.value) {
                        start.push(this.sourceToken);
                        map.items.push({ start, explicitKey: true });
                    }
                    else {
                        this.stack.push({
                            type: 'block-map',
                            offset: this.offset,
                            indent: this.indent,
                            items: [{ start: [this.sourceToken], explicitKey: true }]
                        });
                    }
                    this.onKeyLine = true;
                    return;
                case 'map-value-ind':
                    if (it.explicitKey) {
                        if (!it.sep) {
                            if (includesToken(it.start, 'newline')) {
                                Object.assign(it, { key: null, sep: [this.sourceToken] });
                            }
                            else {
                                const start = getFirstKeyStartProps(it.start);
                                this.stack.push({
                                    type: 'block-map',
                                    offset: this.offset,
                                    indent: this.indent,
                                    items: [{ start, key: null, sep: [this.sourceToken] }]
                                });
                            }
                        }
                        else if (it.value) {
                            map.items.push({ start: [], key: null, sep: [this.sourceToken] });
                        }
                        else if (includesToken(it.sep, 'map-value-ind')) {
                            this.stack.push({
                                type: 'block-map',
                                offset: this.offset,
                                indent: this.indent,
                                items: [{ start, key: null, sep: [this.sourceToken] }]
                            });
                        }
                        else if (isFlowToken(it.key) &&
                            !includesToken(it.sep, 'newline')) {
                            const start = getFirstKeyStartProps(it.start);
                            const key = it.key;
                            const sep = it.sep;
                            sep.push(this.sourceToken);
                            // @ts-expect-error type guard is wrong here
                            delete it.key;
                            // @ts-expect-error type guard is wrong here
                            delete it.sep;
                            this.stack.push({
                                type: 'block-map',
                                offset: this.offset,
                                indent: this.indent,
                                items: [{ start, key, sep }]
                            });
                        }
                        else if (start.length > 0) {
                            // Not actually at next item
                            it.sep = it.sep.concat(start, this.sourceToken);
                        }
                        else {
                            it.sep.push(this.sourceToken);
                        }
                    }
                    else {
                        if (!it.sep) {
                            Object.assign(it, { key: null, sep: [this.sourceToken] });
                        }
                        else if (it.value || atNextItem) {
                            map.items.push({ start, key: null, sep: [this.sourceToken] });
                        }
                        else if (includesToken(it.sep, 'map-value-ind')) {
                            this.stack.push({
                                type: 'block-map',
                                offset: this.offset,
                                indent: this.indent,
                                items: [{ start: [], key: null, sep: [this.sourceToken] }]
                            });
                        }
                        else {
                            it.sep.push(this.sourceToken);
                        }
                    }
                    this.onKeyLine = true;
                    return;
                case 'alias':
                case 'scalar':
                case 'single-quoted-scalar':
                case 'double-quoted-scalar': {
                    const fs = this.flowScalar(this.type);
                    if (atNextItem || it.value) {
                        map.items.push({ start, key: fs, sep: [] });
                        this.onKeyLine = true;
                    }
                    else if (it.sep) {
                        this.stack.push(fs);
                    }
                    else {
                        Object.assign(it, { key: fs, sep: [] });
                        this.onKeyLine = true;
                    }
                    return;
                }
                default: {
                    const bv = this.startBlockValue(map);
                    if (bv) {
                        if (bv.type === 'block-seq') {
                            if (!it.explicitKey &&
                                it.sep &&
                                !includesToken(it.sep, 'newline')) {
                                yield* this.pop({
                                    type: 'error',
                                    offset: this.offset,
                                    message: 'Unexpected block-seq-ind on same line with key',
                                    source: this.source
                                });
                                return;
                            }
                        }
                        else if (atMapIndent) {
                            map.items.push({ start });
                        }
                        this.stack.push(bv);
                        return;
                    }
                }
            }
        }
        yield* this.pop();
        yield* this.step();
    }
    *blockSequence(seq) {
        const it = seq.items[seq.items.length - 1];
        switch (this.type) {
            case 'newline':
                if (it.value) {
                    const end = 'end' in it.value ? it.value.end : undefined;
                    const last = Array.isArray(end) ? end[end.length - 1] : undefined;
                    if (last?.type === 'comment')
                        end?.push(this.sourceToken);
                    else
                        seq.items.push({ start: [this.sourceToken] });
                }
                else
                    it.start.push(this.sourceToken);
                return;
            case 'space':
            case 'comment':
                if (it.value)
                    seq.items.push({ start: [this.sourceToken] });
                else {
                    if (this.atIndentedComment(it.start, seq.indent)) {
                        const prev = seq.items[seq.items.length - 2];
                        const end = prev?.value?.end;
                        if (Array.isArray(end)) {
                            Array.prototype.push.apply(end, it.start);
                            end.push(this.sourceToken);
                            seq.items.pop();
                            return;
                        }
                    }
                    it.start.push(this.sourceToken);
                }
                return;
            case 'anchor':
            case 'tag':
                if (it.value || this.indent <= seq.indent)
                    break;
                it.start.push(this.sourceToken);
                return;
            case 'seq-item-ind':
                if (this.indent !== seq.indent)
                    break;
                if (it.value || includesToken(it.start, 'seq-item-ind'))
                    seq.items.push({ start: [this.sourceToken] });
                else
                    it.start.push(this.sourceToken);
                return;
        }
        if (this.indent > seq.indent) {
            const bv = this.startBlockValue(seq);
            if (bv) {
                this.stack.push(bv);
                return;
            }
        }
        yield* this.pop();
        yield* this.step();
    }
    *flowCollection(fc) {
        const it = fc.items[fc.items.length - 1];
        if (this.type === 'flow-error-end') {
            let top;
            do {
                yield* this.pop();
                top = this.peek(1);
            } while (top?.type === 'flow-collection');
        }
        else if (fc.end.length === 0) {
            switch (this.type) {
                case 'comma':
                case 'explicit-key-ind':
                    if (!it || it.sep)
                        fc.items.push({ start: [this.sourceToken] });
                    else
                        it.start.push(this.sourceToken);
                    return;
                case 'map-value-ind':
                    if (!it || it.value)
                        fc.items.push({ start: [], key: null, sep: [this.sourceToken] });
                    else if (it.sep)
                        it.sep.push(this.sourceToken);
                    else
                        Object.assign(it, { key: null, sep: [this.sourceToken] });
                    return;
                case 'space':
                case 'comment':
                case 'newline':
                case 'anchor':
                case 'tag':
                    if (!it || it.value)
                        fc.items.push({ start: [this.sourceToken] });
                    else if (it.sep)
                        it.sep.push(this.sourceToken);
                    else
                        it.start.push(this.sourceToken);
                    return;
                case 'alias':
                case 'scalar':
                case 'single-quoted-scalar':
                case 'double-quoted-scalar': {
                    const fs = this.flowScalar(this.type);
                    if (!it || it.value)
                        fc.items.push({ start: [], key: fs, sep: [] });
                    else if (it.sep)
                        this.stack.push(fs);
                    else
                        Object.assign(it, { key: fs, sep: [] });
                    return;
                }
                case 'flow-map-end':
                case 'flow-seq-end':
                    fc.end.push(this.sourceToken);
                    return;
            }
            const bv = this.startBlockValue(fc);
            /* istanbul ignore else should not happen */
            if (bv)
                this.stack.push(bv);
            else {
                yield* this.pop();
                yield* this.step();
            }
        }
        else {
            const parent = this.peek(2);
            if (parent.type === 'block-map' &&
                ((this.type === 'map-value-ind' && parent.indent === fc.indent) ||
                    (this.type === 'newline' &&
                        !parent.items[parent.items.length - 1].sep))) {
                yield* this.pop();
                yield* this.step();
            }
            else if (this.type === 'map-value-ind' &&
                parent.type !== 'flow-collection') {
                const prev = getPrevProps(parent);
                const start = getFirstKeyStartProps(prev);
                fixFlowSeqItems(fc);
                const sep = fc.end.splice(1, fc.end.length);
                sep.push(this.sourceToken);
                const map = {
                    type: 'block-map',
                    offset: fc.offset,
                    indent: fc.indent,
                    items: [{ start, key: fc, sep }]
                };
                this.onKeyLine = true;
                this.stack[this.stack.length - 1] = map;
            }
            else {
                yield* this.lineEnd(fc);
            }
        }
    }
    flowScalar(type) {
        if (this.onNewLine) {
            let nl = this.source.indexOf('\n') + 1;
            while (nl !== 0) {
                this.onNewLine(this.offset + nl);
                nl = this.source.indexOf('\n', nl) + 1;
            }
        }
        return {
            type,
            offset: this.offset,
            indent: this.indent,
            source: this.source
        };
    }
    startBlockValue(parent) {
        switch (this.type) {
            case 'alias':
            case 'scalar':
            case 'single-quoted-scalar':
            case 'double-quoted-scalar':
                return this.flowScalar(this.type);
            case 'block-scalar-header':
                return {
                    type: 'block-scalar',
                    offset: this.offset,
                    indent: this.indent,
                    props: [this.sourceToken],
                    source: ''
                };
            case 'flow-map-start':
            case 'flow-seq-start':
                return {
                    type: 'flow-collection',
                    offset: this.offset,
                    indent: this.indent,
                    start: this.sourceToken,
                    items: [],
                    end: []
                };
            case 'seq-item-ind':
                return {
                    type: 'block-seq',
                    offset: this.offset,
                    indent: this.indent,
                    items: [{ start: [this.sourceToken] }]
                };
            case 'explicit-key-ind': {
                this.onKeyLine = true;
                const prev = getPrevProps(parent);
                const start = getFirstKeyStartProps(prev);
                start.push(this.sourceToken);
                return {
                    type: 'block-map',
                    offset: this.offset,
                    indent: this.indent,
                    items: [{ start, explicitKey: true }]
                };
            }
            case 'map-value-ind': {
                this.onKeyLine = true;
                const prev = getPrevProps(parent);
                const start = getFirstKeyStartProps(prev);
                return {
                    type: 'block-map',
                    offset: this.offset,
                    indent: this.indent,
                    items: [{ start, key: null, sep: [this.sourceToken] }]
                };
            }
        }
        return null;
    }
    atIndentedComment(start, indent) {
        if (this.type !== 'comment')
            return false;
        if (this.indent <= indent)
            return false;
        return start.every(st => st.type === 'newline' || st.type === 'space');
    }
    *documentEnd(docEnd) {
        if (this.type !== 'doc-mode') {
            if (docEnd.end)
                docEnd.end.push(this.sourceToken);
            else
                docEnd.end = [this.sourceToken];
            if (this.type === 'newline')
                yield* this.pop();
        }
    }
    *lineEnd(token) {
        switch (this.type) {
            case 'comma':
            case 'doc-start':
            case 'doc-end':
            case 'flow-seq-end':
            case 'flow-map-end':
            case 'map-value-ind':
                yield* this.pop();
                yield* this.step();
                break;
            case 'newline':
                this.onKeyLine = false;
            // fallthrough
            case 'space':
            case 'comment':
            default:
                // all other values are errors
                if (token.end)
                    token.end.push(this.sourceToken);
                else
                    token.end = [this.sourceToken];
                if (this.type === 'newline')
                    yield* this.pop();
        }
    }
}

exports.Parser = Parser;


/***/ }),
/* 79 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var composer = __webpack_require__(7);
var Document = __webpack_require__(12);
var errors = __webpack_require__(56);
var log = __webpack_require__(28);
var identity = __webpack_require__(10);
var lineCounter = __webpack_require__(77);
var parser = __webpack_require__(78);

function parseOptions(options) {
    const prettyErrors = options.prettyErrors !== false;
    const lineCounter$1 = options.lineCounter || (prettyErrors && new lineCounter.LineCounter()) || null;
    return { lineCounter: lineCounter$1, prettyErrors };
}
/**
 * Parse the input as a stream of YAML documents.
 *
 * Documents should be separated from each other by `...` or `---` marker lines.
 *
 * @returns If an empty `docs` array is returned, it will be of type
 *   EmptyStream and contain additional stream information. In
 *   TypeScript, you should use `'empty' in docs` as a type guard for it.
 */
function parseAllDocuments(source, options = {}) {
    const { lineCounter, prettyErrors } = parseOptions(options);
    const parser$1 = new parser.Parser(lineCounter?.addNewLine);
    const composer$1 = new composer.Composer(options);
    const docs = Array.from(composer$1.compose(parser$1.parse(source)));
    if (prettyErrors && lineCounter)
        for (const doc of docs) {
            doc.errors.forEach(errors.prettifyError(source, lineCounter));
            doc.warnings.forEach(errors.prettifyError(source, lineCounter));
        }
    if (docs.length > 0)
        return docs;
    return Object.assign([], { empty: true }, composer$1.streamInfo());
}
/** Parse an input string into a single YAML.Document */
function parseDocument(source, options = {}) {
    const { lineCounter, prettyErrors } = parseOptions(options);
    const parser$1 = new parser.Parser(lineCounter?.addNewLine);
    const composer$1 = new composer.Composer(options);
    // `doc` is always set by compose.end(true) at the very latest
    let doc = null;
    for (const _doc of composer$1.compose(parser$1.parse(source), true, source.length)) {
        if (!doc)
            doc = _doc;
        else if (doc.options.logLevel !== 'silent') {
            doc.errors.push(new errors.YAMLParseError(_doc.range.slice(0, 2), 'MULTIPLE_DOCS', 'Source contains multiple documents; please use YAML.parseAllDocuments()'));
            break;
        }
    }
    if (prettyErrors && lineCounter) {
        doc.errors.forEach(errors.prettifyError(source, lineCounter));
        doc.warnings.forEach(errors.prettifyError(source, lineCounter));
    }
    return doc;
}
function parse(src, reviver, options) {
    let _reviver = undefined;
    if (typeof reviver === 'function') {
        _reviver = reviver;
    }
    else if (options === undefined && reviver && typeof reviver === 'object') {
        options = reviver;
    }
    const doc = parseDocument(src, options);
    if (!doc)
        return null;
    doc.warnings.forEach(warning => log.warn(doc.options.logLevel, warning));
    if (doc.errors.length > 0) {
        if (doc.options.logLevel !== 'silent')
            throw doc.errors[0];
        else
            doc.errors = [];
    }
    return doc.toJS(Object.assign({ reviver: _reviver }, options));
}
function stringify(value, replacer, options) {
    let _replacer = null;
    if (typeof replacer === 'function' || Array.isArray(replacer)) {
        _replacer = replacer;
    }
    else if (options === undefined && replacer) {
        options = replacer;
    }
    if (typeof options === 'string')
        options = options.length;
    if (typeof options === 'number') {
        const indent = Math.round(options);
        options = indent < 1 ? undefined : indent > 8 ? { indent: 8 } : { indent };
    }
    if (value === undefined) {
        const { keepUndefined } = options ?? replacer ?? {};
        if (!keepUndefined)
            return undefined;
    }
    if (identity.isDocument(value) && !_replacer)
        return value.toString(options);
    return new Document.Document(value, _replacer, options).toString(options);
}

exports.parse = parse;
exports.parseAllDocuments = parseAllDocuments;
exports.parseDocument = parseDocument;
exports.stringify = stringify;


/***/ }),
/* 80 */
/***/ ((__unused_webpack_module, exports) => {


/**
 * VisualizationService - Diagram generation for agent hierarchy
 *
 * Generates Mermaid diagrams for:
 * - Team structure visualization
 * - Expert hierarchy
 * - Agent relationships
 */
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.visualizationService = exports.VisualizationService = void 0;
class VisualizationService {
    // ==========================================================================
    // Team Structure Diagrams
    // ==========================================================================
    /**
     * Generate Mermaid flowchart for team structure
     */
    generateTeamDiagram(teams) {
        if (teams.length === 0) {
            return this.getEmptyDiagram('No teams configured');
        }
        let mermaid = 'graph TB\n';
        mermaid += '    %% Team Structure Diagram\n';
        mermaid += '    classDef teamClass fill:#1f77b4,stroke:#08519c,stroke-width:2px,color:#fff\n';
        mermaid += '    classDef leaderClass fill:#ff7f0e,stroke:#d62728,stroke-width:2px,color:#fff\n';
        mermaid += '    classDef memberClass fill:#2ca02c,stroke:#1f77b4,stroke-width:1px,color:#fff\n';
        mermaid += '    classDef bridgeClass fill:#9467bd,stroke:#6a51a3,stroke-width:2px,color:#fff\n\n';
        teams.forEach((team, teamIndex) => {
            const teamId = `T${teamIndex}`;
            const teamLabel = this.sanitizeLabel(`${team.name}\\n(${team.type})`);
            // Team node
            mermaid += `    ${teamId}["${teamLabel}"]:::teamClass\n`;
            // Add members
            team.members.forEach((member, memberIndex) => {
                const memberId = `${teamId}M${memberIndex}`;
                const memberLabel = this.sanitizeLabel(member.role);
                const memberClass = member.is_leader ? 'leaderClass' : 'memberClass';
                if (member.is_bridge) {
                    mermaid += `    ${memberId}["${memberLabel}\\n🌉"]:::bridgeClass\n`;
                }
                else {
                    mermaid += `    ${memberId}["${memberLabel}"]:::${memberClass}\n`;
                }
                // Connect to team
                mermaid += `    ${teamId} --> ${memberId}\n`;
            });
            mermaid += '\n';
        });
        return mermaid;
    }
    /**
     * Generate Mermaid diagram for single team with members
     */
    generateSingleTeamDiagram(team) {
        let mermaid = 'graph TB\n';
        mermaid += '    %% Single Team Structure\n';
        mermaid += '    classDef teamClass fill:#1f77b4,stroke:#08519c,stroke-width:3px,color:#fff\n';
        mermaid += '    classDef leaderClass fill:#ff7f0e,stroke:#d62728,stroke-width:2px,color:#fff\n';
        mermaid += '    classDef memberClass fill:#2ca02c,stroke:#1f77b4,stroke-width:1px,color:#fff\n';
        mermaid += '    classDef bridgeClass fill:#9467bd,stroke:#6a51a3,stroke-width:2px,color:#fff\n';
        mermaid += '    classDef expertRef fill:#17becf,stroke:#00d2d3,stroke-width:1px,stroke-dasharray: 3 3,color:#fff\n\n';
        // Team node
        const teamLabel = this.sanitizeLabel(`${team.name}\\n${team.type}\\n${team.execution_mode}`);
        mermaid += `    Root["${teamLabel}"]:::teamClass\n\n`;
        // Coordinator
        const coordLabel = this.sanitizeLabel(`Coordinator\\n${team.coordinator}\\n${team.coordinator_model}`);
        mermaid += `    Coordinator["${coordLabel}"]:::leaderClass\n`;
        mermaid += `    Root --> Coordinator\n\n`;
        // Members grouped by role
        const leaders = team.members.filter(m => m.is_leader);
        const members = team.members.filter(m => !m.is_leader);
        leaders.forEach((member, index) => {
            const memberId = `Leader${index}`;
            const memberLabel = this.sanitizeLabel(`${member.role}\\n⭐`);
            const memberClass = member.is_bridge ? 'bridgeClass' : 'leaderClass';
            mermaid += `    ${memberId}["${memberLabel}"]:::${memberClass}\n`;
            mermaid += `    Coordinator --> ${memberId}\n`;
        });
        members.forEach((member, index) => {
            const memberId = `Member${index}`;
            const memberLabel = this.sanitizeLabel(`${member.role}\\n${member.expert_slug}`);
            const memberClass = member.is_bridge ? 'bridgeClass' : 'memberClass';
            mermaid += `    ${memberId}["${memberLabel}"]:::${memberClass}\n`;
            // Connect to leader if exists
            if (leaders.length > 0) {
                mermaid += `    Leader0 --> ${memberId}\n`;
            }
            else {
                mermaid += `    Coordinator --> ${memberId}\n`;
            }
        });
        // Decision mode annotation
        mermaid += `\n    %% Decision Mode: ${team.decision_mode}\n`;
        return mermaid;
    }
    // ==========================================================================
    // Expert Hierarchy Diagrams
    // ==========================================================================
    /**
     * Generate Mermaid diagram for expert hierarchy by domain
     */
    generateExpertHierarchyDiagram(experts) {
        if (experts.length === 0) {
            return this.getEmptyDiagram('No experts defined');
        }
        // Group by domain
        const byDomain = experts.reduce((acc, expert) => {
            if (!acc[expert.domain]) {
                acc[expert.domain] = [];
            }
            acc[expert.domain].push(expert);
            return acc;
        }, {});
        let mermaid = 'graph LR\n';
        mermaid += '    %% Expert Hierarchy by Domain\n';
        mermaid += '    classDef domainClass fill:#1f77b4,stroke:#08519c,stroke-width:2px,color:#fff\n';
        mermaid += '    classDef expertClass fill:#2ca02c,stroke:#1f77b4,stroke-width:1px,color:#fff\n';
        mermaid += '    classDef claudeClass fill:#d62728,stroke:#a50f15,stroke-width:1px,color:#fff\n';
        mermaid += '    classDef codexClass fill:#ff7f0e,stroke:#d62728,stroke-width:1px,color:#fff\n';
        mermaid += '    classDef geminiClass fill:#9467bd,stroke:#6a51a3,stroke-width:1px,color:#fff\n';
        mermaid += '    classDef zaiClass fill:#17becf,stroke:#00d2d3,stroke-width:1px,color:#fff\n\n';
        Object.entries(byDomain).forEach(([domain, domainExperts], domainIndex) => {
            const domainId = `D${domainIndex}`;
            mermaid += `    subgraph ${domainId}["${domain}"]\n`;
            mermaid += `        direction TB\n`;
            mermaid += `        D${domainIndex}_Root["${domain} Domain"]:::domainClass\n\n`;
            domainExperts.forEach((expert, expertIndex) => {
                const expertId = `${domainId}E${expertIndex}`;
                const expertLabel = this.sanitizeLabel(`${expert.role}\\n${expert.tier}`);
                const backedByClass = `${expert.backed_by}Class`;
                mermaid += `        ${expertId}["${expertLabel}"]:::${backedByClass}\n`;
                mermaid += `        D${domainIndex}_Root --> ${expertId}\n`;
            });
            mermaid += `    end\n\n`;
        });
        return mermaid;
    }
    /**
     * Generate Mermaid mind map for expert capabilities
     */
    generateExpertMindMap(expert) {
        let mermaid = 'mindmap\n';
        mermaid += '    %% Expert Capabilities Mind Map\n';
        mermaid += `    root((${this.sanitizeLabel(expert.role)}))\n`;
        mermaid += `        Domain(${expert.domain})\n`;
        mermaid += `        Tier[${expert.tier}]\n`;
        mermaid += `        BackedBy(${expert.backed_by})\n`;
        if (expert.capabilities && expert.capabilities.length > 0) {
            mermaid += `        Capabilities\n`;
            expert.capabilities.forEach(cap => {
                mermaid += `            ${this.sanitizeLabel(cap, 30)}\n`;
            });
        }
        if (expert.constraints && expert.constraints.length > 0) {
            mermaid += `        Constraints\n`;
            expert.constraints.forEach(con => {
                mermaid += `            ${this.sanitizeLabel(con, 30)}\n`;
            });
        }
        if (expert.phases && expert.phases.length > 0) {
            mermaid += `        Phases\n`;
            expert.phases.forEach(phase => {
                mermaid += `            ${phase}\n`;
            });
        }
        return mermaid;
    }
    // ==========================================================================
    // Combined Overview Diagram
    // ==========================================================================
    /**
     * Generate comprehensive overview diagram
     */
    generateOverviewDiagram(teams, experts) {
        let mermaid = 'graph TB\n';
        mermaid += '    %% Agent Manager Overview\n';
        mermaid += '    classDef containerClass fill:#34495e,stroke:#2c3e50,stroke-width:2px,color:#fff\n';
        mermaid += '    classDef teamClass fill:#1f77b4,stroke:#08519c,stroke-width:2px,color:#fff\n';
        mermaid += '    classDef expertClass fill:#2ca02c,stroke:#1f77b4,stroke-width:1px,color:#fff\n';
        mermaid += '    classDef statClass fill:#95a5a6,stroke:#7f8c8d,stroke-width:1px,color:#fff\n\n';
        // Stats
        mermaid += `    TeamsContainer["📊 Teams: ${teams.length}"]:::statClass\n`;
        mermaid += `    ExpertsContainer["👥 Experts: ${experts.length}"]:::statClass\n\n`;
        // Team summary
        const upperTeams = teams.filter(t => t.type === 'upper').length;
        const lowerTeams = teams.filter(t => t.type === 'lower').length;
        mermaid += `    UpperTeams["Upper Teams: ${upperTeams}"]:::teamClass\n`;
        mermaid += `    LowerTeams["Lower Teams: ${lowerTeams}"]:::teamClass\n`;
        mermaid += `    TeamsContainer --> UpperTeams\n`;
        mermaid += `    TeamsContainer --> LowerTeams\n\n`;
        // Expert summary by domain
        const byDomain = experts.reduce((acc, e) => {
            acc[e.domain] = (acc[e.domain] || 0) + 1;
            return acc;
        }, {});
        Object.entries(byDomain).forEach(([domain, count]) => {
            mermaid += `    ${domain}Experts["${domain}: ${count}"]:::expertClass\n`;
            mermaid += `    ExpertsContainer --> ${domain}Experts\n`;
        });
        return mermaid;
    }
    // ==========================================================================
    // Helper Methods
    // ==========================================================================
    sanitizeLabel(text, maxLength = 50) {
        // Escape special Mermaid characters
        let sanitized = text
            .replace(/"/g, '#quot;')
            .replace(/\[/g, '#91;')
            .replace(/\]/g, '#93;')
            .replace(/\{/g, '#123;')
            .replace(/\}/g, '#125;')
            .replace(/\(/g, '#40;')
            .replace(/\)/g, '#41;');
        // Truncate if too long
        if (sanitized.length > maxLength) {
            sanitized = sanitized.substring(0, maxLength - 3) + '...';
        }
        return sanitized;
    }
    getEmptyDiagram(message) {
        return `graph TB
    Empty["${message}"]
    classDef emptyClass fill:#95a5a6,stroke:#7f8c8d,stroke-width:1px,color:#fff
    Empty:::emptyClass`;
    }
    // ==========================================================================
    // Statistics for Dashboard
    // ==========================================================================
    getTeamStats(teams) {
        const coordinators = {};
        teams.forEach(team => {
            coordinators[team.coordinator] = (coordinators[team.coordinator] || 0) + 1;
        });
        return {
            total: teams.length,
            upper: teams.filter(t => t.type === 'upper').length,
            lower: teams.filter(t => t.type === 'lower').length,
            totalMembers: teams.reduce((sum, t) => sum + t.members.length, 0),
            coordinators
        };
    }
    getExpertStats(experts) {
        const byDomain = {};
        const byBackedBy = {};
        const byTier = {};
        experts.forEach(expert => {
            byDomain[expert.domain] = (byDomain[expert.domain] || 0) + 1;
            byBackedBy[expert.backed_by] = (byBackedBy[expert.backed_by] || 0) + 1;
            byTier[expert.tier] = (byTier[expert.tier] || 0) + 1;
        });
        return {
            total: experts.length,
            byDomain,
            byBackedBy,
            byTier
        };
    }
}
exports.VisualizationService = VisualizationService;
// Singleton export
exports.visualizationService = new VisualizationService();


/***/ }),
/* 81 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


/**
 * TeamBuilderPanel - Webview panel for creating/editing teams
 *
 * Features:
 * - Team creation and editing
 * - Member management with drag-drop
 * - Bridge member configuration
 * - Real-time validation
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.TeamBuilderPanel = void 0;
const vscode = __importStar(__webpack_require__(1));
const TeamService_1 = __webpack_require__(82);
const ExpertService_1 = __webpack_require__(85);
const ValidationService_1 = __webpack_require__(83);
const webview_1 = __webpack_require__(86);
class TeamBuilderPanel {
    extensionUri;
    static currentPanel;
    panel;
    disposables = [];
    editingTeamSlug = null;
    availableExperts = [];
    constructor(panel, extensionUri, editingSlug) {
        this.extensionUri = extensionUri;
        this.panel = panel;
        this.editingTeamSlug = editingSlug || null;
        this.panel.webview.html = this.getHtmlContent(this.panel.webview);
        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
        this.panel.webview.onDidReceiveMessage(async (message) => this.handleMessage(message), null, this.disposables);
        this.loadInitialData();
    }
    static async createOrShow(extensionUri, editingSlug) {
        const column = vscode.window.activeTextEditor?.viewColumn || vscode.ViewColumn.One;
        if (TeamBuilderPanel.currentPanel) {
            TeamBuilderPanel.currentPanel.panel.reveal(column);
            return;
        }
        const panel = vscode.window.createWebviewPanel('agentManager.teamBuilder', editingSlug ? 'Edit Team' : 'Build Team', column, {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [
                vscode.Uri.joinPath(extensionUri, 'media'),
                vscode.Uri.joinPath(extensionUri, 'dist')
            ]
        });
        TeamBuilderPanel.currentPanel = new TeamBuilderPanel(panel, extensionUri, editingSlug);
    }
    async loadInitialData() {
        // Load available experts
        const expertsResult = await ExpertService_1.expertService.listExperts();
        if (expertsResult.success && expertsResult.data) {
            this.availableExperts = expertsResult.data;
            this.postMessage({
                type: 'expertsLoaded',
                data: this.availableExperts
            });
        }
        // Load existing team if editing
        if (this.editingTeamSlug) {
            const teamResult = await TeamService_1.teamService.getTeam(this.editingTeamSlug);
            if (teamResult.success && teamResult.data) {
                this.postMessage({
                    type: 'teamLoaded',
                    data: teamResult.data
                });
            }
        }
    }
    async handleMessage(message) {
        switch (message.type) {
            case 'validate':
                await this.handleValidation(message.data);
                break;
            case 'save':
                await this.handleSave(message.data);
                break;
            case 'loadExpert':
                await this.handleLoadExpert(message.data);
                break;
            case 'close':
                this.panel.dispose();
                break;
            default:
                console.warn('Unknown message type:', message.type);
        }
    }
    async handleValidation(data) {
        const team = this.buildTeamObject(data);
        const validation = ValidationService_1.validationService.validateTeam(team);
        // Additional member existence validation
        const memberErrors = [];
        for (const member of data.members) {
            const exists = this.availableExperts.some(e => e.slug === member.expert_slug);
            if (!exists) {
                memberErrors.push(`Expert not found: ${member.expert_slug}`);
            }
        }
        if (memberErrors.length > 0) {
            validation.errors.push(...memberErrors);
            validation.valid = false;
        }
        this.postMessage({
            type: 'validationResult',
            data: validation
        });
    }
    async handleSave(data) {
        try {
            const team = this.buildTeamObject(data);
            // Validate first
            const validation = ValidationService_1.validationService.validateTeam(team);
            if (!validation.valid) {
                this.postMessage({
                    type: 'saveError',
                    data: { errors: validation.errors }
                });
                return;
            }
            let result;
            if (this.editingTeamSlug) {
                result = await TeamService_1.teamService.updateTeam(this.editingTeamSlug, team);
            }
            else {
                result = await TeamService_1.teamService.createTeam(data.name, team);
            }
            if (result.success) {
                this.postMessage({
                    type: 'saveSuccess',
                    data: result.data
                });
                // Refresh tree view
                vscode.commands.executeCommand('agentManager.refreshTree');
                setTimeout(() => {
                    this.panel.dispose();
                }, 1000);
            }
            else {
                this.postMessage({
                    type: 'saveError',
                    data: { errors: [result.error || 'Save failed'] }
                });
            }
        }
        catch (error) {
            this.postMessage({
                type: 'saveError',
                data: { errors: [String(error)] }
            });
        }
    }
    async handleLoadExpert(slug) {
        const expert = this.availableExperts.find(e => e.slug === slug);
        if (expert) {
            this.postMessage({
                type: 'expertDetails',
                data: expert
            });
        }
    }
    buildTeamObject(data) {
        return {
            name: data.name,
            slug: this.editingTeamSlug || undefined,
            type: data.type,
            execution_mode: data.execution_mode,
            coordinator: data.coordinator,
            coordinator_model: data.coordinator_model,
            purpose: data.purpose,
            decision_mode: data.decision_mode,
            members: data.members.map(m => ({
                role: m.role,
                expert_slug: m.expert_slug,
                cli: m.cli || null,
                model: m.model || undefined,
                fallback_cli: null,
                tier: m.tier,
                permission_mode: m.permission_mode,
                is_leader: m.is_leader,
                is_bridge: m.is_bridge
            })),
            phase_routing: data.phase_routing
        };
    }
    postMessage(message) {
        this.panel.webview.postMessage(message);
    }
    getHtmlContent(webview) {
        const nonce = (0, webview_1.getNonce)();
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'dist', 'webviews', 'teamBuilder.js'));
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', 'teamBuilder.css'));
        return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}' ${webview.cspSource};">
  <link rel="stylesheet" href="${styleUri}" nonce="${nonce}">
  <title>Team Builder</title>
</head>
<body>
  <div class="container">
    <header class="header">
      <h1 class="title">${this.editingTeamSlug ? 'Edit Team' : 'Build New Team'}</h1>
      <p class="subtitle">Configure your agent team composition and settings</p>
    </header>

    <form id="teamForm" class="form">
      <!-- Basic Info -->
      <section class="section">
        <h2 class="section-title">Basic Information</h2>
        <div class="form-group">
          <label for="teamName">Team Name *</label>
          <input type="text" id="teamName" name="teamName" required
                 placeholder="e.g., Backend Development Team">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="teamType">Team Type *</label>
            <select id="teamType" name="teamType" required>
              <option value="lower">Lower Team (Implementation)</option>
              <option value="upper">Upper Team (Orchestration)</option>
            </select>
          </div>
          <div class="form-group">
            <label for="executionMode">Execution Mode</label>
            <select id="executionMode" name="executionMode">
              <option value="teammate">Teammate (Separate Process)</option>
              <option value="inprocess">In-Process</option>
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="coordinator">Coordinator</label>
            <select id="coordinator" name="coordinator">
              <option value="claude">Claude</option>
              <option value="glm">GLM</option>
            </select>
          </div>
          <div class="form-group">
            <label for="coordinatorModel">Coordinator Model</label>
            <input type="text" id="coordinatorModel" name="coordinatorModel"
                   value="claude-opus-4-6" placeholder="e.g., claude-opus-4-6">
          </div>
        </div>
        <div class="form-group">
          <label for="decisionMode">Decision Mode</label>
          <select id="decisionMode" name="decisionMode">
            <option value="leader_decides">Leader Decides</option>
            <option value="consensus">Consensus</option>
            <option value="vote">Vote</option>
            <option value="architect_veto">Architect Veto</option>
          </select>
        </div>
        <div class="form-group">
          <label for="purpose">Purpose / Description</label>
          <textarea id="purpose" name="purpose" rows="2"
                    placeholder="Describe the team's purpose and responsibilities..."></textarea>
        </div>
      </section>

      <!-- Members -->
      <section class="section">
        <h2 class="section-title">Team Members</h2>
        <div class="members-section">
          <div class="available-experts">
            <h3>Available Experts</h3>
            <div class="search-box">
              <input type="text" id="expertSearch" placeholder="Search experts...">
            </div>
            <div id="expertList" class="expert-list"></div>
          </div>
          <div class="team-members">
            <h3>Team Members <span class="member-count">(0)</span></h3>
            <div id="memberList" class="member-list">
              <p class="empty-state">Drag experts here or click to add</p>
            </div>
          </div>
        </div>
      </section>

      <!-- Phase Routing -->
      <section class="section">
        <h2 class="section-title">Phase Routing (Optional)</h2>
        <div class="phase-routing">
          <div class="form-group">
            <label for="probePhase">Probe Phase</label>
            <select id="probePhase" name="probePhase">
              <option value="">-- Not Assigned --</option>
            </select>
          </div>
          <div class="form-group">
            <label for="graspPhase">Grasp Phase</label>
            <select id="graspPhase" name="graspPhase">
              <option value="">-- Not Assigned --</option>
            </select>
          </div>
          <div class="form-group">
            <label for="tanglePhase">Tangle Phase</label>
            <select id="tanglePhase" name="tanglePhase">
              <option value="">-- Not Assigned --</option>
            </select>
          </div>
          <div class="form-group">
            <label for="inkPhase">Ink Phase</label>
            <select id="inkPhase" name="inkPhase">
              <option value="">-- Not Assigned --</option>
            </select>
          </div>
        </div>
      </section>

      <!-- Validation Status -->
      <section class="section status-section">
        <div id="validationStatus" class="status-box status-info">
          <span class="status-icon">ℹ️</span>
          <span class="status-text">Fill in the form and add at least one member</span>
        </div>
      </section>

      <!-- Actions -->
      <section class="section actions">
        <button type="button" id="validateBtn" class="btn btn-secondary">
          Validate
        </button>
        <button type="submit" id="saveBtn" class="btn btn-primary" disabled>
          Save Team
        </button>
        <button type="button" id="cancelBtn" class="btn btn-ghost">
          Cancel
        </button>
      </section>
    </form>

    <!-- Expert Detail Modal -->
    <div id="expertModal" class="modal">
      <div class="modal-content">
        <div class="modal-header">
          <h3 id="modalExpertName">Expert Details</h3>
          <button class="modal-close" id="closeModal">&times;</button>
        </div>
        <div class="modal-body" id="modalExpertBody"></div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" id="closeModalBtn">Close</button>
          <button type="button" class="btn btn-primary" id="addExpertBtn">Add to Team</button>
        </div>
      </div>
    </div>
  </div>

  <script nonce="${nonce}">${this.getScriptContent()}</script>
</body>
</html>`;
    }
    getScriptContent() {
        return `
    // Team Builder Script
    (function() {
      const vscode = acquireVsCodeApi();
      let availableExperts = [];
      let teamMembers = [];
      let currentTeam = null;
      let selectedExpertSlug = null;

      // Form elements
      const form = document.getElementById('teamForm');
      const validateBtn = document.getElementById('validateBtn');
      const saveBtn = document.getElementById('saveBtn');
      const cancelBtn = document.getElementById('cancelBtn');
      const expertList = document.getElementById('expertList');
      const memberList = document.getElementById('memberList');
      const memberCount = document.querySelector('.member-count');
      const validationStatus = document.getElementById('validationStatus');
      const expertSearch = document.getElementById('expertSearch');

      // Modal elements
      const expertModal = document.getElementById('expertModal');
      const closeModal = document.getElementById('closeModal');
      const closeModalBtn = document.getElementById('closeModalBtn');
      const addExpertBtn = document.getElementById('addExpertBtn');
      const modalExpertName = document.getElementById('modalExpertName');
      const modalExpertBody = document.getElementById('modalExpertBody');

      // Team type change handler
      document.getElementById('teamType').addEventListener('change', function() {
        updatePhaseSelects();
        validateForm();
      });

      // Search handler
      expertSearch.addEventListener('input', function() {
        filterExperts(this.value);
      });

      // Validate button
      validateBtn.addEventListener('click', function() {
        const data = getFormData();
        vscode.postMessage({ type: 'validate', data });
      });

      // Form submit
      form.addEventListener('submit', function(e) {
        e.preventDefault();
        const data = getFormData();
        vscode.postMessage({ type: 'save', data });
      });

      // Cancel button
      cancelBtn.addEventListener('click', function() {
        vscode.postMessage({ type: 'close' });
      });

      // Modal handlers
      closeModal.addEventListener('click', hideModal);
      closeModalBtn.addEventListener('click', hideModal);
      addExpertBtn.addEventListener('click', function() {
        if (selectedExpertSlug) {
          addMember(selectedExpertSlug);
          hideModal();
        }
      });

      // Message handlers
      window.addEventListener('message', function(event) {
        const message = event.data;
        switch (message.type) {
          case 'expertsLoaded':
            availableExperts = message.data;
            renderExpertList(availableExperts);
            break;
          case 'teamLoaded':
            currentTeam = message.data;
            loadTeamData(currentTeam);
            break;
          case 'validationResult':
            showValidationResult(message.data);
            break;
          case 'saveSuccess':
            showStatus('Team saved successfully!', 'success');
            saveBtn.textContent = 'Saved!';
            saveBtn.disabled = true;
            break;
          case 'saveError':
            showStatus('Save failed: ' + message.data.errors.join(', '), 'error');
            break;
          case 'expertDetails':
            showExpertModal(message.data);
            break;
        }
      });

      function renderExpertList(experts) {
        expertList.innerHTML = '';
        experts.forEach(expert => {
          const div = document.createElement('div');
          div.className = 'expert-item';
          div.dataset.slug = expert.slug;
          div.innerHTML = \`
            <div class="expert-icon">
              <span class="expert-domain">\${expert.domain.charAt(0).toUpperCase()}</span>
            </div>
            <div class="expert-info">
              <div class="expert-name">\${expert.role}</div>
              <div class="expert-meta">
                <span class="expert-tier">\${expert.tier}</span>
                <span class="expert-backed">\${expert.backed_by}</span>
              </div>
            </div>
            <div class="expert-phases">
              \${(expert.phases || []).map(p => \`<span class="phase-badge">\${p}</span>\`).join('')}
            </div>
          \`;
          div.addEventListener('click', () => showExpertDetails(expert.slug));
          div.draggable = true;
          div.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('expert-slug', expert.slug);
          });
          expertList.appendChild(div);
        });
      }

      function filterExperts(query) {
        const lower = query.toLowerCase();
        const filtered = availableExperts.filter(e =>
          e.role.toLowerCase().includes(lower) ||
          e.slug.toLowerCase().includes(lower) ||
          (e.capabilities || []).some(c => c.toLowerCase().includes(lower))
        );
        renderExpertList(filtered);
      }

      function renderMemberList() {
        memberList.innerHTML = '';
        memberCount.textContent = \`(\${teamMembers.length})\`;

        if (teamMembers.length === 0) {
          memberList.innerHTML = '<p class="empty-state">Drag experts here or click to add</p>';
          return;
        }

        teamMembers.forEach((member, index) => {
          const div = document.createElement('div');
          div.className = 'member-item';
          div.dataset.index = index;
          div.innerHTML = \`
            <div class="member-role">
              <input type="text" value="\${member.role}"
                     class="role-input" data-index="\${index}" placeholder="Role name">
            </div>
            <div class="member-info">
              <span class="member-slug">\${member.expert_slug}</span>
            </div>
            <div class="member-actions">
              <label class="checkbox-label">
                <input type="checkbox" \${member.is_leader ? 'checked' : ''}
                       class="leader-checkbox" data-index="\${index}">
                <span>⭐ Leader</span>
              </label>
              <label class="checkbox-label">
                <input type="checkbox" \${member.is_bridge ? 'checked' : ''}
                       class="bridge-checkbox" data-index="\${index}">
                <span>🌉 Bridge</span>
              </label>
              <button type="button" class="btn-icon btn-remove" data-index="\${index}" title="Remove">
                ✕
              </button>
            </div>
          \`;

          // Event listeners
          div.querySelector('.role-input').addEventListener('change', (e) => {
            teamMembers[index].role = e.target.value;
            updatePhaseSelects();
            validateForm();
          });
          div.querySelector('.leader-checkbox').addEventListener('change', (e) => {
            // Only one leader
            if (e.target.checked) {
              teamMembers.forEach((m, i) => {
                if (i !== index) m.is_leader = false;
              });
              document.querySelectorAll('.leader-checkbox').forEach(cb => {
                if (cb !== e.target) cb.checked = false;
              });
            }
            teamMembers[index].is_leader = e.target.checked;
            validateForm();
          });
          div.querySelector('.bridge-checkbox').addEventListener('change', (e) => {
            // Only one bridge
            if (e.target.checked) {
              teamMembers.forEach((m, i) => {
                if (i !== index) m.is_bridge = false;
              });
              document.querySelectorAll('.bridge-checkbox').forEach(cb => {
                if (cb !== e.target) cb.checked = false;
              });
            }
            teamMembers[index].is_bridge = e.target.checked;
          });
          div.querySelector('.btn-remove').addEventListener('click', () => {
            teamMembers.splice(index, 1);
            renderMemberList();
            updatePhaseSelects();
            validateForm();
          });

          memberList.appendChild(div);
        });

        // Allow drop
        memberList.parentElement.addEventListener('dragover', (e) => {
          e.preventDefault();
        });
        memberList.parentElement.addEventListener('drop', (e) => {
          e.preventDefault();
          const slug = e.dataTransfer.getData('expert-slug');
          if (slug) addMember(slug);
        });

        updatePhaseSelects();
        validateForm();
      }

      function addMember(slug) {
        const expert = availableExperts.find(e => e.slug === slug);
        if (!expert) return;

        if (teamMembers.some(m => m.expert_slug === slug)) {
          showStatus('Expert already in team', 'warning');
          return;
        }

        const isLeader = teamMembers.length === 0;
        teamMembers.push({
          expert_slug: slug,
          role: expert.role,
          tier: expert.tier,
          permission_mode: expert.permission_mode || 'default',
          is_leader: isLeader,
          is_bridge: false
        });

        renderMemberList();
        showStatus(\`Added \${expert.role} to team\`, 'info');
      }

      function showExpertDetails(slug) {
        selectedExpertSlug = slug;
        vscode.postMessage({ type: 'loadExpert', data: slug });
      }

      function showExpertModal(expert) {
        modalExpertName.textContent = expert.role;
        modalExpertBody.innerHTML = \`
          <div class="expert-detail">
            <div class="detail-row">
              <span class="detail-label">Slug:</span>
              <span class="detail-value">\${expert.slug}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Domain:</span>
              <span class="detail-value">\${expert.domain}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Tier:</span>
              <span class="detail-value">\${expert.tier}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Backed By:</span>
              <span class="detail-value">\${expert.backed_by}</span>
            </div>
            \${expert.phases && expert.phases.length ? \`
            <div class="detail-row">
              <span class="detail-label">Phases:</span>
              <span class="detail-value">\${expert.phases.join(', ')}</span>
            </div>
            \` : ''}
            \${expert.persona ? \`
            <div class="detail-section">
              <h4>Persona</h4>
              <p>\${expert.persona}</p>
            </div>
            \` : ''}
            \${expert.capabilities && expert.capabilities.length ? \`
            <div class="detail-section">
              <h4>Capabilities</h4>
              <ul>
                \${expert.capabilities.map(c => \`<li>\${c}</li>\`).join('')}
              </ul>
            </div>
            \` : ''}
            \${expert.constraints && expert.constraints.length ? \`
            <div class="detail-section">
              <h4>Constraints</h4>
              <ul>
                \${expert.constraints.map(c => \`<li>\${c}</li>\`).join('')}
              </ul>
            </div>
            \` : ''}
          </div>
        \`;
        expertModal.style.display = 'flex';
      }

      function hideModal() {
        expertModal.style.display = 'none';
        selectedExpertSlug = null;
      }

      function updatePhaseSelects() {
        const phases = ['probe', 'grasp', 'tangle', 'ink'];
        const teamType = document.getElementById('teamType').value;

        phases.forEach(phase => {
          const select = document.getElementById(phase + 'Phase');
          select.innerHTML = '<option value="">-- Not Assigned --</option>';
          teamMembers.forEach(member => {
            const option = document.createElement('option');
            option.value = member.expert_slug;
            option.textContent = \`\${member.role} (\${member.expert_slug})\`;
            select.appendChild(option);
          });

          // Restore saved routing
          if (currentTeam && currentTeam.phase_routing && currentTeam.phase_routing[phase]) {
            select.value = currentTeam.phase_routing[phase];
          }
        });
      }

      function getFormData() {
        const phaseRouting = {};
        ['probe', 'grasp', 'tangle', 'ink'].forEach(phase => {
          const value = document.getElementById(phase + 'Phase').value;
          if (value) phaseRouting[phase] = value;
        });

        return {
          name: document.getElementById('teamName').value,
          type: document.getElementById('teamType').value,
          execution_mode: document.getElementById('executionMode').value,
          coordinator: document.getElementById('coordinator').value,
          coordinator_model: document.getElementById('coordinatorModel').value,
          decision_mode: document.getElementById('decisionMode').value,
          purpose: document.getElementById('purpose').value,
          members: teamMembers,
          phase_routing: phaseRouting
        };
      }

      function loadTeamData(team) {
        document.getElementById('teamName').value = team.name;
        document.getElementById('teamType').value = team.type;
        document.getElementById('executionMode').value = team.execution_mode;
        document.getElementById('coordinator').value = team.coordinator;
        document.getElementById('coordinatorModel').value = team.coordinator_model;
        document.getElementById('decisionMode').value = team.decision_mode;
        document.getElementById('purpose').value = team.purpose || '';

        teamMembers = team.members.map(m => ({
          expert_slug: m.expert_slug,
          role: m.role,
          cli: m.cli || undefined,
          model: m.model || undefined,
          tier: m.tier,
          permission_mode: m.permission_mode,
          is_leader: m.is_leader,
          is_bridge: m.is_bridge
        }));

        renderMemberList();
        updatePhaseSelects();
      }

      function showValidationResult(result) {
        if (result.valid) {
          showStatus('✓ Team configuration is valid!', 'success');
          saveBtn.disabled = false;
        } else {
          showStatus('✗ Validation failed: ' + result.errors.join(', '), 'error');
          saveBtn.disabled = true;
        }

        if (result.warnings && result.warnings.length > 0) {
          showStatus('Warnings: ' + result.warnings.join(', '), 'warning');
        }
      }

      function showStatus(message, type) {
        validationStatus.className = 'status-box status-' + type;
        const icons = { info: 'ℹ️', success: '✓', error: '✗', warning: '⚠️' };
        validationStatus.innerHTML = \`
          <span class="status-icon">\${icons[type] || 'ℹ️'}</span>
          <span class="status-text">\${message}</span>
        \`;
      }

      function validateForm() {
        const name = document.getElementById('teamName').value.trim();
        const hasMembers = teamMembers.length > 0;
        const hasLeader = teamMembers.some(m => m.is_leader);

        if (name && hasMembers && hasLeader) {
          validateBtn.disabled = false;
        } else {
          validateBtn.disabled = true;
          saveBtn.disabled = true;
        }
      }

      // Initial validation
      document.getElementById('teamName').addEventListener('input', validateForm);
    })();
    `;
    }
    dispose() {
        TeamBuilderPanel.currentPanel = undefined;
        this.panel.dispose();
        while (this.disposables.length) {
            const disposable = this.disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }
}
exports.TeamBuilderPanel = TeamBuilderPanel;


/***/ }),
/* 82 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


/**
 * TeamService - High-level Team management operations
 *
 * Wraps FileService with additional functionality:
 * - Member validation against existing experts
 * - Bridge member management
 * - Team composition analysis
 * - Phase coverage validation
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.teamService = exports.TeamService = void 0;
const vscode = __importStar(__webpack_require__(1));
const FileService_1 = __webpack_require__(3);
const ValidationService_1 = __webpack_require__(83);
const slugify_1 = __webpack_require__(84);
class TeamService {
    // ==========================================================================
    // CRUD Operations
    // ==========================================================================
    async createTeam(name, options = {}) {
        // Generate slug from name if not provided
        let slug = options.slug || (0, slugify_1.slugify)(name);
        // Check uniqueness
        const existing = await FileService_1.fileService.listTeams();
        const existingSlugs = existing.success && existing.data
            ? new Set(existing.data.map(t => t.slug))
            : new Set();
        slug = (0, slugify_1.generateUniqueSlug)(slug, existingSlugs);
        // Validate members exist
        const members = options.members || [];
        const memberValidation = await this.validateMembersExist(members);
        if (!memberValidation.valid) {
            return {
                success: false,
                error: `Member validation failed: ${memberValidation.errors.join(', ')}`
            };
        }
        // Build team object
        const team = {
            id: options.id || this.generateTeamId(),
            name,
            slug,
            type: options.type || 'lower',
            execution_mode: options.execution_mode || 'teammate',
            coordinator: options.coordinator || 'claude',
            coordinator_model: options.coordinator_model || 'claude-opus-4-6',
            purpose: options.purpose || '',
            decision_mode: options.decision_mode || 'leader_decides',
            members,
            phase_routing: options.phase_routing || {},
            bridge_to: options.bridge_to || null,
            created_at: options.created_at || new Date().toISOString().split('T')[0]
        };
        // Validate
        const validation = ValidationService_1.validationService.validateTeam(team);
        if (!validation.valid) {
            return {
                success: false,
                error: `Validation failed: ${validation.errors.join(', ')}`
            };
        }
        // Warn if issues but continue
        if (validation.warnings.length > 0) {
            const warningMsg = `Team created with warnings:\n${validation.warnings.map(w => `- ${w}`).join('\n')}`;
            vscode.window.showWarningMessage(warningMsg);
        }
        // Create
        const result = await FileService_1.fileService.createTeam(team);
        if (!result.success) {
            return { success: false, error: result.error };
        }
        return { success: true, data: team };
    }
    async updateTeam(slug, updates) {
        // Read existing
        const existing = await FileService_1.fileService.readTeam(slug);
        if (!existing.success || !existing.data) {
            return { success: false, error: `Team not found: ${slug}` };
        }
        // Validate new members if provided
        if (updates.members) {
            const memberValidation = await this.validateMembersExist(updates.members);
            if (!memberValidation.valid) {
                return {
                    success: false,
                    error: `Member validation failed: ${memberValidation.errors.join(', ')}`
                };
            }
        }
        // Merge updates
        const updated = {
            ...existing.data,
            ...updates,
            slug, // Preserve original slug
            id: updates.id || existing.data.id
        };
        // Validate
        const validation = ValidationService_1.validationService.validateTeam(updated);
        if (!validation.valid) {
            return {
                success: false,
                error: `Validation failed: ${validation.errors.join(', ')}`
            };
        }
        // Update
        const result = await FileService_1.fileService.updateTeam(slug, updated);
        if (!result.success) {
            return { success: false, error: result.error };
        }
        return { success: true, data: updated };
    }
    async deleteTeam(slug) {
        // Check if referenced as bridge_to
        const teams = await FileService_1.fileService.listTeams();
        if (teams.success && teams.data) {
            const isBridgeTarget = teams.data.some(team => team.bridge_to === slug && team.slug !== slug);
            if (isBridgeTarget) {
                return {
                    success: false,
                    error: 'Cannot delete: This team is referenced as a bridge target by another team'
                };
            }
        }
        return FileService_1.fileService.deleteTeam(slug);
    }
    // ==========================================================================
    // Query Operations
    // ==========================================================================
    async listTeams() {
        return FileService_1.fileService.listTeams();
    }
    async getTeam(slug) {
        return FileService_1.fileService.readTeam(slug);
    }
    async getTeamsByType(type) {
        const result = await FileService_1.fileService.listTeams();
        if (!result.success || !result.data) {
            return result;
        }
        const filtered = result.data.filter(t => t.type === type);
        return { success: true, data: filtered };
    }
    async findTeamByMember(expertSlug) {
        const result = await FileService_1.fileService.listTeams();
        if (!result.success || !result.data) {
            return result;
        }
        const filtered = result.data.filter(team => team.members.some(m => m.expert_slug === expertSlug));
        return { success: true, data: filtered };
    }
    // ==========================================================================
    // Member Management
    // ==========================================================================
    async addMember(teamSlug, member) {
        const teamResult = await FileService_1.fileService.readTeam(teamSlug);
        if (!teamResult.success || !teamResult.data) {
            return { success: false, error: `Team not found: ${teamSlug}` };
        }
        // Validate expert exists
        const expertExists = await ValidationService_1.validationService.checkTeamMemberExists(member.expert_slug);
        if (!expertExists) {
            return {
                success: false,
                error: `Expert not found: ${member.expert_slug}`
            };
        }
        const team = teamResult.data;
        const updatedMembers = [...team.members, member];
        return this.updateTeam(teamSlug, { members: updatedMembers });
    }
    async removeMember(teamSlug, expertSlug) {
        const teamResult = await FileService_1.fileService.readTeam(teamSlug);
        if (!teamResult.success || !teamResult.data) {
            return { success: false, error: `Team not found: ${teamSlug}` };
        }
        const team = teamResult.data;
        const updatedMembers = team.members.filter(m => m.expert_slug !== expertSlug);
        // Check if removing leader
        const wasLeader = team.members.find(m => m.expert_slug === expertSlug)?.is_leader;
        if (wasLeader && updatedMembers.length > 0) {
            // Check if there's still a leader
            const hasLeader = updatedMembers.some(m => m.is_leader);
            if (!hasLeader) {
                return {
                    success: false,
                    error: 'Cannot remove the only leader. Designate another leader first.'
                };
            }
        }
        return this.updateTeam(teamSlug, { members: updatedMembers });
    }
    async updateMember(teamSlug, expertSlug, updates) {
        const teamResult = await FileService_1.fileService.readTeam(teamSlug);
        if (!teamResult.success || !teamResult.data) {
            return { success: false, error: `Team not found: ${teamSlug}` };
        }
        const team = teamResult.data;
        const memberIndex = team.members.findIndex(m => m.expert_slug === expertSlug);
        if (memberIndex === -1) {
            return { success: false, error: `Member not found: ${expertSlug}` };
        }
        const updatedMembers = [...team.members];
        updatedMembers[memberIndex] = {
            ...updatedMembers[memberIndex],
            ...updates
        };
        return this.updateTeam(teamSlug, { members: updatedMembers });
    }
    async setLeader(teamSlug, expertSlug) {
        const teamResult = await FileService_1.fileService.readTeam(teamSlug);
        if (!teamResult.success || !teamResult.data) {
            return { success: false, error: `Team not found: ${teamSlug}` };
        }
        const team = teamResult.data;
        const updatedMembers = team.members.map(m => ({
            ...m,
            is_leader: m.expert_slug === expertSlug
        }));
        return this.updateTeam(teamSlug, { members: updatedMembers });
    }
    async setBridgeMember(teamSlug, expertSlug) {
        const teamResult = await FileService_1.fileService.readTeam(teamSlug);
        if (!teamResult.success || !teamResult.data) {
            return { success: false, error: `Team not found: ${teamSlug}` };
        }
        // Clear existing bridge member first
        const team = teamResult.data;
        const updatedMembers = team.members.map(m => ({
            ...m,
            is_bridge: m.expert_slug === expertSlug
        }));
        return this.updateTeam(teamSlug, { members: updatedMembers });
    }
    // ==========================================================================
    // Bridge Management
    // ==========================================================================
    async setBridgeTarget(teamSlug, targetTeamSlug) {
        if (targetTeamSlug) {
            // Validate target team exists
            const targetResult = await FileService_1.fileService.readTeam(targetTeamSlug);
            if (!targetResult.success || !targetResult.data) {
                return { success: false, error: `Target team not found: ${targetTeamSlug}` };
            }
        }
        return this.updateTeam(teamSlug, { bridge_to: targetTeamSlug });
    }
    async getBridgeChain(teamSlug) {
        const chain = [];
        let currentSlug = teamSlug;
        const visited = new Set();
        while (currentSlug && !visited.has(currentSlug)) {
            visited.add(currentSlug);
            const result = await FileService_1.fileService.readTeam(currentSlug);
            if (!result.success || !result.data) {
                break;
            }
            chain.push(result.data);
            if (!result.data.bridge_to) {
                break;
            }
            currentSlug = result.data.bridge_to;
        }
        // Detect cycles
        if (currentSlug && visited.has(currentSlug)) {
            return { success: false, error: 'Circular bridge reference detected' };
        }
        return { success: true, data: chain };
    }
    // ==========================================================================
    // Team Analysis
    // ==========================================================================
    async analyzeTeam(teamSlug) {
        const teamResult = await FileService_1.fileService.readTeam(teamSlug);
        if (!teamResult.success || !teamResult.data) {
            return { success: false, error: `Team not found: ${teamSlug}` };
        }
        const team = teamResult.data;
        const analysis = {
            valid: true,
            errors: [],
            warnings: [],
            hasLeader: false,
            hasOrchestrator: false,
            hasArchitect: false,
            phaseCoverage: [],
            size: {
                current: team.members.length,
                recommended: team.type === 'upper' ? { min: 3, max: 8 } : { min: 2, max: 6 }
            }
        };
        // Check for leader
        analysis.hasLeader = team.members.some(m => m.is_leader);
        if (!analysis.hasLeader) {
            analysis.errors.push('Team must have at least one leader');
            analysis.valid = false;
        }
        // Check team composition
        if (team.type === 'upper') {
            for (const member of team.members) {
                const role = member.role.toLowerCase();
                if (role.includes('orchestrator')) {
                    analysis.hasOrchestrator = true;
                }
                if (role.includes('architect') || role.includes('designer')) {
                    analysis.hasArchitect = true;
                }
            }
            if (!analysis.hasOrchestrator) {
                analysis.errors.push('Upper team must have an orchestrator');
                analysis.valid = false;
            }
            if (!analysis.hasArchitect) {
                analysis.errors.push('Upper team must have an architect');
                analysis.valid = false;
            }
        }
        // Analyze phase coverage
        const phaseRoutingKeys = Object.keys(team.phase_routing).filter(k => team.phase_routing[k]);
        analysis.phaseCoverage = phaseRoutingKeys;
        if (analysis.phaseCoverage.length === 0) {
            analysis.warnings.push('No phase routing configured');
        }
        // Size warnings
        if (team.members.length < analysis.size.recommended.min) {
            analysis.warnings.push(`Team size (${team.members.length}) is below recommended minimum (${analysis.size.recommended.min})`);
        }
        else if (team.members.length > analysis.size.recommended.max) {
            analysis.warnings.push(`Team size (${team.members.length}) exceeds recommended maximum (${analysis.size.recommended.max})`);
        }
        return { success: true, data: analysis };
    }
    async getExpertUsage(expertSlug) {
        const teamsResult = await FileService_1.fileService.listTeams();
        if (!teamsResult.success || !teamsResult.data) {
            return { success: false, error: teamsResult.error };
        }
        const teams = teamsResult.data
            .filter(team => team.members.some(m => m.expert_slug === expertSlug))
            .map(team => {
            const member = team.members.find(m => m.expert_slug === expertSlug);
            return {
                name: team.name,
                slug: team.slug,
                role: member.role
            };
        });
        const isLeader = teamsResult.data.some(team => team.members.some(m => m.expert_slug === expertSlug && m.is_leader));
        const isBridge = teamsResult.data.some(team => team.members.some(m => m.expert_slug === expertSlug && m.is_bridge));
        return {
            success: true,
            data: { teams, isLeader, isBridge }
        };
    }
    // ==========================================================================
    // Utilities
    // ==========================================================================
    async validateMembersExist(members) {
        const errors = [];
        const expertsResult = await FileService_1.fileService.listExperts();
        const expertSlugs = new Set();
        if (expertsResult.success && expertsResult.data) {
            for (const expert of expertsResult.data) {
                expertSlugs.add(expert.slug);
            }
        }
        for (const member of members) {
            if (!expertSlugs.has(member.expert_slug)) {
                errors.push(`Expert not found: ${member.expert_slug}`);
            }
        }
        return {
            valid: errors.length === 0,
            errors
        };
    }
    generateTeamId() {
        return `team-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    async cloneTeam(sourceSlug, newName) {
        const sourceResult = await FileService_1.fileService.readTeam(sourceSlug);
        if (!sourceResult.success || !sourceResult.data) {
            return { success: false, error: `Source team not found: ${sourceSlug}` };
        }
        const source = sourceResult.data;
        // Generate new slug
        const newSlug = (0, slugify_1.slugify)(newName);
        const existing = await FileService_1.fileService.listTeams();
        const existingSlugs = existing.success && existing.data
            ? new Set(existing.data.map(t => t.slug))
            : new Set();
        const uniqueSlug = (0, slugify_1.generateUniqueSlug)(newSlug, existingSlugs);
        // Create clone
        const cloned = {
            ...source,
            id: this.generateTeamId(),
            name: newName,
            slug: uniqueSlug,
            created_at: new Date().toISOString().split('T')[0]
        };
        const validation = ValidationService_1.validationService.validateTeam(cloned);
        if (!validation.valid) {
            return {
                success: false,
                error: `Validation failed: ${validation.errors.join(', ')}`
            };
        }
        const result = await FileService_1.fileService.createTeam(cloned);
        if (!result.success) {
            return { success: false, error: result.error };
        }
        return { success: true, data: cloned };
    }
    async getTeamStats() {
        const result = await FileService_1.fileService.listTeams();
        if (!result.success || !result.data) {
            return { success: false, error: result.error };
        }
        const teams = result.data;
        const stats = {
            total: teams.length,
            byType: {},
            totalMembers: 0,
            avgTeamSize: 0
        };
        for (const team of teams) {
            stats.byType[team.type] = (stats.byType[team.type] || 0) + 1;
            stats.totalMembers += team.members.length;
        }
        stats.avgTeamSize = teams.length > 0
            ? Math.round((stats.totalMembers / teams.length) * 10) / 10
            : 0;
        return { success: true, data: stats };
    }
}
exports.TeamService = TeamService;
// Singleton export
exports.teamService = new TeamService();


/***/ }),
/* 83 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


/**
 * ValidationService - Validates expert, team, and agent definitions
 *
 * Ensures data integrity, required fields, and business rule compliance.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.validationService = exports.ValidationService = void 0;
const FileService_1 = __webpack_require__(3);
class ValidationService {
    VALID_DOMAINS = ['general', 'development'];
    VALID_TIERS = ['trivial', 'standard', 'premium'];
    VALID_PERMISSIONS = ['plan', 'acceptEdits', 'default'];
    VALID_BACKED_BY = ['claude', 'codex', 'gemini', 'zai'];
    // ==========================================================================
    // Expert Validation
    // ==========================================================================
    validateExpert(data) {
        const errors = [];
        const warnings = [];
        // Required fields
        if (!data.role || data.role.trim() === '') {
            errors.push('role is required');
        }
        if (!data.slug || data.slug.trim() === '') {
            errors.push('slug is required');
        }
        else if (!/^[a-z0-9-]+$/.test(data.slug)) {
            errors.push('slug must be lowercase with hyphens only');
        }
        // Enum validations
        if (data.domain && !this.VALID_DOMAINS.includes(data.domain)) {
            errors.push(`invalid domain: ${data.domain}. Must be one of: ${this.VALID_DOMAINS.join(', ')}`);
        }
        if (data.tier && !this.VALID_TIERS.includes(data.tier)) {
            errors.push(`invalid tier: ${data.tier}. Must be one of: ${this.VALID_TIERS.join(', ')}`);
        }
        if (data.permission_mode && !this.VALID_PERMISSIONS.includes(data.permission_mode)) {
            errors.push(`invalid permission_mode: ${data.permission_mode}. Must be one of: ${this.VALID_PERMISSIONS.join(', ')}`);
        }
        if (data.backed_by && !this.VALID_BACKED_BY.includes(data.backed_by)) {
            errors.push(`invalid backed_by: ${data.backed_by}. Must be one of: ${this.VALID_BACKED_BY.join(', ')}`);
        }
        // Warnings
        if (!data.phases || data.phases.length === 0) {
            warnings.push('no phases defined - agent may not be routable');
        }
        if (!data.persona) {
            warnings.push('no persona defined - consider adding role description');
        }
        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }
    async checkExpertExists(slug) {
        const result = await FileService_1.fileService.readExpert(slug);
        return result.success;
    }
    async checkExpertSlugUnique(slug) {
        const experts = await FileService_1.fileService.listExperts();
        if (!experts.success || !experts.data) {
            return true;
        }
        return !experts.data.some(e => e.slug === slug);
    }
    // ==========================================================================
    // Team Validation
    // ==========================================================================
    validateTeam(data) {
        const errors = [];
        const warnings = [];
        // Required fields
        if (!data.name || data.name.trim() === '') {
            errors.push('name is required');
        }
        if (!data.slug || data.slug.trim() === '') {
            errors.push('slug is required');
        }
        if (!data.type) {
            errors.push('type is required (upper or lower)');
        }
        else if (!['upper', 'lower'].includes(data.type)) {
            errors.push(`invalid type: ${data.type}. Must be 'upper' or 'lower'`);
        }
        if (!data.members || data.members.length === 0) {
            errors.push('team must have at least one member');
        }
        else {
            // Validate members
            const memberValidation = this.validateTeamMembers(data.members, data.type);
            errors.push(...memberValidation.errors);
            warnings.push(...memberValidation.warnings);
        }
        // Team size limits
        if (data.members) {
            if (data.type === 'upper' && (data.members.length < 3 || data.members.length > 8)) {
                warnings.push(`upper team size should be 3-8 members (current: ${data.members.length})`);
            }
            if (data.type === 'lower' && (data.members.length < 2 || data.members.length > 6)) {
                warnings.push(`lower team size should be 2-6 members (current: ${data.members.length})`);
            }
        }
        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }
    validateTeamMembers(members, teamType) {
        const errors = [];
        const warnings = [];
        // Check leader exists
        const leaders = members.filter(m => m.is_leader);
        if (leaders.length === 0) {
            errors.push('team must have at least one leader');
        }
        else if (leaders.length > 1) {
            warnings.push('multiple leaders defined - only one recommended');
        }
        // Team type specific rules
        if (teamType === 'upper') {
            const hasOrchestrator = members.some(m => m.role.toLowerCase().includes('orchestrator') ||
                m.expert_slug.includes('orchestrator'));
            if (!hasOrchestrator) {
                errors.push('upper team must have an orchestrator');
            }
            const hasArchitect = members.some(m => m.role.toLowerCase().includes('architect') ||
                m.expert_slug.includes('designer'));
            if (!hasArchitect) {
                errors.push('upper team must have an architect');
            }
        }
        if (teamType === 'lower') {
            const hasTeamLead = members.some(m => m.role.toLowerCase().includes('lead') ||
                m.expert_slug.includes('leader'));
            if (!hasTeamLead) {
                errors.push('lower team must have a team leader');
            }
        }
        // Check for duplicate roles
        const roles = members.map(m => m.role);
        const duplicates = roles.filter((r, i) => roles.indexOf(r) !== i);
        if (duplicates.length > 0) {
            warnings.push(`duplicate roles found: ${[...new Set(duplicates)].join(', ')}`);
        }
        return { valid: errors.length === 0, errors, warnings };
    }
    async checkTeamMemberExists(role) {
        const experts = await FileService_1.fileService.listExperts();
        if (!experts.success || !experts.data) {
            return false;
        }
        return experts.data.some(e => e.slug === role || e.role.toLowerCase() === role.toLowerCase());
    }
    // ==========================================================================
    // Phase Coverage Validation
    // ==========================================================================
    validatePhaseCoverage(members) {
        const errors = [];
        const warnings = [];
        const phases = ['probe', 'grasp', 'tangle', 'ink'];
        const coveredPhases = new Set();
        members.forEach(member => {
            // This is a simplified check - in practice, you'd read expert's phases
            coveredPhases.add('tangle'); // Placeholder
        });
        // For now, just warn if no phase coverage
        if (coveredPhases.size === 0) {
            warnings.push('no phases are covered by team members');
        }
        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }
    // ==========================================================================
    // YAML/JSON Format Validation
    // ==========================================================================
    validateYamlFormat(content) {
        try {
            yaml.parse(content);
            return { valid: true, errors: [], warnings: [] };
        }
        catch (error) {
            return {
                valid: false,
                errors: [`YAML parse error: ${error}`],
                warnings: []
            };
        }
    }
    validateJsonFormat(content) {
        try {
            JSON.parse(content);
            return { valid: true, errors: [], warnings: [] };
        }
        catch (error) {
            return {
                valid: false,
                errors: [`JSON parse error: ${error}`],
                warnings: []
            };
        }
    }
}
exports.ValidationService = ValidationService;
// Note: yaml import needed for validation
const yaml = __importStar(__webpack_require__(6));
// Singleton export
exports.validationService = new ValidationService();


/***/ }),
/* 84 */
/***/ ((__unused_webpack_module, exports) => {


/**
 * slugify - Convert text to URL-friendly slug
 *
 * Converts role names, titles, or any text to lowercase,
 * hyphen-separated slugs suitable for filenames and URLs.
 */
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.slugify = slugify;
exports.generateUniqueSlug = generateUniqueSlug;
exports.isValidSlug = isValidSlug;
exports.sanitizeFilename = sanitizeFilename;
/**
 * Convert text to slug format
 * - Convert to lowercase
 * - Replace spaces and special characters with hyphens
 * - Remove consecutive hyphens
 * - Trim leading/trailing hyphens
 *
 * @param text - Input text to convert
 * @param maxLength - Maximum length (default: 50)
 * @returns URL-friendly slug
 */
function slugify(text, maxLength = 50) {
    if (!text || text.trim() === '') {
        return '';
    }
    return text
        .toLowerCase()
        // Replace Korean characters are kept as-is
        .normalize('NFC')
        // Replace spaces and special chars with hyphens
        .replace(/[\s\u2000-\u200B\u3000_]+/g, '-')
        // Remove characters that aren't alphanumeric, Korean, or hyphen
        .replace(/[^\p{L}\p{N}-]+/gu, '')
        // Replace multiple consecutive hyphens
        .replace(/-+/g, '-')
        // Trim hyphens from start/end
        .replace(/^-+|-+$/g, '')
        // Limit length
        .slice(0, maxLength);
}
/**
 * Generate a unique slug by appending a numeric suffix if needed
 *
 * @param baseSlug - Base slug to use
 * @param existingSlugs - Set of already used slugs
 * @returns Unique slug
 */
function generateUniqueSlug(baseSlug, existingSlugs) {
    let slug = baseSlug;
    let counter = 1;
    while (existingSlugs.has(slug)) {
        slug = `${baseSlug}-${counter}`;
        counter++;
    }
    return slug;
}
/**
 * Validate slug format
 *
 * @param slug - Slug to validate
 * @returns True if valid
 */
function isValidSlug(slug) {
    return /^[a-z0-9-]+$/.test(slug) && slug.length > 0 && slug.length <= 50;
}
/**
 * Sanitize filename (more permissive than slugify)
 *
 * @param filename - Original filename
 * @returns Safe filename
 */
function sanitizeFilename(filename) {
    return filename
        .replace(/[<>:"/\\|?*]/g, '') // Remove invalid characters
        .replace(/^\.+/, '') // Remove leading dots
        .slice(0, 255); // Limit length
}


/***/ }),
/* 85 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


/**
 * ExpertService - High-level Expert management operations
 *
 * Wraps FileService with additional functionality:
 * - Auto-generate slugs from role names
 * - Template loading for new experts
 * - Bulk operations
 * - Expert search and filtering
 */
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.expertService = exports.ExpertService = void 0;
const FileService_1 = __webpack_require__(3);
const ValidationService_1 = __webpack_require__(83);
const slugify_1 = __webpack_require__(84);
class ExpertService {
    templates = new Map();
    constructor() {
        this.initializeTemplates();
    }
    // ==========================================================================
    // Templates
    // ==========================================================================
    initializeTemplates() {
        this.templates.set('backend-developer', {
            name: 'Backend Developer',
            description: 'Server-side API and database development',
            template: {
                role: 'Backend Developer',
                domain: 'development',
                backed_by: 'claude',
                tier: 'premium',
                permission_mode: 'default',
                phases: ['grasp', 'tangle'],
                agent_profile: 'backend-developer',
                capabilities: [
                    'API design (REST, GraphQL, gRPC)',
                    'Database modeling and queries',
                    'Server-side architecture',
                    'Authentication and authorization',
                    'API documentation'
                ],
                constraints: [
                    'Focus on backend concerns only',
                    'Coordinate with frontend for API contracts',
                    'Write tests for API endpoints'
                ],
                persona: 'Expert in backend development with deep knowledge of server architectures, databases, and API design.'
            }
        });
        this.templates.set('frontend-developer', {
            name: 'Frontend Developer',
            description: 'Client-side UI and user experience',
            template: {
                role: 'Frontend Developer',
                domain: 'development',
                backed_by: 'claude',
                tier: 'premium',
                permission_mode: 'default',
                phases: ['tangle', 'ink'],
                agent_profile: 'frontend-developer',
                capabilities: [
                    'React/Vue/Angular component development',
                    'State management (Redux, Vuex, NgRx)',
                    'Responsive design and accessibility',
                    'Performance optimization',
                    'Testing frameworks (Jest, Cypress)'
                ],
                constraints: [
                    'Focus on UI/UX implementation',
                    'Coordinate with backend for API integration',
                    'Ensure WCAG accessibility compliance'
                ],
                persona: 'Expert in modern frontend development with focus on user experience and performance.'
            }
        });
        this.templates.set('security-auditor', {
            name: 'Security Auditor',
            description: 'Security review and vulnerability assessment',
            template: {
                role: 'Security Auditor',
                domain: 'development',
                backed_by: 'claude',
                tier: 'premium',
                permission_mode: 'acceptEdits',
                phases: ['grasp', 'tangle'],
                agent_profile: 'security-auditor',
                capabilities: [
                    'OWASP compliance checks',
                    'Vulnerability scanning',
                    'Security architecture review',
                    'Penetration testing guidance',
                    'Security best practices enforcement'
                ],
                constraints: [
                    'Read-only access for production code',
                    'Provide security recommendations only',
                    'Never bypass security controls'
                ],
                persona: 'Security specialist focused on identifying vulnerabilities and ensuring OWASP compliance.'
            }
        });
        this.templates.set('test-automation', {
            name: 'Test Automation Engineer',
            description: 'Test strategy and automated testing',
            template: {
                role: 'Test Automation Engineer',
                domain: 'development',
                backed_by: 'claude',
                tier: 'standard',
                permission_mode: 'default',
                phases: ['tangle', 'ink'],
                agent_profile: 'test-automation',
                capabilities: [
                    'Unit testing strategy',
                    'Integration testing',
                    'E2E test automation',
                    'Test coverage analysis',
                    'CI/CD test pipeline integration'
                ],
                constraints: [
                    'Maintain test independence',
                    'Ensure tests are deterministic',
                    'Document test scenarios clearly'
                ],
                persona: 'Testing expert focused on comprehensive test coverage and quality assurance.'
            }
        });
        this.templates.set('devops-engineer', {
            name: 'DevOps Engineer',
            description: 'CI/CD, infrastructure, and deployment',
            template: {
                role: 'DevOps Engineer',
                domain: 'development',
                backed_by: 'claude',
                tier: 'premium',
                permission_mode: 'default',
                phases: ['ink'],
                agent_profile: 'devops-engineer',
                capabilities: [
                    'CI/CD pipeline design',
                    'Docker and Kubernetes',
                    'Infrastructure as Code (Terraform, CloudFormation)',
                    'Monitoring and logging setup',
                    'Deployment automation'
                ],
                constraints: [
                    'Follow infrastructure best practices',
                    'Ensure zero-downtime deployments',
                    'Document all infrastructure changes'
                ],
                persona: 'DevOps specialist focused on automation, reliability, and deployment excellence.'
            }
        });
        this.templates.set('code-reviewer', {
            name: 'Code Reviewer',
            description: 'Code quality review and analysis',
            template: {
                role: 'Code Reviewer',
                domain: 'development',
                backed_by: 'codex',
                tier: 'standard',
                permission_mode: 'plan',
                phases: ['ink'],
                agent_profile: 'code-reviewer',
                capabilities: [
                    'Code quality analysis',
                    'Best practices enforcement',
                    'Bug detection',
                    'Performance review',
                    'Security review'
                ],
                constraints: [
                    'Read-only access',
                    'Provide constructive feedback',
                    'Suggest improvements without direct changes'
                ],
                persona: 'Code quality expert focused on maintainability, performance, and best practices.'
            }
        });
        this.templates.set('general-assistant', {
            name: 'General Assistant',
            description: 'General-purpose AI assistant',
            template: {
                role: 'General Assistant',
                domain: 'general',
                backed_by: 'claude',
                tier: 'standard',
                permission_mode: 'default',
                phases: [],
                capabilities: [
                    'General task assistance',
                    'Research and analysis',
                    'Documentation',
                    'Problem solving'
                ],
                constraints: [],
                persona: 'Helpful assistant capable of handling a wide range of tasks.'
            }
        });
    }
    getTemplates() {
        return Array.from(this.templates.values());
    }
    getTemplate(key) {
        return this.templates.get(key);
    }
    // ==========================================================================
    // CRUD Operations
    // ==========================================================================
    async createExpert(role, options = {}) {
        // Generate slug from role if not provided
        let slug = options.slug || (0, slugify_1.slugify)(role);
        // Check uniqueness and generate unique slug
        const existing = await FileService_1.fileService.listExperts();
        const existingSlugs = existing.success && existing.data
            ? new Set(existing.data.map(e => e.slug))
            : new Set();
        slug = (0, slugify_1.generateUniqueSlug)(slug, existingSlugs);
        // Build expert object
        const expert = {
            role,
            slug,
            domain: options.domain || 'general',
            backed_by: options.backed_by || 'claude',
            cli: options.cli,
            model: options.model,
            fallback_cli: options.fallback_cli || null,
            tier: options.tier || 'standard',
            permission_mode: options.permission_mode || 'default',
            memory: options.memory,
            isolation: options.isolation || null,
            phases: options.phases || [],
            agent_profile: options.agent_profile,
            default_platform: options.default_platform,
            persona: options.persona || '',
            capabilities: options.capabilities || [],
            constraints: options.constraints || [],
            created_at: options.created_at || new Date().toISOString().split('T')[0]
        };
        // Validate
        const validation = ValidationService_1.validationService.validateExpert(expert);
        if (!validation.valid) {
            return {
                success: false,
                error: `Validation failed: ${validation.errors.join(', ')}`
            };
        }
        // Create
        const result = await FileService_1.fileService.createExpert(expert);
        if (!result.success) {
            return { success: false, error: result.error };
        }
        return { success: true, data: expert };
    }
    async createExpertFromTemplate(templateKey, customRole) {
        const template = this.templates.get(templateKey);
        if (!template) {
            return { success: false, error: `Template not found: ${templateKey}` };
        }
        const role = customRole || template.template.role || template.name;
        return this.createExpert(role, { ...template.template, role });
    }
    async updateExpert(slug, updates) {
        // Read existing
        const existing = await FileService_1.fileService.readExpert(slug);
        if (!existing.success || !existing.data) {
            return { success: false, error: `Expert not found: ${slug}` };
        }
        // Merge updates
        const updated = {
            ...existing.data,
            ...updates,
            slug // Preserve original slug
        };
        // Validate
        const validation = ValidationService_1.validationService.validateExpert(updated);
        if (!validation.valid) {
            return {
                success: false,
                error: `Validation failed: ${validation.errors.join(', ')}`
            };
        }
        // Update
        const result = await FileService_1.fileService.updateExpert(slug, updated);
        if (!result.success) {
            return { success: false, error: result.error };
        }
        return { success: true, data: updated };
    }
    async deleteExpert(slug) {
        // Check if used in teams
        const teams = await FileService_1.fileService.listTeams();
        if (teams.success && teams.data) {
            const inUse = teams.data.some(team => team.members.some(m => m.expert_slug === slug));
            if (inUse) {
                return {
                    success: false,
                    error: `Cannot delete: Expert is used in one or more teams`
                };
            }
        }
        return FileService_1.fileService.deleteExpert(slug);
    }
    // ==========================================================================
    // Query Operations
    // ==========================================================================
    async listExperts() {
        return FileService_1.fileService.listExperts();
    }
    async getExpert(slug) {
        return FileService_1.fileService.readExpert(slug);
    }
    async findExperts(filter) {
        const result = await FileService_1.fileService.listExperts();
        if (!result.success || !result.data) {
            return result;
        }
        let filtered = result.data;
        if (filter.domain) {
            filtered = filtered.filter(e => e.domain === filter.domain);
        }
        if (filter.backed_by) {
            filtered = filtered.filter(e => e.backed_by === filter.backed_by);
        }
        if (filter.tier) {
            filtered = filtered.filter(e => e.tier === filter.tier);
        }
        if (filter.phase) {
            filtered = filtered.filter(e => e.phases && e.phases.includes(filter.phase));
        }
        if (filter.search) {
            const searchLower = filter.search.toLowerCase();
            filtered = filtered.filter(e => e.role.toLowerCase().includes(searchLower) ||
                e.persona?.toLowerCase().includes(searchLower) ||
                e.capabilities?.some(c => c.toLowerCase().includes(searchLower)));
        }
        return { success: true, data: filtered };
    }
    async searchExperts(query) {
        return this.findExperts({ search: query });
    }
    // ==========================================================================
    // Utility Operations
    // ==========================================================================
    async cloneExpert(sourceSlug, newRole) {
        const source = await FileService_1.fileService.readExpert(sourceSlug);
        if (!source.success || !source.data) {
            return { success: false, error: `Source expert not found: ${sourceSlug}` };
        }
        // Create copy with new role
        const cloneData = {
            ...source.data,
            role: newRole,
            created_at: new Date().toISOString().split('T')[0]
        };
        delete cloneData.slug; // Let createExpert generate new slug
        return this.createExpert(newRole, cloneData);
    }
    async exportExperts() {
        const result = await FileService_1.fileService.listExperts();
        if (!result.success || !result.data) {
            return { success: false, error: result.error };
        }
        const exportData = {
            version: 1,
            exported_at: new Date().toISOString(),
            experts: result.data
        };
        return { success: true, data: JSON.stringify(exportData, null, 2) };
    }
    async importExperts(jsonData, overwrite = false) {
        try {
            const importData = JSON.parse(jsonData);
            if (!importData.experts || !Array.isArray(importData.experts)) {
                return { success: false, error: 'Invalid import data format' };
            }
            let created = 0;
            let updated = 0;
            let skipped = 0;
            for (const expert of importData.experts) {
                const existing = await FileService_1.fileService.readExpert(expert.slug);
                if (existing.success) {
                    if (overwrite) {
                        await FileService_1.fileService.updateExpert(expert.slug, expert);
                        updated++;
                    }
                    else {
                        skipped++;
                    }
                }
                else {
                    await FileService_1.fileService.createExpert(expert);
                    created++;
                }
            }
            return {
                success: true,
                data: { created, updated, skipped }
            };
        }
        catch (error) {
            return { success: false, error: String(error) };
        }
    }
    // ==========================================================================
    // Statistics
    // ==========================================================================
    async getExpertStats() {
        const result = await FileService_1.fileService.listExperts();
        if (!result.success || !result.data) {
            return { success: false, error: result.error };
        }
        const experts = result.data;
        const stats = {
            total: experts.length,
            byDomain: {},
            byBackedBy: {},
            byTier: {}
        };
        for (const expert of experts) {
            stats.byDomain[expert.domain] = (stats.byDomain[expert.domain] || 0) + 1;
            stats.byBackedBy[expert.backed_by] = (stats.byBackedBy[expert.backed_by] || 0) + 1;
            stats.byTier[expert.tier] = (stats.byTier[expert.tier] || 0) + 1;
        }
        return { success: true, data: stats };
    }
}
exports.ExpertService = ExpertService;
// Singleton export
exports.expertService = new ExpertService();


/***/ }),
/* 86 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


/**
 * Webview utilities for VS Code extension panels
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.getNonce = getNonce;
exports.escapeHtml = escapeHtml;
exports.getWebviewOptions = getWebviewOptions;
/**
 * Generate a nonce for CSP
 */
function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}
/**
 * Generate webview URI with proper CSP
 */
function getWebviewOptions(extensionUri) {
    return {
        enableScripts: true,
        localResourceRoots: [
            vscode.Uri.joinPath(extensionUri, 'media'),
            vscode.Uri.joinPath(extensionUri, 'dist')
        ]
    };
}
const vscode = __importStar(__webpack_require__(1));


/***/ }),
/* 87 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


/**
 * ExpertManager Webview - Expert creation and editing interface
 *
 * Provides a rich UI for creating, editing, and managing expert definitions.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.openExpertManager = openExpertManager;
const vscode = __importStar(__webpack_require__(1));
const ExpertManagerService_1 = __webpack_require__(88);
const webview_1 = __webpack_require__(86);
let currentPanel;
function openExpertManager(extensionUri, expertSlug) {
    if (currentPanel) {
        currentPanel.reveal();
        return;
    }
    currentPanel = vscode.window.createWebviewPanel('expertManager', expertSlug ? 'Edit Expert' : 'Create Expert', vscode.ViewColumn.Beside, {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [extensionUri]
    });
    currentPanel.webview.html = getHtml(currentPanel.webview, extensionUri);
    currentPanel.onDidDispose(() => {
        currentPanel = undefined;
    });
    // Handle messages from webview
    currentPanel.webview.onDidReceiveMessage(async (message) => {
        const panel = currentPanel;
        if (!panel) {
            return;
        }
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
    }, undefined);
}
// ==========================================================================
// Message Handlers
// ==========================================================================
async function handleInit(panel, expertSlug) {
    if (expertSlug) {
        // Load existing expert
        const { fileService } = await Promise.resolve().then(() => __importStar(__webpack_require__(3)));
        const result = await fileService.readExpert(expertSlug);
        if (result.success && result.data) {
            panel.webview.postMessage({
                command: 'loadExpert',
                data: result.data
            });
        }
        else {
            panel.webview.postMessage({
                command: 'error',
                message: `Expert not found: ${expertSlug}`
            });
        }
    }
    else {
        // New expert - send templates
        panel.webview.postMessage({
            command: 'loadTemplates',
            templates: ExpertManagerService_1.expertManagerService.getTemplates(),
            categories: ExpertManagerService_1.expertManagerService.getCategories(),
            formData: ExpertManagerService_1.expertManagerService.getFormData()
        });
    }
}
async function handleSave(panel, data) {
    const isEdit = !!data._originalSlug;
    // Prepare expert object
    const expert = {
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
        result = await ExpertManagerService_1.expertManagerService.updateExpert(data._originalSlug, expert);
    }
    else {
        result = await ExpertManagerService_1.expertManagerService.createExpert(expert);
    }
    if (result.success) {
        panel.webview.postMessage({
            command: 'saved',
            data: result.data
        });
        vscode.window.showInformationMessage(`Expert ${isEdit ? 'updated' : 'created'} successfully!`);
        // Refresh tree
        vscode.commands.executeCommand('agentManager.refreshTree');
    }
    else {
        panel.webview.postMessage({
            command: 'error',
            message: result.error || 'Failed to save expert'
        });
    }
}
async function handleDelete(panel, slug) {
    const confirmed = await vscode.window.showWarningMessage(`Delete expert "${slug}"? This action cannot be undone.`, { modal: true }, 'Delete', 'Cancel');
    if (confirmed === 'Delete') {
        const result = await ExpertManagerService_1.expertManagerService.deleteExpert(slug);
        if (result.success) {
            vscode.window.showInformationMessage(`Expert "${slug}" deleted.`);
            panel.dispose();
            vscode.commands.executeCommand('agentManager.refreshTree');
        }
        else {
            vscode.window.showErrorMessage(result.error || 'Failed to delete expert');
        }
    }
}
async function handleDuplicate(panel, slug) {
    const newSlug = await vscode.window.showInputBox({
        prompt: 'Enter slug for the duplicate',
        value: `${slug}-copy`,
        validateInput: (value) => {
            const validation = ExpertManagerService_1.expertManagerService.validateSlug(value);
            return validation.valid ? null : validation.error;
        }
    });
    if (!newSlug) {
        return;
    }
    const result = await ExpertManagerService_1.expertManagerService.duplicateExpert(slug, newSlug);
    if (result.success) {
        vscode.window.showInformationMessage(`Expert duplicated as "${newSlug}"`);
        vscode.commands.executeCommand('agentManager.refreshTree');
        // Open the new expert
        vscode.commands.executeCommand('agentManager.editAgent', newSlug);
    }
    else {
        vscode.window.showErrorMessage(result.error || 'Failed to duplicate expert');
    }
}
async function handleLoadTemplate(panel, templateId) {
    const template = ExpertManagerService_1.expertManagerService.getTemplate(templateId);
    if (template) {
        panel.webview.postMessage({
            command: 'loadTemplate',
            template
        });
    }
}
function handleGenerateSlug(panel, role) {
    const slug = ExpertManagerService_1.expertManagerService.generateSlug(role);
    panel.webview.postMessage({
        command: 'slugGenerated',
        slug
    });
}
async function handleValidateSlug(panel, slug, originalSlug) {
    // Basic format validation
    const formatValidation = ExpertManagerService_1.expertManagerService.validateSlug(slug);
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
        const { validationService } = await Promise.resolve().then(() => __importStar(__webpack_require__(83)));
        const isUnique = await validationService.checkExpertSlugUnique(slug);
        panel.webview.postMessage({
            command: 'slugValidation',
            valid: isUnique,
            error: isUnique ? undefined : 'Slug already exists'
        });
    }
    else {
        panel.webview.postMessage({
            command: 'slugValidation',
            valid: true
        });
    }
}
// ==========================================================================
// HTML Generation
// ==========================================================================
function getHtml(_webview, _extensionUri) {
    const nonce = (0, webview_1.getNonce)();
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


/***/ }),
/* 88 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


/**
 * ExpertManagerService - Expert CRUD operations with templates
 *
 * Manages expert creation, editing, and template management.
 */
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.expertManagerService = exports.ExpertManagerService = void 0;
const FileService_1 = __webpack_require__(3);
const ValidationService_1 = __webpack_require__(83);
class ExpertManagerService {
    // ==========================================================================
    // Templates
    // ==========================================================================
    templates = [
        {
            id: 'frontend-developer',
            name: 'Frontend Developer',
            description: 'React, Vue, Web development expert',
            category: 'development',
            defaults: {
                role: 'Frontend Developer',
                domain: 'development',
                backed_by: 'claude',
                tier: 'premium',
                permission_mode: 'default',
                phases: ['tangle', 'ink'],
                capabilities: [
                    'React 19+ component architecture',
                    'Next.js 15 App Router',
                    'TypeScript 5+ type safety',
                    'Tailwind CSS styling',
                    'Performance optimization',
                    'Accessibility (WCAG 2.1)',
                    'Responsive design patterns'
                ],
                constraints: [
                    'Always use TypeScript for type safety',
                    'Follow React best practices',
                    'Ensure accessibility compliance',
                    'Optimize for Core Web Vitals'
                ],
                persona: 'Expert frontend developer specializing in modern React applications, Next.js, and cutting-edge frontend architecture.'
            }
        },
        {
            id: 'backend-developer',
            name: 'Backend Developer',
            description: 'API, Database, Server-side development expert',
            category: 'development',
            defaults: {
                role: 'Backend Developer',
                domain: 'development',
                backed_by: 'claude',
                tier: 'premium',
                permission_mode: 'default',
                phases: ['grasp', 'tangle'],
                capabilities: [
                    'RESTful API design',
                    'GraphQL implementation',
                    'Database modeling',
                    'Authentication & Authorization',
                    'Performance optimization',
                    'Security best practices',
                    'Microservices architecture'
                ],
                constraints: [
                    'Always validate input data',
                    'Use prepared statements for database queries',
                    'Implement proper error handling',
                    'Follow OWASP security guidelines'
                ],
                persona: 'Expert backend developer specializing in API design, database architecture, and server-side development.'
            }
        },
        {
            id: 'fullstack-developer',
            name: 'Fullstack Developer',
            description: 'End-to-end web development expert',
            category: 'development',
            defaults: {
                role: 'Fullstack Developer',
                domain: 'development',
                backed_by: 'claude',
                tier: 'premium',
                permission_mode: 'default',
                phases: ['grasp', 'tangle', 'ink'],
                capabilities: [
                    'Full-stack web development',
                    'Frontend frameworks (React, Vue, Next.js)',
                    'Backend frameworks (Express, Fastify, NestJS)',
                    'Database design and optimization',
                    'API design and integration',
                    'DevOps and deployment',
                    'Testing and quality assurance'
                ],
                constraints: [
                    'Maintain consistency across frontend and backend',
                    'Follow testing best practices',
                    'Implement proper error boundaries',
                    'Use TypeScript end-to-end'
                ],
                persona: 'Expert fullstack developer capable of handling end-to-end web application development.'
            }
        },
        {
            id: 'devops-engineer',
            name: 'DevOps Engineer',
            description: 'CI/CD, Infrastructure, Deployment expert',
            category: 'development',
            defaults: {
                role: 'DevOps Engineer',
                domain: 'development',
                backed_by: 'claude',
                tier: 'premium',
                permission_mode: 'acceptEdits',
                phases: ['tangle', 'ink'],
                capabilities: [
                    'CI/CD pipeline design',
                    'Docker containerization',
                    'Kubernetes orchestration',
                    'Infrastructure as Code (Terraform)',
                    'Cloud platforms (AWS, GCP, Azure)',
                    'Monitoring and observability',
                    'Security and compliance'
                ],
                constraints: [
                    'Always use Infrastructure as Code',
                    'Implement proper security measures',
                    'Follow the principle of least privilege',
                    'Document all infrastructure changes'
                ],
                persona: 'Expert DevOps engineer specializing in cloud infrastructure, CI/CD pipelines, and automation.'
            }
        },
        {
            id: 'security-auditor',
            name: 'Security Auditor',
            description: 'Security review, OWASP compliance expert',
            category: 'development',
            defaults: {
                role: 'Security Auditor',
                domain: 'development',
                backed_by: 'claude',
                tier: 'premium',
                permission_mode: 'plan',
                phases: ['grasp', 'tangle'],
                capabilities: [
                    'OWASP Top 10 vulnerability assessment',
                    'Security code review',
                    'Penetration testing',
                    'Compliance auditing (GDPR, SOC 2, HIPAA)',
                    'Threat modeling',
                    'Security architecture review',
                    'Secure coding practices'
                ],
                constraints: [
                    'Follow OWASP security guidelines',
                    'Report all security findings',
                    'Maintain confidentiality',
                    'Follow responsible disclosure'
                ],
                persona: 'Expert security auditor specializing in application security, vulnerability assessment, and compliance.'
            }
        },
        {
            id: 'ux-designer',
            name: 'UX Designer',
            description: 'User experience, interface design expert',
            category: 'development',
            defaults: {
                role: 'UX Designer',
                domain: 'development',
                backed_by: 'claude',
                tier: 'standard',
                permission_mode: 'default',
                phases: ['probe', 'ink'],
                capabilities: [
                    'User research and analysis',
                    'Wireframing and prototyping',
                    'Visual design',
                    'Design system creation',
                    'Usability testing',
                    'Accessibility design',
                    'Interaction design'
                ],
                constraints: [
                    'Follow WCAG accessibility guidelines',
                    'Design for mobile-first',
                    'Maintain design consistency',
                    'Consider user feedback'
                ],
                persona: 'Expert UX designer specializing in user-centered design, interface design, and design systems.'
            }
        },
        {
            id: 'product-manager',
            name: 'Product Manager',
            description: 'Product strategy, requirements, planning expert',
            category: 'general',
            defaults: {
                role: 'Product Manager',
                domain: 'general',
                backed_by: 'claude',
                tier: 'standard',
                permission_mode: 'plan',
                phases: ['probe'],
                capabilities: [
                    'Product strategy and roadmap',
                    'Requirements gathering',
                    'User story creation',
                    'Prioritization',
                    'Stakeholder management',
                    'Market analysis',
                    'Agile planning'
                ],
                constraints: [
                    'Focus on user value',
                    'Data-driven decision making',
                    'Clear communication',
                    'Iterative improvement'
                ],
                persona: 'Expert product manager specializing in product strategy, requirements definition, and agile planning.'
            }
        },
        {
            id: 'technical-writer',
            name: 'Technical Writer',
            description: 'Documentation, technical communication expert',
            category: 'general',
            defaults: {
                role: 'Technical Writer',
                domain: 'general',
                backed_by: 'claude',
                tier: 'standard',
                permission_mode: 'default',
                phases: ['ink'],
                capabilities: [
                    'Technical documentation',
                    'API documentation',
                    'User guides',
                    'README files',
                    'Knowledge base articles',
                    'Video tutorials',
                    'Documentation architecture'
                ],
                constraints: [
                    'Write clearly and concisely',
                    'Target the right audience',
                    'Keep documentation up to date',
                    'Use examples and diagrams'
                ],
                persona: 'Expert technical writer specializing in developer documentation, API docs, and knowledge management.'
            }
        },
        {
            id: 'custom',
            name: 'Custom Expert',
            description: 'Create your own expert from scratch',
            category: 'custom',
            defaults: {
                role: '',
                domain: 'general',
                backed_by: 'claude',
                tier: 'standard',
                permission_mode: 'default',
                phases: [],
                capabilities: [],
                constraints: [],
                persona: ''
            }
        }
    ];
    // ==========================================================================
    // Template Operations
    // ==========================================================================
    getTemplates() {
        return this.templates;
    }
    getTemplate(id) {
        return this.templates.find(t => t.id === id);
    }
    getTemplatesByCategory(category) {
        return this.templates.filter(t => t.category === category);
    }
    getCategories() {
        const categories = new Set(this.templates.map(t => t.category));
        return Array.from(categories).sort();
    }
    // ==========================================================================
    // Expert CRUD Operations
    // ==========================================================================
    async createExpert(expert) {
        // Validate
        const validation = ValidationService_1.validationService.validateExpert(expert);
        if (!validation.valid) {
            return {
                success: false,
                error: `Validation failed: ${validation.errors.join(', ')}`
            };
        }
        // Check uniqueness
        const exists = await ValidationService_1.validationService.checkExpertExists(expert.slug);
        if (exists) {
            return {
                success: false,
                error: `Expert with slug "${expert.slug}" already exists`
            };
        }
        // Create
        const result = await FileService_1.fileService.createExpert(expert);
        if (result.success) {
            return { success: true, data: expert };
        }
        return { success: false, error: result.error };
    }
    async updateExpert(slug, expert) {
        // Validate
        const validation = ValidationService_1.validationService.validateExpert(expert);
        if (!validation.valid) {
            return {
                success: false,
                error: `Validation failed: ${validation.errors.join(', ')}`
            };
        }
        // Check if slug changed and new slug exists
        if (slug !== expert.slug) {
            const exists = await ValidationService_1.validationService.checkExpertExists(expert.slug);
            if (exists) {
                return {
                    success: false,
                    error: `Expert with slug "${expert.slug}" already exists`
                };
            }
            // Delete old file if slug changed
            await FileService_1.fileService.deleteExpert(slug);
        }
        // Update
        const result = await FileService_1.fileService.updateExpert(expert.slug, expert);
        if (result.success) {
            return { success: true, data: expert };
        }
        return { success: false, error: result.error };
    }
    async deleteExpert(slug) {
        // Check if expert is used in any team
        const teams = await FileService_1.fileService.listTeams();
        if (teams.success && teams.data) {
            const inUse = teams.data.some(team => team.members.some(member => member.expert_slug === slug));
            if (inUse) {
                return {
                    success: false,
                    error: `Expert "${slug}" is used in one or more teams. Remove from teams first.`
                };
            }
        }
        const result = await FileService_1.fileService.deleteExpert(slug);
        return result;
    }
    async duplicateExpert(slug, newSlug) {
        const result = await FileService_1.fileService.readExpert(slug);
        if (!result.success || !result.data) {
            return { success: false, error: `Expert not found: ${slug}` };
        }
        const newExpert = {
            ...result.data,
            slug: newSlug,
            role: `${result.data.role} (Copy)`,
            created_at: new Date().toISOString().split('T')[0]
        };
        return this.createExpert(newExpert);
    }
    // ==========================================================================
    // Expert Form Data
    // ==========================================================================
    getFormData() {
        return {
            domains: [
                { value: 'general', label: 'General' },
                { value: 'development', label: 'Development' }
            ],
            tiers: [
                { value: 'trivial', label: 'Trivial', description: 'Simple tasks, low cost' },
                { value: 'standard', label: 'Standard', description: 'Regular tasks, balanced cost' },
                { value: 'premium', label: 'Premium', description: 'Complex tasks, high quality' }
            ],
            backedBy: [
                { value: 'claude', label: 'Claude', description: 'Anthropic Claude' },
                { value: 'codex', label: 'Codex', description: 'OpenAI Codex' },
                { value: 'gemini', label: 'Gemini', description: 'Google Gemini' },
                { value: 'zai', label: 'ZAI', description: 'ZAI Models' }
            ],
            permissionModes: [
                { value: 'plan', label: 'Plan', description: 'Planning and analysis only' },
                { value: 'acceptEdits', label: 'Accept Edits', description: 'Review and approve changes' },
                { value: 'default', label: 'Default', description: 'Full autonomy' }
            ],
            phases: [
                { value: 'probe', label: 'Probe', description: 'Research and discovery' },
                { value: 'grasp', label: 'Grasp', description: 'Understanding and analysis' },
                { value: 'tangle', label: 'Tangle', description: 'Implementation' },
                { value: 'ink', label: 'Ink', description: 'Documentation and delivery' }
            ]
        };
    }
    // ==========================================================================
    // Slug Generation
    // ==========================================================================
    generateSlug(role) {
        return role
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .trim()
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .substring(0, 50);
    }
    // ==========================================================================
    // Validation
    // ==========================================================================
    validateSlug(slug) {
        if (!slug || slug.trim() === '') {
            return { valid: false, error: 'Slug is required' };
        }
        if (!/^[a-z0-9-]+$/.test(slug)) {
            return { valid: false, error: 'Slug must contain only lowercase letters, numbers, and hyphens' };
        }
        if (slug.startsWith('-') || slug.endsWith('-')) {
            return { valid: false, error: 'Slug cannot start or end with a hyphen' };
        }
        if (slug.length > 50) {
            return { valid: false, error: 'Slug must be 50 characters or less' };
        }
        return { valid: true };
    }
}
exports.ExpertManagerService = ExpertManagerService;
// Singleton export
exports.expertManagerService = new ExpertManagerService();


/***/ })
/******/ 	]);
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module is referenced by other modules so it can't be inlined
/******/ 	var __webpack_exports__ = __webpack_require__(0);
/******/ 	module.exports = __webpack_exports__;
/******/ 	
/******/ })()
;
//# sourceMappingURL=extension.js.map