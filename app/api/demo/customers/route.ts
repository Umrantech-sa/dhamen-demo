import { readDb } from "@/lib/db/store";
import { demoRoute } from "@/lib/demo/route";
import { customerViews } from "@/lib/demo/views";

export const GET = demoRoute(() => readDb((db) => customerViews(db)));
