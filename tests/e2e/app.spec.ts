import { test, expect } from '@playwright/test';
import sharp from 'sharp';
const brief = { id: 'swsh3-136', name: 'Furret', localId: '136' };
const card = { ...brief, set: { id: 'swsh3', name: 'Darkness Ablaze', cardCount: { official: 189 } }, category: 'Pokemon', rarity: 'Uncommon', hp: 110, types: ['Colorless'], variants: { normal: true, reverse: true }, pricing: { tcgplayer: { unit: 'USD', updated: new Date().toISOString(), normal: { marketPrice: .27, productId: 219333 }, 'reverse-holofoil': { marketPrice: .43, productId: 219333 } } } };
test.beforeEach(async ({ page }) => {
  await page.route('https://api.tcgdex.net/v2/en/cards', route => route.fulfill({ json: Array.from({ length: 100 }, (_, i) => i === 0 ? brief : { id: `test-${i}`, name: `Other ${i}`, localId: `${i}` }) }));
  await page.route('https://api.tcgdex.net/v2/en/cards/swsh3-136', route => route.fulfill({ json: card }));
});
test('manual lookup confirms printing and uses exact prices', async ({ page }) => {
  await page.goto('./');
  await expect(page).toHaveTitle(/Goozemon/);
  await page.getByRole('tab', { name: 'Search manually' }).click();
  await page.getByLabel('Card name', { exact: true }).fill('Furret');
  await page.getByRole('button', { name: 'Find matching cards' }).click();
  await page.getByRole('button', { name: /Furret/ }).click();
  await expect(page.getByRole('heading', { name: 'Furret', exact: true })).toBeVisible();
  await expect(page.getByText('$0.27')).toHaveCount(0);
  await page.getByLabel('Confirm your printing').selectOption('normal');
  await expect(page.getByText('$0.27')).toBeVisible();
  await page.getByLabel('Confirm your printing').selectOption('reverse-holofoil');
  await expect(page.getByText('$0.43')).toBeVisible();
  await expect(page.getByRole('link', { name: 'View sold listings' })).toHaveCount(2);
  await expect(page.getByText('Unavailable', { exact: true })).toHaveCount(2);
  await expect(page.getByRole('link', { name: 'Inspect on TCGplayer' })).toHaveAttribute('href', 'https://www.tcgplayer.com/product/219333');
  await page.getByRole('button', { name: 'Scan another card', exact: true }).last().click();
  await expect(page.getByRole('button', { name: 'Start camera' })).toBeVisible();
});
test('camera denial keeps photo upload available', async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { value: () => Promise.reject(new DOMException('Denied', 'NotAllowedError')) }); });
  await page.goto('./'); await page.getByRole('button', { name: 'Start camera' }).click();
  await expect(page.getByRole('alert')).toContainText('Camera unavailable');
  await expect(page.getByRole('button', { name: 'Upload photo', exact: true })).toBeEnabled();
});
test('layout fits the viewport and privacy information opens', async ({ page }) => {
  await page.goto('./');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'About and install' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Close information' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('photo upload runs local OCR and finds the exact numbered card', async ({ page }) => {
  test.setTimeout(60000);
  const photo = await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="840"><rect width="600" height="840" fill="white"/><text x="65" y="58" font-family="Arial" font-size="38" font-weight="bold">Furret</text><text x="65" y="115" font-family="Arial" font-size="20">Evolves from Sentret</text><text x="65" y="797" font-family="Arial" font-size="24">136/189</text></svg>')).png().toBuffer();
  const uploadedRequests: string[] = [];
  page.on('request', request => { if (request.method() === 'POST') uploadedRequests.push(request.url()); });
  await page.goto('./');
  await page.getByLabel('Upload card photo').setInputFiles({ name: 'card.png', mimeType: 'image/png', buffer: photo });
  await page.getByRole('button', { name: 'Identify card' }).click();
  await expect(page.getByRole('button', { name: /Furret/ })).toBeVisible({ timeout: 45000 });
  expect(uploadedRequests).toEqual([]);
});
