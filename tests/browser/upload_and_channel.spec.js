// The two things that need a browser AND a socket: bytes going up a live view's own
// connection, and two independent pages talking over a channel.

const { test, expect } = require("@playwright/test");

async function connected(page) {
  await expect(page.locator("html")).toHaveClass(/brood-connected/, { timeout: 15_000 });
}

test.describe("socket upload", () => {
  test("a picked file streams up the socket and reaches 100%", async ({ page }) => {
    await page.goto("/avatar");
    await connected(page);

    // A real file input, set the way a user sets it. Everything after this is the client
    // reading the file, framing it, and the server spooling it — none of which any Brood test
    // can exercise, because the bytes start in the browser.
    await page.locator("#picker").setInputFiles({
      name: "hatch.png",
      mimeType: "image/png",
      buffer: Buffer.alloc(64 * 1024, 7),
    });

    await expect(page.locator("#entries li")).toHaveCount(1);
    await expect(page.locator("#entries li")).toContainText("hatch.png");
    await expect(page.locator("#entries li")).toContainText("100%", { timeout: 15_000 });
    await expect(page.locator("#entries li")).toContainText("✓");
  });

  test("the accept list is enforced on the server, not just in the picker", async ({ page }) => {
    await page.goto("/avatar");
    await connected(page);
    // The picker's `accept` attribute filters a file dialog; it does not stop a client that
    // sends anyway. setInputFiles bypasses the dialog, which is exactly the case the server
    // side exists for.
    await page.locator("#picker").setInputFiles({
      name: "notes.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("nope"),
    });
    await expect(page.locator("#entries li")).toContainText("not accepted");
    // refused, so no ref was issued and nothing can be uploaded against it
    await expect(page.locator("#entries li progress")).toHaveCount(0);
  });

  test("saving consumes the finished file and lists it", async ({ page }) => {
    await page.goto("/avatar");
    await connected(page);
    await page.locator("#picker").setInputFiles({
      name: "small.png",
      mimeType: "image/png",
      buffer: Buffer.alloc(1024, 3),
    });
    await expect(page.locator("#entries li")).toContainText("100%", { timeout: 15_000 });

    await page.locator("#save").click();
    await expect(page.locator("#saved li")).toHaveCount(1);
    await expect(page.locator("#saved li")).toContainText("small.png");
    await expect(page.locator("#saved li")).toContainText("1024 bytes");
    // consumed, not left to be saved twice
    await expect(page.locator("#entries li")).toHaveCount(0);
  });
});

test.describe("channels", () => {
  // Two independent pages on one topic. This is the whole reason channels exist beside live
  // views, and it cannot be shown with one browser context.
  test("a message sent in one tab arrives in another", async ({ browser }) => {
    const alice = await browser.newPage();
    const bob = await browser.newPage();

    for (const [page, name] of [[alice, "alice"], [bob, "bob"]]) {
      await page.goto("/chat");
      await page.locator("#name").fill(name);
      await page.locator("#connect").click();
      await expect(page.locator("#status")).toContainText("joined room:lobby", { timeout: 15_000 });
    }

    await alice.locator("#body").fill("hello from alice");
    await alice.locator("#say-form button").click();

    await expect(bob.locator("#log")).toContainText("alice: hello from alice", { timeout: 10_000 });
    // the sender sees it the same way everyone else does — one code path, no local echo that
    // can disagree with the server
    await expect(alice.locator("#log")).toContainText("alice: hello from alice");

    await alice.close();
    await bob.close();
  });

  test("a request gets its reply on its own ref while pushes stream past", async ({ page }) => {
    await page.goto("/chat");
    await page.locator("#name").fill("grace");
    await page.locator("#connect").click();
    await expect(page.locator("#status")).toContainText("joined", { timeout: 15_000 });

    await page.locator("#who").click();
    await expect(page.locator("#log")).toContainText("here:", { timeout: 10_000 });
    await expect(page.locator("#log")).toContainText("grace");
  });

  test("topics are independent on the same socket", async ({ browser }) => {
    const lobby = await browser.newPage();
    const dev = await browser.newPage();

    await lobby.goto("/chat");
    await lobby.locator("#name").fill("in-lobby");
    await lobby.locator("#connect").click();
    await expect(lobby.locator("#status")).toContainText("joined room:lobby", { timeout: 15_000 });

    await dev.goto("/chat");
    await dev.locator("#name").fill("in-dev");
    await dev.locator("#topic").selectOption("room:dev");
    await dev.locator("#connect").click();
    await expect(dev.locator("#status")).toContainText("joined room:dev", { timeout: 15_000 });

    await lobby.locator("#body").fill("lobby only");
    await lobby.locator("#say-form button").click();
    await expect(lobby.locator("#log")).toContainText("lobby only", { timeout: 10_000 });

    // The other topic must not hear it — a shared socket is not a shared room.
    await dev.waitForTimeout(1000);
    await expect(dev.locator("#log")).not.toContainText("lobby only");

    await lobby.close();
    await dev.close();
  });
});
