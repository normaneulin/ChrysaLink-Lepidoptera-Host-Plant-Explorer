import { Hono } from "https://deno.land/x/hono@v3.12.8/mod.ts";
import { cors } from "https://deno.land/x/hono@v3.12.8/middleware.ts";
import { observationController } from "./src/controllers/observation.controller.ts";
import { authController } from "./src/controllers/auth.controller.ts";

const app = new Hono();

// CORS middleware
app.use("/*", cors({
  origin: ["http://localhost:3000", "http://localhost:3001", "https://*.vercel.app"],
  credentials: true,
}));

// Health check
app.get("/", (c) => c.json({ status: "ok", message: "ChrysaLink API" }));

// Observation routes
app.post("/observations", observationController.createObservation);
app.get("/observations/:id", observationController.getObservationById);
app.get("/observations", observationController.listObservations);
app.put("/observations/:id", observationController.updateObservation);
app.delete("/observations/:id", observationController.deleteObservation);

// Species search route
app.get("/species/search", observationController.searchSpecies);

// Relationship routes
app.get("/relationships/:lepidopteraId/:plantId/observations", observationController.getRelationshipObservations);

// Auth routes
app.post("/auth/signup", authController.signup);
app.post("/auth/login", authController.login);

// Notifications route (placeholder)
app.get("/notifications", (c) => c.json({ success: true, data: [] }));

Deno.serve(app.fetch);
