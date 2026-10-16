import {
  PDFDocument,
  PDFName,
  PDFDict,
  PDFStream,
  PDFRef,
  PDFCheckBox,
  PDFRadioGroup,
  pushGraphicsState,
  translate,
  rotateInPlace,
  degrees,
  drawObject,
  popGraphicsState,
} from "pdf-lib";
import fs from "fs/promises";

/**
 * Checks whether a PDF document or buffer contains fillable/interactive AcroForm fields.
 *
 * @param {PDFDocument|Buffer|Uint8Array} target - PDFDocument instance or PDF bytes
 * @returns {Promise<boolean>} True if fillable fields exist, false otherwise
 */
export const hasAcroFormFields = async (target) => {
  try {
    let pdfDoc = target;
    if (Buffer.isBuffer(target) || target instanceof Uint8Array) {
      pdfDoc = await PDFDocument.load(target, { ignoreEncryption: true });
    }
    const form = pdfDoc.getForm();
    const fields = form.getFields();
    return Array.isArray(fields) && fields.length > 0;
  } catch (error) {
    return false;
  }
};

/**
 * Flattens all interactive AcroForm fields in a pdf-lib PDFDocument instance into static page content.
 *
 * Key guarantees:
 * 1. Text remains real, selectable, copyable, searchable vector text (not rasterized/image).
 * 2. Visual appearance of all filled fields (text, checkmarks, radios) is permanently baked into page streams.
 * 3. Interactive form controls are completely removed (zero editable fields remaining).
 * 4. Resolves the upstream pdf-lib bug where indirect checkbox appearance dictionaries cause syntax errors.
 * 5. Cleans up widget annotations and the document AcroForm catalog dictionary cleanly without dangling xrefs.
 * 6. Preserves existing layout, page dimensions, fonts, images, and non-widget annotations.
 *
 * @param {PDFDocument} pdfDoc - The loaded PDFDocument instance to flatten
 * @returns {Promise<PDFDocument>} The flattened PDFDocument instance
 */
export const flattenPdfDocument = async (pdfDoc) => {
  if (!pdfDoc || typeof pdfDoc.getForm !== "function") {
    throw new Error("Invalid PDFDocument provided to flattenPdfDocument");
  }

  const form = pdfDoc.getForm();
  let fields = [];
  try {
    fields = form.getFields();
  } catch (e) {
    fields = [];
  }

  // If there are no form fields, simply ensure AcroForm catalog is clean and return
  if (!fields || fields.length === 0) {
    try {
      pdfDoc.catalog.delete(PDFName.of("AcroForm"));
    } catch (e) {}
    return pdfDoc;
  }

  // Ensure appearances are updated for all modified fields
  try {
    form.updateFieldAppearances();
  } catch (err) {
    console.warn("Warning updating field appearances before flattening:", err?.message || err);
  }

  // Bake appearance streams for every widget directly onto the widget's page content
  for (const field of fields) {
    try {
      const widgets = field.acroField.getWidgets();
      for (const widget of widgets) {
        let page = null;
        try {
          page = form.findWidgetPage(widget);
        } catch (pageErr) {
          continue;
        }
        if (!page) continue;

        const normalAp = widget.getNormalAppearance();
        if (!normalAp) continue;

        const apDictOrStream =
          normalAp instanceof PDFRef
            ? pdfDoc.context.lookup(normalAp)
            : normalAp;

        let streamRef = null;

        if (apDictOrStream instanceof PDFStream) {
          // Normal appearance is a direct or indirect stream
          streamRef =
            normalAp instanceof PDFRef
              ? normalAp
              : pdfDoc.context.register(normalAp);
        } else if (apDictOrStream instanceof PDFDict) {
          // Normal appearance is a state dictionary (e.g., checkboxes, radio groups)
          let val = null;
          if (typeof field.acroField.getValue === "function") {
            val = field.acroField.getValue();
          }

          const isOff =
            val === null ||
            val === undefined ||
            val === false ||
            val === PDFName.of("Off") ||
            val?.toString?.() === "/Off";

          let state = !isOff && val ? apDictOrStream.get(val) : null;

          // If checked but no state found matching value, fallback to /Yes or /On
          if (!state && !isOff) {
            state =
              apDictOrStream.get(PDFName.of("Yes")) ||
              apDictOrStream.get(PDFName.of("On"));
          }

          if (state instanceof PDFRef) {
            const lookedUp = pdfDoc.context.lookup(state);
            if (lookedUp instanceof PDFStream) {
              streamRef = state;
            }
          } else if (state instanceof PDFStream) {
            streamRef = pdfDoc.context.register(state);
          }
        }

        // If an appearance stream exists for this widget (e.g. text or checked checkbox), draw it
        if (streamRef) {
          const xObjectKey = page.node.newXObject("FlatWidget", streamRef);
          const rect = widget.getRectangle();
          const rot = widget.getAppearanceCharacteristics()?.getRotation() || 0;
          const rotAngle =
            typeof rot === "number" ? degrees(rot) : rot || degrees(0);

          const ops = [
            pushGraphicsState(),
            translate(rect.x, rect.y),
            ...rotateInPlace({ ...rect, rotation: rotAngle }),
            drawObject(xObjectKey),
            popGraphicsState(),
          ].filter(Boolean);

          page.pushOperators(...ops);
        }
      }
    } catch (fieldErr) {
      console.warn(`Warning flattening field ${field.getName?.() || "unknown"}:`, fieldErr.message);
    }
  }

  // Remove widget annotations from each page, keeping any non-widget annotations intact
  const pages = pdfDoc.getPages();
  for (const page of pages) {
    try {
      const annots = page.node.Annots();
      if (!annots) continue;

      const keptAnnots = [];
      for (let i = 0; i < annots.size(); i++) {
        const annotRef = annots.get(i);
        const annotDict = pdfDoc.context.lookup(annotRef);
        if (annotDict instanceof PDFDict) {
          const subtype = annotDict.get(PDFName.of("Subtype"))?.toString();
          if (subtype !== "/Widget") {
            keptAnnots.push(annotRef);
          }
        }
      }

      if (keptAnnots.length > 0) {
        page.node.set(PDFName.of("Annots"), pdfDoc.context.obj(keptAnnots));
      } else {
        page.node.delete(PDFName.of("Annots"));
      }
    } catch (annotsErr) {
      console.warn("Warning cleaning up page annotations:", annotsErr.message);
    }
  }

  // Completely delete AcroForm dictionary from document catalog
  try {
    pdfDoc.catalog.delete(PDFName.of("AcroForm"));
  } catch (catalogErr) {
    console.warn("Warning deleting AcroForm catalog:", catalogErr.message);
  }

  return pdfDoc;
};

/**
 * Converts a fillable PDF (Buffer or Uint8Array) into a non-editable, flattened PDF buffer.
 *
 * @param {Buffer|Uint8Array} pdfBytes - Raw PDF bytes
 * @returns {Promise<Uint8Array>} Flattened PDF bytes
 */
export const flattenPdfBytes = async (pdfBytes) => {
  if (!pdfBytes) {
    throw new Error("No PDF bytes provided to flattenPdfBytes");
  }

  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  await flattenPdfDocument(pdfDoc);
  return await pdfDoc.save();
};

/**
 * Reads a PDF file, flattens all form fields, and optionally writes to an output path.
 *
 * @param {string} inputPath - Path to the source PDF file
 * @param {string} [outputPath] - Optional path to save the flattened PDF
 * @returns {Promise<Uint8Array>} Flattened PDF bytes
 */
export const flattenPdfFile = async (inputPath, outputPath) => {
  if (!inputPath) {
    throw new Error("No input path provided to flattenPdfFile");
  }

  const inputBytes = await fs.readFile(inputPath);
  const flattenedBytes = await flattenPdfBytes(inputBytes);

  if (outputPath) {
    await fs.writeFile(outputPath, flattenedBytes);
  }

  return flattenedBytes;
};
