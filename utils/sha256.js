import crypto from "crypto";

/**
 * Generate SHA256 hash of a string payload
 * @param {string} payload
 * @returns {string} sha256 hash (hex)
 */
export const generateSHA256 = (payload) => {
  if (!payload) {
    throw new Error("Payload is required for SHA256 generation");
  }

  return crypto
    .createHash("sha256")
    .update(payload)
    .digest("hex");
};
