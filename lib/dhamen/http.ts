// Request pipeline for the mock Dhamen endpoints: header auth (Appendix A),
// validation, transactional execution, API logging, latency simulation and webhooks.
import { after, type NextRequest } from "next/server";
import { withDb } from "@/lib/db/store";
import { DHAMEN_CONFIG } from "./config";
import { DhamenError, Errors } from "./errors";
import { shortId } from "./generators";
import type { Ctx, DB } from "./types";
import { dispatchPending } from "./webhooks";

const MAX_LOGS = 400;

interface RouteInput {
  body: unknown;
  params: Record<string, string>;
  query: URLSearchParams;
}

interface RouteOptions<I> {
  parse?: (input: RouteInput) => I;
  run: (db: DB, input: I, ctx: Ctx) => unknown;
  mutate?: boolean;
}

export function requestOrigin(req: NextRequest) {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(":", "");
  return host ? `${proto}://${host}` : req.nextUrl.origin;
}

function authenticate(req: NextRequest) {
  const h = req.headers;
  if (!h.get("app-key") || !h.get("app-id")) throw Errors.unauthorized();
  if (h.get("app-key") !== DHAMEN_CONFIG.appKey || h.get("app-id") !== DHAMEN_CONFIG.appId) throw Errors.unauthorized();
  if (h.get("clientid") !== DHAMEN_CONFIG.clientId) throw Errors.forbidden();
  if (h.get("api-version") !== DHAMEN_CONFIG.apiVersion) throw Errors.noMapping();
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function dhamenRoute<I = unknown>(opts: RouteOptions<I>) {
  return async (req: NextRequest, context?: { params: Promise<Record<string, string>> }) => {
    const started = Date.now();
    const origin = requestOrigin(req);
    const plannedLatency = Math.round(120 + Math.random() * 380);
    let body: unknown = undefined;
    let status = 200;
    let payload: unknown;
    let simulateLatency = false;

    // The operation and its API log entry are written in one transaction (one storage round-trip).
    const log = (db: DB) => {
      simulateLatency = db.settings.simulateLatency;
      db.apiLogs.push({
        id: shortId(),
        method: req.method,
        path: req.nextUrl.pathname,
        status,
        messageCode: (payload as { messageCode?: string | number })?.messageCode,
        durationMs: Date.now() - started + (simulateLatency ? plannedLatency : 0),
        request: body,
        response: payload,
        source: req.headers.get("x-demo-source") ?? "external",
        createdAt: new Date().toISOString(),
      });
      if (db.apiLogs.length > MAX_LOGS) db.apiLogs.splice(0, db.apiLogs.length - MAX_LOGS);
    };

    try {
      if (req.method !== "GET") {
        const text = await req.text();
        if (text) {
          try {
            body = JSON.parse(text);
          } catch {
            throw Errors.validation({ body: ["Request body must be valid JSON"] });
          }
        }
      }
      authenticate(req);
      const params = (await context?.params) ?? {};
      const input = opts.parse ? opts.parse({ body, params, query: req.nextUrl.searchParams }) : (body as I);
      const ctx: Ctx = { now: new Date(), origin };
      await withDb((db) => {
        const result = opts.run(db, input, ctx);
        payload = result === undefined ? { messageCode: 200, messageDescription: "Success" } : result;
        log(db);
      });
    } catch (err) {
      if (err instanceof DhamenError) {
        status = err.httpStatus;
        payload = { messageCode: err.code, messageDescription: err.message, ...(err.errors ? { errors: err.errors } : {}) };
      } else {
        console.error(err);
        status = 500;
        payload = { messageCode: "500", messageDescription: "Internal server error" };
      }
      await withDb(log).catch(console.error);
    }

    if (simulateLatency) await sleep(plannedLatency);
    if (status === 200 && opts.mutate !== false) after(() => dispatchPending(origin).catch(console.error));

    return Response.json(payload, { status });
  };
}
