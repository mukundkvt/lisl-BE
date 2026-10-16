// For User

import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { PDFDocument } from "pdf-lib";
import { uploadToMinio, deleteFromMinio } from "../utils/minioClient.js";
import { getISTDate } from "../utils/convertToIndianTimeDate.js";

const uploadSignature = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "No token provided" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    const user = await User.findOne({ mobileNumber: decoded.mobileNumber });
    if (!user || !user.PAN) return res.status(404).json({ message: "User or PAN not found" });

    // Get base64 signature data from request body
    const { signature } = req.body;
    if (!signature) return res.status(400).json({ message: "Signature data is required" });

    // Validate image format and extract base64 data
    const formatMatch = signature.match(/^data:image\/(\w+);base64,/);
    if (!formatMatch) {
      return res.status(400).json({ message: "Invalid image format. Must be a base64 encoded image." });
    }

    const imageFormat = formatMatch[1].toLowerCase();
    const validFormats = ['png', 'jpeg', 'jpg', 'gif', 'webp'];
    if (!validFormats.includes(imageFormat)) {
      return res.status(400).json({ message: `Unsupported image format. Supported formats are: ${validFormats.join(', ')}` });
    }

    const base64Data = signature.replace(/^data:image\/\w+;base64,/, "");
    const imageBuffer = Buffer.from(base64Data, 'base64');

    const timestamp = Date.now();
    const imageFileName = `${user.PAN}_signature_${timestamp}.jpg`;
    const pdfFileName = `${user.PAN}_signature_${timestamp}.pdf`;

    // Delete previous signature files from MinIO if present
    if (user.signature?.signature_image) {
      try {
        await deleteFromMinio(user.signature.signature_image);
      } catch (err) {}
    }
    if (user.signature?.signature_pdf) {
      try {
        await deleteFromMinio(user.signature.signature_pdf);
      } catch (err) {}
    }

    // Upload signature image directly to MinIO
    await uploadToMinio(`uploads/${imageFileName}`, imageBuffer, `image/${imageFormat === 'jpg' ? 'jpeg' : imageFormat}`);

    // Create PDF with signature
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]); // A4 size
    const { width, height } = page.getSize();

    // Add heading at the top
    const helveticaFont = await pdfDoc.embedFont('Helvetica');
    const headingY = height - 100;
    page.drawText('Signature:', {
      x: 50,
      y: headingY,
      size: 24,
      font: helveticaFont
    });

    // Embed image based on format
    const embeddedImage = imageFormat === 'png' 
      ? await pdfDoc.embedPng(imageBuffer)
      : await pdfDoc.embedJpg(imageBuffer);
    
    // Calculate dimensions to maintain aspect ratio and fit within page width
    const maxWidth = width - 100;
    const scale = maxWidth / embeddedImage.width;
    const imageDims = embeddedImage.scale(Math.min(scale, 0.5));
    
    page.drawImage(embeddedImage, {
      x: (width - imageDims.width) / 2,
      y: headingY - imageDims.height - 50,
      width: imageDims.width,
      height: imageDims.height,
    });

    // Save PDF as Buffer and upload to MinIO
    const pdfBytes = await pdfDoc.save();
    const pdfBuffer = Buffer.from(pdfBytes);
    await uploadToMinio(`uploads/${pdfFileName}`, pdfBuffer, "application/pdf");

    // Update user's signature information in database
    user.signature = {
      signature_image: `uploads/${imageFileName}`,
      signature_pdf: `uploads/${pdfFileName}`,
    };
    
    user.max_step_completed = Math.max(user.max_step_completed || 0, 8);
    
    // In rejection mode, record step 7 (Signature) completion
    if (!user.rejectedStepsDone) user.rejectedStepsDone = [];
    if (user.rejectedSteps?.includes(7) && !user.rejectedStepsDone.includes(7)) {
      user.rejectedStepsDone.push(7);
    }
    // Auto-approve signature on upload/process
    if (!user.approvals) user.approvals = {};
    if (!user.approvals.signature) user.approvals.signature = {};
    user.approvals.signature.status = "approved";
    user.approvals.signature.autoApproved = true;
    user.approvals.signature.approveAt = getISTDate(new Date());
    user.approvals.signature.rejectionReason = undefined;
    user.approvals.signature.rejectedBy = undefined;
    user.approvals.signature.rejectedAt = undefined;
    await user.save();

    res.status(200).json({
      message: "Signature uploaded successfully",
      data: {
        signature_image: user.signature.signature_image,
        signature_pdf: user.signature.signature_pdf
      }
    });

  } catch (error) {
    console.error("Error uploading signature:", error);
    res.status(500).json({ message: "Error uploading signature", error: error.message });
  }
};

export { uploadSignature };
