/**
 * Agent Manager - VS Code Extension Entry Point
 *
 * Provides GUI for relay-plugin agent configuration and team management.
 */

import * as vscode from 'vscode';
import { AgentTreeProvider, registerTreeCommands } from './providers/AgentTreeProvider';
import { FileService, fileService } from './services/FileService';
import { visualizationService } from './services/VisualizationService';
import { TeamBuilderPanel } from './webviews/TeamBuilderPanel';
import { openExpertManager } from './webviews/ExpertManager';
import { getNonce } from './utils/webview';

let treeProvider: AgentTreeProvider;
let currentDashboardPanel: vscode.WebviewPanel | undefined;

export function activate(context: vscode.ExtensionContext) {
  console.log('Agent Manager extension is activating...');

  // Initialize services
  const fileServiceInstance = new FileService();

  // Register tree data provider
  treeProvider = new AgentTreeProvider(fileServiceInstance, context);
  vscode.window.registerTreeDataProvider('agentManager.treeView', treeProvider);

  // Register tree view commands
  registerTreeCommands(context, fileServiceInstance);

  // Register commands
  const commands = [
    vscode.commands.registerCommand('agentManager.openDashboard', () => openDashboard(fileServiceInstance)),
    vscode.commands.registerCommand('agentManager.createExpert', () => createExpert(fileServiceInstance)),
    vscode.commands.registerCommand('agentManager.buildTeam', () => buildTeam(fileServiceInstance)),
    vscode.commands.registerCommand('agentManager.editAgent', () => editAgent(fileServiceInstance)),
    vscode.commands.registerCommand('agentManager.openSettings', () => openSettings(fileServiceInstance)),
    vscode.commands.registerCommand('agentManager.refreshTree', () => treeProvider.refresh()),
    vscode.commands.registerCommand('agentManager.viewTeamDiagram', (teamSlug: string) => viewTeamDiagram(fileServiceInstance, teamSlug)),
    vscode.commands.registerCommand('agentManager.viewExpertDiagram', (expertSlug: string) => viewExpertDiagram(fileServiceInstance, expertSlug)),
    vscode.commands.registerCommand('agentManager.openExpertManager', (expertSlug?: string) => {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (workspaceFolders && workspaceFolders.length > 0) {
        openExpertManager(workspaceFolders[0].uri, expertSlug);
      }
    }),
  ];

  commands.forEach(cmd => context.subscriptions.push(cmd));

  // Check for relay setup
  checkRelaySetup(fileServiceInstance);

  console.log('Agent Manager extension activated successfully!');
}

export function deactivate() {
  console.log('Agent Manager extension deactivated');
}

// ==========================================================================
// Command Handlers
// ==========================================================================

async function openDashboard(fileService: FileService) {
  if (currentDashboardPanel) {
    currentDashboardPanel.reveal();
    return;
  }

  currentDashboardPanel = vscode.window.createWebviewPanel(
    'agentManagerDashboard',
    'Agent Manager Dashboard',
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [
        vscode.Uri.joinPath(vscode.Uri.file(fileService.getRelayRoot()), 'experts'),
        vscode.Uri.joinPath(vscode.Uri.file(fileService.getRelayRoot()), 'teams')
      ]
    }
  );

  currentDashboardPanel.onDidDispose(() => {
    currentDashboardPanel = undefined;
  });

  // Handle messages from webview
  currentDashboardPanel.webview.onDidReceiveMessage(
    async (message) => {
      switch (message.command) {
        case 'requestData':
          await handleDataRequest(currentDashboardPanel!, fileService);
          break;
        case 'createExpert':
          vscode.commands.executeCommand('agentManager.createExpert');
          break;
        case 'buildTeam':
          vscode.commands.executeCommand('agentManager.buildTeam');
          break;
        case 'refresh':
          await handleDataRequest(currentDashboardPanel!, fileService);
          break;
        case 'openExpert':
          await openExpertInEditor(fileService, message.slug);
          break;
        case 'openTeam':
          await openTeamInEditor(fileService, message.slug);
          break;
      }
    },
    undefined
  );

  currentDashboardPanel.webview.html = getDashboardHtml(currentDashboardPanel.webview);
}

async function handleDataRequest(panel: vscode.WebviewPanel, fileService: FileService) {
  const [expertsResult, teamsResult, configResult] = await Promise.all([
    fileService.listExperts(),
    fileService.listTeams(),
    fileService.readDomainConfig()
  ]);

  const experts = expertsResult.success ? expertsResult.data || [] : [];
  const teams = teamsResult.success ? teamsResult.data || [] : [];
  const config = configResult.success ? configResult.data : null;

  const expertStats = visualizationService.getExpertStats(experts);
  const teamStats = visualizationService.getTeamStats(teams);
  const overviewDiagram = visualizationService.generateOverviewDiagram(teams, experts);
  const teamDiagram = visualizationService.generateTeamDiagram(teams);

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

async function openExpertInEditor(fileService: FileService, slug: string) {
  const filePath = fileService.getExpertsDir() + `/${slug}.md`;
  const uri = vscode.Uri.file(filePath);
  await vscode.commands.executeCommand('vscode.openWith', uri, 'default');
}

async function openTeamInEditor(fileService: FileService, slug: string) {
  const filePath = fileService.getTeamsDir() + `/${slug}.json`;
  const uri = vscode.Uri.file(filePath);
  await vscode.commands.executeCommand('vscode.openWith', uri, 'default');
}

async function createExpert(fileService: FileService) {
  // Open Expert Manager webview
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (workspaceFolders && workspaceFolders.length > 0) {
    openExpertManager(workspaceFolders[0].uri);
  } else {
    vscode.window.showErrorMessage('Please open a workspace folder first');
  }
}

async function buildTeam(fileService: FileService, editingSlug?: string) {
  const extensionUri = vscode.Uri.file(fileService.getRelayRoot()).with({ scheme: 'file' });
  // Navigate to extension root
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (workspaceFolders && workspaceFolders.length > 0) {
    await TeamBuilderPanel.createOrShow(workspaceFolders[0].uri, editingSlug);
  } else {
    vscode.window.showErrorMessage('Please open a workspace folder first');
  }
}

async function editAgent(fileService: FileService, expertSlug?: string) {
  if (expertSlug) {
    // Direct edit from tree view
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
      openExpertManager(workspaceFolders[0].uri, expertSlug);
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
      openExpertManager(workspaceFolders[0].uri, selected.slug);
    }
  }
}

async function openSettings(fileService: FileService) {
  const config = await fileService.readDomainConfig();
  if (config.success && config.data) {
    vscode.window.showInformationMessage(
      `Domain: ${config.data.domain}, Project: ${config.data.project_name}`
    );
  } else {
    const action = await vscode.window.showWarningMessage(
      'Relay plugin not configured. Would you like to set it up?',
      'Setup Now',
      'Cancel'
    );
    if (action === 'Setup Now') {
      vscode.window.showInformationMessage('Please run /relay:setup in the chat to configure relay plugin.');
    }
  }
}

async function viewTeamDiagram(fileService: FileService, teamSlug: string) {
  const result = await fileService.readTeam(teamSlug);
  if (!result.success || !result.data) {
    vscode.window.showErrorMessage(`Team not found: ${teamSlug}`);
    return;
  }

  const diagram = visualizationService.generateSingleTeamDiagram(result.data);
  showDiagramViewer(`${result.data.name} Structure`, diagram);
}

async function viewExpertDiagram(fileService: FileService, expertSlug: string) {
  const result = await fileService.readExpert(expertSlug);
  if (!result.success || !result.data) {
    vscode.window.showErrorMessage(`Expert not found: ${expertSlug}`);
    return;
  }

  const diagram = visualizationService.generateExpertMindMap(result.data);
  showDiagramViewer(`${result.data.role} Mind Map`, diagram);
}

function showDiagramViewer(title: string, mermaidCode: string) {
  const panel = vscode.window.createWebviewPanel(
    'agentDiagramViewer',
    title,
    vscode.ViewColumn.Two,
    { enableScripts: true }
  );

  panel.webview.html = getDiagramViewerHtml(mermaidCode);
}

// ==========================================================================
// Helpers
// ==========================================================================

async function checkRelaySetup(fileService: FileService) {
  const config = await fileService.readDomainConfig();
  if (!config.success || !config.data) {
    vscode.window.showWarningMessage(
      'Relay plugin not configured. Run /relay:setup to initialize.'
    );
  }
}

function getDashboardHtml(webview: vscode.Webview): string {
  const nonce = getNonce();

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

function getDiagramViewerHtml(mermaidCode: string): string {
  const nonce = getNonce();

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
