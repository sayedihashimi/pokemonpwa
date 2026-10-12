import { test, expect } from '@playwright/test';
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
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
  await expect(page.getByRole('button', { name: /^(Start camera|Take photo)$/ })).toBeVisible();
});
test('camera denial keeps photo upload available', async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { value: () => Promise.reject(new DOMException('Denied', 'NotAllowedError')) }); });
  await page.goto('./'); await page.getByRole('button', { name: /^(Start camera|Use live camera instead)$/ }).click();
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

test('Kyogre photo with background and sleeve matches Celebrations 003/025', async ({ page }) => {
  test.setTimeout(90000);
  const kyogre = { id: 'cel25-3', name: 'Kyogre', localId: '3' };
  const alternatives = [kyogre, { id: 'ex9-6', name: 'Kyogre', localId: '6' },
    { id: 'ecard2-133', name: 'Seer', localId: '133' }, { id: 'base1-3', name: 'Chansey', localId: '3' }];
  await page.route('https://api.tcgdex.net/v2/en/cards', route => route.fulfill({ json: [...alternatives,
    ...Array.from({ length: 100 }, (_, i) => ({ id: `test-${i}`, name: `Other ${i}`, localId: `${i}` }))] }));
  await page.route('https://api.tcgdex.net/v2/en/cards/cel25-3', route => route.fulfill({ json: {
    ...kyogre, set: { id: 'cel25', name: 'Celebrations', cardCount: { official: 25 } }, variants: { holo: true },
  } }));
  await page.goto('./');
  await page.getByLabel('Upload card photo').setInputFiles(fileURLToPath(new URL('../../assets/kyogre-3.jpg', import.meta.url)));
  await page.getByRole('button', { name: 'Identify card' }).click();
  await expect(page.locator('.match').first()).toContainText('Kyogre', { timeout: 60000 });
  await expect(page.locator('.match')).toHaveCount(1);
  await page.locator('.match').first().click();
  await expect(page.getByRole('heading', { name: 'Kyogre', exact: true })).toBeVisible();
  await expect(page.locator('.result')).toContainText('Celebrations');
  await expect(page.locator('.number-tag')).toHaveText('#3 / 25');
});

test('reflective Mega Charizard suggests its family, never Hala or an exact printing', async ({ page }) => {
  test.setTimeout(90000);
  const name = 'Mega Charizard X ex';
  const choices = [{ id: 'me02-130', name, localId: '130' }, { id: 'me02-013', name, localId: '013' },
    { id: 'sm2-126', name: 'Hala', localId: '126' }, { id: 'sm2-143', name: 'Hala', localId: '143' },
    { id: 'base1-4', name: 'Charizard', localId: '4' }, { id: 'other-130', name: 'Mega Charizard Y ex', localId: '130' }];
  await page.route('https://api.tcgdex.net/v2/en/cards', route => route.fulfill({ json: [...choices,
    ...Array.from({ length: 100 }, (_, i) => ({ id: `test-${i}`, name: `Other ${i}`, localId: `${i}` }))] }));
  await page.goto('./');
  await page.getByLabel('Upload card photo').setInputFiles(fileURLToPath(new URL('../../assets/mega-charizard-x-ex-94.jpg', import.meta.url)));
  await page.getByRole('button', { name: 'Identify card' }).click();
  await expect(page.locator('.notice')).toContainText('Possible name matches only', { timeout: 60000 });
  await expect(page.locator('.match')).toHaveCount(2);
  await expect(page.getByRole('button', { name: /Mega Charizard X ex.*130/ })).toBeVisible();
  await expect(page.locator('.match').filter({ hasText: 'Hala' })).toHaveCount(0);
  await expect(page.locator('.raw-price')).toHaveCount(0);
});

for (const device of ['iPhone', 'iPad desktop mode']) {
  test(`${device} uses system photo capture without requesting a video stream`, async ({ page }) => {
    await page.addInitScript(device => {
      Object.defineProperty(navigator, 'userAgent', { value: device === 'iPhone' ? 'iPhone' : 'Macintosh' });
      Object.defineProperty(navigator, 'platform', { value: device === 'iPhone' ? 'iPhone' : 'MacIntel' });
      Object.defineProperty(navigator, 'maxTouchPoints', { value: 5 });
      Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { value: () => { throw new Error('Unexpected video request'); } });
    }, device);
    await page.goto('./');
    await expect(page.getByLabel('Take card photo')).toHaveAttribute('capture', 'environment');
    await expect(page.getByLabel('Upload card photo')).not.toHaveAttribute('capture');
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Take photo', exact: true }).click();
    const picker = await chooser;
    expect(await picker.element().getAttribute('aria-label')).toBe('Take card photo');
    // Cancelling system capture must leave the scan controls usable.
    await page.getByLabel('Take card photo').dispatchEvent('cancel');
    await expect(page.getByRole('button', { name: 'Take photo', exact: true })).toBeEnabled();
    await picker.setFiles(fileURLToPath(new URL('../../assets/kyogre-3.jpg', import.meta.url)));
    await expect(page.getByRole('button', { name: 'Identify card' })).toBeVisible();
    await expect(page.locator('.photo-preview')).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
  });
}
