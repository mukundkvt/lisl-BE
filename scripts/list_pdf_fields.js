
import { PDFDocument } from 'pdf-lib';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function listFields() {
    try {
        const pdfPath = path.join(__dirname, '../assets/Annexure J.pdf');
        console.log('Reading PDF from:', pdfPath);
        const pdfBytes = await fs.readFile(pdfPath);
        const pdfDoc = await PDFDocument.load(pdfBytes);
        const form = pdfDoc.getForm();
        const fields = form.getFields();

        console.log('Fields found in PDF:');
        fields.forEach(field => {
            const type = field.constructor.name;
            const name = field.getName();
            console.log(`- Name: "${name}", Type: ${type}`);
            if (type === 'PDFCheckBox') {
                console.log(`  Checked: ${field.isChecked()}`);
            }
        });
    } catch (error) {
        console.error('Error:', error);
    }
}

listFields();
