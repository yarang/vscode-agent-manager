/**
 * ExpertManager Webview - Expert creation and editing interface
 *
 * Provides a rich UI for creating, editing, and managing expert definitions.
 */
import * as vscode from 'vscode';
import { Expert, SpecDefinition } from '../types';
import { TemplateService } from '../services/TemplateService';
interface ExpertManagerMessage {
    command: string;
    [key: string]: unknown;
}
interface ExpertManagerMessageHandlers {
    init: (panel: vscode.WebviewPanel, expertSlug?: string) => Promise<void>;
    save: (panel: vscode.WebviewPanel, data: ExpertFormData) => Promise<void>;
    delete: (panel: vscode.WebviewPanel, slug: string) => Promise<void>;
    duplicate: (panel: vscode.WebviewPanel, slug: string) => Promise<void>;
    loadTemplate: (panel: vscode.WebviewPanel, templateId: string) => Promise<void>;
    generateSlug: (panel: vscode.WebviewPanel, role: string) => void;
    validateSlug: (panel: vscode.WebviewPanel, slug: string, originalSlug?: string) => Promise<void>;
    cancel: (panel: vscode.WebviewPanel) => void;
    saveSpec: (panel: vscode.WebviewPanel, spec: SpecDefinition) => Promise<void>;
    deleteSpec: (panel: vscode.WebviewPanel, id: string) => Promise<void>;
}
export declare function openExpertManager(extensionUri: vscode.Uri, expertSlug?: string, templateService?: TemplateService): void;
interface ExpertFormData extends Partial<Expert> {
    _originalSlug?: string;
    specs?: string[];
}
export declare function dispatchExpertManagerMessage(panel: vscode.WebviewPanel, message: ExpertManagerMessage, expertSlug?: string, handlers?: ExpertManagerMessageHandlers): Promise<void>;
export declare function getExpertManagerHtmlForTest(): string;
export {};
//# sourceMappingURL=ExpertManager.d.ts.map