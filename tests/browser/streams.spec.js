// The stream merge, in a real DOM.
//
// This is the half no server test reaches. The Brood suite can prove the server forgets a row
// once its frame is out; only a browser can prove the row is still on screen afterwards —
// which is the entire premise. Three of the review's findings were in `morphStream`.

const { test, expect } = require("@playwright/test");

async function connected(page) {
  await expect(page.locator("html")).toHaveClass(/brood-connected/, { timeout: 15_000 });
}

const rows = (page) => page.locator("#feed li");

test.describe("merge, not replace", () => {
  test("rows accumulate across patches although the server sends each one once", async ({ page }) => {
    await page.goto("/feed");
    await connected(page);
    await expect(rows(page)).toHaveCount(3);

    await page.locator("#add").click();
    await expect(rows(page)).toHaveCount(4);
    await page.locator("#add").click();
    await expect(rows(page)).toHaveCount(5);

    // The point: the server sent row 4 and row 5 once each and kept neither, yet all five are
    // here. A container that reconciled instead of merging would be showing only the last one.
    await expect(page.locator("#feed li#row-1")).toBeVisible();
    await expect(page.locator("#feed li#row-5")).toBeVisible();
  });

  test("a re-rendered row is morphed in place rather than duplicated", async ({ page }) => {
    await page.goto("/feed");
    await connected(page);
    await page.locator("#add").click();
    await expect(page.locator("#feed li#row-4")).toHaveCount(1);

    // Let several ticker patches go by. Each one re-renders the container; an id must still
    // appear exactly once afterwards.
    await page.waitForTimeout(4500);
    await expect(page.locator("#feed li#row-4")).toHaveCount(1);
    await expect(page.locator("#feed li#row-1")).toHaveCount(1);
  });

  test("prepended rows land at the top", async ({ page }) => {
    await page.goto("/feed");
    await connected(page);
    await page.locator("#add").click();
    // data-stream-at="0" puts a new row first, which is what a feed wants
    await expect(rows(page).first()).toHaveAttribute("id", "row-4");
  });
});

test.describe("removal", () => {
  test("a delete removes exactly that row", async ({ page }) => {
    await page.goto("/feed");
    await connected(page);
    await expect(rows(page)).toHaveCount(3);

    // A delete cannot be expressed by rendering what is left — the server does not know what
    // is left — so it arrives as an instruction naming the id. This is that path end to end.
    await page.locator("#feed li#row-2 button").click();
    await expect(page.locator("#feed li#row-2")).toHaveCount(0);
    await expect(page.locator("#feed li#row-1")).toHaveCount(1);
    await expect(page.locator("#feed li#row-3")).toHaveCount(1);
  });

  test("clear empties the browser's copy", async ({ page }) => {
    await page.goto("/feed");
    await connected(page);
    await page.locator("#pause").click(); // stop the ticker refilling it mid-assertion
    await page.locator("#clear").click();
    await expect(rows(page)).toHaveCount(0);
  });

  test("and the container merges again after a reset rather than staying in reset mode", async ({ page }) => {
    await page.goto("/feed");
    await connected(page);
    await page.locator("#pause").click();
    await page.locator("#clear").click();
    await expect(rows(page)).toHaveCount(0);

    // If the reset flag were not cleared after its one render, this row would arrive into a
    // container that empties itself first — and the list would never grow past one.
    await page.locator("#add").click();
    await expect(rows(page)).toHaveCount(1);
    await page.locator("#add").click();
    await expect(rows(page)).toHaveCount(2);
  });
});

test.describe("the ticker", () => {
  test("keeps adding rows without the page being touched", async ({ page }) => {
    await page.goto("/feed");
    await connected(page);
    await expect(rows(page)).toHaveCount(3);
    await expect(rows(page)).toHaveCount(4, { timeout: 6000 });
  });
});
