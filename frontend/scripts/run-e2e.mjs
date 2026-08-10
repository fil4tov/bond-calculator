import { spawn } from 'node:child_process';
import { error as logError } from 'node:console';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const frontendDirectory = path.resolve(scriptDirectory, '..');
const repositoryDirectory = path.resolve(frontendDirectory, '..');
const composeFile = path.join(repositoryDirectory, 'compose.e2e.yaml');
const playwrightCli = path.join(
  frontendDirectory,
  'node_modules',
  '@playwright',
  'test',
  'cli.js',
);

function executeCommand(command, args, options) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      stdio: 'inherit',
    });

    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      const reason = signal ? `signal ${signal}` : `exit code ${code ?? 'unknown'}`;
      reject(new Error(`${path.basename(command)} failed with ${reason}`));
    });
  });
}

export async function runE2E({
  execute = executeCommand,
  playwrightArgs = process.argv.slice(2),
} = {}) {
  const composeArgs = ['compose', '--project-name', 'bonds-e2e', '-f', composeFile];
  let failure;

  try {
    await execute('docker', [...composeArgs, 'up', '--build', '--wait'], {
      cwd: repositoryDirectory,
      env: process.env,
    });
    await execute(process.execPath, [playwrightCli, 'test', ...playwrightArgs], {
      cwd: frontendDirectory,
      env: {
        ...process.env,
        VITE_API_PROXY_TARGET: 'http://127.0.0.1:8001',
      },
    });
  } catch (error) {
    failure = error;
  } finally {
    try {
      await execute('docker', [...composeArgs, 'down', '--volumes', '--remove-orphans'], {
        cwd: repositoryDirectory,
        env: process.env,
      });
    } catch (cleanupError) {
      if (failure === undefined) failure = cleanupError;
      else logError('Не удалось удалить временный E2E-стек:', cleanupError);
    }
  }

  if (failure !== undefined) throw failure;
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (invokedPath === import.meta.url) {
  runE2E().catch((error) => {
    logError(error);
    process.exitCode = 1;
  });
}
