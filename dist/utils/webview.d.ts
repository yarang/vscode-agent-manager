/**
 * Webview utilities for VS Code extension panels
 */
/**
 * Generate a nonce for CSP
 */
export declare function getNonce(): string;
/**
 * Escape HTML to prevent XSS
 */
export declare function escapeHtml(text: string): string;
/**
 * Generate webview URI with proper CSP
 */
export declare function getWebviewOptions(extensionUri: vscode.Uri): vscode.WebviewOptions;
import * as vscode from 'vscode';
//# sourceMappingURL=webview.d.ts.map