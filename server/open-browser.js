// Apre il browser predefinito su un URL locale.
import { exec } from 'node:child_process';

export function openBrowser(url) {
  // Solo URL semplici (http://localhost:PORTA): niente caratteri speciali da passare alla shell.
  if (!/^http:\/\/localhost:\d+\/?$/.test(url)) return;
  const command =
    process.platform === 'win32' ? `start "" "${url}"`
    : process.platform === 'darwin' ? `open "${url}"`
    : `xdg-open "${url}"`;
  exec(command, { windowsHide: true }, (err) => {
    if (err) console.warn(`  Non riesco ad aprire il browser: apri tu ${url}`);
  });
}
