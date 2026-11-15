const API_ROOT = "https://api.github.com";

export interface GitHubEnvironment {
  GITHUB_TOKEN?: string;
  GITHUB_OWNER?: string;
}

export interface GitHubRepository {
  full_name: string;
  name: string;
  owner: { login: string };
  languages_url: string;
  default_branch: string;
  html_url: string;
  description?: string | null;
  pushed_at?: string | null;
  stargazers_count?: number;
  forks_count?: number;
  open_issues_count?: number;
  homepage?: string | null;
  private?: boolean;
  [key: string]: unknown;
}

export class GitHubApiError extends Error {
  readonly status: number;

  constructor(status: number, url: string) {
    super(`GitHub API returned ${status} for ${url}`);
    this.name = "GitHubApiError";
    this.status = status;
  }
}

export async function githubJson<T = unknown>(
  url: string,
  env: GitHubEnvironment = {}
): Promise<T> {
  const headers = new Headers({
    Accept: "application/vnd.github+json",
    "User-Agent": "testacoda-repo-maturity-scanner",
    "X-GitHub-Api-Version": "2022-11-28"
  });
  if (env.GITHUB_TOKEN) headers.set("Authorization", `Bearer ${env.GITHUB_TOKEN}`);

  const response = await fetch(url, { headers });
  if (!response.ok) throw new GitHubApiError(response.status, url);
  return await response.json() as T;
}

function isGitHubRepository(value: unknown): value is GitHubRepository {
  if (typeof value !== "object" || value === null) return false;
  const repository = value as Partial<GitHubRepository>;
  return typeof repository.full_name === "string" &&
    typeof repository.name === "string" &&
    typeof repository.owner?.login === "string" &&
    typeof repository.languages_url === "string" &&
    typeof repository.default_branch === "string" &&
    typeof repository.html_url === "string";
}

export async function listPublicRepos(
  owner: string,
  env: GitHubEnvironment = {}
): Promise<GitHubRepository[]> {
  const repos: GitHubRepository[] = [];
  for (let page = 1; page <= 10; page += 1) {
    const url = `${API_ROOT}/users/${encodeURIComponent(owner)}` +
      `/repos?type=public&sort=updated&per_page=100&page=${page}`;
    const batch: unknown = await githubJson(url, env);
    if (!Array.isArray(batch)) throw new Error("Unexpected repository list response");
    repos.push(...batch.filter(isGitHubRepository));
    if (batch.length < 100) break;
  }
  return repos.filter((repo) => !repo.private);
}
