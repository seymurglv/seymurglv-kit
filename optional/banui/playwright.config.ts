import { mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { defineConfig, devices } from '@playwright/test'

// On macOS Firefox cannot open its data folder in the real home and exits
// before the first page. It gets an empty home of its own for the run.
function firefoxEnv(): Record<string, string> {
  const env: Record<string, string> = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) env[key] = value
  }
  if (process.platform === 'darwin') {
    const home = join(tmpdir(), 'banui-firefox-home')
    mkdirSync(home, { recursive: true })
    env.CFFIXED_USER_HOME = home
  }
  return env
}

export default defineConfig({
  testDir: 'tests/e2e',
  use: { baseURL: 'http://127.0.0.1:5179' },
  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:5179/demo/specimen.html',
    reuseExistingServer: true,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'], launchOptions: { env: firefoxEnv() } },
    },
  ],
})
