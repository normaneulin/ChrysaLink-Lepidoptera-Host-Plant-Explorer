import { supabase } from "../config/supabase.ts";

/**
 * Storage Service
 * Handles image uploads to Supabase Storage
 */

const BUCKET_NAME = "observation-images";

export const StorageService = {
  /**
   * Upload base64 image to Supabase Storage
   * Returns the public URL and storage path
   */
  async uploadImage(
    base64Image: string,
    userId: string,
    type: "lepidoptera" | "plant"
  ): Promise<{ url: string; path: string }> {
    try {
      // Extract base64 data and content type
      const matches = base64Image.match(/^data:(.+);base64,(.+)$/);
      if (!matches || matches.length !== 3) {
        throw new Error("Invalid base64 image format");
      }

      const contentType = matches[1];
      const base64Data = matches[2];

      // Convert base64 to binary
      const binaryData = Uint8Array.from(atob(base64Data), (c) =>
        c.charCodeAt(0)
      );

      // Generate unique filename
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(7);
      const extension = contentType.split("/")[1] || "jpg";
      const filename = `${userId}/${type}_${timestamp}_${random}.${extension}`;

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(filename, binaryData, {
          contentType,
          upsert: false,
        });

      if (error) {
        throw new Error(`Storage upload failed: ${error.message}`);
      }

      // Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from(BUCKET_NAME).getPublicUrl(filename);

      return {
        url: publicUrl,
        path: filename,
      };
    } catch (error: any) {
      throw new Error(`Image upload failed: ${error.message}`);
    }
  },

  /**
   * Delete image from storage
   */
  async deleteImage(path: string): Promise<void> {
    try {
      const { error } = await supabase.storage
        .from(BUCKET_NAME)
        .remove([path]);

      if (error) {
        throw new Error(`Storage deletion failed: ${error.message}`);
      }
    } catch (error: any) {
      console.error("Failed to delete image:", error);
      // Don't throw - deletion failures shouldn't break the main flow
    }
  },
};
