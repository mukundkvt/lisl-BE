import crypto from "crypto";

export const generateMD5 = (password) => {
  if (!password) {
    throw new Error("Password is required for MD5 generation");
  }

  return crypto
    .createHash("md5")
    .update(password)
    .digest("hex");
};
