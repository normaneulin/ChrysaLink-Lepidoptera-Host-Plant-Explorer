import { Hono } from "hono";
import { cors } from "hono/cors";
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
app.post("/observations", (c) => observationController.createObservation(c));
app.get("/observations/:id", (c) => observationController.getObservationById(c));
app.get("/observations", (c) => observationController.listObservations(c));
app.put("/observations/:id", (c) => observationController.updateObservation(c));
app.delete("/observations/:id", (c) => observationController.deleteObservation(c));

// Species search route
app.get("/species/search", (c) => observationController.searchSpecies(c));

// Relationship routes
app.get("/relationships/:lepidopteraId/:plantId/observations", (c) => observationController.getRelationshipObservations(c));

// Auth routes
app.post("/auth/signup", (c) => authController.signup(c));
app.post("/auth/login", (c) => authController.login(c));

// Notifications route (placeholder)
app.get("/notifications", (c) => c.json({ success: true, data: [] }));

Deno.serve(app.fetch);
