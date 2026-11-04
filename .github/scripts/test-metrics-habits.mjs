import assert from "node:assert/strict"
import {readFileSync} from "node:fs"

// Test the actual patched plugin while refusing any language-analysis request.
const source = readFileSync(process.argv[2], "utf8")
  .replace(/^import .*$/m, "const recent_analyzer = () => { throw new Error('Language analysis must stay disabled') }")
  .replace("export default async function", "return async function")
const run = new Function("console", source)({debug() {}})
const login = "test-user"

async function check(name, payload, expectedRequests) {
  const requests = []
  const inputs = {from: 100, days: 30, facts: true, charts: true, "charts.type": "classic", trim: false, "languages.limit": 0, "languages.threshold": "0%", skipped: []}
  const data = {config: {timezone: {offset: 0}}, shared: {"repositories.skipped": [], "commits.authoring": [login]}}
  const rest = {
    activity: {listEventsForAuthenticatedUser: async () => ({data: [{type: "PushEvent", actor: {login}, repo: {name: "test-user/example"}, created_at: new Date().toISOString(), payload}]})},
    request: async commit => {
      requests.push(commit.url)
      return {data: {author: {login}, commit: {author: {name: login}}, files: [{filename: "example.txt", patch: "+    first line\n+    second line"}]}}
    },
  }
  const imports = {
    metadata: {plugins: {habits: {enabled: () => true, inputs: () => inputs, extras: () => true}}},
    filters: {repo: () => true}, paths: {basename: path => path.split("/").pop()}, format: {error: error => error},
  }
  const habits = await run({login, data, rest, imports, q: {habits: true}, account: "user"}, {enabled: true, extras: true})
  assert.deepEqual(requests, expectedRequests)
  assert.equal(habits.linguist.available, false)
  assert.deepEqual(habits.linguist.ordered, [])
  assert.equal(typeof habits.commits.hour, "string")
  assert.ok(habits.commits.day)
  if (expectedRequests.length) {
    assert.equal(habits.indents.style, "spaces")
    assert.ok(habits.lines.average.chars > 0)
  }
  console.log(`PASS: ${name}`)
}

await check("current push events produce facts without language analysis", {head: "current-head"}, ["/repos/test-user/example/commits/current-head"])
await check("legacy push events remain supported", {commits: [{url: "/repos/test-user/example/commits/legacy-head"}]}, ["/repos/test-user/example/commits/legacy-head"])
await check("incomplete push events retain timing facts without fetching patches", {}, [])
