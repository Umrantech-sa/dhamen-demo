// Storage for the mock Dhamen backend. The whole sandbox is one JSON document.
// Every mutation runs as a transaction: lock → load → mutate → write → unlock.
// If the mutation throws, nothing is written, so business errors never leave partial state.
//
// Backends, picked from the environment:
// - Upstash Redis (KV_REST_API_* or UPSTASH_REDIS_REST_*): used on Vercel, shared by all instances.
// - JSON file data/db.json: local development.
// - In-memory: fallback on Vercel when Redis isn't configured (resets on every cold start).
import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { Redis } from "@upstash/redis";
import type { DB } from "@/lib/dhamen/types";
import { buildSeed } from "./seed";

interface Backend {
  name: "redis" | "file" | "memory";
  load(): Promise<DB | null>;
  save(db: DB): Promise<void>;
  lock<T>(fn: () => Promise<T>): Promise<T>;
}

const g = globalThis as unknown as { __dhamenQueue?: Promise<unknown>; __dhamenMemory?: DB; __dhamenBackend?: Backend };

/** Serializes transactions inside this server instance. */
function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const prev = g.__dhamenQueue ?? Promise.resolve();
  const next = prev.then(task, task);
  g.__dhamenQueue = next.catch(() => undefined);
  return next;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function redisBackend(url: string, token: string): Backend {
  const redis = new Redis({ url, token });
  const prefix = process.env.DHAMEN_REDIS_PREFIX ?? "dhamen-demo";
  const DB_KEY = `${prefix}:db`;
  const LOCK_KEY = `${prefix}:lock`;
  const RELEASE = 'if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end';

  return {
    name: "redis",
    load: () => redis.get<DB>(DB_KEY),
    save: async (db) => {
      await redis.set(DB_KEY, db);
    },
    // Cross-instance lock so concurrent serverless invocations don't overwrite each other.
    async lock(fn) {
      const owner = randomUUID();
      const deadline = Date.now() + 10_000;
      while (!(await redis.set(LOCK_KEY, owner, { nx: true, px: 10_000 }))) {
        if (Date.now() > deadline) throw new Error("Timed out waiting for the sandbox database lock");
        await sleep(40 + Math.random() * 60);
      }
      try {
        return await fn();
      } finally {
        await redis.eval(RELEASE, [LOCK_KEY], [owner]).catch(() => undefined);
      }
    },
  };
}

function fileBackend(): Backend {
  const dir = path.join(process.cwd(), "data");
  const file = path.join(dir, "db.json");
  return {
    name: "file",
    async load() {
      try {
        return JSON.parse(await fs.readFile(file, "utf8")) as DB;
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw err;
      }
    },
    async save(db) {
      await fs.mkdir(dir, { recursive: true });
      const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
      await fs.writeFile(tmp, JSON.stringify(db, null, 2));
      await fs.rename(tmp, file);
    },
    lock: (fn) => fn(),
  };
}

function memoryBackend(): Backend {
  console.warn("[dhamen] No Redis configured on Vercel: using in-memory storage that resets on cold starts.");
  return {
    name: "memory",
    load: async () => (g.__dhamenMemory ? structuredClone(g.__dhamenMemory) : null),
    save: async (db) => {
      g.__dhamenMemory = structuredClone(db);
    },
    lock: (fn) => fn(),
  };
}

function backend(): Backend {
  if (!g.__dhamenBackend) {
    const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
    g.__dhamenBackend = url && token ? redisBackend(url, token) : process.env.VERCEL ? memoryBackend() : fileBackend();
  }
  return g.__dhamenBackend;
}

export const storageBackend = () => backend().name;

async function loadOrSeed(b: Backend): Promise<DB> {
  const db = await b.load();
  if (db) return db;
  const seeded = buildSeed();
  await b.save(seeded);
  return seeded;
}

export function withDb<T>(fn: (db: DB) => T | Promise<T>): Promise<T> {
  const b = backend();
  return enqueue(() =>
    b.lock(async () => {
      const db = await loadOrSeed(b);
      const result = await fn(db);
      await b.save(db);
      return result;
    }),
  );
}

export async function readDb<T>(fn: (db: DB) => T | Promise<T>): Promise<T> {
  const b = backend();
  const db = await b.load();
  // First visit: seed under the lock so concurrent requests don't seed twice.
  return fn(db ?? (await withDb((d) => d)));
}

export function resetDb(): Promise<void> {
  const b = backend();
  return enqueue(() => b.lock(() => b.save(buildSeed())));
}
