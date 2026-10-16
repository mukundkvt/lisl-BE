/**
 * @swagger
 * tags:
 *   - name: Master
 *     description: Endpoints for managing users (search, delete, etc.)
 */

/**
 * @swagger
 * /api/admin/user/master-search:
 *   get:
 *     summary: Search for a user by mobile number, PAN, or email
 *     tags: [Master]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: search
 *         in: query
 *         description: Mobile number, PAN, or email to search for
 *         required: true
 *         schema:
 *           type: string
 *           example: "ABCDE1234F"
 *     responses:
 *       200:
 *         description: User found successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: 64f5c5b2e9c8f1a2b3d4e5f6
 *                     name:
 *                       type: object
 *                       properties:
 *                         fullName:
 *                           type: string
 *                           example: John Doe
 *                     signed:
 *                       type: boolean
 *                       description: Whether the user has signed the digital contract
 *                       example: true
 *                 message:
 *                   type: string
 *                   example: User found successfully.
 *       400:
 *         description: Bad request (missing or invalid query param)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Query param 'search' is required
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: No user found with given input
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Internal server error
 *                 error:
 *                   type: string
 *                   example: Error message
 */

/**
 * @swagger
 * /api/admin/user/master-delete/{userId}:
 *   delete:
 *     summary: Delete a user and their associated files
 *     tags: [Master]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: userId
 *         in: path
 *         description: ID of the user to delete
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       description: Reason for deletion
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 example: User requested deletion of data
 *     responses:
 *       200:
 *         description: User deleted successfully
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
 *                   example: User deleted successfully
 *       400:
 *         description: Bad request (missing reason or user not found)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Reason for deletion is required
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       403:
 *         description: Forbidden - Insufficient permissions
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Internal server error
 *                 error:
 *                   type: string
 *                   example: Error message
 */
