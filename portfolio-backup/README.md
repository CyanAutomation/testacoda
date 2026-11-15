# Portfolio HTML backup

Open index.html directly in a browser. The page is self-contained and loads public repositories from GitHub. Its script is generated from `backup.ts` into `index.html`; edit the TypeScript source and run `npm run build` from `portfolio/` to regenerate it. To show cached LOC, test, release, and maturity metrics after deploying Testacoda, set `window.TESTACODA_API_BASE` in `index.template.html` before the generated script placeholder, then rebuild.

This file is a fallback recreation of the published carousel. The original Sites source archive was not accessible from the current offline workspace, so this is not an exact source export.
