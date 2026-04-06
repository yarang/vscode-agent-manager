/**
 * RelayEventWatcher - File system watcher for relay runtime events
 *
 * Watches .claude/relay/ subdirectories and dispatches events to VSCode UI:
 *   - notify/events/*.json  → agent activity output panel
 *   - experts/*.md          → tree view refresh
 *   - teams/*.json          → tree view refresh
 *   - templates/**          → template browser refresh
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import { RelayEvent } from '../types';

export type RelayEventHandler = (event: RelayEvent) => void;

export class RelayEventWatcher implements vscode.Disposable {
  private watchers: vscode.FileSystemWatcher[] = [];
  private outputChannel: vscode.OutputChannel;
  private onRefreshTree: (() => void) | undefined;
  private onRefreshTemplates: (() => void) | undefined;
  private statusBarItem: vscode.StatusBarItem;
  private activeAgentCount = 0;

  constructor() {
    this.outputChannel = vscode.window.createOutputChannel('Agent Activity');
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100
    );
    this.statusBarItem.command = 'agentManager.showAgentActivity';
    this.statusBarItem.hide();
  }

  // ==========================================================================
  // Lifecycle
  // ==========================================================================

  start(
    relayRoot: string,
    options: {
      onRefreshTree?: () => void;
      onRefreshTemplates?: () => void;
    } = {}
  ): void {
    this.onRefreshTree = options.onRefreshTree;
    this.onRefreshTemplates = options.onRefreshTemplates;

    this.watchNotifyEvents(relayRoot);
    this.watchExperts(relayRoot);
    this.watchTeams(relayRoot);
    this.watchTemplates(relayRoot);
  }

  showOutputChannel(): void {
    this.outputChannel.show(true);
  }

  dispose(): void {
    this.watchers.forEach(w => w.dispose());
    this.watchers = [];
    this.outputChannel.dispose();
    this.statusBarItem.dispose();
  }

  // ==========================================================================
  // Watchers
  // ==========================================================================

  private watchNotifyEvents(relayRoot: string): void {
    const pattern = new vscode.RelativePattern(
      vscode.Uri.file(relayRoot),
      'notify/events/*.json'
    );
    const watcher = vscode.workspace.createFileSystemWatcher(pattern, false, true, true);

    watcher.onDidCreate(uri => {
      this.handleEventFile(uri.fsPath);
    });

    this.watchers.push(watcher);
  }

  private watchExperts(relayRoot: string): void {
    const pattern = new vscode.RelativePattern(
      vscode.Uri.file(relayRoot),
      'experts/*.md'
    );
    const watcher = vscode.workspace.createFileSystemWatcher(pattern);

    const refresh = () => this.onRefreshTree?.();
    watcher.onDidCreate(refresh);
    watcher.onDidChange(refresh);
    watcher.onDidDelete(refresh);

    this.watchers.push(watcher);
  }

  private watchTeams(relayRoot: string): void {
    const pattern = new vscode.RelativePattern(
      vscode.Uri.file(relayRoot),
      'teams/*.json'
    );
    const watcher = vscode.workspace.createFileSystemWatcher(pattern);

    const refresh = () => this.onRefreshTree?.();
    watcher.onDidCreate(refresh);
    watcher.onDidChange(refresh);
    watcher.onDidDelete(refresh);

    this.watchers.push(watcher);
  }

  private watchTemplates(relayRoot: string): void {
    const pattern = new vscode.RelativePattern(
      vscode.Uri.file(relayRoot),
      'templates/**/*.md'
    );
    const watcher = vscode.workspace.createFileSystemWatcher(pattern);

    const refresh = () => {
      this.onRefreshTemplates?.();
      this.onRefreshTree?.();
    };
    watcher.onDidCreate(refresh);
    watcher.onDidChange(refresh);
    watcher.onDidDelete(refresh);

    this.watchers.push(watcher);
  }

  // ==========================================================================
  // Event Handling
  // ==========================================================================

  private handleEventFile(filePath: string): void {
    try {
      if (!fs.existsSync(filePath)) { return; }
      const raw = fs.readFileSync(filePath, 'utf-8');
      const event = JSON.parse(raw) as RelayEvent;
      this.dispatchEvent(event);
    } catch {
      // ignore malformed event files
    }
  }

  private dispatchEvent(event: RelayEvent): void {
    switch (event.event_type) {
      case 'file_changed':
        this.onFileChanged(event);
        break;
      case 'stop':
        this.onAgentStop(event);
        break;
      case 'teammate_idle':
        this.onTeammateIdle(event);
        break;
      default:
        this.logEvent(event);
        break;
    }
  }

  private onFileChanged(event: RelayEvent): void {
    const filePath = (event.payload['file_path'] as string) ?? '';
    const toolName = (event.payload['tool_name'] as string) ?? '';
    const shortPath = filePath.split('/').slice(-3).join('/');

    this.logToOutput(`[file] ${toolName}: ${shortPath}`, event.timestamp);
    this.onRefreshTree?.();
  }

  private onAgentStop(event: RelayEvent): void {
    this.activeAgentCount = Math.max(0, this.activeAgentCount - 1);
    this.updateStatusBar();
    this.logToOutput('[stop] Agent session ended', event.timestamp);

    if (this.activeAgentCount === 0) {
      vscode.window.showInformationMessage('Agent task completed.');
      setTimeout(() => this.statusBarItem.hide(), 3000);
    }
  }

  private onTeammateIdle(event: RelayEvent): void {
    const agentSlug = (event.payload['agent'] as string) ?? 'unknown';
    this.logToOutput(`[idle] ${agentSlug} is idle`, event.timestamp);
    this.bumpActiveAgentCount();
  }

  private bumpActiveAgentCount(): void {
    this.activeAgentCount++;
    this.updateStatusBar();
  }

  private updateStatusBar(): void {
    if (this.activeAgentCount > 0) {
      this.statusBarItem.text = `$(loading~spin) ${this.activeAgentCount} agent(s) active`;
      this.statusBarItem.tooltip = 'Click to show agent activity';
      this.statusBarItem.show();
    } else {
      this.statusBarItem.hide();
    }
  }

  private logToOutput(message: string, timestamp?: string): void {
    const ts = timestamp
      ? new Date(timestamp).toLocaleTimeString()
      : new Date().toLocaleTimeString();
    this.outputChannel.appendLine(`[${ts}] ${message}`);
  }

  private logEvent(event: RelayEvent): void {
    this.logToOutput(`[${event.event_type}] ${JSON.stringify(event.payload)}`, event.timestamp);
  }
}
