import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import { db } from "./db/client";

export async function createTRPCContext() {
  return { db };
}

export type Context = Awaited<ReturnType<typeof createTRPCContext>>;

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;
