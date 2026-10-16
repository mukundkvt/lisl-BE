/**
 * @swagger
 * /admin/users:
 *   post:
 *     summary: Create a new User (Admin only)
 *     tags: [User]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserInput'
 *     responses:
 *       201:
 *         description: User created successfully
 *       400:
 *         description: All required fields must be provided
 *       409:
 *         description: Login name or Employee ID already exists
 *       500:
 *         description: Server error
 *
 *   get:
 *     summary: Get all Users with pagination, filter, and search
 *     tags: [User]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of results per page
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [Scrutiny Officer, Supervisor, Admin, Relationship Manager, Authorised Person, Branch]
 *         description: Filter users by role
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search across loginName, name, employeeId, role, branch, reportingTo, and mobile
 *     responses:
 *       200:
 *         description: List of Users with pagination info
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
 *                     $ref: '#/components/schemas/User'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     page:
 *                       type: integer
 *                     pages:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *       500:
 *         description: Server error
 */
/**
 * @swagger
 * /admin/users/check-login-name/{loginName}:
 *   get:
 *     summary: Check if a login name is available
 *     tags: [User]
 *     parameters:
 *       - in: path
 *         name: loginName
 *         schema:
 *           type: string
 *         required: true
 *         description: The login name to check
 *     responses:
 *       200:
 *         description: Availability of the login name
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Login name is available"
 *                 availableToRegister:
 *                   type: boolean
 *                   example: true
 *       500:
 *         description: Server error
 */
/**
 * @swagger
 * /admin/users/check-employee-id/{employeeId}:
 *   get:
 *     summary: Check if an Employee ID is available
 *     tags: [User]
 *     parameters:
 *       - in: path
 *         name: employeeId
 *         schema:
 *           type: string
 *         required: true
 *         description: The Employee ID to check
 *     responses:
 *       200:
 *         description: Availability of the Employee ID
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Employee ID is available"
 *                 availableToRegister:
 *                   type: boolean
 *                   example: true
 *       500:
 *         description: Server error
 */
/**
 * @swagger
 * /admin/users/{id}:
 *   put:
 *     summary: Update a User (Admin only)
 *     tags: [User]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserUpdate'
 *     responses:
 *       200:
 *         description: User updated successfully
 *       404:
 *         description: User not found
 *       409:
 *         description: Login name or Employee ID already exists
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /admin/users/get_rm_by_branchid/{branchId}:
 *   get:
 *     summary: Get Relationship Managers by Branch ID
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: branchId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the branch to retrieve RMs for
 *     responses:
 *       200:
 *         description: List of Relationship Managers for the specified branch
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
 *                       _id:
 *                         type: string
 *                         example: "654c1a1a1a1a1a1a1a1a1a1a"
 *                       name:
 *                         type: string
 *                         example: "RM One"
 *                       employeeId:
 *                         type: string
 *                         example: "RM001"
 *                       mobile:
 *                         type: string
 *                         example: "9876543210"
 *                       branch:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                           name:
 *                             type: string
 *                         example:
 *                           _id: "654c1a1a1a1a1a1a1a1a1a1b"
 *                           name: "Main Branch"
 *         400:
 *           description: Branch ID is required
 *           content:
 *             application/json:
 *               schema:
 *                 $ref: '#/components/responses/BadRequestError'
 *               examples:
 *                 missingBranchId:
 *                   value:
 *                     success: false
 *                     message: "Branch ID is required"
 *         404:
 *           description: No Relationship Managers found for this branch
 *           content:
 *             application/json:
 *               schema:
 *                 $ref: '#/components/responses/NotFoundError'
 *               examples:
 *                 noRMsFound:
 *                   value:
 *                     success: false
 *                     message: "No Relationship Managers found for this branch."
 *         500:
 *           description: Server error
 *           content:
 *             application/json:
 *               schema:
 *                 $ref: '#/components/responses/ServerError'
 */
/**
 * @swagger
 * /admin/users/relationship-managers:
 *   get:
 *     summary: Get list of all relationship managers (name and ID only)
 *     tags: [User]
 *     responses:
 *       200:
 *         description: List of relationship managers
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
 *                       _id:
 *                         type: string
 *                         example: "507f1f77bcf86cd799439011"
 *                       name:
 *                         type: string
 *                         example: "John Doe"
 *       500:
 *         description: Server error
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
 *                   example: "Failed to fetch relationship managers"
 *                 error:
 *                   type: string
 *                   example: "Detailed error message (in development)"
 */
/**
 * @swagger
 * /admin/users/rm-and-ap:
 *   get:
 *     summary: Get list of all relationship managers and authorized persons
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of relationship managers and authorized persons in a single array
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
 *                       _id:
 *                         type: string
 *                         example: "507f1f77bcf86cd799439011"
 *                       name:
 *                         type: string
 *                         example: "John Doe"
 *                       role:
 *                         type: string
 *                         example: "Relationship Manager"
 *                       employeeId:
 *                         type: string
 *                         example: "EMP001"
 *                       mobile:
 *                         type: string
 *                         example: "9876543210"
 *                       branch:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                           name:
 *                             type: string
 *                         example:
 *                           _id: "507f1f77bcf86cd799439012"
 *                           name: "Main Branch"
 *                       reportingTo:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                           name:
 *                             type: string
 *                         example:
 *                           _id: "507f1f77bcf86cd799439013"
 *                           name: "Manager Name"

 *       500:
 *         description: Server error
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
 *                   example: "Failed to fetch relationship managers and authorized persons"
 *                 error:
 *                   type: string
 *                   example: "Detailed error message (in development)"
 */
/**
 * @swagger
 * /admin/users/status:
 *   patch:
 *     summary: Update a user's status (Admin only)
 *     tags: [User]
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
 *                 description: The login name of the user to update.
 *                 example: "testuser"
 *               status:
 *                 type: string
 *                 description: The new status for the user.
 *                 enum: [Active, Inactive]
 *                 example: "Inactive"
 *             required:
 *               - loginName
 *               - status
 *     responses:
 *       200:
 *         description: User status updated successfully
 *       400:
 *         description: Invalid input, loginName and status are required, or status is invalid
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Only Admins can perform this action
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
/**
 * @swagger
 * /admin/users/counts-by-role:
 *   get:
 *     summary: Get user counts by role (excluding Admins)
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: A JSON object with role counts.
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
 *                     type: integer
 *                   example:
 *                     Scrutiny Officer: 10
 *                     Supervisor: 5
 *                     Relationship Manager: 12
 *                     Authorised Person: 8
 *                     Branch: 3
 *       500:
 *         description: Server error
 */
