/**
 * @swagger
 * tags:
 *   name: DP ID
 *   description: DP ID Management APIs
 */

/**
 * @swagger
 * /api/admin/upload-dp-ids:
 *   post:
 *     summary: Upload DP IDs from a text file
 *     tags: [DP ID]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: DP IDs processed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalProcessed:
 *                       type: integer
 *                     added:
 *                       type: integer
 *                     duplicates:
 *                       type: integer
 *       400:
 *         description: No file uploaded or invalid file
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /api/admin/free-dp-id-count:
 *   get:
 *     summary: Get DP ID statistics (total, used, free)
 *     tags: [DP ID]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: DP ID statistics fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     used:
 *                       type: integer
 *                     free:
 *                       type: integer
 *                 message:
 *                   type: string
 *       500:
 *         description: Internal server error
 */
