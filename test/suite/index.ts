/**
 * VS Code Extension Test Suite
 *
 * Main test runner file that orchestrates all extension tests.
 */

import * as path from 'path';
import * as Mocha from 'mocha';
import { glob } from 'glob';

export async function run(): Promise<void> {
  // Create the mocha test
  const mocha = new Mocha({
    ui: 'tdd',
    color: true
  });

  const testsRoot = path.join(__dirname, '.');
  const testFiles = await glob('**/*.test.js', {
    cwd: testsRoot,
    absolute: true
  });

  await new Promise<void>((resolve, reject) => {
    testFiles.sort().forEach(file => mocha.addFile(file));

    try {
      mocha.run(failures => {
        if (failures > 0) {
          reject(new Error(`${failures} tests failed.`));
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
