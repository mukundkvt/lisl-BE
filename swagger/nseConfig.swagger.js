/**
 * @swagger
 * tags:
 *   name: NSE Config
 *   description: Manage NSE API Credentials
 */

/**
 * @swagger
 * /api/admin/nse:
 *   put:
 *     summary: Create or Update NSE credentials
 *     tags: [NSE Config]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 description: NSE login username
 *                 example: nse_user_123
 *               password:
 *                 type: string
 *                 description: NSE login password
 *                 example: strongPassword@123
 *     responses:
 *       200:
 *         description: NSE credentials updated successfully
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
 *                   example: NSE credentials updated successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                     username:
 *                       type: string
 *                     apiName:
 *                       type: string
 *                     updatedBy:
 *                       type: string
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Missing required fields
 *       500:
 *         description: Failed to update NSE credentials
 */

/**
 * @swagger
 * /api/admin/nse:
 *   get:
 *     summary: Get NSE credential update history
 *     tags: [NSE Config]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully fetched NSE auth history
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
 *                     username:
 *                       type: string
 *                     password:
 *                       type: string
 *                     apiName:
 *                       type: string
 *                       updatedBy:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                           name:
 *                             type: string
 *                           email:
 *                             type: string
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                       updatedAt:
 *                         type: string
 *                         format: date-time
 *       500:
 *         description: Failed to fetch NSE auth history
 */
