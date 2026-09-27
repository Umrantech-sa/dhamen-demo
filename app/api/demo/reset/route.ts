import { resetDb } from "@/lib/db/store";
import { demoRoute } from "@/lib/demo/route";

export const POST = demoRoute(() => resetDb());
