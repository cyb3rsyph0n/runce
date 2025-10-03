
# @nurv/runce

[![CI](https://github.com/cyb3rsyph0n/runce/actions/workflows/ci.yml/badge.svg)](https://github.com/cyb3rsyph0n/runce/actions/workflows/ci.yml)
[![Tests](https://img.shields.io/badge/tests-75%20passed-brightgreen)](https://github.com/cyb3rsyph0n/runce/actions)
[![npm version](https://badge.fury.io/js/@nurv%2Frunce.svg)](https://badge.fury.io/js/@nurv%2Frunce)
[![codecov](https://codecov.io/gh/cyb3rsyph0n/runce/branch/master/graph/badge.svg)](https://codecov.io/gh/cyb3rsyph0n/runce)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/node/v/@nurv/runce.svg)](https://nodejs.org/)

Run one-time **runce tasks** for your Node service—like migrations, but for arbitrary TypeScript/JavaScript. Ships with a MongoDB tracker and a pluggable interface for others.

## Features

* ✅ Run TS/JS tasks exactly once
* ✅ Pluggable **Tracker** (MongoDB + File tracker out of the box)
* ✅ CLI + programmatic API
* ✅ Distributed lock (MongoDB lease) to prevent concurrent runners
* ✅ Dry-run, filters, JSON list, rich logs
* ✅ Task scaffolding

## Quick Start

```bash
npm i @nurv/runce mongodb
npx runce make "initialize queues"
```

Generate a config:

```ts
// config/runce.config.ts
import { defineConfig } from '@nurv/runce';

export default defineConfig({
  tasksDir: './tasks',
  tracker: {
    type: 'mongo', // or 'file' for development
    options: { uri: process.env.MONGO_URI, db: 'infra' },
  },
  lock: { enabled: true, ttlMs: 60000, owner: process.env.HOSTNAME },
});
```

Or use JavaScript:

```js
// config/runce.config.js
export default {
  tasksDir: './tasks',
  tracker: {
    type: 'mongo', // or 'file' for development
    options: { uri: process.env.MONGO_URI, db: 'infra' },
  },
  lock: { enabled: true, ttlMs: 60000, owner: process.env.HOSTNAME },
};
```

Run pending tasks:

```bash
MONGO_URI="mongodb://localhost:27017" npx runce run
```

List applied:

```bash
npx runce list --json | jq .
```

## Writing a Task

Tasks can be written in either **TypeScript** or **JavaScript**:

**TypeScript (Recommended):**
```ts
// tasks/20251003T120000.init-queues.ts
import { RunceTask } from '@nurv/runce';

const task: RunceTask = {
  id: '20251003T120000.init-queues',
  title: 'Initialize message queues',
  async run({ log }) {
    log('creating SQS queues ...');
    // ... do one-time setup
  },
};
export default task;
```

**JavaScript:**
```js
// tasks/20251003T120000.init-queues.js
const task = {
  id: '20251003T120000.init-queues',
  title: 'Initialize message queues',
  async run({ log }) {
    log('creating SQS queues ...');
    // ... do one-time setup
  },
};
export default task;
```

**Naming:** prefix with an ISO timestamp for natural ordering. `id` must be unique and stable.

## Configuration

```ts
export interface Config {
  tasksDir: string;
  tracker: { type: string; options: Record<string, unknown> };
  lock?: { enabled: boolean; ttlMs: number; owner?: string };
  dryRun?: boolean;
}
```

You can keep config in JS or TS. The CLI resolves via `--config` or defaults to TypeScript config files.

### Swapping Trackers

Change `tracker.type` and provide matching `options`.

```js
export default {
  tracker: { type: 'file', options: { path: '.runce.json' } }
}
```

Add your own by implementing `ITracker` and registering it. No changes to tasks or runner needed.

## CLI

```bash
# Create a new task file (generates TypeScript by default)
runce make "human readable name"

# Run tasks (uses TypeScript config by default)
runce run [--config ./config/runce.config.ts] [--tasks-dir ./tasks] [--dry-run]
         [--only id1,id2] [--since 2025-09-01] [--until 2025-10-01]

# List applied tasks  
runce list [--config ./config/runce.config.ts] [--json]

# Get help
runce --help
runce run --help
```

## Programmatic API

```ts
import { runWithConfig, runWithConfigObject, listApplied, listAppliedWithConfig, defineConfig } from '@nurv/runce';

// Load config from file
await runWithConfig('./config/runce.config.ts');

// Or pass config object directly (useful for dynamic configuration)
const config = defineConfig({
  tasksDir: './tasks',
  tracker: {
    type: 'mongo',
    options: { uri: process.env.MONGO_URI, db: 'infra' },
  },
});
await runWithConfigObject(config);

// List applied tasks
const records = await listApplied('./config/runce.config.ts');
// Or with config object
const records2 = await listAppliedWithConfig(config);
```

### Use Cases for Config Objects

Passing config objects directly is useful when:
- **Environment-based configuration**: Build config dynamically based on environment variables
- **Testing**: Create test configs without filesystem dependencies
- **Serverless**: Configure runce without requiring config files in deployment packages
- **Multi-tenant**: Different configurations per tenant or database

```ts
// Example: Environment-based configuration
const config = defineConfig({
  tasksDir: './tasks',
  tracker: {
    type: process.env.NODE_ENV === 'production' ? 'mongo' : 'file',
    options: process.env.NODE_ENV === 'production' 
      ? { uri: process.env.MONGO_URI, db: process.env.DB_NAME }
      : { path: './.runce-dev.json' }
  },
  lock: { 
    enabled: process.env.NODE_ENV === 'production',
    ttlMs: 60000,
    owner: process.env.HOSTNAME 
  }
});

await runWithConfigObject(config);
```

## Tracker Interface

```ts
export interface AppliedRecord {
  id: string; name: string; checksum: string; appliedAt: Date; durationMs: number; status: 'success'|'failed'; error?: string;
}
export interface ITracker {
  init(options: Record<string, unknown>): Promise<void>;
  getAppliedIds(): Promise<Set<string>>;
  recordApplied(rec: AppliedRecord): Promise<void>;
  listApplied(): Promise<AppliedRecord[]>;
}
```

## MongoDB Tracker Options

```ts
{
  uri: string;         // Mongo connection string
  db: string;          // database name
  appliedCollection?: string; // default: runce.applied
  lockCollection?: string;    // default: runce.lock
}
```

## File Tracker Options

```ts
{
  path?: string;       // default: .runce.json
}
```

## Locking

The MongoDB tracker uses a lease document (`_id: 'global'`) updated with `leaseUntil`. If another process holds a valid lease, `run` exits with code 1. The file tracker doesn't support locking.

## Idempotency Patterns

* Prefer **external state checks** inside tasks (e.g., does the bucket/queue exist?).
* Use `alreadyDone()` for cheap pre-checks when possible.
* Avoid destructive operations; make tasks additive or guarded.

## Checksums & Drift

A SHA‑256 checksum of task files is stored. If the on-disk checksum changes after apply, you can detect drift by comparing stored vs current checksums.

## Development

```bash
npm i
npm run build          # Compile TypeScript
npm run lint           # Run ESLint
npm run test           # Run tests with Jest
npm run test:coverage  # Run tests with coverage
npm run test:watch     # Run tests in watch mode
npm run dev            # Watch mode compilation
```

## TypeScript Support

Runce fully supports TypeScript out of the box:

- **Task Files**: Write tasks in `.ts` files with full type safety
- **Config Files**: Use TypeScript config with `defineConfig()` helper
- **Runtime**: Uses `tsx` for TypeScript execution at runtime
- **Type Safety**: Full IntelliSense and compile-time checking

No compilation step required - TypeScript files run directly!

## Testing

* Unit tests for loader, runner, filters, checksum.
* MongoDB tracker tests using `mongodb-memory-server`.
* Tests run with Jest and support TypeScript out of the box.

## Extending with a New Tracker

1. Implement `ITracker` in `src/trackers/my-tracker.ts`.
2. Export it via the tracker factory map.
3. Use `tracker.type = 'my'` in config.

## Examples

### Database Index Creation
```js
const task = {
  id: '20251003T120000.user-indexes',
  title: 'Create user indexes',
  async run({ log }) {
    log('Creating user email index...');
    // await db.collection('users').createIndex({ email: 1 }, { unique: true });
    log('User indexes created');
  },
  async alreadyDone({ log }) {
    // Check if index already exists
    // const indexes = await db.collection('users').indexes();
    // return indexes.some(idx => idx.key.email);
    return false;
  },
};
export default task;
```

### S3 Bucket Setup
```js
const task = {
  id: '20251003T120001.s3-buckets',
  title: 'Initialize S3 buckets',
  async run({ log }) {
    log('Creating upload bucket...');
    // await s3.createBucket({ Bucket: 'app-uploads' });
    log('S3 buckets ready');
  },
};
export default task;
```

## FAQ

**Why not Prisma?** Prisma tracks SQL schema, not arbitrary JS. Runce tasks handle service setup and data chores.

**Can I rollback?** Not built-in. Author tasks to be safe to re-run or provide explicit compensating logic.

**Can I run in Docker entrypoint?** Yes: `runce run` in your container startup before the app listener.

## License

MIT
