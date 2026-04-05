/**
 * pathResolver - Resolve .claude/relay directory paths
 *
 * Provides centralized path resolution for all relay-plugin data locations.
 */

import * as vscode from 'vscode';
import * as path from 'path';

/**
 * Get the workspace root folder
 *
 * @returns Workspace root path or empty string if no workspace open
 */
export function getWorkspaceRoot(): string {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
}

/**
 * Get the .claude directory root
 *
 * @returns Path to .claude directory
 */
export function getClaudeRoot(): string {
  return path.join(getWorkspaceRoot(), '.claude');
}

/**
 * Get the relay plugin root directory
 *
 * @returns Path to .claude/relay directory
 */
export function getRelayRoot(): string {
  return path.join(getClaudeRoot(), 'relay');
}

/**
 * Get the experts directory
 *
 * @returns Path to .claude/relay/experts directory
 */
export function getExpertsDir(): string {
  return path.join(getRelayRoot(), 'experts');
}

/**
 * Get the teams directory
 *
 * @returns Path to .claude/relay/teams directory
 */
export function getTeamsDir(): string {
  return path.join(getRelayRoot(), 'teams');
}

/**
 * Get the agent library definitions directory
 *
 * @returns Path to .claude/relay/agent-library/definitions directory
 */
export function getAgentDefinitionsDir(): string {
  return path.join(getRelayRoot(), 'agent-library', 'definitions');
}

/**
 * Get the domain config file path
 *
 * @returns Path to .claude/relay/domain-config.json
 */
export function getDomainConfigPath(): string {
  return path.join(getRelayRoot(), 'domain-config.json');
}

/**
 * Get expert file path by slug
 *
 * @param slug - Expert slug
 * @returns Path to expert markdown file
 */
export function getExpertPath(slug: string): string {
  return path.join(getExpertsDir(), `${slug}.md`);
}

/**
 * Get team file path by slug
 *
 * @param slug - Team slug
 * @returns Path to team JSON file
 */
export function getTeamPath(slug: string): string {
  return path.join(getTeamsDir(), `${slug}.json`);
}

/**
 * Get agent definition file path by ID
 *
 * @param id - Agent definition ID
 * @returns Path to agent definition JSON file
 */
export function getAgentDefinitionPath(id: string): string {
  return path.join(getAgentDefinitionsDir(), `${id}.json`);
}

/**
 * Check if relay directory structure exists
 *
 * @returns Object indicating which directories exist
 */
export function checkRelayStructure(): {
  relayExists: boolean;
  expertsExists: boolean;
  teamsExists: boolean;
  agentLibraryExists: boolean;
} {
  const root = getRelayRoot();
  const fs = require('fs');

  return {
    relayExists: fs.existsSync(root),
    expertsExists: fs.existsSync(getExpertsDir()),
    teamsExists: fs.existsSync(getTeamsDir()),
    agentLibraryExists: fs.existsSync(getAgentDefinitionsDir())
  };
}

/**
 * Ensure all relay directories exist
 *
 * @returns Path to relay root
 * @throws Error if workspace is not open
 */
export function ensureRelayStructure(): string {
  const root = getRelayRoot();
  const fs = require('fs');

  if (!getWorkspaceRoot()) {
    throw new Error('No workspace folder is open');
  }

  // Create relay directory
  if (!fs.existsSync(root)) {
    fs.mkdirSync(root, { recursive: true });
  }

  // Create subdirectories
  const dirs = [
    getExpertsDir(),
    getTeamsDir(),
    getAgentDefinitionsDir()
  ];

  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  return root;
}
