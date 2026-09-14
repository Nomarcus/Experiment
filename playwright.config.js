import {defineConfig,devices} from '@playwright/test';
export default defineConfig({
  testDir:'./tests/e2e',fullyParallel:true,timeout:45000,
  use:{baseURL:'http://localhost:4173',trace:'retain-on-failure'},
  projects:[{name:'desktop',use:{...devices['Desktop Chrome']}},{name:'mobile',use:{...devices['iPhone 13'],defaultBrowserType:'chromium'}}],
  webServer:{command:'npm start',url:'http://localhost:4173',reuseExistingServer:!process.env.CI},
});
