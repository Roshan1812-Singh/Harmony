import { test, expect } from '@playwright/test';

test('landing renders and links to auth', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Free music for everyone/i })).toBeVisible();
  await page.getByRole('link', { name: 'Start listening' }).click();
  await expect(page).toHaveURL(/\/auth\/register/);
});
