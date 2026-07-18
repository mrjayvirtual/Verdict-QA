# Verdict QA - Development Setup

## Quick Start

```bash
# Install dependencies
pnpm install

# Setup environment
cp .env.example .env.local

# Start development server
pnpm dev
```

## Project Layout

```
verdict-QA/
├── packages/          # Shared packages
│   ├── web/          # React frontend
│   ├── api/          # Express backend
│   ├── database/     # DB schema & migrations
│   └── shared-types/ # TypeScript types
├── .env.example      # Environment template
├── package.json      # Root package
├── pnpm-workspace.yaml
└── README.md         # This file
```

## Development

### Available Commands

```bash
# Start all services
pnpm dev

# Build all packages
pnpm build

# Type checking
pnpm typecheck

# Testing
pnpm test

# Linting
pnpm lint
```

## Contributing

1. Create feature branch
2. Make changes
3. Run tests and type checking
4. Create pull request

## Documentation

See [README.md](./README.md) for full documentation.
