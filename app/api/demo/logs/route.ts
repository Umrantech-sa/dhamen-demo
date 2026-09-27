import { readDb } from "@/lib/db/store";
import { demoRoute } from "@/lib/demo/route";

export const GET = demoRoute(() => readDb((db) => [...db.apiLogs].reverse()));
