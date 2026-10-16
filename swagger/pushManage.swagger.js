/**
 * @swagger
 * tags:
 *   name: PushManage
 *   description: API for managing and viewing push logs and statuses
 */

/**
 * @swagger
 * /api/admin/push-manage/status/{userId}:
 *   get:
 *     summary: Get push status summary for a user
 *     tags: [PushManage]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         schema:
 *           type: string
 *         required: true
 *         description: The user ID
 *     responses:
 *       200:
 *         description: Push status summary retrieved successfully
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
 *                   additionalProperties:
 *                     type: object
 *                     properties:
 *                       status:
 *                         type: string
 *                         enum: [pending, success, failed]
 *                         example: success
 *                       lastTimestamp:
 *                         type: string
 *                         format: date-time
 *                         nullable: true
 *                         example: "2023-10-27T10:00:00.000Z"
 *                 kycType:
 *                   type: string
 *                   example: Digilocker
 *                 clientCode:
 *                   type: string
 *                   example: CLT123
 *                 referredBy:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                       example: Jane Smith
 *                     employeeId:
 *                       type: string
 *                       example: EMP123
 *                     role:
 *                       type: string
 *                       example: Relationship Manager
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /api/admin/push-manage/logs/{userId}/{section}:
 *   get:
 *     summary: Get detailed logs for a specific push section
 *     tags: [PushManage]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         schema:
 *           type: string
 *         required: true
 *         description: The user ID
 *       - in: path
 *         name: section
 *         schema:
 *           type: string
 *         required: true
 *         description: The push section name (e.g., bseStar, camsKraUpload)
 *     responses:
 *       200:
 *         description: Push logs retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 section:
 *                   type: string
 *                   example: bseStar
 *                 status:
 *                   type: string
 *                   enum: [pending, success, failed]
 *                   example: success
 *                 logs:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       timestamp:
 *                         type: string
 *                         format: date-time
 *                       action:
 *                         type: string
 *                       payload:
 *                         type: object
 *                       response:
 *                         type: object
 *       404:
 *         description: User or section not found
 *       500:
 *         description: Internal server error
 */
