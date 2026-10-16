/**
 * @swagger
 * tags:
 *   name: BSE Config
 *   description: Manage BSE MFI API Credentials
 */

/**
 * @swagger
 * /api/admin/bse-config:
 *   get:
 *     summary: Get current BSE MFI configuration
 *     tags: [BSE Config]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved BSE config
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                     userId:
 *                       type: string
 *                     memberCode:
 *                       type: string
 *                     password:
 *                       type: string
 *                     updateHistory:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           updatedBy:
 *                             type: string
 *                           updatedAt:
 *                             type: string
 *                             format: date-time
 *                           previousData:
 *                             type: object
 *                             properties:
 *                               userId:
 *                                 type: string
 *                               memberCode:
 *                                 type: string
 *                               password:
 *                                 type: string
 *       404:
 *         description: BSE Config not found
 *       500:
 *         description: Internal Server Error
 */

/**
 * @swagger
 * /api/admin/bse-config:
 *   post:
 *     summary: Create or Update BSE MFI configuration
 *     tags: [BSE Config]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - memberCode
 *               - password
 *             properties:
 *               userId:
 *                 type: string
 *                 description: BSE User ID
 *               memberCode:
 *                 type: string
 *                 description: BSE Member Code
 *               password:
 *                 type: string
 *                 description: BSE Password
 *     responses:
 *       200:
 *         description: BSE Config updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: BSE Config updated successfully
 *                 data:
 *                   type: object
 *       400:
 *         description: Missing required fields
 *       500:
 *         description: Internal Server Error
 */
