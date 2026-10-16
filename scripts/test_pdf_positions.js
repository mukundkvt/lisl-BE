
import { PDFDocument, rgb } from 'pdf-lib';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { annexureJFieldsConfig } from '../config/pdfConfig.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function createPositionDebugPdf() {
    try {
        const templatePath = path.join(__dirname, '../assets/Annexure J.pdf');
        const pdfBytes = await fs.readFile(templatePath);
        const pdfDoc = await PDFDocument.load(pdfBytes);
        const pages = pdfDoc.getPages();

        // Helper to draw rectangle
        const drawRect = (config, label, color = rgb(1, 0, 0)) => {
            if (!config) return;
            const { page, x, y, width, height } = config;
            const pageIndex = page - 1;
            
            if (pageIndex >= 0 && pageIndex < pages.length) {
                const p = pages[pageIndex];
                
                // Draw rectangle
                p.drawRectangle({
                    x,
                    y,
                    width,
                    height,
                    borderColor: color,
                    borderWidth: 2,
                });
                
                // Draw label
                p.drawText(label, {
                    x: x + 5,
                    y: y + 5, // Just 5px above the bottom of the box
                    size: 10,
                    color: color,
                });
                
                console.log(`Drew ${label} on Page ${page} at (${x}, ${y}) [${width}x${height}]`);
            } else {
                console.log(`Page ${page} not found for ${label}`);
            }
        };

        console.log('--- Drawing Configured Positions ---');
        // --- MODIFY THESE IN config/pdfConfig.js ---
        // Page 1: Photo Position
        drawRect(annexureJFieldsConfig.photo, 'PHOTO', rgb(1, 0, 0)); // Red

        // Page 1: First Signature Position
        drawRect(annexureJFieldsConfig.photoSignature, 'SIG 1', rgb(0, 0, 1)); // Blue

        // Page 2: Second Signature Position
        drawRect(annexureJFieldsConfig.secondPageSignature, 'SIG 2', rgb(0, 0.5, 0)); // Green
        // ------------------------------------------

        const outputPath = path.join(__dirname, '../uploads/debug_positions.pdf');
        
        // Ensure uploads directory exists
        try {
            await fs.access(path.dirname(outputPath));
        } catch {
            await fs.mkdir(path.dirname(outputPath), { recursive: true });
        }

        await fs.writeFile(outputPath, await pdfDoc.save());
        console.log('\nDebug PDF created successfully!');
        console.log('File Path:', outputPath);
        console.log('Open this PDF to check the positions of Photo and Signatures.');
        console.log('To adjust positions, edit: config/pdfConfig.js');

    } catch (error) {
        console.error('Error:', error);
    }
}

createPositionDebugPdf();
