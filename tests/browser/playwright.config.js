// Playwright config for the browser suite.
//
// This is the ONE place npm enters either repo, and it is deliberately fenced: CI only, never
// `bin/setup`, never a dependency of the app, never anything a contributor needs to run
// `nest test`. Hatch itself stays pure Brood; this is the demo exercising a browser, because a
// browser is the only thing that can.
//
// It earns the exception. The 0.21.0 review found seven bugs in the client that no test in
// either repo could reach — a binding that pushed its event and then let the page reload out
// from under the session, a rejoin that fired twice on every load, a DOM merge that produced
// duplicates. Every one needed a real DOM and a real socket.

const PORT = process.env.HATCH_PORT || "5177";

module.exports = {
  testDir: __dirname,
  // Generous, because each test drives a real WebSocket round trip and CI is not fast.
  timeout: 30_000,
  expect: { timeout: 10_000 },
  // A flake here means a race in the client, not a slow machine — retrying would hide
  // exactly the class of bug this suite exists to catch.
  retries: 0,
  // One at a time: several of these share server state (the presence roster, a pubsub topic),
  // and a parallel run would have them stepping on each other rather than testing anything.
  workers: 1,
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "retain-on-failure",
  },
  // Playwright starts and stops the demo itself, so the suite is one command locally and in
  // CI. `reuseExistingServer` keeps a dev server you already have running from being killed.
  webServer: {
    command: "nest run",
    url: `http://127.0.0.1:${PORT}`,
    env: { HATCH_PORT: PORT },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    cwd: `${__dirname}/../..`,
  },
};
