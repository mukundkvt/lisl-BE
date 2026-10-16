/**
 * @swagger
 * tags:
 *   name: Push
 *   description: Push user data to external systems
 */

/**
 * @swagger
 * /api/admin/push_to_kra/{userId}:
 *   post:
 *     summary: Push user onboarding data to KRA
 *     tags: [Push]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         schema:
 *           type: string
 *         required: true
 *         description: The user's MongoDB _id
 *     responses:
 *       200:
 *         description: Data successfully pushed to KRA
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
 *       400:
 *         description: Missing required data or rejected by KRA
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /api/admin/upload_bse:
 *   post:
 *     summary: Upload user data to BSE
 *     tags: [Push]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             example:
 *               clientCode: "ABC123"
 *               pan: "ABCDE1234F"
 *     responses:
 *       200:
 *         description: Data successfully uploaded to BSE
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
 *       400:
 *         description: Invalid or missing input
 *       500:
 *         description: Internal server error
 */


/**
 * @swagger
 * /api/admin/push_to_sharepro/{userId}:
 *   post:
 *     summary: Push user onboarding data to SharePro
 *     tags: [Push]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         schema:
 *           type: string
 *         required: true
 *         description: The user's MongoDB _id
 *     responses:
 *       200:
 *         description: Data successfully pushed to SharePro
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
 *       400:
 *         description: Missing approvals or digital signature, or rejected by SharePro
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
/**
 * @swagger
 * /api/admin/push_to_bse_mfi/{userId}:
 *   post:
 *     summary: Push user onboarding data to BSE MFI
 *     tags: [Push]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         schema:
 *           type: string
 *         required: true
 *         description: The user's MongoDB _id
 *     responses:
 *       200:
 *         description: Data successfully pushed to BSE MFI
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
 *       400:
 *         description: Missing approvals or digital signature, or rejected by BSE MFI
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
/**
 * @swagger
 * /api/admin/push_to_nse/{userId}:
 *   post:
 *     summary: Push user onboarding data to NSE
 *     tags: [Push]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         schema:
 *           type: string
 *         required: true
 *         description: The user's MongoDB _id
 *     responses:
 *       200:
 *         description: Data successfully pushed to NSE
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
 *       400:
 *         description: Missing approvals or digital signature, or rejected by NSE
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */

