
import { PDFDocument } from 'pdf-lib';
import fs from 'fs/promises';

async function listFields() {
  const pdfBytes = await fs.readFile('./assets/Annexure J.pdf');
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const form = pdfDoc.getForm();
  const fields = form.getFields();
  fields.forEach(field => {
    const type = field.constructor.name;
    const name = field.getName();
    let details = '';
    
    const widgets = field.acroField.getWidgets();
    if (widgets.length > 0) {
        const widget = widgets[0];
        const rect = widget.getRectangle();
        details = ` (x: ${rect.x}, y: ${rect.y}, w: ${rect.width}, h: ${rect.height})`;
    }
    
    console.log(`${type}: ${name}${details}`);
  });
}

listFields().catch(console.error);
