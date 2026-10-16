import nodemailer from "nodemailer";

/**
 * Creates a configured Nodemailer transporter that automatically
 * handles port 465 (Direct SSL) vs port 587/25 (STARTTLS) and supports automatic fallback.
 */
export const createSmtpTransporter = (customOptions = {}) => {
  const host = customOptions.host || process.env.SMTP_HOST || "smtp.office365.com";
  const port = parseInt(customOptions.port || process.env.SMTP_PORT || "587", 10);
  const user = customOptions.user || process.env.SMTP_USER;
  const pass = customOptions.pass || process.env.SMTP_PASS;

  // Port 465 is for direct SSL/TLS. Ports 587, 25, 2525 use STARTTLS (secure = false).
  // If SMTP_SECURE is explicitly set, we honor it unless port is 587/25 (which can never be direct SSL).
  let isSecure = port === 465;
  if (process.env.SMTP_SECURE !== undefined && process.env.SMTP_SECURE !== "") {
    const envSecure = String(process.env.SMTP_SECURE).toLowerCase() === "true";
    if (port === 587 || port === 25) {
      // 587 / 25 require STARTTLS (secure: false). Direct SSL causes "wrong version number" error.
      isSecure = false;
    } else {
      isSecure = envSecure;
    }
  }

  const transportConfig = {
    host,
    port,
    secure: isSecure,
    auth: user && pass ? { user, pass } : undefined,
    tls: {
      rejectUnauthorized: false, // Prevents self-signed cert issues
    },
    ...customOptions,
  };

  // If port 587 or 25, ensure requireTLS is handled smoothly
  if (port === 587) {
    transportConfig.requireTLS = true;
  }

  return nodemailer.createTransport(transportConfig);
};

/**
 * Send an email with automatic error recovery/fallback between STARTTLS (587) and Direct SSL (465).
 */
export const sendEmailWithFallback = async (mailOptions) => {
  const fromUser = process.env.SMTP_USER || "noreply@lakshmishree.com";
  const defaultFrom = `"Lakshmishree Investment & Securities Limited" <${fromUser}>`;

  const finalMailOptions = {
    from: mailOptions.from || defaultFrom,
    ...mailOptions,
  };

  // 1. Primary Attempt
  try {
    const primaryTransporter = createSmtpTransporter();
    const info = await primaryTransporter.sendMail(finalMailOptions);
    return { success: true, info };
  } catch (primaryError) {
    console.warn("⚠️ Primary SMTP attempt failed:", primaryError.message);

    // 2. Fallback Attempt (toggle secure/port configuration)
    try {
      const currentPort = parseInt(process.env.SMTP_PORT || "587", 10);
      const fallbackPort = currentPort === 465 ? 587 : 465;
      const fallbackSecure = fallbackPort === 465;

      console.log(`🔄 Retrying with fallback SMTP configuration (Port: ${fallbackPort}, Secure: ${fallbackSecure})...`);

      const fallbackTransporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || "smtp.office365.com",
        port: fallbackPort,
        secure: fallbackSecure,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
        tls: { rejectUnauthorized: false },
        requireTLS: fallbackPort === 587,
      });

      const fallbackInfo = await fallbackTransporter.sendMail(finalMailOptions);
      console.log("✅ Fallback SMTP email sent successfully!");
      return { success: true, info: fallbackInfo };
    } catch (fallbackError) {
      console.error("❌ Fallback SMTP attempt also failed:", fallbackError.message);
      throw primaryError; // throw the original error with context
    }
  }
};
