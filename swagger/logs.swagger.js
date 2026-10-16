/**
 * @swagger
 * tags:
 *   name: Logs
 *   description: OTP logs management endpoints
 */

/**
 * @swagger
 * /admin/mobile-otp-logs/{mobileNumber}:
 *   get:
 *     summary: Get mobile OTP logs by mobile number (latest first)
 *     tags: [Logs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: mobileNumber
 *         required: true
 *         schema:
 *           type: string
 *         description: Mobile number of the user
 *     responses:
 *       200:
 *         description: OTP logs retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       otp:
 *                         type: number
 *                         example: 123456
 *                       mobile:
 *                         type: string
 *                         example: "9876543210"
 *                       timestamp:
  *                         type: string
  *                         format: date-time
  *                         example: "2023-06-15T10:30:00.000Z"
  *                         description: "Date in Indian Standard Time (IST)"
 *                       isVerify:
 *                         type: boolean
 *                         example: false
 *       400:
 *         description: Mobile number is required
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       403:
 *         description: Forbidden - Insufficient permissions
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /admin/email-otp-logs/{email}:
 *   get:
 *     summary: Get email OTP logs by email (latest first)
 *     tags: [Logs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: email
 *         required: true
 *         schema:
 *           type: string
 *         description: Email of the user
 *     responses:
 *       200:
 *         description: OTP logs retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       otp:
 *                         type: number
 *                         example: 123456
 *                       email:
 *                         type: string
 *                         example: "user@example.com"
 *                       timestamp:
 *                         type: string
 *                         format: date-time
 *                         example: "2023-06-15T10:30:00.000Z"
 *                         description: "Date in Indian Standard Time (IST)"
 *                       isVerify:
 *                         type: boolean
 *                         example: false
 *       400:
 *         description: Email is required
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       403:
 *         description: Forbidden - Insufficient permissions
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /admin/audit-logs:
 *   get:
 *     summary: Download Audit Logs as Excel file
 *     tags: [Logs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *         description: Start date in dd-mm-yyyy format (e.g. 01-01-2024)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *         description: End date in dd-mm-yyyy format (e.g. 31-01-2024)
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by Name or PAN (case-insensitive)
 *     responses:
 *       200:
 *         description: Audit logs Excel file
 *         content:
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       403:
 *         description: Forbidden - Insufficient permissions
 *       500:
 *         description: Internal server error
 */
