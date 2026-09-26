import { Request, Response, NextFunction } from "express";
import multer, { FileFilterCallback } from "multer";
import { ApiError } from "../utils/ApiError";

// 25MB maximum file size limit per file
const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;
const MAX_FILE_COUNT = 10;

// Permitted MIME types for task proofs, screenshots, PDF documentation, and demo videos
const ALLOWED_MIME_TYPES = new Set([
  // Images
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "image/bmp",
  // Documents
  "application/pdf",
  // Videos
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-matroska",
  "video/mpeg",
]);

/**
 * Custom file filter validating format against allowed media types.
 */
const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  callback: FileFilterCallback
): void => {
  if (ALLOWED_MIME_TYPES.has(file.mimetype.toLowerCase())) {
    callback(null, true);
  } else {
    callback(
      new ApiError(
        400,
        `Unsupported file type '${file.mimetype}'. Only images (JPEG, PNG, WebP, GIF, SVG), PDFs, and videos (MP4, WebM, MOV, MKV) are allowed.`
      )
    );
  }
};

// Memory storage keeps buffer in RAM for direct streaming to Cloudinary
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: MAX_FILE_COUNT,
  },
  fileFilter,
});

/**
 * Express middleware for single file upload (field name: 'file').
 * Intercepts Multer errors and formats them as standard ApiError responses.
 */
export const uploadSingleFile = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const single = upload.single("file");

  single(req, res, (err: any) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return next(
            new ApiError(400, `File exceeds maximum allowed size limit of 25MB.`)
          );
        }
        if (err.code === "LIMIT_UNEXPECTED_FILE") {
          return next(
            new ApiError(
              400,
              `Unexpected field name '${err.field}'. Use 'file' or 'files' as the multipart form-data field name.`
            )
          );
        }
        return next(new ApiError(400, `Upload error: ${err.message}`));
      }
      return next(err);
    }
    next();
  });
};

/**
 * Express middleware for multiple files upload (field name: 'files', max 10).
 */
export const uploadMultipleFiles = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const multiple = upload.array("files", MAX_FILE_COUNT);

  multiple(req, res, (err: any) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return next(
            new ApiError(400, `One or more files exceed the 25MB size limit.`)
          );
        }
        if (err.code === "LIMIT_FILE_COUNT") {
          return next(
            new ApiError(400, `Maximum ${MAX_FILE_COUNT} files can be uploaded at once.`)
          );
        }
        return next(new ApiError(400, `Upload error: ${err.message}`));
      }
      return next(err);
    }
    next();
  });
};

/**
 * Flexible Express middleware accepting both single ('file') and multiple ('files') fields.
 * Populates req.file (if single) and req.files (array or dictionary of uploaded files).
 */
export const uploadTaskAttachments = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const flexible = upload.fields([
    { name: "file", maxCount: 1 },
    { name: "files", maxCount: MAX_FILE_COUNT },
  ]);

  flexible(req, res, (err: any) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return next(
            new ApiError(400, "One or more files exceed the 25MB size limit.")
          );
        }
        if (err.code === "LIMIT_FILE_COUNT" || err.code === "LIMIT_UNEXPECTED_FILE") {
          return next(
            new ApiError(
              400,
              `Too many files or unexpected field name '${err.field || "unknown"}'. Maximum ${MAX_FILE_COUNT} files allowed under 'file' or 'files'.`
            )
          );
        }
        return next(new ApiError(400, `Upload error: ${err.message}`));
      }
      return next(err);
    }

    // Normalization helper: if single 'file' field was uploaded, also set req.file
    const filesDict = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    if (filesDict) {
      if (filesDict["file"] && filesDict["file"].length > 0 && !req.file) {
        req.file = filesDict["file"][0];
      }
    }

    next();
  });
};
