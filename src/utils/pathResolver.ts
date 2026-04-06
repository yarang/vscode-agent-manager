/**
 * pathResolver - Resolve .claude/relay directory paths
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export function getWorkspaceRoot(): string {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
}

export function getClaudeRoot(): string {
  return path.join(getWorkspaceRoot(), '.claude');
}

export function getRelayRoot(): string {
  return path.join(getClaudeRoot(), 'relay');
}

export function getExpertsDir(): string {
  return path.join(getRelayRoot(), 'experts');
}

export function getTeamsDir(): string {
  return path.join(getRelayRoot(), 'teams');
}

export function getAgentDefinitionsDir(): string {
  return path.join(getRelayRoot(), 'agent-library', 'definitions');
}

export function getDomainConfigPath(): string {
  return path.join(getRelayRoot(), 'domain-config.json');
}

/** Project scope template root */
export function getProjectTemplatesRoot(): string {
  return path.join(getRelayRoot(), 'templates');
}

export function getProjectSpecsDir(): string {
  return path.join(getProjectTemplatesRoot(), 'modules', 'specs');
}

export function getProjectPlatformsDir(): string {
  return path.join(getProjectTemplatesRoot(), 'modules', 'platforms');
}

export function getProjectPoliciesDir(): string {
  return path.join(getProjectTemplatesRoot(), 'modules', 'policies');
}

export function getProjectDefinitionsDir(): string {
  return path.join(getProjectTemplatesRoot(), 'definitions');
}

export function getNotifyEventsDir(): string {
  return path.join(getRelayRoot(), 'notify', 'events');
}

export function getExpertPath(slug: string): string {
  return path.join(getExpertsDir(), `${slug}.md`);
}

export function getTeamPath(slug: string): string {
  return path.join(getTeamsDir(), `${slug}.json`);
}

export function getAgentDefinitionPath(id: string): string {
  return path.join(getAgentDefinitionsDir(), `${id}.json`);
}

export function checkRelayStructure(): {
  relayExists: boolean;
  expertsExists: boolean;
  teamsExists: boolean;
  templatesExists: boolean;
} {
  const root = getRelayRoot();
  return {
    relayExists: fs.existsSync(root),
    expertsExists: fs.existsSync(getExpertsDir()),
    teamsExists: fs.existsSync(getTeamsDir()),
    templatesExists: fs.existsSync(getProjectTemplatesRoot())
  };
}

export function ensureRelayStructure(): string {
  const root = getRelayRoot();

  if (!getWorkspaceRoot()) {
    throw new Error('No workspace folder is open');
  }

  const dirs = [
    root,
    getExpertsDir(),
    getTeamsDir(),
    getProjectTemplatesRoot(),
    getProjectSpecsDir(),
    getProjectPoliciesDir(),
    getProjectDefinitionsDir()
  ];

  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  return root;
}
