import { after, type NextRequest } from "next/server";
import { DhamenError } from "@/lib/dhamen/errors";
import { requestOrigin } from "@/lib/dhamen/http";
import { dispatchPending } from "@/lib/dhamen/webhooks";

interface DemoInput {
  req: NextRequest;
  params: Record<string, string>;
  body: Record<string, unknown>;
  origin: string;
  now: Date;
}

/** Wrapper for sandbox-only helper endpoints used by the dashboard UI. */
export function demoRoute(fn: (input: DemoInput) => unknown, opts: { dispatch?: boolean } = {}) {
  return async (req: NextRequest, context?: { params: Promise<Record<string, string>> }) => {
    const origin = requestOrigin(req);
    try {
      const params = (await context?.params) ?? {};
      const text = req.method === "GET" ? "" : await req.text();
      const body = text ? JSON.parse(text) : {};
      const result = await fn({ req, params, body, origin, now: new Date() });
      if (opts.dispatch) after(() => dispatchPending(origin).catch(console.error));
      return Response.json(result ?? { messageCode: 200, messageDescription: "Success" });
    } catch (err) {
      if (err instanceof DhamenError) {
        return Response.json({ messageCode: err.code, messageDescription: err.message, errors: err.errors }, { status: err.httpStatus });
      }
      console.error(err);
      return Response.json({ messageCode: "500", messageDescription: "Internal server error" }, { status: 500 });
    }
  };
}
