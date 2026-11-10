import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { setTimeout as sleep } from "node:timers/promises";

// Choose an unused local port. All credentials are synthetic, and the database
// URL is deliberately local: this check must never touch deployment data.
const probe = createServer();
probe.listen(0, "127.0.0.1");
await once(probe, "listening");
const port = probe.address().port;
await new Promise((resolve, reject) => probe.close((error) => error ? reject(error) : resolve()));
const origin = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(port)], {
  env: {
    ...process.env,
    NODE_ENV: "production",
    DATABASE_URL: "postgresql://test:test@127.0.0.1:5432/ngtz_smoke_never_connect",
    NEXTAUTH_URL: origin,
    NEXTAUTH_SECRET: "local-smoke-test-not-a-production-secret",
    GOOGLE_CLIENT_ID: "smoke-test-google",
    GOOGLE_CLIENT_SECRET: "smoke-test-google-secret",
    GITHUB_CLIENT_ID: "smoke-test-github",
    GITHUB_CLIENT_SECRET: "smoke-test-github-secret",
    NEXT_TELEMETRY_DISABLED: "1",
  },
  stdio: ["ignore", "pipe", "pipe"],
});
let output = "";
let startupError;
server.on("error", (error) => { startupError = error; });
server.stdout.on("data", (chunk) => { output += chunk; });
server.stderr.on("data", (chunk) => { output += chunk; });
let checks = 0;
async function get(path) {
  return fetch(`${origin}${path}`, { redirect: "manual", signal: AbortSignal.timeout(5000) });
}
try {
  let ready = false;
  for (let attempt = 0; attempt < 120; attempt++) {
    if (startupError) throw startupError;
    if (server.exitCode !== null) throw new Error(`Server exited early: ${server.exitCode}`);
    try {
      if ((await get("/login")).status === 200) { ready = true; break; }
    } catch { /* Wait for the listener. */ }
    await sleep(250);
  }
  assert.ok(ready, "production server became ready");
  const login = await get("/login");
  assert.equal(login.status, 200);
  assert.match(await login.text(), /NGTZ/);
  checks++;

  for (const path of ["/", "/dashboard", "/analytics", "/settings"]) {
    const response = await get(path);
    assert.equal(response.status, 307, `${path}: unauthenticated redirect`);
    assert.equal(new URL(response.headers.get("location"), origin).pathname, "/login");
    checks++;
  }
  for (const path of ["/api/habits", "/api/logs", "/api/analytics", "/api/account"]) {
    const response = await get(path);
    assert.equal(response.status, 401, `${path}: authentication required`);
    assert.deepEqual(await response.json(), { error: "Unauthorized" });
    checks++;
  }
  const write = await fetch(`${origin}/api/logs`, {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: "{}",
    signal: AbortSignal.timeout(5000),
  });
  assert.equal(write.status, 401);
  checks++;

  const providers = await get("/api/auth/providers");
  assert.equal(providers.status, 200);
  assert.deepEqual(Object.keys(await providers.json()).sort(), ["github", "google"]);
  checks++;
  const session = await get("/api/auth/session");
  assert.equal(session.status, 200);
  assert.deepEqual(await session.json(), {});
  checks++;
  const csrf = await get("/api/auth/csrf");
  assert.equal(csrf.status, 200);
  assert.equal(typeof (await csrf.json()).csrfToken, "string");
  assert.ok(csrf.headers.get("set-cookie"));
  checks++;
  console.log(`Production HTTP smoke: ${checks} checks passed. No OAuth exchange or database connection was made.`);
} catch (error) {
  console.error(output);
  throw error;
} finally {
  if (server.exitCode === null) {
    server.kill("SIGTERM");
    await Promise.race([once(server, "exit"), sleep(5000)]);
    if (server.exitCode === null) server.kill("SIGKILL");
  }
}
