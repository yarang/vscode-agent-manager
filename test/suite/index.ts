/**
 * VS Code Extension Test Suite
 *
 * Main test runner file that orchestrates all extension tests.
 */

import * as path from 'path';
import * as Mocha from 'mocha';
import * as vscode from 'vscode';

export async function run(): Promise<void> {
  // Create the mocha test
  const mocha = new Mocha({
    ui: 'tdd',
    color: true
  });

  const testsRoot = path.join(__dirname, '.');

  await new Promise<void>((resolve, reject) => {
    mocha.addFile(path.join(testsRoot, 'extension.test.js'));
    mocha.addFile(path.join(testsRoot, 'services/**/*.test.js'));

    try {
      mocha.run(failures => {
        if (failures > 0) {
          reject(new Error(\`\${failures} tests failed.\`));
        } else {
          resolve();
        }
      });
    } catch (err) {
      console.error(err);
      reject(err);
    }
  });
}
