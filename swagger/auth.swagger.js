/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Authentication endpoints
 */
/**
 * @swagger
 * /admin/login:
 *   post:
 *     summary: Login for admin users
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AuthCredentials'
 *     responses:
 *       200:
 *         description: Login successful, returns token and user details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: Login name and password are required
 *       401:
 *         description: Invalid login credentials
 *       403:
 *         description: Account is inactive
 *       500:
 *         description: Server error
 */
/**
 * @swagger
 * /admin/register:
 *   post:
 *     summary: Register a new admin user (for initial setup, can be restricted later)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserInput'
 *     responses:
 *       201:
 *         description: Admin user registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: Invalid input
 *       409:
 *         description: User already exists
 *       500:
 *         description: Server error
 */


/**
 * @swagger
 * /admin/check_auth_status:
 *   get:
 *     summary: Check authentication status and return user details
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Token valid – returns user details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Invalid or expired token
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
/**
 * @swagger
 * /admin/change-password:
 *   post:
 *     summary: Change password for the currently logged-in user
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - oldPassword
 *               - newPassword
 *             properties:
 *               oldPassword:
 *                 type: string
 *                 format: password
 *                 description: The user's current password.
 *               newPassword:
 *                 type: string
 *                 format: password
 *                 description: The user's new password.
 *     responses:
 *       200:
 *         description: Password changed successfully
 *       400:
 *         description: Old password and new password are required
 *       401:
 *         description: Invalid old password or Unauthorized
 *       404:
 *         description: Admin user not found
 *       500:
 *         description: Server error while changing password
 */
/**
 * @swagger
 * /admin/change-password-by-admin:
 *   post:
 *     summary: Change any user's password (Admin only)
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               loginName:
 *                 type: string
 *                 description: The login name of the user to update
 *                 example: "testuser"
 *               password:
 *                 type: string
 *                 description: The new password
 *                 example: "newPasswordForUser456"
 *             required:
 *               - loginName
 *               - password
 *     responses:
 *       200:
 *         description: Password updated successfully
 *       400:
 *         description: Login name and new password are required
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Only Admins can perform this action
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
