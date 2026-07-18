# Verdict QA

**Quality Assurance & Testing Platform** - Comprehensive testing, validation, and QA management system

## Overview

Verdict QA is a comprehensive platform for:
- **Test Management** - Create, organize, and manage test cases
- **Test Execution** - Execute tests and track results in real-time
- **Bug Tracking** - Report, prioritize, and manage bugs
- **Coverage Reports** - Monitor test coverage and quality metrics
- **Team Collaboration** - Assign tasks, track progress, and communicate
- **Automated Testing** - Integration with CI/CD pipelines
- **Analytics & Insights** - Comprehensive dashboards and reports

## Tech Stack

- **Frontend:** React + TypeScript + Tailwind CSS + Vite
- **Backend API:** Express.js + TypeScript + PostgreSQL
- **Database:** PostgreSQL + Drizzle ORM
- **Testing:** Jest + Playwright + Cypress
- **Deployment:** Vercel (Frontend) + Railway/Render (Backend)
- **Monorepo:** pnpm workspaces

## Project Structure

```
.
├── packages/
│   ├── web/                    # React frontend (Vite)
│   ├── api/                    # Express API server
│   ├── database/               # Database schema & migrations
│   ├── shared-types/           # Shared TypeScript types
│   ├── ui-components/          # Shared UI components
│   └── test-utils/             # Testing utilities
├── apps/
│   └── cli/                    # Command-line interface
├── scripts/                    # Build and utility scripts
├── docker/                     # Docker configuration
├── tests/                      # E2E and integration tests
├── docs/                       # Documentation
└── vercel.json                 # Vercel configuration
```

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm 8+
- PostgreSQL 14+
- Docker (optional, for local development)

### Installation

```bash
# Clone the repository
git clone https://github.com/mrjayvirtual/verdict-QA.git
cd verdict-QA

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env.local

# Start development servers
pnpm dev
```

### Environment Setup

```bash
# Copy environment template
cp .env.example .env.local

# Edit with your configuration
vim .env.local
```

Required variables:
- `DATABASE_URL` - PostgreSQL connection string
- `API_URL` - Backend API URL
- `NEXTAUTH_SECRET` - Authentication secret (for NextAuth)
- `JWT_SECRET` - JWT signing secret

## Development

### Commands

```bash
# Start all services in development mode
pnpm dev

# Build all packages
pnpm build

# Run type checking
pnpm typecheck

# Run linting
pnpm lint

# Run tests
pnpm test

# Run E2E tests
pnpm test:e2e
```

### Specific Package Commands

```bash
# Frontend only
pnpm --filter @verdict/web dev

# API server only
pnpm --filter @verdict/api dev

# Database migrations
pnpm --filter @verdict/database migrate
```

## API Endpoints

### Authentication
- `POST /auth/register` - Register new user
- `POST /auth/login` - Login user
- `POST /auth/logout` - Logout user
- `GET /auth/me` - Get current user

### Test Cases
- `GET /api/tests` - List all test cases
- `POST /api/tests` - Create new test case
- `GET /api/tests/:id` - Get test case details
- `PUT /api/tests/:id` - Update test case
- `DELETE /api/tests/:id` - Delete test case

### Test Execution
- `POST /api/executions` - Execute test case
- `GET /api/executions/:id` - Get execution results
- `GET /api/executions/:id/logs` - Get execution logs

### Bug Management
- `GET /api/bugs` - List all bugs
- `POST /api/bugs` - Report new bug
- `PUT /api/bugs/:id` - Update bug status
- `DELETE /api/bugs/:id` - Close bug

### Analytics
- `GET /api/analytics/dashboard` - Dashboard metrics
- `GET /api/analytics/coverage` - Test coverage report
- `GET /api/analytics/trends` - Quality trends

## Database Schema

### Core Tables
- `users` - User accounts and roles
- `projects` - QA projects
- `test_cases` - Test case definitions
- `test_suites` - Grouped test cases
- `test_executions` - Test run history
- `test_results` - Individual test outcomes
- `bugs` - Bug reports
- `bug_comments` - Bug discussion
- `attachments` - File uploads

## Testing

### Unit Tests
```bash
pnpm test
```

### Integration Tests
```bash
pnpm test:integration
```

### E2E Tests
```bash
pnpm test:e2e
```

## Deployment

### Frontend (Vercel)
```bash
# Automatic deployment on push to main
# Configure in vercel.json
```

### Backend (Railway/Render)
```bash
# Set environment variables
# Connect GitHub repository
# Auto-deploy on push
```

### Database Migrations
```bash
# Run migrations in production
pnpm --filter @verdict/database migrate:prod
```

## CI/CD Pipeline

Automated workflows:
- **Lint & Type Check** - On every PR
- **Run Tests** - On every PR
- **Build** - On every PR
- **Deploy Preview** - On PR creation (Vercel)
- **Deploy Production** - On merge to main

## Contributing

1. Create a feature branch (`git checkout -b feature/amazing-feature`)
2. Commit changes (`git commit -m 'Add amazing feature'`)
3. Push to branch (`git push origin feature/amazing-feature`)
4. Open a Pull Request

### Code Standards
- Write unit tests for new features
- Follow TypeScript strict mode
- Use meaningful commit messages
- Update documentation

## Performance Monitoring

- **Frontend:** Sentry for error tracking
- **Backend:** Datadog for monitoring
- **Database:** Query performance analysis
- **API:** Response time tracking

## Security

- JWT-based authentication
- Role-based access control (RBAC)
- Encrypted sensitive data
- CORS enabled for trusted domains
- Rate limiting on API endpoints
- SQL injection prevention via parameterized queries

## Roadmap

- [ ] AI-powered test suggestion
- [ ] Mobile app for test execution
- [ ] Integration with Jira, Azure DevOps
- [ ] Advanced analytics and ML insights
- [ ] Performance testing suite
- [ ] Load testing integration

## License

MIT - See LICENSE file for details

## Support

For questions or issues:
- Open a GitHub issue
- Check existing documentation in `/docs`
- Review API documentation in Swagger UI

## Contact

- **Author:** mrjayvirtual
- **Email:** mrjayvirtual@gmail.com
- **GitHub:** https://github.com/mrjayvirtual
