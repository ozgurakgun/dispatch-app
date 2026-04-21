# Workflow for agents and contributors

## Pull requests

- **Record prompts in the PR:** As the work evolves, add the user’s prompts **verbatim** (or clearly labeled quotes) as **PR comments** so the thread stays an audit trail of what was asked and when. Prefer one comment per request or a short numbered list if many small tweaks land in one push.
- **Commit as you go:** Make **small, logical commits** while implementing (e.g. fix, feat, docs, ci) instead of one large squashed change, unless the repo owner asks otherwise.

## CI

- Run `npm run lint` and `npm run build` locally before pushing when you touch app or workflow code.

## Deploy (Render)

- See `README.md` (Render section) and `render.yaml` for static site deployment and the GitHub deploy hook secret.
