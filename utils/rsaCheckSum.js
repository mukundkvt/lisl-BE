import crypto from "crypto";

/**
 * Encrypt SHA256 hash using RSA public key and convert to Base64
 * @param {string} sha256Hash
 * @param {string} publicKey
 * @returns {string} base64 encoded checksum
 */
export const generateChecksumRSA = (sha256Hash, publicKey) => {
  if (!sha256Hash) {
    throw new Error("SHA256 hash is required for RSA encryption");
  }
  if (!publicKey) {
    throw new Error("Public key is required for RSA encryption");
  }

  const buffer = Buffer.from(sha256Hash, "utf8");

  const encrypted = crypto.publicEncrypt(
    {
      key: publicKey,
      padding: crypto.constants.RSA_PKCS1_PADDING,
    },
    buffer
  );

  return encrypted.toString("base64");
};
