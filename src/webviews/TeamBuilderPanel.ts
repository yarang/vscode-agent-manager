/**
 * TeamBuilderPanel - Webview panel for creating/editing teams
 *
 * Features:
 * - Team creation and editing
 * - Member management with drag-drop
 * - Bridge member configuration
 * - Real-time validation
 */

import * as vscode from 'vscode';
import { Team, TeamMember, Expert } from '../types';
import { teamService } from '../services/TeamService';
import { expertService } from '../services/ExpertService';
import { validationService } from '../services/ValidationService';
import { getNonce } from '../utils/webview';

export interface TeamBuilderMessage {
  type: string;
  data?: unknown;
}

export interface TeamCreateData {
  name: string;
  type: 'upper' | 'lower';
  execution_mode: 'teammate' | 'inprocess';
  coordinator: 'claude' | 'glm';
  coordinator_model: string;
  purpose: string;
  decision_mode: 'leader_decides' | 'consensus' | 'vote' | 'architect_veto';
  members: TeamMemberData[];
  phase_routing: PhaseRoutingData;
}

export interface TeamMemberData {
  expert_slug: string;
  role: string;
  cli?: string;
  model?: string;
  tier: 'trivial' | 'standard' | 'premium';
  permission_mode: 'plan' | 'acceptEdits' | 'default';
  is_leader: boolean;
  is_bridge: boolean;
}

export interface PhaseRoutingData {
  probe?: string;
  grasp?: string;
  tangle?: string;
  ink?: string;
}

export class TeamBuilderPanel {
  private static currentPanel: TeamBuilderPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];
  private editingTeamSlug: string | null = null;
  private availableExperts: Expert[] = [];

  private constructor(
    panel: vscode.WebviewPanel,
    private extensionUri: vscode.Uri,
    editingSlug?: string
  ) {
    this.panel = panel;
    this.editingTeamSlug = editingSlug || null;

    this.panel.webview.html = this.getHtmlContent(this.panel.webview);

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

    this.panel.webview.onDidReceiveMessage(
      async (message) => this.handleMessage(message),
      null,
      this.disposables
    );

    this.loadInitialData();
  }

  public static async createOrShow(
    extensionUri: vscode.Uri,
    editingSlug?: string
  ): Promise<void> {
    const column = vscode.window.activeTextEditor?.viewColumn || vscode.ViewColumn.One;

    if (TeamBuilderPanel.currentPanel) {
      TeamBuilderPanel.currentPanel.panel.reveal(column);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'agentManager.teamBuilder',
      editingSlug ? 'Edit Team' : 'Build Team',
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, 'media'),
          vscode.Uri.joinPath(extensionUri, 'dist')
        ]
      }
    );

    TeamBuilderPanel.currentPanel = new TeamBuilderPanel(panel, extensionUri, editingSlug);
  }

  private async loadInitialData(): Promise<void> {
    // Load available experts
    const expertsResult = await expertService.listExperts();
    if (expertsResult.success && expertsResult.data) {
      this.availableExperts = expertsResult.data;
      this.postMessage({
        type: 'expertsLoaded',
        data: this.availableExperts
      });
    }

    // Load existing team if editing
    if (this.editingTeamSlug) {
      const teamResult = await teamService.getTeam(this.editingTeamSlug);
      if (teamResult.success && teamResult.data) {
        this.postMessage({
          type: 'teamLoaded',
          data: teamResult.data
        });
      }
    }
  }

  private async handleMessage(message: TeamBuilderMessage): Promise<void> {
    switch (message.type) {
      case 'validate':
        await this.handleValidation(message.data as TeamCreateData);
        break;

      case 'save':
        await this.handleSave(message.data as TeamCreateData);
        break;

      case 'loadExpert':
        await this.handleLoadExpert(message.data as string);
        break;

      case 'close':
        this.panel.dispose();
        break;

      default:
        console.warn('Unknown message type:', message.type);
    }
  }

  private async handleValidation(data: TeamCreateData): Promise<void> {
    const team = this.buildTeamObject(data);
    const validation = validationService.validateTeam(team);

    // Additional member existence validation
    const memberErrors: string[] = [];
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

  private async handleSave(data: TeamCreateData): Promise<void> {
    try {
      const team = this.buildTeamObject(data);

      // Validate first
      const validation = validationService.validateTeam(team);
      if (!validation.valid) {
        this.postMessage({
          type: 'saveError',
          data: { errors: validation.errors }
        });
        return;
      }

      let result;
      if (this.editingTeamSlug) {
        result = await teamService.updateTeam(this.editingTeamSlug, team);
      } else {
        result = await teamService.createTeam(data.name, team);
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
      } else {
        this.postMessage({
          type: 'saveError',
          data: { errors: [result.error || 'Save failed'] }
        });
      }
    } catch (error) {
      this.postMessage({
        type: 'saveError',
        data: { errors: [String(error)] }
      });
    }
  }

  private async handleLoadExpert(slug: string): Promise<void> {
    const expert = this.availableExperts.find(e => e.slug === slug);
    if (expert) {
      this.postMessage({
        type: 'expertDetails',
        data: expert
      });
    }
  }

  private buildTeamObject(data: TeamCreateData): Partial<Team> {
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

  private postMessage(message: TeamBuilderMessage): void {
    this.panel.webview.postMessage(message);
  }

  private getHtmlContent(webview: vscode.Webview): string {
    const nonce = getNonce();
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'webviews', 'teamBuilder.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'media', 'teamBuilder.css')
    );

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

  private getScriptContent(): string {
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

      function closeExpertPicker() {
        expertSearch.value = '';
        renderExpertList(availableExperts);

        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
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
          closeExpertPicker();
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
        closeExpertPicker();
        showStatus(\`Added \${expert.role} to team\`, 'info');
      }

      function showExpertDetails(slug) {
        selectedExpertSlug = slug;
        closeExpertPicker();
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

  public dispose(): void {
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
