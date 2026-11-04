const { test, expect } = require('@playwright/test');

for (const width of [1280, 390]) {
  test(`Hide and Show retain one open room workspace at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/index.html');
    await page.locator('#radsTab').click();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.locator('#rad_lounge_len').fill('4');
    await page.locator('#rad_lounge_wid').fill('3');
    const active = page.locator('.hl-room-editor.is-active');
    await active.getByRole('button', { name: 'Hide room', exact: true }).click();
    await expect(active).toHaveCount(1);
    await expect(active).toHaveAttribute('data-hl-room', 'hallway');
    await expect(page.locator('.hl-room-editor:visible')).toHaveCount(1);
    await expect(page.locator('#rad_hallway_len')).toBeVisible();
    await expect(active.locator(':scope > details > summary')).toBeHidden();
    await expect(page.locator('[data-hl-room-nav][aria-current="page"]')).toHaveCount(1);
    await expect(page.locator('[data-hl-room-nav="lounge"]')).toHaveCount(0);
    await page.locator('.hidden-room-pill-v50').filter({ hasText: 'Lounge' })
      .getByRole('button', { name: 'Show', exact: true }).click();
    await expect(active).toHaveAttribute('data-hl-room', 'hallway');
    await expect(page.locator('.hl-room-editor:visible')).toHaveCount(1);
    await page.locator('[data-hl-room-nav="lounge"]').click();
    await expect(page.locator('#rad_lounge_len')).toHaveValue('4');
    await expect(page.locator('#rad_lounge_wid')).toHaveValue('3');
    await expect(active.locator(':scope > details > summary')).toBeHidden();
    // Exercise the empty-room edge and restore without manufacturing state.
    const keys = await page.locator('[data-hl-room-nav]').evaluateAll(es => es.map(e => e.dataset.hlRoomNav));
    for (const key of keys) {
      await page.locator(`[data-hl-room-nav="${key}"]`).click();
      await active.getByRole('button', { name: 'Hide room', exact: true }).click();
      await expect(active).toHaveCount(key === keys.at(-1) ? 0 : 1);
    }
    await expect(page.locator('.hl-room-editor')).toHaveCount(0);
    await page.locator('.hidden-room-pill-v50').filter({ hasText: 'Lounge' })
      .getByRole('button', { name: 'Show', exact: true }).click();
    await expect(active).toHaveCount(1);
    await expect(page.locator('#rad_lounge_len')).toBeVisible();
    await expect(page.locator('#rad_lounge_len')).toHaveValue('4');
    expect(errors).toEqual([]);
  });
}
