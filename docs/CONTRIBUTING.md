# Contributing to Sentinel

Want to help? Great. Here's how we work.

## Getting Started

1. Fork the repository
2. Clone your fork
3. Install dependencies: `pnpm install`
4. Copy `.env.example` to `.env` and fill in values
5. Start Postgres and Redis (Docker or local)
6. Run migrations: `pnpm db:push`
7. Start dev server: `pnpm dev`
8. Start workers: `pnpm workers:dev`

## Development Workflow

### Before You Code

- Check existing issues and PRs
- For significant changes, open an issue first to discuss
- Small fixes and improvements can go straight to PR

### While Coding

```bash
# Type checking
pnpm tsc --noEmit

# Lint
pnpm lint

# Test database queries
pnpm db:studio
```

### Commits

Write clear commit messages:

```
Add review saturation monitoring

- Compute active reviewer count from PR review events
- Track saturation as ratio of pending reviews to reviewers
- Add hourly job schedule (9am-6pm weekdays)
```

Not:

```
fix stuff
```

### Pull Requests

- Keep PRs focused on one thing
- Include context on why, not just what
- Update docs if you changed behavior
- Add yourself to contributors if you want

## Project Structure

```
src/
├── app/           # Next.js routes and pages
├── server/        # tRPC routers and database
├── workers/       # BullMQ job processors
├── jobs/          # Job definitions
├── alerts/        # Alert rules engine
├── analysis/      # AI detection heuristics
├── integrations/  # External services (Slack, etc.)
├── components/    # React components
└── lib/           # Shared utilities
```

## Areas That Need Help

### Good First Issues

- Dashboard polish (loading states, empty states)
- Better error messages
- More detection heuristics
- Documentation improvements

### Medium Effort

- Additional notification channels (Discord, Teams)
- CSV/JSON export for metrics
- Dark/light mode toggle
- Mobile-responsive dashboard

### Larger Projects

- Clerk authentication integration
- Multi-organization support
- Public API with rate limiting
- GitHub Action for CI integration

## Code Style

No formal style guide. ESLint catches the obvious stuff. Beyond that:

- TypeScript everywhere, obviously
- Explicit types on function signatures, let inference handle the rest
- No `any` unless you've tried everything else and written a comment explaining why
- Destructure props, it's easier to read
- `const` by default, `let` when you actually need to reassign
- Early returns > nested ifs. Flat code is readable code.

Look at the existing code. Write code that looks like it belongs there. If you're unsure, ask.

## Testing

We don't have automated tests yet. Yes, really. It's on the list.

Manual testing workflow:
1. Run `pnpm db:seed` to get fresh test data
2. Trigger metrics: `curl -X POST localhost:3000/api/admin/metrics/compute -H "X-Admin-Key: ..."`
3. Check the dashboard, verify numbers make sense
4. For webhooks, push to a real repo and watch worker logs

If you want to add proper tests (please do):
- Vitest for unit tests
- Playwright for E2E
- Focus on the critical paths first: webhook signature verification, metrics aggregation, alert deduplication

## Database Changes

If you modify the schema:

1. Update `src/server/db/schema.ts`
2. Run `pnpm db:generate` to create migration
3. Test with `pnpm db:push` on a dev database
4. Include migration file in PR

## Questions?

- Open an issue for bugs or feature requests
- Start a discussion for questions or ideas
- Tag maintainers if you're stuck on a PR

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thanks for helping make Sentinel better.
