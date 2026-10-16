
import { PDFDocument } from 'pdf-lib';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { annexureJFieldsConfig } from '../config/pdfConfig.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const testConfig = async () => {
    try {
        const templatePath = path.join(__dirname, '../assets/Annexure J.pdf');
        const pdfBytes = await fs.readFile(templatePath);
        const pdfDoc = await PDFDocument.load(pdfBytes);
        const form = pdfDoc.getForm();
        const fields = form.getFields();

        const pdfFieldNames = fields.map(f => f.getName());
        console.log(`Total fields in PDF: ${pdfFieldNames.length}`);

        const configKeys = Object.keys(annexureJFieldsConfig);
        console.log(`Total keys in config: ${configKeys.length}`);

        // Check if config keys map to valid PDF fields
        console.log('\n--- Checking Config Keys against PDF Fields ---');
        let invalidConfigKeys = 0;
        configKeys.forEach(key => {
            const fieldName = annexureJFieldsConfig[key];
            if (typeof fieldName === 'object') return; // Skip coordinate objects like photo

            if (!pdfFieldNames.includes(fieldName)) {
                console.log(`[MISSING] Config key '${key}' maps to '${fieldName}' which is NOT in PDF`);
                invalidConfigKeys++;
            }
        });
        if (invalidConfigKeys === 0) console.log('All config keys map to valid PDF fields.');

        // Check if PDF fields are mapped in config
        console.log('\n--- Checking PDF Fields against Config ---');
        const mappedFieldNames = Object.values(annexureJFieldsConfig).filter(v => typeof v === 'string');
        let unmappedPdfFields = 0;
        pdfFieldNames.forEach(name => {
            if (!mappedFieldNames.includes(name)) {
                console.log(`[UNMAPPED] PDF field '${name}' is not in config`);
                unmappedPdfFields++;
            }
        });

        if (unmappedPdfFields === 0) {
            console.log('All PDF fields are mapped in config.');
        } else {
            console.log(`Found ${unmappedPdfFields} unmapped PDF fields.`);
        }

    } catch (error) {
        console.error('Error testing config:', error);
    }
};

testConfig();
