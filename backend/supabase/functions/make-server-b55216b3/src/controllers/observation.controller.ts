import { Context } from "https://esm.sh/hono";
import { ObservationService } from "../services/observation.service.ts";
import { CreateObservationData, SearchSpeciesParams } from "../types/observation.types.ts";
import { formatErrorResponse } from "../utils/error-handler.ts";

/**
 * Observation Controller
 * Handles observation CRUD and species search endpoints
 */

export const observationController = {
  /**
   * POST /observations
   * Create a new observation
   */
  async createObservation(c: Context) {
    try {
      const userId = c.get("userId");

      if (!userId) {
        return c.json(
          { success: false, error: "Unauthorized" },
          401
        );
      }

      const body = await c.req.json();
      const data = body as CreateObservationData;

      const observation = await ObservationService.createObservation(
        userId,
        data
      );

      return c.json(
        {
          success: true,
          data: observation,
          message: "Observation created successfully",
        },
        201
      );
    } catch (error: any) {
      const errorResponse = formatErrorResponse(error);
      return c.json(errorResponse, errorResponse.statusCode || 400);
    }
  },

  /**
   * GET /observations/:id
   * Get a specific observation
   */
  async getObservationById(c: Context) {
    try {
      const id = c.req.param("id");

      const observation = await ObservationService.getObservationById(id);

      return c.json({
        success: true,
        data: observation,
      });
    } catch (error: any) {
      const errorResponse = formatErrorResponse(error);
      return c.json(errorResponse, errorResponse.statusCode || 400);
    }
  },

  /**
   * GET /observations
   * List observations with optional filters
   */
  async listObservations(c: Context) {
    try {
      const userId = c.req.query("userId");
      const lepidopteraId = c.req.query("lepidopteraId");
      const plantId = c.req.query("plantId");
      const location = c.req.query("location");
      const isPublic = c.req.query("isPublic");

      const filters: Record<string, any> = {};
      if (userId) filters.userId = userId;
      if (lepidopteraId) filters.lepidopteraId = lepidopteraId;
      if (plantId) filters.plantId = plantId;
      if (location) filters.location = location;
      if (isPublic !== undefined) filters.isPublic = isPublic === "true";

      const observations = await ObservationService.listObservations(
        Object.keys(filters).length > 0 ? filters : undefined
      );

      return c.json({
        success: true,
        data: observations,
      });
    } catch (error: any) {
      const errorResponse = formatErrorResponse(error);
      return c.json(errorResponse, errorResponse.statusCode || 400);
    }
  },

  /**
   * PUT /observations/:id
   * Update an observation
   */
  async updateObservation(c: Context) {
    try {
      const userId = c.get("userId");
      const id = c.req.param("id");

      if (!userId) {
        return c.json(
          { success: false, error: "Unauthorized" },
          401
        );
      }

      const body = await c.req.json();
      const updates = body as Partial<CreateObservationData>;

      const observation = await ObservationService.updateObservation(
        id,
        userId,
        updates
      );

      return c.json({
        success: true,
        data: observation,
        message: "Observation updated successfully",
      });
    } catch (error: any) {
      const errorResponse = formatErrorResponse(error);
      return c.json(errorResponse, errorResponse.statusCode || 400);
    }
  },

  /**
   * DELETE /observations/:id
   * Delete an observation
   */
  async deleteObservation(c: Context) {
    try {
      const userId = c.get("userId");
      const id = c.req.param("id");

      if (!userId) {
        return c.json(
          { success: false, error: "Unauthorized" },
          401
        );
      }

      await ObservationService.deleteObservation(id, userId);

      return c.json({
        success: true,
        message: "Observation deleted successfully",
      });
    } catch (error: any) {
      const errorResponse = formatErrorResponse(error);
      return c.json(errorResponse, errorResponse.statusCode || 400);
    }
  },

  /**
   * GET /species/search
   * Search for species
   */
  async searchSpecies(c: Context) {
    try {
      const query = c.req.query("q");
      const type = c.req.query("type") as "lepidoptera" | "plant" | undefined;

      if (!query || !type) {
        return c.json(
          {
            success: false,
            error: "Missing required parameters: q and type",
          },
          400
        );
      }

      const species = await ObservationService.searchSpecies({
        query,
        type,
      } as SearchSpeciesParams);

      return c.json({
        success: true,
        data: species,
      });
    } catch (error: any) {
      const errorResponse = formatErrorResponse(error);
      return c.json(errorResponse, errorResponse.statusCode || 400);
    }
  },

  /**
   * GET /relationships/:lepidopteraId/:plantId/observations
   * Get observations for a specific relationship
   */
  async getRelationshipObservations(c: Context) {
    try {
      const lepidopteraId = c.req.param("lepidopteraId");
      const plantId = c.req.param("plantId");

      const observations =
        await ObservationService.getRelationshipObservations(
          lepidopteraId,
          plantId
        );

      return c.json({
        success: true,
        data: observations,
      });
    } catch (error: any) {
      const errorResponse = formatErrorResponse(error);
      return c.json(errorResponse, errorResponse.statusCode || 400);
    }
  },
};
