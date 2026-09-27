import { demoRoute } from "@/lib/demo/route";
import { dispatchPending } from "@/lib/dhamen/webhooks";

export const POST = demoRoute(({ body, origin }) => dispatchPending(origin, Array.isArray(body.ids) ? (body.ids as number[]) : undefined));
