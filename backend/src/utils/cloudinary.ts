import { cloudinary, isCloudinaryConfigured } from "../config/cloudinary";
import { env } from "../config/env";
import { ApiError } from "./ApiError";

export interface CloudinaryUploadResult {
  url: string;
  secureUrl: string;
  publicId: string;
  format: string;
  resourceType: string;
  bytes: number;
  originalFilename?: string;
}

export interface CloudinaryUploadOptions {
  folder?: string;
  resourceType?: "auto" | "image" | "video" | "raw";
  tags?: string[];
  originalFilename?: string;
}

export interface CloudinaryDeleteOptions {
  resourceType?: "auto" | "image" | "video" | "raw";
  invalidate?: boolean;
}

export interface CloudinaryDeleteResult {
  publicId: string;
  result: string; // "ok", "not found", etc.
}

/**
 * Streams an in-memory file buffer directly to Cloudinary.
 *
 * @param buffer The file buffer in memory from multer.
 * @param options Upload options including target folder, resourceType, and tags.
 * @returns Promise resolving to Cloudinary upload result metadata.
 */
export const uploadBufferToCloudinary = async (
  buffer: Buffer,
  options: CloudinaryUploadOptions = {}
): Promise<CloudinaryUploadResult> => {
  if (!isCloudinaryConfigured()) {
    throw new ApiError(
      500,
      "Cloudinary is not configured. Please configure CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in the server environment."
    );
  }

  const targetFolder = options.folder || env.CLOUDINARY_FOLDER || "teamflow/tasks";
  const resourceType = options.resourceType || "auto";

  return new Promise<CloudinaryUploadResult>((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: targetFolder,
        resource_type: resourceType,
        tags: options.tags || ["task-attachment"],
      },
      (error, result) => {
        if (error || !result) {
          console.error("[Cloudinary] Upload failed:", error);
          return reject(
            new ApiError(
              500,
              `Cloudinary upload failed: ${error?.message || "Unknown error during cloud upload"}`
            )
          );
        }

        resolve({
          url: result.url,
          secureUrl: result.secure_url,
          publicId: result.public_id,
          format: result.format,
          resourceType: result.resource_type,
          bytes: result.bytes,
          originalFilename: options.originalFilename,
        });
      }
    );

    uploadStream.end(buffer);
  });
};

/**
 * Deletes an asset from Cloudinary by its publicId.
 *
 * @param publicId Cloudinary asset public ID.
 * @param options Deletion options including resourceType ("image", "raw", "video", "auto") and cache invalidation.
 * @returns Promise resolving to deletion status.
 */
export const deleteFromCloudinary = async (
  publicId: string,
  options: CloudinaryDeleteOptions = {}
): Promise<CloudinaryDeleteResult> => {
  if (!isCloudinaryConfigured()) {
    throw new ApiError(
      500,
      "Cloudinary is not configured. Please configure CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in the server environment."
    );
  }

  if (!publicId || typeof publicId !== "string" || !publicId.trim()) {
    throw new ApiError(400, "A valid Cloudinary publicId is required for deletion");
  }

  const resourceType = options.resourceType || "image";

  try {
    const result = await cloudinary.uploader.destroy(publicId.trim(), {
      resource_type: resourceType,
      invalidate: options.invalidate ?? true,
    });

    if (result.result !== "ok" && result.result !== "not found") {
      // If resourceType was default/mismatched and result is not ok, attempt with other resource types
      if (resourceType === "image") {
        const rawAttempt = await cloudinary.uploader.destroy(publicId.trim(), {
          resource_type: "raw",
          invalidate: options.invalidate ?? true,
        });
        if (rawAttempt.result === "ok") {
          return { publicId, result: rawAttempt.result };
        }

        const videoAttempt = await cloudinary.uploader.destroy(publicId.trim(), {
          resource_type: "video",
          invalidate: options.invalidate ?? true,
        });
        if (videoAttempt.result === "ok") {
          return { publicId, result: videoAttempt.result };
        }
      }
    }

    return {
      publicId,
      result: result.result || "ok",
    };
  } catch (error: any) {
    console.error(`[Cloudinary] Delete failed for publicId '${publicId}':`, error);
    throw new ApiError(
      500,
      `Cloudinary file deletion failed: ${error?.message || "Unknown error during cloud deletion"}`
    );
  }
};

/**
 * Deletes multiple assets from Cloudinary.
 *
 * @param publicIds Array of Cloudinary asset public IDs.
 * @param options Deletion options.
 * @returns Promise resolving to an array of deletion results.
 */
export const deleteMultipleFromCloudinary = async (
  publicIds: string[],
  options: CloudinaryDeleteOptions = {}
): Promise<CloudinaryDeleteResult[]> => {
  if (!publicIds || publicIds.length === 0) {
    return [];
  }

  return Promise.all(
    publicIds.map((id) => deleteFromCloudinary(id, options))
  );
};
