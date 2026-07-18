# Verdict QA - Development Guide

## Local Development Setup

### Prerequisites
- Node.js 18+
- pnpm 8+
- PostgreSQL 14+ (or Docker)
- Git

### Quick Start

```bash
# Clone repository
git clone https://github.com/mrjayvirtual/verdict-QA.git
cd verdict-QA

# Install dependencies
pnpm install

# Setup environment
cp .env.example .env.local

# Start dev servers
pnpm dev
```

### Using Docker

```bash
# Start all services
docker-compose up -d

# Run migrations
docker-compose exec api pnpm --filter @verdict/database migrate

# View logs
docker-compose logs -f
```

## Project Commands

### Development
```bash
pnpm dev              # Start all services
pnpm --filter @verdict/web dev    # Frontend only
pnpm --filter @verdict/api dev    # Backend only
```

### Building
```bash
pnpm build            # Build all packages
pnpm --filter @verdict/web build   # Frontend only
pnpm --filter @verdict/api build   # Backend only
```

### Testing
```bash
pnpm test             # Run all tests
pnpm test:ui          # Run tests with UI
pnpm test:e2e         # Run E2E tests
```

### Quality
```bash
pnpm typecheck        # Type checking
pnpm lint             # Linting
pnpm lint --fix       # Fix lint issues
```

## Architecture

### Monorepo Structure
- **packages/web** - React frontend (Vite)
- **packages/api** - Express backend
- **packages/database** - DB schema & migrations
- **packages/shared-types** - TypeScript types

### Database
- PostgreSQL for data storage
- Drizzle ORM for queries
- SQL migrations for schema changes

### Frontend
- React 18 with TypeScript
- Vite for bundling
- React Router for navigation
- TailwindCSS for styling (optional)

### Backend
- Express.js with TypeScript
- CORS enabled
- JSON request/response
- RESTful API design

## API Development

### Adding a New Endpoint

1. Create route handler in `packages/api/src/routes/`
2. Add types to `packages/shared-types/src/types.ts`
3. Register route in `packages/api/src/index.ts`
4. Test with curl or Postman

Example:
```typescript
// packages/api/src/routes/projects.ts
import { Router } from 'express';

const router = Router();

router.get('/projects', (req, res) => {
  res.json({ data: [] });
});

export default router;
```

## Database Development

### Creating Migrations

```bash
pnpm --filter @verdict/database migrate:create my_migration
```

### Running Migrations

```bash
# Development
pnpm --filter @verdict/database migrate

# Production
pnpm --filter @verdict/database migrate:prod
```

## Deployment

### Frontend (Vercel)
- Automatic deployment on push to main
- Environment variables in Vercel dashboard
- Build: `pnpm build`
- Output: `packages/web/dist`

### Backend
- Deploy to Railway, Render, or similar
- Environment: `NODE_ENV=production`
- Database: Managed PostgreSQL

## Troubleshooting

### Port already in use
```bash
# Find process using port 3000
lsof -i :3000
# Kill process
kill -9 <PID>
```

### Database connection issues
```bash
# Check DATABASE_URL in .env.local
# Verify PostgreSQL is running
# Test connection: psql $DATABASE_URL
```

### pnpm lock file conflicts
```bash
# Regenerate lock file
rm pnpm-lock.yaml
pnpm install
```

## Git Workflow

1. Create feature branch: `git checkout -b feature/my-feature`
2. Make changes and commit: `git commit -m 'feat: add my feature'`
3. Push to GitHub: `git push origin feature/my-feature`
4. Open Pull Request
5. After review and CI passes, merge to main

## Code Style

- TypeScript strict mode
- ESLint for linting
- Prettier for formatting
- Commit message format: `type: description`

Types: feat, fix, docs, style, refactor, test, chore

## Performance Optimization

- Bundle analysis: `pnpm build --analyze`
- Database query optimization
- API response caching
- Frontend lazy loading

## Security

- Never commit `.env` files
- Use environment variables for secrets
- CORS configuration for API
- Input validation on all endpoints
- SQL injection prevention via ORM

## Support

For issues or questions, open a GitHub issue or contact maintainers.
