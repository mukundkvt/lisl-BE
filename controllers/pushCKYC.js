import User from "../models/User.js";
import fs from "node:fs/promises";
import path from "node:path";
import { PassThrough } from "node:stream";
import archiver from "archiver";
import sharp from "sharp";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { v4 as uuidv4 } from "uuid";
import { getISTDate } from "../utils/convertToIndianTimeDate.js";
import { getFileBufferFromMinio } from "../utils/minioClient.js";

const CKYC_VERSION = "V1.3";
const DETAIL_20_FIELD_COUNT = 121;
const DETAIL_30_FIELD_COUNT = 12;
const DETAIL_70_FIELD_COUNT = 9;
const MAX_USERS_PER_BULK = 50;
const MAX_ZIP_BYTES = 25 * 1024 * 1024;

const formatDDMMYYYY = (dateInput) => {
  if (!dateInput) return "";
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = String(d.getFullYear());
  return `${dd}${mm}${yyyy}`;
};

const formatDD_MM_YYYY = (dateInput) => {
  if (!dateInput) return "";
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = String(d.getFullYear());
  return `${dd}-${mm}-${yyyy}`;
};

const sanitize = (value, maxLen) => {
  const s = String(value ?? "")
    .replaceAll("|", " ")
    .replaceAll("\r", " ")
    .replaceAll("\n", " ")
    .trim();
  if (!maxLen) return s;
  return s.length > maxLen ? s.slice(0, maxLen) : s;
};

const padNumber = (value, length) => {
  const s = String(value ?? "").replaceAll(/\D/g, "");
  return s.padStart(length, "0").slice(-length);
};

const resolveFilePath = async (maybePath) => {
  const p = String(maybePath ?? "").trim();
  if (!p) return null;
  if (path.isAbsolute(p)) return p;
  const normalized = p.replaceAll("\\", "/");
  const candidates = [
    path.join(process.cwd(), normalized),
    path.join(process.cwd(), "uploads", normalized.replace(/^uploads\//, "")),
  ];
  for (const c of candidates) {
    try {
      await fs.access(c);
      return c;
    } catch {
      continue;
    }
  }
  return null;
};

const readFileBuffer = async (maybePath) => {
  if (!maybePath) return null;
  try {
    return await getFileBufferFromMinio(maybePath);
  } catch {
    return null;
  }
};

const toJpegBuffer = async (inputBuffer) => {
  if (!inputBuffer) return null;
  try {
    return await sharp(inputBuffer).jpeg({ quality: 85 }).toBuffer();
  } catch {
    return null;
  }
};

const createPdfFromImages = async (imageBuffers) => {
  const pdfDoc = await PDFDocument.create();
  for (const b of imageBuffers) {
    if (!b) continue;
    const normalized = await sharp(b).png().toBuffer();
    const embedded = await pdfDoc.embedPng(normalized);
    const { width, height } = embedded.scale(1);
    const page = pdfDoc.addPage([width, height]);
    page.drawImage(embedded, { x: 0, y: 0, width, height });
  }
  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
};

const isPdfBuffer = (buffer) => {
  if (!Buffer.isBuffer(buffer)) return false;
  if (buffer.length < 4) return false;
  return buffer.subarray(0, 4).toString("utf8") === "%PDF";
};

const createPdfFromMixedBuffers = async (buffers) => {
  const out = await PDFDocument.create();
  for (const b of buffers) {
    if (!b) continue;
    if (isPdfBuffer(b)) {
      const src = await PDFDocument.load(b);
      const copiedPages = await out.copyPages(src, src.getPageIndices());
      for (const p of copiedPages) out.addPage(p);
      continue;
    }

    const normalized = await sharp(b).rotate().jpeg({ quality: 80 }).toBuffer();
    const embedded = await out.embedJpg(normalized);
    const { width, height } = embedded.scale(1);
    const page = out.addPage([width, height]);
    page.drawImage(embedded, { x: 0, y: 0, width, height });
  }
  const bytes = await out.save();
  return Buffer.from(bytes);
};

export const createPoaPdfA4 = async ({ frontBuffer, backBuffer }) => {
  const A4_W = 595.28;
  const A4_H = 841.89;
  const margin = 36;
  const mmToPt = (mm) => (mm * 72) / 25.4;
  const cardW = mmToPt(85.6);
  const cardH = mmToPt(53.98);
  const cardPad = 6;

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([A4_W, A4_H]);
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const title = "Address Proof:";
  const titleSize = 14;
  const titleY = A4_H - margin - titleSize;
  page.drawText(title, { x: margin, y: titleY, size: titleSize, font, color: rgb(0, 0, 0) });

  const slotY = titleY - 18 - cardH;
  const leftX = margin;
  const rightX = A4_W - margin - cardW;

  const slots = [];
  if (frontBuffer) slots.push({ buffer: frontBuffer, x: leftX, y: slotY });
  if (backBuffer) slots.push({ buffer: backBuffer, x: rightX, y: slotY });
  if (slots.length === 1) slots[0].x = (A4_W - cardW) / 2;

  const drawIntoSlot = async (buf, x, y) => {
    const innerW = cardW - cardPad * 2;
    const innerH = cardH - cardPad * 2;

    if (isPdfBuffer(buf)) {
      const embeddedPages = await pdfDoc.embedPdf(buf, [0]);
      const embedded = embeddedPages[0];
      const scale = Math.min(innerW / embedded.width, innerH / embedded.height);
      const w = embedded.width * scale;
      const h = embedded.height * scale;
      const dx = x + cardPad + (innerW - w) / 2;
      const dy = y + cardPad + (innerH - h) / 2;
      page.drawPage(embedded, { x: dx, y: dy, xScale: scale, yScale: scale });
      return;
    }

    const normalized = await sharp(buf)
      .rotate()
      .resize({ width: 1200, height: 800, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();
    const embedded = await pdfDoc.embedJpg(normalized);
    const scale = Math.min(innerW / embedded.width, innerH / embedded.height);
    const w = embedded.width * scale;
    const h = embedded.height * scale;
    const dx = x + cardPad + (innerW - w) / 2;
    const dy = y + cardPad + (innerH - h) / 2;
    page.drawImage(embedded, { x: dx, y: dy, width: w, height: h });
  };

  for (const s of slots) {
    await drawIntoSlot(s.buffer, s.x, s.y);
  }

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
};

const getDocumentMasterCodeForPoa = (addressProofType) => {
  switch (addressProofType) {
    case "aadhaar":
      return "04";
    case "passport":
      return "05";
    case "driving_license":
      return "06";
    case "voter_id":
      return "07";
    default:
      return "";
  }
};

const getProofOfAddressMasterCode = (addressProofType) => {
  switch (addressProofType) {
    case "aadhaar":
      return "1";
    case "passport":
      return "2";
    case "driving_license":
      return "3";
    case "voter_id":
      return "4";
    default:
      return "";
  }
};

const buildHeader10 = ({
  batchNumber,
  fiCode,
  regionOrBranchCode,
  totalDetailRecords,
  createDate,
  custType,
}) => {
  const fields = [
    "10",
    sanitize(batchNumber, 5),
    sanitize(fiCode, 7),
    sanitize(regionOrBranchCode, 10),
    String(totalDetailRecords ?? 0),
    formatDD_MM_YYYY(createDate),
    CKYC_VERSION,
    custType,
    "",
    "",
    "",
  ];
  return fields.join("|");
};

const buildDetail20 = ({ user, lineNumber, branchCode, fiReferenceNumber, cfg }) => {
  const fields = Array.from({ length: DETAIL_20_FIELD_COUNT }, () => "");
  const set = (sr, v, maxLen) => {
    const idx = sr - 1;
    if (idx < 0 || idx >= fields.length) return;
    fields[idx] = sanitize(v, maxLen);
  };

  const prefix =
    user?.prefix === "Mr" ? "Mr" : user?.prefix === "Mrs" ? "Mrs" : "Miss";
  const gender =
    user?.gender === "male" ? "M" : user?.gender === "female" ? "F" : "";

  const firstName = user?.name?.firstName || "";
  const middleName = user?.name?.middleName || "";
  const lastName = user?.name?.lastName || "";

  set(1, "20");
  set(2, padNumber(lineNumber, 5));
  set(3, "01");
  set(4, branchCode, 10);

  set(15, "1", 2);
  set(18, "01", 2);
  set(19, fiReferenceNumber, 14);

  set(20, prefix, 5);
  set(21, firstName, 50);
  set(22, middleName, 50);
  set(23, lastName, 50);
  set(41, gender, 1);
  set(45, formatDD_MM_YYYY(user?.dateOfBirth), 10);
  set(53, user?.PAN, 10);
  set(54, "01", 2);
  set(55, "0", 1);

  set(61, user?.address?.addressLine1, 55);
  set(62, user?.address?.addressLine2, 55);
  set(63, user?.address?.addressLine3, 55);
  set(64, user?.address?.city, 50);
  set(66, user?.address?.stateCode, 2);
  set(67, user?.address?.countryCode || "IN", 2);
  set(68, user?.address?.pincode, 10);
  set(69, getProofOfAddressMasterCode(user?.addressProof?.type), 3);

  set(71, "Y", 1);

  set(73, user?.address?.addressLine1, 55);
  set(74, user?.address?.addressLine2, 55);
  set(75, user?.address?.addressLine3, 55);
  set(76, user?.address?.city, 50);
  set(78, user?.address?.stateCode, 2);
  set(79, user?.address?.countryCode || "IN", 2);
  set(80, user?.address?.pincode, 10);
  set(81, getDocumentMasterCodeForPoa(user?.addressProof?.type), 2);

  const mobile = String(user?.mobileNumber ?? "");
  set(96, mobile ? "91" : "", 3);
  set(97, mobile, 20);
  set(100, user?.email, 100);

  set(102, formatDD_MM_YYYY(cfg.kycVerificationDate), 10);
  set(103, cfg.placeOfDeclaration || user?.address?.city, 50);
  set(104, formatDD_MM_YYYY(cfg.kycVerificationDate), 10);
  set(105, cfg.typeOfDocumentSubmitted || "04", 2);
  set(106, cfg.verifierName, 150);
  set(107, cfg.verifierDesignation || "Officer", 50);
  set(108, cfg.verifierBranch || cfg.branchCode, 50);
  set(109, cfg.verifierEmpCode, 50);
  set(110, cfg.organisationName, 150);
  set(111, cfg.organisationCode, 7);

  set(112, "1", 2);
  set(113, "0", 3);
  set(115, "0", 2);
  set(116, "3", 2);
  set(121, fiReferenceNumber, 14);

  return fields.join("|");
};

const buildDetail30 = ({ lineNumber, idType, idNumber }) => {
  const fields = Array.from({ length: DETAIL_30_FIELD_COUNT }, () => "");
  const set = (sr, v, maxLen) => {
    const idx = sr - 1;
    if (idx < 0 || idx >= fields.length) return;
    fields[idx] = sanitize(v, maxLen);
  };
  set(1, "30");
  set(2, padNumber(lineNumber, 5));
  set(3, idType, 3);
  set(4, idNumber, 30);
  return fields.join("|");
};

const buildDetail70 = ({ lineNumber, imageName, imageType }) => {
  const fields = Array.from({ length: DETAIL_70_FIELD_COUNT }, () => "");
  const set = (sr, v, maxLen) => {
    const idx = sr - 1;
    if (idx < 0 || idx >= fields.length) return;
    fields[idx] = sanitize(v, maxLen);
  };
  set(1, "70");
  set(2, padNumber(lineNumber, 7));
  set(3, imageName, 50);
  set(4, imageType, 2);
  return fields.join("|");
};

const validateEnv = (cfg) => {
  const missing = [];
  for (const [k, v] of Object.entries(cfg)) {
    if (v === undefined || v === null || String(v).trim() === "") missing.push(k);
  }
  return missing;
};

export const validateUserForCkyc = (user) => {
  const issues = [];
  if (!user?.PAN) issues.push("PAN missing");
  if (!user?.dateOfBirth) issues.push("DOB missing");
  if (!user?.name?.firstName && !user?.name?.fullName) issues.push("Name missing");
  if (!user?.prefix && !user?.gender) issues.push("Prefix missing");
  if (!user?.gender) issues.push("Gender missing");
  if (!user?.address?.addressLine1) issues.push("Address line 1 missing");
  if (!user?.address?.city) issues.push("City missing");
  if (!user?.address?.stateCode) issues.push("State code missing");
  if (!user?.address?.pincode) issues.push("Pincode missing");
  if (!user?.addressProof?.type) issues.push("Address proof type missing");
  if (!user?.aadhaar_file && !user?.addressProof?.frontImage && !user?.addressProof?.backImage) {
    issues.push("Address proof missing");
  }
  if (!user?.mobileNumber) issues.push("Mobile number missing");
  return issues;
};

export const isUserEligibleForCkyc = (user) => {
  if (!user) return false;
  if (validateUserForCkyc(user).length > 0) return false;
  const photo = user?.ipv_details?.capturedImage || user?.aadhaar_photo;
  const signature = user?.signature?.signature_pdf || user?.signature?.signature_image;
  const poa = user?.aadhaar_file || user?.addressProof?.frontImage || user?.addressProof?.backImage;
  return Boolean(photo && signature && poa);
};

const buildZipBuffer = async (appendFn) => {
  const archive = archiver("zip", { zlib: { level: 9 } });
  const out = new PassThrough();
  const chunks = [];

  out.on("data", (c) => chunks.push(c));

  const done = new Promise((resolve, reject) => {
    out.once("end", resolve);
    out.once("error", reject);
    archive.once("error", reject);
  });

  archive.pipe(out);
  appendFn(archive);
  await archive.finalize();
  await done;

  return Buffer.concat(chunks);
};

export const generateCkycBulkZip = async (req, res) => {
  const now = getISTDate(new Date());

  const uploaderIdRaw =
    req.user?.employeeId ||
    req.user?.email ||
    req.user?.mobileNumber ||
    req.user?._id ||
    "SYSTEM";
  const uploaderId = sanitize(String(uploaderIdRaw).replaceAll(/[^a-zA-Z0-9]/g, ""), 12) || "SYSTEM";

  const cfgOverride = req.body?.ckycConfig && typeof req.body.ckycConfig === "object"
    ? req.body.ckycConfig
    : {};

  const baseFiCode = cfgOverride.fiCode ?? process.env.CKYC_FI_CODE;
  const baseRegionOrBranchCode =
    cfgOverride.regionOrBranchCode ?? process.env.CKYC_REGION_OR_BRANCH_CODE;
  const baseBranchCode = cfgOverride.branchCode ?? process.env.CKYC_BRANCH_CODE;

  const cfg = {
    fiCode: baseFiCode,
    regionOrBranchCode: baseRegionOrBranchCode,
    branchCode: baseBranchCode,
    organisationName:
      cfgOverride.organisationName ?? process.env.CKYC_ORGANISATION_NAME,
    organisationCode:
      cfgOverride.organisationCode ?? process.env.CKYC_ORGANISATION_CODE ?? baseFiCode,
    verifierName: cfgOverride.verifierName ?? process.env.CKYC_VERIFIER_NAME ?? uploaderId,
    verifierEmpCode:
      cfgOverride.verifierEmpCode ?? process.env.CKYC_VERIFIER_EMP_CODE ?? uploaderId,
    verifierDesignation:
      (cfgOverride.verifierDesignation ?? process.env.CKYC_VERIFIER_DESIGNATION) ||
      "Officer",
    verifierBranch:
      (cfgOverride.verifierBranch ?? process.env.CKYC_VERIFIER_BRANCH) ||
      baseBranchCode ||
      baseRegionOrBranchCode,
    placeOfDeclaration:
      (cfgOverride.placeOfDeclaration ?? process.env.CKYC_PLACE_OF_DECLARATION) ||
      "NA",
    typeOfDocumentSubmitted:
      (cfgOverride.typeOfDocumentSubmitted ?? process.env.CKYC_DOC_SUBMITTED_TYPE) ||
      "04",
    kycVerificationDate: now,
  };

  const missingEnv = validateEnv(cfg);
  if (missingEnv.length > 0) {
    return res.status(400).json({
      message: "Missing CKYC configuration",
      missing: missingEnv,
    });
  }

  const requestedUserIds = Array.isArray(req.body?.userIds)
    ? req.body.userIds.filter(Boolean)
    : null;

  if (requestedUserIds?.length > MAX_USERS_PER_BULK) {
    return res.status(400).json({
      message: "Only 50 users allowed per CKYC bulk generation request",
      maxUsers: MAX_USERS_PER_BULK,
      requested: requestedUserIds.length,
    });
  }

  const query = requestedUserIds?.length
    ? { _id: { $in: requestedUserIds } }
    : {
        "pushTo.updateCkycStatus.status": { $ne: "success" },
      };

  const users = requestedUserIds?.length
    ? await User.find(query).lean()
    : await User.find(query).limit(MAX_USERS_PER_BULK).lean();
  if (!users || users.length === 0) {
    return res.status(404).json({ message: "No users found" });
  }

  const batchNumber = padNumber(String(Math.floor(Math.random() * 99999) + 1), 5);
  const fileDate = formatDDMMYYYY(now);
  const bulkFileName = `${sanitize(cfg.fiCode, 7)}_${sanitize(
    cfg.regionOrBranchCode,
    10
  )}_${fileDate}_${CKYC_VERSION}_${uploaderId}_U${batchNumber}.txt`;

  const included = [];
  const skipped = [];

  for (const u of users) {
    const issues = validateUserForCkyc(u);
    if (issues.length > 0) {
      skipped.push({ userId: String(u._id), issues });
      continue;
    }

    const photoSource = u?.ipv_details?.capturedImage || u?.aadhaar_photo || null;
    const photoBuf = await readFileBuffer(photoSource);
    const photoJpeg = await toJpegBuffer(photoBuf);
    if (!photoJpeg) {
      skipped.push({ userId: String(u._id), issues: ["Photograph missing"] });
      continue;
    }

    const signatureSource = u?.signature?.signature_pdf || u?.signature?.signature_image || null;
    const signatureBuf = await readFileBuffer(signatureSource);
    if (!signatureBuf) {
      skipped.push({ userId: String(u._id), issues: ["Signature missing"] });
      continue;
    }

    let poaPdf = null;
    const aadhaarProof = await readFileBuffer(u?.aadhaar_file);
    if (aadhaarProof) {
      poaPdf = await createPoaPdfA4({ frontBuffer: aadhaarProof, backBuffer: null });
    } else {
      const poaFront = await readFileBuffer(u?.addressProof?.frontImage);
      const poaBack = await readFileBuffer(u?.addressProof?.backImage);
      const buffers = [poaFront, poaBack].filter(Boolean);
      if (buffers.length === 0) {
        skipped.push({ userId: String(u._id), issues: ["Address proof missing"] });
        continue;
      }
      poaPdf = await createPoaPdfA4({ frontBuffer: poaFront, backBuffer: poaBack });
    }

    const fiRef = `IN${sanitize(cfg.fiCode, 4).padEnd(4, "A").toUpperCase()}${padNumber(
      uuidv4().replaceAll(/[^0-9]/g, ""),
      8
    )}`.slice(0, 14);

    const signatureExt =
      signatureSource?.toLowerCase()?.endsWith(".pdf") ? "pdf" : "jpg";
    const signatureFinal =
      signatureExt === "pdf" ? signatureBuf : await toJpegBuffer(signatureBuf);
    if (!signatureFinal) {
      skipped.push({ userId: String(u._id), issues: ["Signature invalid"] });
      continue;
    }

    included.push({
      user: u,
      fiReferenceNumber: fiRef,
      photo: { name: `${fiRef}_PHOTO.jpg`, buffer: photoJpeg, type: "02" },
      poa: {
        name: `${fiRef}_POA.pdf`,
        buffer: poaPdf,
        type: getDocumentMasterCodeForPoa(u?.addressProof?.type),
      },
      signature: {
        name: `${fiRef}_SIGNATURE.${signatureExt}`,
        buffer: signatureFinal,
        type: "09",
      },
    });
  }

  if (included.length === 0) {
    return res.status(400).json({
      message: "No eligible users to generate CKYC bulk file",
      skipped,
    });
  }

  let selected = included.slice(0, MAX_USERS_PER_BULK);

  const buildBulkText = (items) => {
    const lines = [];
    lines.push(
      buildHeader10({
        batchNumber,
        fiCode: cfg.fiCode,
        regionOrBranchCode: cfg.regionOrBranchCode,
        totalDetailRecords: items.length,
        createDate: now,
        custType: "01",
      })
    );

    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      const lineNumber = i + 1;
      lines.push(
        buildDetail20({
          user: item.user,
          lineNumber,
          branchCode: cfg.branchCode,
          fiReferenceNumber: item.fiReferenceNumber,
          cfg,
        })
      );
      lines.push(
        buildDetail30({
          lineNumber,
          idType: "C",
          idNumber: item.user.PAN,
        })
      );
      lines.push(
        buildDetail70({
          lineNumber,
          imageName: item.photo.name,
          imageType: item.photo.type,
        })
      );
      lines.push(
        buildDetail70({
          lineNumber,
          imageName: item.poa.name,
          imageType: item.poa.type,
        })
      );
      lines.push(
        buildDetail70({
          lineNumber,
          imageName: item.signature.name,
          imageType: item.signature.type,
        })
      );
    }

    return lines.join("\n") + "\n";
  };

  const estimateZipBytes = (bulkText, items) => {
    let total = Buffer.byteLength(bulkText, "utf8");
    for (const item of items) {
      const raw =
        (item.photo?.buffer?.length || 0) +
        (item.poa?.buffer?.length || 0) +
        (item.signature?.buffer?.length || 0);
      total += Math.ceil(raw * 1.1) + 512;
    }
    return total;
  };

  let bulkText = "";
  while (true) {
    bulkText = buildBulkText(selected);
    const estimatedBytes = estimateZipBytes(bulkText, selected);
    if (estimatedBytes <= MAX_ZIP_BYTES) break;
    if (selected.length <= 1) {
      return res.status(400).json({
        message: "CKYC bulk ZIP exceeds 25MB limit even for a single user",
        maxZipBytes: MAX_ZIP_BYTES,
        skipped,
      });
    }

    const removed = selected.pop();
    skipped.push({
      userId: String(removed.user._id),
      issues: ["ZIP size exceeds 25MB limit"],
    });
  }

  if (selected.length === 0) {
    return res.status(400).json({
      message: "No eligible users to generate CKYC bulk file",
      skipped,
    });
  }

  let userZipBuffers = [];
  while (true) {
    userZipBuffers = await Promise.all(
      selected.map(async (item) => {
        const zipName = `${item.fiReferenceNumber}.zip`;
        const zipBuffer = await buildZipBuffer((zip) => {
          zip.append(item.photo.buffer, { name: item.photo.name });
          zip.append(item.poa.buffer, { name: item.poa.name });
          zip.append(item.signature.buffer, { name: item.signature.name });
        });
        return { name: zipName, buffer: zipBuffer, userId: String(item.user._id) };
      })
    );

    const actualBytes =
      Buffer.byteLength(bulkText, "utf8") +
      userZipBuffers.reduce((sum, z) => sum + (z.buffer?.length || 0), 0);

    if (actualBytes <= MAX_ZIP_BYTES) break;
    if (selected.length <= 1) {
      return res.status(400).json({
        message: "CKYC bulk ZIP exceeds 25MB limit even for a single user",
        maxZipBytes: MAX_ZIP_BYTES,
        skipped,
      });
    }

    const removed = selected.pop();
    skipped.push({
      userId: String(removed.user._id),
      issues: ["ZIP size exceeds 25MB limit"],
    });
    bulkText = buildBulkText(selected);
  }

  res.setHeader("Content-Type", "application/zip");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=\"${bulkFileName.replace(/\.txt$/i, "")}.zip\"`
  );

  const archive = archiver("zip", { zlib: { level: 9 } });
  archive.on("error", (err) => {
    if (!res.headersSent) res.status(500);
    res.end();
    throw err;
  });
  archive.pipe(res);

  archive.append(bulkText, { name: bulkFileName });
  for (const z of userZipBuffers) {
    archive.append(z.buffer, { name: z.name });
  }

  await archive.finalize();

  const ops = selected.map((item, index) => ({
    updateOne: {
      filter: { _id: item.user._id },
      update: {
        $set: {
          "pushTo.ekycToCkyc.status": "success",
          "pushTo.photoUploadForCkyc.status": "success",
          "pushTo.poaUploadForCkyc.status": "success",
          "pushTo.signatureUploadForCkyc.status": "success",
          "pushTo.updateCkycStatus.status": "success",
        },
        $push: {
          "pushTo.updateCkycStatus.logs": {
            timestamp: now,
            action: "ckyc_bulk_generated",
            payload: {
              fileName: bulkFileName,
              fiReferenceNumber: item.fiReferenceNumber,
              lineNumber: index + 1,
            },
            response: { success: true },
          },
        },
      },
    },
  }));

  if (ops.length > 0) {
    await User.bulkWrite(ops);
  }
};

