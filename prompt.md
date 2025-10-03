# prompt.md

You are a senior TypeScript engineer. Build a small library/CLI that runs one‑time **runce tasks** for a Node.js service (similar to DB migrations, but for arbitrary JS/TS code). The system must track which tasks have been executed using a pluggable **Tracker** interface. The first tracker implementation is **MongoDB**. Swapping trackers is done purely via config (no code changes). The project must be production‑ready with tests, linting, and clear docs.

## Goals

* Run arbitrary **TS tasks** exactly once per environment.
* Maintain an append‑only record of applied tasks (with checksum + metadata).
* Provide **CLI** and **programmatic API**.
* Implement **MongoTracker** now; architecture must support future trackers (e.g., File, Postgres) by flipping a config value.
* Provide **distributed lock** to avoid concurrent runners.
* Developer experience: generated task templates, TypeScript types, robust logging, dry‑run, filters (--only, --since, --until), and idempotency guidance.

## Constraints & Tech

* Node 20+, TypeScript, ESM.
* Package name (placeholder): `@nurv/runce`.
* Build with `tsup` or `tsc`. Test with `vitest`. Lint with `eslint` + `prettier`.
* No framework coupling; small dependency footprint. For Mongo use `mongodb` official driver.

## High‑Level Architecture

```
packages/runce/
  src/
    index.ts                # public API
    cli.ts                  # CLI entry
    core/
      runner.ts             # orchestrates execution
      loader.ts             # loads tasks from disk
      lock.ts               # cross-process lock abstraction
      checksum.ts           # stable hash of task contents
      logger.ts
    trackers/
      tracker.ts            # ITracker interface
      mongo-tracker.ts      # Mongo implementation
    types.ts                # shared types
  tasks/                    # user-land tasks (default path)
    2025-10-01T120000.init-queues.ts
  config/
    runce.config.ts    # exports Config object
  bin/
    runce              # shell shim -> node ./dist/cli.js
  README.md
  ...
```

## Data Model (Mongo)

* Collection: `runce.applied`

  * `id: string` (task id, usually filename stem)
  * `name: string`
  * `checksum: string` (hash of file contents)
  * `appliedAt: Date`
  * `durationMs: number`
  * `status: 'success' | 'failed'`
  * `error?: string`
* Collection: `runce.lock`

  * single doc `{ _id: 'global', leaseUntil: Date, owner: string }`

## Task Authoring Model

Each task is a TS module exporting a default object that implements `RunceTask`.

```ts
// tasks/2025-10-01T120000.init-queues.ts
import { RunceTask } from '@nurv/runce';

const task: RunceTask = {
  id: '2025-10-01T120000.init-queues',
  title: 'Initialize message queues',
  async run(ctx) {
    // write any one-time logic here (API calls, S3 buckets, cache warms, data backfills, etc.)
    // use ctx.log, ctx.config, ctx.db, etc.
  },
  // optional: verify idempotency by checking external state first
  // async alreadyDone(ctx) { return boolean }
};
export default task;
```

## Public Types & Interfaces

```ts
// src/trackers/tracker.ts
export interface AppliedRecord {
  id: string;
  name: string;
  checksum: string;
  appliedAt: Date;
  durationMs: number;
  status: 'success' | 'failed';
  error?: string;
}

export interface TrackerInit {
  /** free-form connection details for a tracker */
  [k: string]: unknown;
}

export interface ITracker {
  init(cfg: TrackerInit): Promise<void>;
  /**
   * Returns a set of task ids that have been successfully applied.
   */
  getAppliedIds(): Promise<Set<string>>;
  /**
   * Atomically upsert an applied record by id.
   */
  recordApplied(rec: AppliedRecord): Promise<void>;
  /**
   * Optionally expose read API for records (used by --list).
   */
  listApplied(): Promise<AppliedRecord[]>;
}
```

```ts
// src/types.ts
export interface RunceTaskContext {
  log: (...args: any[]) => void;
  config: Config;
  /** Optional DI hooks (e.g., db clients) */
  services?: Record<string, unknown>;
}

export interface RunceTask {
  id: string;   // canonical, stable id (often timestamped)
  title?: string;
  run(ctx: RunceTaskContext): Promise<void>;
  alreadyDone?: (ctx: RunceTaskContext) => Promise<boolean>;
}

export interface Config {
  tasksDir: string;
  tracker: {
    type: 'mongo' | 'file' | 'postgres' | string; // extensible
    options: Record<string, unknown>;             // passed to tracker.init
  };
  lock?: {
    enabled: boolean;
    /** lease duration in ms */
    ttlMs: number;
    /** best-effort owner id for diagnostics */
    owner?: string;
  };
  dryRun?: boolean;
}
```

## Loader & Checksum

* Loader: loads all `*.{ts,js}` files from `tasksDir`, sorts by `id`.
* Checksum: SHA‑256 of normalized file contents (strip EOL differences) to detect drift.

## Locking Semantics

* Use tracker-specific or generic lock. For Mongo: `findOneAndUpdate` with `upsert: true` ensuring `leaseUntil > now` to acquire; renew every `ttlMs/2` while running. If unavailable, exit with nonzero code.

## CLI

```
runce run [--config ./config/runce.config.ts] \
  [--tasksDir ./tasks] [--dry-run] [--only id1,id2] [--since 2025-09-01] [--until 2025-10-01] [--concurrency 1]

runce list [--json]

runce make "human-readable name"   # scaffolds timestamped task file
```

* `--only`: comma-separated list of task ids to run.
* `--since/--until`: filter by id prefix or timestamp segment.
* `run` output clearly marks **SKIP** (already applied), **DRY‑RUN**, **OK**, **FAIL**.

## Programmatic API

```ts
import { runTasks, listApplied } from '@nurv/runce';
await runTasks({ config });
```

## Config Example

```ts
// config/runce.config.ts
import { defineConfig } from '@nurv/runce';
export default defineConfig({
  tasksDir: './tasks',
  tracker: {
    type: 'mongo',
    options: {
      uri: process.env.MONGO_URI!,
      db: 'infra',
      appliedCollection: 'runce.applied',
      lockCollection: 'runce.lock',
    },
  },
  lock: { enabled: true, ttlMs: 60_000, owner: process.env.HOSTNAME },
  dryRun: false,
});
```

## Mongo Tracker Skeleton

```ts
// src/trackers/mongo-tracker.ts
import { ITracker, AppliedRecord, TrackerInit } from './tracker.js';
import { MongoClient, Collection } from 'mongodb';

export class MongoTracker implements ITracker {
  private client!: MongoClient;
  private applied!: Collection<AppliedRecord>;

  async init(cfg: TrackerInit) {
    const { uri, db, appliedCollection = 'runce.applied' } = cfg as any;
    this.client = new MongoClient(uri);
    await this.client.connect();
    this.applied = this.client.db(db).collection(appliedCollection);
    await this.applied.createIndex({ id: 1 }, { unique: true });
  }

  async getAppliedIds() {
    const ids = await this.applied.find({}, { projection: { id: 1 } }).toArray();
    return new Set(ids.map(d => d.id));
  }

  async recordApplied(rec: AppliedRecord) {
    await this.applied.updateOne(
      { id: rec.id },
      { $set: rec },
      { upsert: true }
    );
  }

  async listApplied() {
    return this.applied.find().sort({ appliedAt: 1 }).toArray();
  }
}
```

## Runner Outline

```ts
// src/core/runner.ts
import { ITracker } from '../trackers/tracker.js';
import { RunceTask } from '../types.js';

export async function runTasks(opts: { tracker: ITracker; tasks: RunceTask[]; config: any; log: Function; dryRun?: boolean; }) {
  const { tracker, tasks, dryRun, log } = opts;
  const applied = await tracker.getAppliedIds();

  for (const task of tasks) {
    if (applied.has(task.id)) { log('SKIP', task.id); continue; }
    if (task.alreadyDone && await task.alreadyDone({ log, config: opts.config })) {
      log('SKIP (alreadyDone)', task.id);
      continue;
    }
    const started = Date.now();
    try {
      if (!dryRun) await task.run({ log, config: opts.config });
      const rec = {
        id: task.id,
        name: task.title ?? task.id,
        checksum: 'computed-elsewhere',
        appliedAt: new Date(),
        durationMs: Date.now() - started,
        status: 'success' as const,
      };
      if (!dryRun) await tracker.recordApplied(rec);
      log('OK', task.id);
    } catch (err: any) {
      const rec = {
        id: task.id,
        name: task.title ?? task.id,
        checksum: 'computed-elsewhere',
        appliedAt: new Date(),
        durationMs: Date.now() - started,
        status: 'failed' as const,
        error: String(err?.stack || err?.message || err),
      };
      await tracker.recordApplied(rec);
      log('FAIL', task.id, err);
      process.exitCode = 1;
    }
  }
}
```

## Extensibility Requirements

* Trackers are loaded via a small factory based on `config.tracker.type`.
* Adding a new tracker should only require placing a new `X-tracker.ts` and updating the factory map.
* No changes to task authoring or runner.

## CLI Acceptance Criteria

* `runce make "init queues"` creates `tasks/2025-10-01T120000.init-queues.ts` prefilled with the template.
* `runce run` runs all pending tasks, respecting lock + dry-run.
* `runce list --json` shows applied records.
* Exit code 0 on success, 1 if any task fails or lock cannot be acquired.

## Testing

* Unit tests for loader, checksum, filtering, tracker factory, mongo tracker (use testcontainers or in-memory server), and runner.
* E2E test: create two tasks; ensure second run skips both; ensure failure is recorded.

## Deliverables

* Full TS source, build, tests, and CLI.
* `README.md` with setup & examples.
* Published as a workspace-ready package.