import { listPublicRepos } from "./github.js";
import { scanRepository } from "./metrics.js";

const CACHE_TTL_SECONDS = 3 * 24 * 60 * 60;
const jsonHeaders = { "content-type": "application/json; charset=utf-8" };

function responseJson(body, status, origin) {
  return new Response(JSON.stringify(body, null, 2), {
    status: status || 200,
    headers: {
      ...jsonHeaders,
      "cache-control": "public, max-age=60, stale-while-revalidate=300",
      "access-control-allow-origin": origin || "*",
      "access-control-allow-methods": "GET, OPTIONS",
      "access-control-allow-headers": "Content-Type"
    }
  });
}

function repoKey(fullName) {
  return "repo:" + fullName.toLowerCase();
}

async function readRepoIndex(env, owner) {
  return await env.CACHE.get("index:" + owner.toLowerCase(), "json") || [];
}

async function writeRepoIndex(env, owner, repositories) {
  await env.CACHE.put("index:" + owner.toLowerCase(), JSON.stringify(repositories), {
    expirationTtl: CACHE_TTL_SECONDS
  });
}

async function saveScan(env, owner, result) {
  await env.CACHE.put(repoKey(result.repo.full_name), JSON.stringify(result), {
    expirationTtl: CACHE_TTL_SECONDS
  });
  const index = await readRepoIndex(env, owner);
  const updated = index.map((item) => item.full_name.toLowerCase() === result.repo.full_name.toLowerCase()
    ? { ...item, scan: result }
    : item);
  await writeRepoIndex(env, owner, updated);
}

async function refreshOwner(owner, env) {
  if (!owner) throw new Error("Set GITHUB_OWNER in Worker variables");
  const repos = await listPublicRepos(owner, env);
  const index = await Promise.all(repos.map(async (repo) => {
    const previous = await env.CACHE.get(repoKey(repo.full_name), "json");
    return { ...repo, scan: previous || null };
  }));
  await writeRepoIndex(env, owner, index);

  if (env.SCANS) {
    for (let start = 0; start < repos.length; start += 100) {
      await env.SCANS.sendBatch(repos.slice(start, start + 100).map((repo) => ({
        body: { owner, full_name: repo.full_name }
      })));
    }
  } else {
    for (const repo of repos) {
      try {
        await saveScan(env, owner, await scanRepository(repo, env));
      } catch {
        // Keep the last successful snapshot when one repository cannot be scanned.
      }
    }
  }
}

async function handleRequest(request, env) {
  const url = new URL(request.url);
  const owner = url.searchParams.get("owner") || env.GITHUB_OWNER || "CyanAutomation";
  const origin = env.CORS_ORIGIN || "*";
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "access-control-allow-origin": origin,
        "access-control-allow-methods": "GET, OPTIONS",
        "access-control-allow-headers": "Content-Type",
        "access-control-max-age": "86400"
      }
    });
  }
  if (request.method !== "GET") return responseJson({ error: "Method not allowed" }, 405, origin);
  if (url.pathname === "/healthz") return responseJson({ ok: true, service: "testacoda" }, 200, origin);

  if (url.pathname === "/v1/repos") {
    const repositories = await readRepoIndex(env, owner);
    return responseJson({
      owner,
      scanned_at: repositories.reduce((latest, item) => {
        const stamp = item.scan && item.scan.scanned_at;
        return stamp && stamp > latest ? stamp : latest;
      }, ""),
      repositories
    }, 200, origin);
  }

  const match = url.pathname.match(/^\/v1\/repos\/([^/]+)\/([^/]+)$/);
  if (match) {
    const fullName = decodeURIComponent(match[1]) + "/" + decodeURIComponent(match[2]);
    const result = await env.CACHE.get(repoKey(fullName), "json");
    if (!result) return responseJson({ error: "No scan found", repo: fullName }, 404, origin);
    return responseJson(result, 200, origin);
  }
  return responseJson({ error: "Not found" }, 404, origin);
}

export default {
  async fetch(request, env) {
    try {
      return await handleRequest(request, env);
    } catch (error) {
      return responseJson({ error: error.message || "Internal server error" }, 500, env.CORS_ORIGIN || "*");
    }
  },

  async scheduled(_event, env, ctx) {
    ctx.waitUntil(refreshOwner(env.GITHUB_OWNER || "CyanAutomation", env));
  },

  async queue(batch, env) {
    for (const message of batch.messages) {
      try {
        const { owner, full_name: fullName } = message.body;
        const [repoOwner, repoName] = fullName.split("/");
        const repo = {
          ...(await (await import("./github.js")).githubJson(
            "https://api.github.com/repos/" + fullName, env
          )),
          owner: { login: repoOwner },
          name: repoName
        };
        await saveScan(env, owner, await scanRepository(repo, env));
        message.ack();
      } catch {
        message.retry();
      }
    }
  }
};
