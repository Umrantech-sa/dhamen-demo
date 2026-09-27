import { readDb } from "@/lib/db/store";
import { demoRoute } from "@/lib/demo/route";
import { supplierViews } from "@/lib/demo/views";

export const GET = demoRoute(() => readDb((db) => supplierViews(db)));
