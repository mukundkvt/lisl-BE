/**
 * @swagger
 * tags:
 *   name: Push cdsl_upload_to_dp
 *   description: CDSL Integration Endpoints
 */

/**
 * @swagger
 * /api/admin/push_to_cdsl/auth/{userId}:
 *   post:
 *     summary: Authenticate with CDSL
 *     tags: [Push cdsl_upload_to_dp]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the user to authenticate for
 *     responses:
 *       200:
 *         description: Authentication successful
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
 *                   example: Authentication successful
 *                 authToken:
 *                   type: string
 *       400:
 *         description: Authentication failed
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /api/admin/push_to_cdsl/setup/{userId}:
 *   post:
 *     summary: Push BO Setup to CDSL (HrmSetUpload)
 *     tags: [Push cdsl_upload_to_dp]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the user to push setup for
 *     responses:
 *       200:
 *         description: Data successfully pushed to CDSL
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
 *                   example: Data successfully pushed to CDSL
 *                 acknowledgmentID:
 *                   type: string
 *                 fileName:
 *                   type: string
 *       400:
 *         description: CDSL API rejected request
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /api/admin/push_to_cdsl/modify/{userId}:
 *   post:
 *     summary: Push BO Modification to CDSL (HrmModUpload)
 *     tags: [Push cdsl_upload_to_dp]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the user to modify
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               modificationType:
 *                 type: string
 *                 default: "01"
 *               email:
 *                 type: string
 *               mobile:
 *                 type: string
 *               address:
 *                 type: object
 *               bankDetails:
 *                 type: object
 *               nominees:
 *                 type: array
 *                 items:
 *                   type: object
 *               eCorrespondence:
 *                 type: string
 *                 default: "Y"
 *     responses:
 *       200:
 *         description: Modification request submitted to CDSL
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
 *                   example: Modification request submitted to CDSL
 *                 acknowledgmentID:
 *                   type: string
 *       400:
 *         description: CDSL API rejected modification request
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /api/admin/push_to_cdsl/status/{userId}:
 *   post:
 *     summary: Check CDSL Upload Status
 *     tags: [Push cdsl_upload_to_dp]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - acknowledgmentID
 *             properties:
 *               acknowledgmentID:
 *                 type: string
 *                 description: The acknowledgment ID received from setup or modify upload
 *     responses:
 *       200:
 *         description: Status check successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 status:
 *                   type: string
 *                   example: "00"
 *                 data:
 *                   type: object
 *       400:
 *         description: Error or invalid request
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /api/admin/push_to_cdsl/download/{userId}:
 *   post:
 *     summary: Download CDSL Response File
 *     tags: [Push cdsl_upload_to_dp]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - uploadId
 *               - uploadFileName
 *             properties:
 *               uploadId:
 *                 type: string
 *                 description: The Upload ID (e.g., "08" for setup, "11" for modify)
 *               uploadFileName:
 *                 type: string
 *                 description: The name of the file that was uploaded (zip for setup, txt for modify)
 *     responses:
 *       200:
 *         description: Download successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 fileName:
 *                   type: string
 *                 parsedData:
 *                   type: object
 *       400:
 *         description: Failed to download
 *       500:
 *         description: Internal server error
 */
