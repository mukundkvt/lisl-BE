import crypto from "crypto";

/**
 * CAMS Encryption Utility
 * Uses Base64 encoded key & IV provided by CAMS
 */

const ALGORITHM = "aes-256-cbc";

const getKeys = () => {
  if (!process.env.CAMS_ENCRYPTION_KEY || !process.env.CAMS_ENCRYPTION_IV) {
    console.warn("⚠️ CAMS Encryption keys are missing in environment variables. Encryption will fail.");
    return { KEY: null, IV: null };
  }
  return {
    KEY: Buffer.from(process.env.CAMS_ENCRYPTION_KEY, "base64"),
    IV: Buffer.from(process.env.CAMS_ENCRYPTION_IV, "base64")
  };
};

export const encryptPayload = (payload) => {
  const { KEY, IV } = getKeys();

  if (!KEY || !IV) {
    throw new Error("CAMS Encryption keys are missing");
  }

  console.log("🔐 Encryption Debug:");
  console.log(`  Algorithm: ${ALGORITHM}`);
  console.log(`  Key Length: ${KEY.length}`);
  console.log(`  IV Length: ${IV.length}`);
  console.log(`  IV (hex): ${IV.toString("hex")}`);
  if (!payload) {
    throw new Error("Payload is required for encryption");
  }

  if (KEY.length !== 32) {
    throw new Error("Invalid encryption key length");
  }

  if (IV.length !== 16) {
    throw new Error("Invalid IV length");
  }

  const cipher = crypto.createCipheriv(ALGORITHM, KEY, IV);

  let encrypted = cipher.update(JSON.stringify(payload), "utf8", "base64");

  encrypted += cipher.final("base64");

  return encrypted;
};

export const decryptPayload = (encryptedData) => {
  const { KEY, IV } = getKeys();

  if (!KEY || !IV) {
    throw new Error("CAMS Encryption keys are missing");
  }

  if (!encryptedData) {
    throw new Error("Encrypted data is required for decryption");
  }

  try {
    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, IV);
    let decrypted = decipher.update(encryptedData, "base64", "utf8");
    decrypted += decipher.final("utf8");
    return JSON.parse(decrypted);
  } catch (error) {
    console.error("❌ CAMS Decryption Failed:", error.message);
    throw new Error("Failed to decrypt CAMS payload: " + error.message);
  }
};
