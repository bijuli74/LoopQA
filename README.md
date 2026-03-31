# LoopQA

Automated testing platform for wearable watches & companion apps.

## Monorepo Structure

```
loopqa/
├── apps/
│   ├── web/          # Next.js dashboard (TypeScript)
│   └── api/          # Node.js API server (TypeScript, tRPC)
├── packages/
│   └── shared/       # Shared types, schemas, utils
├── agent/            # On-prem Go agent daemon
└── docs/             # Documentation
```

## Getting Started

```bash
pnpm install
pnpm dev
```
