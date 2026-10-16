//For User
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createCoordinateGrid, createGridForAllPages } from '../utils/pdfCoordinateHelper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Only enable in development environment
if (process.env.NODE_ENV === 'development') {
  // Generate coordinate grid for a specific page
  router.get('/pdf-grid/:page', async (req, res) => {
    try {
      const pageIndex = parseInt(req.params.page, 10) - 1;
      const templatePath = path.join(__dirname, '../assets/template.pdf');
      const gridPath = await createCoordinateGrid(templatePath, pageIndex);
      
      if (gridPath) {
        res.json({
          success: true,
          message: 'Grid PDF created successfully',
          path: gridPath
        });
      } else {
        res.status(400).json({
          success: false,
          message: 'Failed to create grid PDF'
        });
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error creating grid PDF',
        error: error.message
      });
    }
  });
  
  // Generate coordinate grids for all pages
  router.get('/pdf-grid-all', async (req, res) => {
    try {
      const templatePath = path.join(__dirname, '../assets/template.pdf');
      const results = await createGridForAllPages(templatePath);
      
      if (results) {
        res.json({
          success: true,
          message: 'Grid PDFs created successfully',
          results
        });
      } else {
        res.status(400).json({
          success: false,
          message: 'Failed to create grid PDFs'
        });
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error creating grid PDFs',
        error: error.message
      });
    }
  });
}

export default router;