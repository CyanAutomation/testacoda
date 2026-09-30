const API_ROOT = "https://api.github.com";

export async function githubJson(url, env = {}) {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "testacoda-repo-maturity-scanner",
    "X-GitHub-Api-Version": "2022-11-28"
  };
  if (env.GITHUB_TOKEN) headers.Authorization = "Bearer " + env.GITHUB_TOKEN;

  const response = await fetch(url, { headers });
  if (!response.ok) {
    const error = new Error("GitHub API returned " + response.status + " for " + url);
    error.status = response.status;
    throw error;
  }
  return response.json();
}

export async function listPublicRepos(owner, env = {}) {
  const repos = [];
  for (let page = 1; page <= 10; page += 1) {
    const url = API_ROOT + "/users/" + encodeURIComponent(owner) +
      "/repos?type=public&sort=updated&per_page=100&page=" + page;
    const batch = await githubJson(url, env);
    if (!Array.isArray(batch)) throw new Error("Unexpected repository list response");
    repos.push(...batch);
    if (batch.length < 100) break;
  }
  return repos.filter((repo) => !repo.private);
}
