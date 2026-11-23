import {
  countSource,
  isSource,
  isTest,
  selectFiles,
  type PortfolioRepository,
  type PortfolioSnapshot,
  type ProjectMetrics,
  type SourceTreeEntry
} from "./data.ts";

const OWNER = "CyanAutomation";

interface GitHubRepository extends PortfolioRepository {
  full_name: string;
  owner: { login: string };
  pushed_at: string;
  default_branch: string;
  private?: boolean;
}

interface GitHubRelease {
  tag_name?: string;
  published_at?: string | null;
}

interface GitHubTree {
  sha: string;
  tree: SourceTreeEntry[];
  truncated?: boolean;
}

async function github<T>(path: string, env: Pick<Env, "GITHUB_TOKEN">): Promise<T> {
  const headers = new Headers({
    "User-Agent": "testacoda-project-collection",
    Accept: "application/vnd.github+json"
  });
  if (env.GITHUB_TOKEN) headers.set("Authorization", `Bearer ${env.GITHUB_TOKEN}`);
  const response = await fetch(`https://api.github.com/${path}`, { headers });
  if (!response.ok) throw new Error(`GitHub ${response.status}`);
  return await response.json() as T;
}

async function listRepositories(env: Pick<Env, "GITHUB_TOKEN">): Promise<GitHubRepository[]> {
  const repos: GitHubRepository[] = [];
  for (let page = 1; page <= 10; page += 1) {
    const batch: unknown = await github(
      `users/${OWNER}/repos?type=owner&per_page=100&page=${page}`,
      env
    );
    if (!Array.isArray(batch)) throw new Error("Unexpected repository list response");
    repos.push(...batch.filter(isGitHubRepository).filter((repo) => !repo.private && repo.owner.login === OWNER));
    if (batch.length < 100) break;
  }
  return repos;
}

function carryForwardProjects(
  repos: GitHubRepository[],
  existing: Record<string, ProjectMetrics>
): Record<string, ProjectMetrics> {
  const projects: Record<string, ProjectMetrics> = {};
  for (const repo of repos) {
    const previous = existing[repo.name];
    if (previous) projects[repo.name] = previous;
  }
  return projects;
}

function selectRefreshTarget(
  repos: GitHubRepository[],
  projects: Record<string, ProjectMetrics>
): GitHubRepository | undefined {
  return [...repos].sort((a, b) => {
    const x = projects[a.name];
    const y = projects[b.name];
    return Number(Boolean(x && x.pushed_at === a.pushed_at)) - Number(Boolean(y && y.pushed_at === b.pushed_at)) ||
      (x?.time || 0) - (y?.time || 0);
  })[0];
}

async function scanProjectFiles(
  target: GitHubRepository,
  tree: GitHubTree
): Promise<Pick<ProjectMetrics, "loc" | "tests" | "scanned" | "partial">> {
  const treeEntries = tree.tree || [];
  const selected = selectFiles(treeEntries);
  let lines = 0;
  let tests = 0;
  let scanned = 0;
  let partial = selected.partial || Boolean(tree.truncated);

  for (const file of selected.files) {
    try {
      const url = `https://raw.githubusercontent.com/${target.full_name}/${tree.sha}/` +
        `${file.path.split("/").map(encodeURIComponent).join("/")}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("file unavailable");
      const result = countSource(await response.text(), isTest(file.path));
      lines += result.lines;
      tests += result.tests;
      scanned += 1;
    } catch {
      partial = true;
    }
  }

  return { loc: scanned ? lines : null, tests: scanned ? tests : null, scanned, partial };
}

async function scanProject(target: GitHubRepository, env: Pick<Env, "GITHUB_TOKEN">): Promise<ProjectMetrics> {
  const base = `repos/${target.full_name}`;
  const [languages, release, tree] = await Promise.all([
    github<Record<string, number>>(`${base}/languages`, env),
    github<GitHubRelease>(`${base}/releases/latest`, env).catch((error: unknown) => {
      if (error instanceof Error && error.message === "GitHub 404") return null;
      throw error;
    }),
    github<GitHubTree>(`${base}/git/trees/${encodeURIComponent(target.default_branch)}?recursive=1`, env)
  ]);
  const scan = await scanProjectFiles(target, tree);
  const treeEntries = tree.tree || [];

  return {
    pushed_at: target.pushed_at,
    sha: tree.sha,
    time: Date.now(),
    languages,
    release: release?.tag_name || null,
    releasePublishedAt: release?.published_at || null,
    ...scan,
    testfiles: treeEntries.filter((file) => file.type === "blob" && isSource(file.path) && isTest(file.path)).length,
    paths: treeEntries.filter((file) => file.type === "blob").slice(0, 100).map((file) => file.path)
  };
}

function isGitHubRepository(value: unknown): value is GitHubRepository {
  if (typeof value !== "object" || value === null) return false;
  const repository = value as Partial<GitHubRepository>;
  return typeof repository.name === "string" &&
    typeof repository.full_name === "string" &&
    typeof repository.owner?.login === "string" &&
    typeof repository.pushed_at === "string" &&
    typeof repository.default_branch === "string";
}

export async function refresh(env: Env): Promise<void> {
  const old = await env.SNAPSHOTS.get<PortfolioSnapshot>("snapshot", "json");
  const repos = await listRepositories(env);
  if (!repos.length && old?.repos?.length) {
    throw new Error("GitHub returned an empty repository list; preserving the previous snapshot");
  }
  const projects = carryForwardProjects(repos, old?.projects || {});
  const target = selectRefreshTarget(repos, projects);

  if (target) {
    try {
      projects[target.name] = await scanProject(target, env);
    } catch (error) {
      console.error(JSON.stringify({ event: "project_refresh_failed", project: target.name, error: String(error) }));
    }
  }

  await env.SNAPSHOTS.put("snapshot", JSON.stringify({
    updatedAt: new Date().toISOString(),
    repos,
    projects
  } satisfies PortfolioSnapshot));
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/api/snapshot") {
      const snapshot = await env.SNAPSHOTS.get("snapshot");
      return snapshot
        ? new Response(snapshot, { headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=60" } })
        : new Response(JSON.stringify({ error: "Snapshot not available yet" }), {
          status: 503,
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
        });
    }
    return env.ASSETS.fetch(request);
  },

  scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): void {
    ctx.waitUntil(refresh(env));
  }
} satisfies ExportedHandler<Env>;
