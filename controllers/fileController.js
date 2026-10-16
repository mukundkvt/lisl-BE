import multer from 'multer';
import path from 'path';
import Image from '../models/imageSchema.js';
import { getISTDate } from '../utils/convertToIndianTimeDate.js';
import { uploadToMinio, deleteFromMinio } from '../utils/minioClient.js';

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
});

const uploadFile = (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err) return res.status(400).json({ message: 'File upload failed', error: err.message });
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    const { originalname: originalName, size, mimetype, buffer } = req.file;
    const ext = path.extname(originalName) || '';
    const cleanBaseName = path.basename(originalName, ext).replace(/[^a-zA-Z0-9_-]/g, "_");
    const filename = `${cleanBaseName}_${Date.now()}${ext}`;
    const filePath = `uploads/${filename}`;

    try {
      await uploadToMinio(filePath, buffer, mimetype || 'application/octet-stream');

      const newImage = new Image({
        image: filename, 
        alt: originalName.split('.')[0].split(/[_-]/).join(' ')
      });
      await newImage.save();

      res.status(200).json({
        message: 'File uploaded successfully',
        file: {
          _id: newImage._id,
          filename,
          originalName,
          size,
          mimetype,
          path: filePath,
          uploadDate: getISTDate(new Date())
        }
      });
    } catch (dbError) {
      return res.status(500).json({ message: 'Error uploading file to MinIO or saving to database', error: dbError.message });
    }
  });
};

const getRecentUploads = async (req, res) => {
    const limit = parseInt(req.query.limit) || 20; // Number of items per page
    const page = parseInt(req.params.page) || 1; // Current page

    try {
        // Fetch images from the database, sorted by creation date (most recent first)
        const images = await Image.find()
            .sort({ _id: -1 }) // Sort by _id to get the most recent first
            .skip((page - 1) * limit) // Skip the previous pages
            .limit(limit); // Limit the number of results

        // Get the total count of images for pagination
        const totalFiles = await Image.countDocuments();

        // Calculate total pages
        const totalPages = Math.ceil(totalFiles / limit);

        // Prepare the response
        res.status(200).json({
            message: 'Recent uploads retrieved successfully',
            files: images.map(img => ({
                id: img._id, // Include the ID
                image: img.image,
                alt: img.alt
            })),
            currentPage: page,
            totalPages: totalPages,
            totalFiles: totalFiles
        });
    } catch (error) {
        return res.status(500).json({ message: 'Error fetching image data', error: error.message });
    }
};

const searchFilesByName = async (req, res) => {
  const { query } = req; // Get the query parameters from the request
  const searchTerm = query.name ? query.name.toLowerCase() : ''; // Get the search term

  try {
    // Query the database for images that match the search term
    const matchingImages = await Image.find({
      alt: { $regex: searchTerm, $options: 'i' } // Case-insensitive search
    });

    // Format the response to include id, image, and alt
    const formattedFiles = matchingImages.map(img => ({
      id: img._id, // Use the MongoDB document ID
      image: img.image, // The image filename or path
      alt: img.alt // The alt text
    }));

    res.status(200).json({
      message: 'Files retrieved successfully',
      files: formattedFiles // Return the formatted files
    });
  } catch (err) {
    return res.status(500).json({ message: 'Error fetching images from database', error: err.message });
  }
};

const deleteFile = async (req, res) => {
  const { filename } = req.params;
  const filePath = `uploads/${filename}`;

  try {
    await deleteFromMinio(filePath);
    await Image.findOneAndDelete({ image: filename });
    res.status(200).json({ message: 'File deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting file from MinIO', error: err.message });
  }
};

const updateAltText = async (req, res) => {
  const { id } = req.params; // Get the image ID from the request parameters
  const { alt } = req.body; // Get the new alt text from the request body

  if (!id || !alt) {
    return res.status(400).json({ message: 'Image ID and alt text are required' });
  }

  try {
    const updatedImage = await Image.findByIdAndUpdate(
      id, // Find the document by image ID
      { alt }, // Update the alt text
      { new: true } // Return the updated document
    );

    if (!updatedImage) {
      return res.status(404).json({ message: 'Image not found' });
    }

    res.status(200).json({
      message: 'Alt text updated successfully',
      image: updatedImage
    });
  } catch (dbError) {
    return res.status(500).json({ message: 'Error updating alt text', error: dbError.message });
  }
};

export { uploadFile, getRecentUploads, searchFilesByName, deleteFile, updateAltText };
