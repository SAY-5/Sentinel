import { router } from "../trpc";
import { metricsRouter } from "./metrics";
import { eventsRouter } from "./events";
import { incidentsRouter } from "./incidents";
import { alertsRouter } from "./alerts";

export const appRouter = router({
  metrics: metricsRouter,
  events: eventsRouter,
  incidents: incidentsRouter,
  alerts: alertsRouter,
});

export type AppRouter = typeof appRouter;
