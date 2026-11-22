import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// End-to-end tests (`npm run test:e2e`): a production build (`next build &&
// next start`) on a free port, against the local Supabase stack.

/** A free TCP port, picked once in the main process; workers inherit it through the environment. */
function freePort(): number {
  const script = "const s=require('net').createServer();s.listen(0,'127.0.0.1',()=>{console.log(s.address().port);s.close()})";
  return Number(execFileSync(process.execPath, ["-e", script], { encoding: "utf8" }).trim());
}
process.env.E2E_PORT ??= String(freePort());
const port = Number(process.env.E2E_PORT);
// E2E_BASE_URL runs against a server already started (`next start`), skipping the build.
const existing = process.env.E2E_BASE_URL;

// The container's preinstalled chromium, when the bundled revision isn't installed (never run `playwright install` here).
const PREINSTALLED = "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  timeout: 60_000,
  use: {
    baseURL: existing ?? `http://127.0.0.1:${port}`,
    trace: "off",
    screenshot: "off",
    video: "off",
    timezoneId: "Europe/London",
    locale: "en-GB",
    launchOptions: existsSync(PREINSTALLED) ? { executablePath: PREINSTALLED } : {},
  },
  projects: [{ name: "phone", use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 } } }],
  webServer: existing
    ? undefined
    : {
        command: `npm run build && npm run start -- -p ${port} -H 127.0.0.1`,
        url: `http://127.0.0.1:${port}/login`,
        reuseExistingServer: false,
        timeout: 300_000,
        stdout: "ignore",
        stderr: "pipe",
      },
});
