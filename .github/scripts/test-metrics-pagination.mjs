import assert from "node:assert/strict"
import {readFileSync} from "node:fs"

// Exercise the actual patched collector with GitHub responses, including timeouts.
const source = readFileSync(process.argv[2], "utf8")
const start = source.indexOf("      //Query repositories from GitHub API")
const end = source.indexOf("      //Fetch missing packages count", start)
assert.ok(start >= 0 && end > start, "Repository collector is present")
const AsyncFunction = Object.getPrototypeOf(async function() {}).constructor
const collect = new AsyncFunction("data", "graphql", "queries", "repositories", "_batch", "account", "console", `
  const login = "test-user", forks = "", affiliations = ""
  ${source.slice(start, end)}
`)

async function check(name, {count, limit = 200, batch = 25, account = "user", failAt = [], expected = count, contributed = 0}) {
  const data = {user: {repositories: {nodes: []}, repositoriesContributedTo: {nodes: []}}}
  let requests = 0
  const graphql = async ({type, after, repositories: size}) => {
    requests++
    if (failAt.includes(requests)) throw new Error("GitHub query timed out")
    const offset = Number(after.match(/after: "(\d+)"/)?.[1] ?? 0)
    const total = type === "repositories" ? count : contributed
    const nodes = Array.from({length: Math.max(0, Math.min(size, total - offset))}, (_, i) => ({id: offset + i}))
    return {[account]: {[type]: {nodes, edges: nodes.map(({id}) => ({cursor: String(id + 1)}))}}}
  }
  await collect(data, graphql, {base: {repositories: input => input}}, limit, batch, account, {debug() {}})
  assert.equal(data.user.repositories.nodes.length, expected, name)
  assert.equal(new Set(data.user.repositories.nodes.map(r => r.id)).size, expected, "No duplicates after retries")
  if (account === "user") assert.equal(data.user.repositoriesContributedTo.nodes.length, Math.min(contributed, limit))
  console.log(`PASS: ${name}`)
}

await check("all repositories across multiple pages", {count: 146})
await check("retry the first page after a timeout", {count: 146, failAt: [1]})
await check("retry a later page without losing or duplicating results", {count: 146, failAt: [3]})
await check("apply the limit independently to both collections", {count: 300, expected: 200, contributed: 80})
await check("respect a partial final page at the configured limit", {count: 146, limit: 137, expected: 137})
await check("organization batch limit", {count: 70, batch: 100, account: "organization"})
