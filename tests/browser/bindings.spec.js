// The client bindings, in a real browser — the half no Brood test can see.
//
// Each case here corresponds to something the 0.21.0 review found by reading, which is the
// argument for the suite existing: reading found them, but only after they shipped.

const { test, expect } = require("@playwright/test");

// The live client sets `brood-connected` on <html> once the socket is up. Waiting on that
// rather than on a timeout is what keeps these from being flaky.
async function connected(page) {
  await expect(page.locator("html")).toHaveClass(/brood-connected/, { timeout: 15_000 });
}

test.describe("hooks", () => {
  test("a hook mounts and draws into its own element", async ({ page }) => {
    await page.goto("/bindings");
    await connected(page);
    // The server renders an empty <div data-hook>; the <svg> can only come from the hook.
    await expect(page.locator("#spark svg")).toBeVisible();
    await expect(page.locator("#spark polyline")).toHaveAttribute("points", /\d/);
  });

  test("data-update=ignore keeps the morph out of the hook's subtree", async ({ page }) => {
    await page.goto("/bindings");
    await connected(page);
    const svg = page.locator("#spark svg");
    await expect(svg).toBeVisible();

    // Force several server patches (the ticker fires every second) and confirm the hook's own
    // DOM survives them. Without data-update="ignore" the morph would replace the <svg> with
    // the empty container the server rendered, and the chart would vanish on the next update.
    const before = await page.locator("#spark polyline").getAttribute("points");
    await page.waitForTimeout(2500);
    await expect(svg).toBeVisible();
    const after = await page.locator("#spark polyline").getAttribute("points");
    // still drawn, and redrawn — `updated` fired because the server changed data-points
    expect(after).not.toBe(before);
  });
});

test.describe("debounce", () => {
  test("typing fast produces one round trip, not one per keystroke", async ({ page }) => {
    await page.goto("/bindings");
    await connected(page);
    await expect(page.locator("#searches")).toHaveText("0");

    // Eight characters well inside the 300ms window.
    await page.locator("#search").pressSequentially("hatchery", { delay: 20 });
    await expect(page.locator("#searches")).toHaveText("1", { timeout: 5000 });
    // and the value that arrived is the whole word, not its first letter
    await expect(page.locator("#bindings-query, body")).toContainText("hatchery");
  });

  test("leaving the field flushes what it was holding", async ({ page }) => {
    await page.goto("/bindings");
    await connected(page);
    await page.locator("#search").fill("ada");
    // Blur immediately — well inside the debounce window. The flush on focusout is what makes
    // this arrive at all; without it the user waits out the timer to see any result.
    await page.locator("#keys").focus();
    await expect(page.locator("#searches")).toHaveText("1", { timeout: 2000 });
  });
});

test.describe("throttle", () => {
  // The case hatch deliberately differs from Phoenix on: a throttled VALUE gets a trailing
  // send, so the server ends on what the user released rather than on whatever the last
  // in-window event happened to be.
  test("a dragged slider ends on the value it was released at", async ({ page }) => {
    await page.goto("/bindings");
    await connected(page);
    const slider = page.locator("#level");
    for (const value of ["10", "30", "60", "90", "97"]) {
      await slider.fill(value);
      await page.waitForTimeout(40);
    }
    await expect(page.locator("#level-out")).toHaveText("97", { timeout: 5000 });
  });

  // And the opposite for an ACTION: replaying a throttled click late is a second click, so the
  // extras are dropped outright.
  test("a throttled button drops its extra presses rather than replaying them", async ({ page }) => {
    await page.goto("/bindings");
    await connected(page);
    for (let i = 0; i < 5; i++) {
      await page.locator("#burst").click();
      await page.waitForTimeout(30);
    }
    await page.waitForTimeout(1500);
    // one leading-edge send; the rest fell inside the 1000ms window and were dropped
    await expect(page.locator("#bursts")).toHaveText("1");
  });
});

test.describe("data-on and data-js", () => {
  test("a key filter keeps unwanted keystrokes off the wire", async ({ page }) => {
    await page.goto("/bindings");
    await connected(page);
    await page.locator("#keys").pressSequentially("abc");
    await page.waitForTimeout(500);
    await expect(page.locator("#last-key")).toHaveText("");

    await page.locator("#keys").press("Enter");
    await expect(page.locator("#last-key")).toHaveText("Enter", { timeout: 5000 });
  });

  test("a client command runs with no server round trip", async ({ page }) => {
    await page.goto("/bindings");
    await connected(page);
    const panel = page.locator("#panel");
    await expect(panel).toBeHidden();
    await page.locator("#toggle").click();
    await expect(panel).toBeVisible();
    await page.locator("#toggle").click();
    await expect(panel).toBeHidden();
  });
});
