import { backupPresentation, loadProjects, type DisplayProject } from "../portfolio/src/backup-data.ts";

declare global {
  interface Window {
    TESTACODA_API_BASE?: string;
  }
}

function element<T extends HTMLElement = HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing backup portfolio element #${id}`);
  return found as T;
}

const OWNER = "CyanAutomation";
const API_BASE = window.TESTACODA_API_BASE || "";
const state: { projects: DisplayProject[]; index: number } = { projects: [], index: 0 };

function render(): void {
  const project = state.projects[state.index];
  if (!project) return;
  const view = backupPresentation(project, state.index, state.projects.length);
  element("counter").textContent = view.counter;
  element("name").textContent = view.name;
  element("description").textContent = view.description;
  element("preview-label").textContent = view.previewLabel;
  element("preview-stars").textContent = view.stars;
  element("preview-language").textContent = view.language;
  element("preview-health").textContent = view.maturity;
  element("loc").textContent = view.loc;
  element("tests").textContent = view.tests;
  element("release").textContent = view.release;
  element("updated").textContent = view.updated;
  element<HTMLAnchorElement>("repo-link").href = view.url;
  const chips = element("chips");
  chips.innerHTML = "";
  view.chips.forEach((text) => {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.textContent = text;
    chips.append(chip);
  });
  element("position").textContent = view.position;
  element<HTMLElement>("progress").style.width = view.progress;
}

function move(delta: number): void {
  if (!state.projects.length) return;
  state.index = (state.index + delta + state.projects.length) % state.projects.length;
  render();
}

element("prev").addEventListener("click", () => move(-1));
element("next").addEventListener("click", () => move(1));
document.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft") move(-1);
  if (event.key === "ArrowRight") move(1);
});

void loadProjects(API_BASE, fetch, () => { element("status").textContent = "Using GitHub fallback"; }).then((projects) => {
  state.projects = projects;
  if (!projects.length) throw new Error("No public repositories were returned");
  element("status").textContent = API_BASE ? "GitHub + Testacoda" : "Live GitHub data";
  render();
}).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Could not load repositories";
  element("counter").textContent = "Portfolio is ready";
  element("name").textContent = "Could not load repositories";
  element("description").textContent = `${message}. Check your connection and try again.`;
  element("status").textContent = "GitHub API unavailable";
});

export {};
