/**
 * ConfigService - Domain and API key configuration management
 *
 * Handles:
 * - Domain configuration (active packs, project name)
 * - API key status checking
 * - Relay plugin settings
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { DomainConfig, ServiceResult, Domain } from '../types';
import { fileService } from './FileService';
import { getClaudeRoot, getRelayRoot } from '../utils/pathResolver';

export interface ApiKeyStatus {
  provider: string;
  configured: boolean;
  source?: string;
  error?: string;
}

export interface RelayConfig {
  domain: Domain;
  active_packs: string[];
  project_name: string;
  // Additional relay settings
  coordinator_model?: string;
  execution_mode?: 'teammate' | 'inprocess';
}

export class ConfigService {
  private readonly CONFIG_FILE = 'domain-config.json';
  private readonly CLAUDE_CONFIG = 'settings.json';

  // ==========================================================================
  // Domain Configuration
  // ==========================================================================

  async getDomainConfig(): Promise<ServiceResult<RelayConfig>> {
    const result = await fileService.readDomainConfig();
    if (!result.success || !result.data) {
      // Return default config
      return {
        success: true,
        data: this.getDefaultConfig()
      };
    }

    return {
      success: true,
      data: {
        domain: result.data.domain,
        active_packs: result.data.active_packs || [],
        project_name: result.data.project_name || '',
        coordinator_model: 'claude-opus-4-6',
        execution_mode: 'teammate'
      }
    };
  }

  async updateDomainConfig(updates: Partial<RelayConfig>): Promise<ServiceResult<RelayConfig>> {
    const current = await this.getDomainConfig();
    if (!current.success || !current.data) {
      return { success: false, error: 'Failed to read current config' };
    }

    const updated: RelayConfig = {
      ...current.data,
      ...updates
    };

    const domainConfig: DomainConfig = {
      domain: updated.domain,
      active_packs: updated.active_packs,
      project_name: updated.project_name,
      configured_at: new Date().toISOString()
    };

    const result = await fileService.writeDomainConfig(domainConfig);
    if (!result.success) {
      return { success: false, error: result.error };
    }

    return { success: true, data: updated };
  }

  async setDomain(domain: Domain): Promise<ServiceResult<void>> {
    return this.updateDomainConfig({ domain }).then(() => ({ success: true }));
  }

  async setActivePacks(packs: string[]): Promise<ServiceResult<void>> {
    return this.updateDomainConfig({ active_packs: packs }).then(() => ({ success: true }));
  }

  async addActivePack(pack: string): Promise<ServiceResult<void>> {
    const current = await this.getDomainConfig();
    if (!current.success || !current.data) {
      return { success: false, error: 'Failed to read current config' };
    }

    const packs = current.data.active_packs;
    if (!packs.includes(pack)) {
      packs.push(pack);
    }

    return this.updateDomainConfig({ active_packs: packs }).then(() => ({ success: true }));
  }

  async removeActivePack(pack: string): Promise<ServiceResult<void>> {
    const current = await this.getDomainConfig();
    if (!current.success || !current.data) {
      return { success: false, error: 'Failed to read current config' };
    }

    const packs = current.data.active_packs.filter(p => p !== pack);
    return this.updateDomainConfig({ active_packs: packs }).then(() => ({ success: true }));
  }

  async setProjectName(name: string): Promise<ServiceResult<void>> {
    return this.updateDomainConfig({ project_name: name }).then(() => ({ success: true }));
  }

  // ==========================================================================
  // API Key Status
  // ==========================================================================

  async getApiKeyStatus(): Promise<ServiceResult<ApiKeyStatus[]>> {
    const statuses: ApiKeyStatus[] = [];

    // Check Claude API key
    statuses.push(await this.checkClaudeApiKey());

    // Check Codex API key
    statuses.push(await this.checkCodexApiKey());

    // Check Gemini API key
    statuses.push(await this.checkGeminiApiKey());

    // Check Zai MCP server
    statuses.push(await this.checkZaiMcp());

    return { success: true, data: statuses };
  }

  private async checkClaudeApiKey(): Promise<ApiKeyStatus> {
    // Check environment variable
    const envKey = process.env.ANTHROPIC_API_KEY;
    if (envKey && envKey.startsWith('sk-ant-')) {
      return {
        provider: 'Claude (Anthropic)',
        configured: true,
        source: 'Environment variable (ANTHROPIC_API_KEY)'
      };
    }

    // Check Claude Code settings
    const claudeConfig = await this.getClaudeSettings();
    if (claudeConfig?.apiKey) {
      return {
        provider: 'Claude (Anthropic)',
        configured: true,
        source: 'Claude Code settings'
      };
    }

    return {
      provider: 'Claude (Anthropic)',
      configured: false,
      error: 'No API key found. Set ANTHROPIC_API_KEY environment variable or configure in Claude Code settings.'
    };
  }

  private async checkCodexApiKey(): Promise<ApiKeyStatus> {
    // Check environment variable
    const envKey = process.env.OPENAI_API_KEY;
    if (envKey && envKey.startsWith('sk-')) {
      return {
        provider: 'Codex (OpenAI)',
        configured: true,
        source: 'Environment variable (OPENAI_API_KEY)'
      };
    }

    return {
      provider: 'Codex (OpenAI)',
      configured: false,
      error: 'No API key found. Set OPENAI_API_KEY environment variable.'
    };
  }

  private async checkGeminiApiKey(): Promise<ApiKeyStatus> {
    // Check environment variable
    const envKey = process.env.GEMINI_API_KEY;
    if (envKey && envKey.length > 0) {
      return {
        provider: 'Gemini (Google)',
        configured: true,
        source: 'Environment variable (GEMINI_API_KEY)'
      };
    }

    return {
      provider: 'Gemini (Google)',
      configured: false,
      error: 'No API key found. Set GEMINI_API_KEY environment variable.'
    };
  }

  private async checkZaiMcp(): Promise<ApiKeyStatus> {
    // Check if MCP server is configured
    // This would check the MCP server configuration
    const mcpConfigured = await this.isMcpServerConfigured('zai-mcp-server');

    return {
      provider: 'Zai MCP',
      configured: mcpConfigured,
      source: mcpConfigured ? 'MCP server configuration' : undefined,
      error: mcpConfigured ? undefined : 'Zai MCP server not configured. Check Claude Code MCP settings.'
    };
  }

  // ==========================================================================
  // Relay Structure
  // ==========================================================================

  async checkRelayStructure(): Promise<ServiceResult<{
    exists: boolean;
    relayDir: string;
    expertsDir: string;
    teamsDir: string;
    agentLibraryDir: string;
    configFile: string;
    expertsCount: number;
    teamsCount: number;
  }>> {
    const relayRoot = getRelayRoot();
    const exists = fs.existsSync(relayRoot);

    const expertsDir = path.join(relayRoot, 'experts');
    const teamsDir = path.join(relayRoot, 'teams');
    const agentLibraryDir = path.join(relayRoot, 'agent-library', 'definitions');
    const configFile = path.join(relayRoot, this.CONFIG_FILE);

    let expertsCount = 0;
    let teamsCount = 0;

    if (exists) {
      if (fs.existsSync(expertsDir)) {
        const files = fs.readdirSync(expertsDir).filter(f => f.endsWith('.md'));
        expertsCount = files.length;
      }
      if (fs.existsSync(teamsDir)) {
        const files = fs.readdirSync(teamsDir).filter(f => f.endsWith('.json'));
        teamsCount = files.length;
      }
    }

    return {
      success: true,
      data: {
        exists,
        relayDir: relayRoot,
        expertsDir,
        teamsDir,
        agentLibraryDir,
        configFile,
        expertsCount,
        teamsCount
      }
    };
  }

  async initializeRelayStructure(): Promise<ServiceResult<string>> {
    const relayRoot = getRelayRoot();

    try {
      // Create relay directory
      if (!fs.existsSync(relayRoot)) {
        fs.mkdirSync(relayRoot, { recursive: true });
      }

      // Create subdirectories
      const dirs = [
        path.join(relayRoot, 'experts'),
        path.join(relayRoot, 'teams'),
        path.join(relayRoot, 'agent-library', 'definitions')
      ];

      for (const dir of dirs) {
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
      }

      // Create default domain config if it doesn't exist
      const configPath = path.join(relayRoot, this.CONFIG_FILE);
      if (!fs.existsSync(configPath)) {
        const defaultConfig = this.getDefaultConfig();
        const domainConfig: DomainConfig = {
          domain: defaultConfig.domain,
          active_packs: defaultConfig.active_packs,
          project_name: defaultConfig.project_name,
          configured_at: new Date().toISOString()
        };
        fs.writeFileSync(configPath, JSON.stringify(domainConfig, null, 2), 'utf-8');
      }

      return { success: true, data: relayRoot };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  private getDefaultConfig(): RelayConfig {
    const workspaceName = path.basename(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || 'project');

    return {
      domain: 'general',
      active_packs: [],
      project_name: workspaceName,
      coordinator_model: 'claude-opus-4-6',
      execution_mode: 'teammate'
    };
  }

  private async getClaudeSettings(): Promise<{ apiKey?: string } | null> {
    try {
      const claudeConfigPath = path.join(getClaudeRoot(), this.CLAUDE_CONFIG);
      if (!fs.existsSync(claudeConfigPath)) {
        return null;
      }

      const content = fs.readFileSync(claudeConfigPath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  private async isMcpServerConfigured(serverName: string): Promise<boolean> {
    // Check if MCP server is configured in Claude settings
    // This is a simplified check - in practice, you'd read the MCP config
    try {
      const claudeConfigPath = path.join(getClaudeRoot(), this.CLAUDE_CONFIG);
      if (!fs.existsSync(claudeConfigPath)) {
        return false;
      }

      const content = fs.readFileSync(claudeConfigPath, 'utf-8');
      const config = JSON.parse(content);

      // Check if MCP servers are configured
      if (config.mcpServers && config.mcpServers[serverName]) {
        return true;
      }

      return false;
    } catch {
      return false;
    }
  }

  // ==========================================================================
  // Project Info
  // ==========================================================================

  async getProjectInfo(): Promise<ServiceResult<{
    name: string;
    path: string;
    relayConfigured: boolean;
    expertCount: number;
    teamCount: number;
  }>> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      return { success: false, error: 'No workspace folder open' };
    }

    const relayCheck = await this.checkRelayStructure();
    const relayInfo = relayCheck.success && relayCheck.data
      ? relayCheck.data
      : { exists: false, expertsCount: 0, teamsCount: 0 };

    const domainConfig = await this.getDomainConfig();
    const projectName = domainConfig.success && domainConfig.data
      ? domainConfig.data.project_name
      : path.basename(workspaceFolder.uri.fsPath);

    return {
      success: true,
      data: {
        name: projectName,
        path: workspaceFolder.uri.fsPath,
        relayConfigured: relayInfo.exists,
        expertCount: relayInfo.expertsCount,
        teamCount: relayInfo.teamsCount
      }
    };
  }

  async openRelayFolder(): Promise<void> {
    const relayRoot = getRelayRoot();
    const uri = vscode.Uri.file(relayRoot);

    // Check if directory exists
    if (!fs.existsSync(relayRoot)) {
      const init = await this.initializeRelayStructure();
      if (!init.success) {
        vscode.window.showErrorMessage(`Failed to initialize relay structure: ${init.error}`);
        return;
      }
    }

    // Open in VS Code
    await vscode.commands.executeCommand('vscode.openFolder', uri, { forceNewWindow: false });
  }

  async openDomainConfig(): Promise<void> {
    const configPath = path.join(getRelayRoot(), this.CONFIG_FILE);

    // Ensure config exists
    await this.initializeRelayStructure();

    const uri = vscode.Uri.file(configPath);
    await vscode.commands.executeCommand('vscode.open', uri);
  }
}

// Singleton export
export const configService = new ConfigService();
