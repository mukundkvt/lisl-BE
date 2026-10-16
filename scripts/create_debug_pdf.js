
import { PDFDocument } from 'pdf-lib';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function createDebugPdf() {
    try {
        const templatePath = path.join(__dirname, '../assets/Annexure J.pdf');
        const pdfBytes = await fs.readFile(templatePath);
        const pdfDoc = await PDFDocument.load(pdfBytes);
        const form = pdfDoc.getForm();
        const fields = form.getFields();

        fields.forEach(field => {
            const name = field.getName();
            const type = field.constructor.name;
            if (type === 'PDFTextField') {
                console.log(`Field: ${name} (Text)`);
                field.setText(name);
            } else if (type === 'PDFCheckBox') {
                console.log(`Field: ${name} (CheckBox)`);
                field.check();
            }
        });

        const outputPath = path.join(__dirname, '../uploads/debug_annexure_j.pdf');
        await fs.writeFile(outputPath, await pdfDoc.save());
        console.log('Debug PDF created at:', outputPath);

    } catch (error) {
        console.error('Error:', error);
    }
}

createDebugPdf();
