// server/run.ts
import { spawn } from 'child_process';

console.log('🚀 Запуск TypeScript сервера через ts-node...');

const serverProcess = spawn('npx', ['ts-node', '--esm', 'server/test-server.ts'], {
  stdio: 'inherit',
  shell: true
});

serverProcess.on('close', (code) => {
  console.log(`❌ Сервер завершился с кодом: ${code}`);
});