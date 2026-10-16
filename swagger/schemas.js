/**
 * @swagger
 * components:
 *   schemas:
 *     AuthCredentials:
 *       type: object
 *       required:
 *         - loginName
 *         - password
 *       properties:
 *         loginName:
 *           type: string
 *           example: "admin"
 *         password:
 *           type: string
 *           format: password
 *           example: "Admin@123"
 *
 *     AuthResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         token:
 *           type: string
 *           example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *         user:
 *           type: object
 *           properties:
 *             _id:
 *               type: string
 *               example: "507f1f77bcf86cd799439011"
 *             loginName:
 *               type: string
 *               example: "admin"
 *             name:
 *               type: string
 *               example: "Admin User"
 *             role:
 *               type: string
 *               example: "Admin"
 *
 *     User:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           example: "60d0fe4f5b86d7001c88c8c8"
 *         fullName:
 *           type: string
 *           example: "John Doe"
 *         PAN:
 *           type: string
 *           example: "ABCDE1234F"
 *         mobile:
 *           type: string
 *           example: "9876543210"
 *         email:
 *           type: string
 *           example: "john.doe@example.com"
 *         referral:
 *           type: object
 *           properties:
 *             referralType:
 *               type: string
 *               example: "AP"
 *             referralId:
 *               type: string
 *               example: "60d0fe4f5b86d7001c88c8c9"
 *         createdOn:
 *           type: string
 *           format: date-time
 *           example: "2023-10-27T10:00:00.000Z"
 *
 *     UserInput:
 *       type: object
 *       required:
 *         - loginName
 *         - role
 *         - name
 *         - employeeId
 *         - mobile
 *         - email
 *         - password
 *       properties:
 *         loginName:
 *           type: string
 *           example: "johndoe"
 *         role:
 *           type: string
 *           enum: ["Scrutiny Officer", "Supervisor", "Admin", "Relationship Manager", "Authorised Person", "Branch", "Management"]
 *           example: "Authorised Person"
 *         name:
 *           type: string
 *           example: "John Doe"
 *         employeeId:
 *           type: string
 *           example: "EMP001"
 *         email:
 *           type: string
 *           example: "john.doe@example.com"
 *         mobile:
 *           type: string
 *           example: "9876543210"
 *         password:
 *           type: string
 *           format: password
 *           example: "password123"
 *         branch:
 *           type: string
 *           example: "507f1f77bcf86cd799439011"
 *         reportingTo:
 *           type: string
 *           example: "507f1f77bcf86cd799439012"
 *
 *     UserUpdate:
 *       type: object
 *       properties:
 *         loginName:
 *           type: string
 *           example: "johndoe_updated"
 *         role:
 *           type: string
 *           enum: ["Scrutiny Officer", "Supervisor", "Admin", "Relationship Manager", "Authorised Person", "Branch", "Management"]
 *           example: "Authorised Person"
 *         name:
 *           type: string
 *           example: "John Doe Updated"
 *         employeeId:
 *           type: string
 *           example: "EMP001_UPDATED"
 *         email:
 *           type: string
 *           example: "john.updated@example.com"
 *         mobile:
 *           type: string
 *           example: "9876543210"
 *         password:
 *           type: string
 *           format: password
 *           example: "newpassword123"
 *         branch:
 *           type: string
 *           example: "507f1f77bcf86cd799439011"
 *         reportingTo:
 *           type: string
 *           example: "507f1f77bcf86cd799439012"
 *         status:
 *           type: string
 *           enum: ["Active", "Inactive"]
 *           example: "Active"
 *
 *   responses:
 *     BadRequestError:
 *       description: Bad request - invalid input or missing parameters
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               success:
 *                 type: boolean
 *                 example: false
 *               message:
 *                 type: string
 *                 example: "Invalid input provided"
 *     NotFoundError:
 *       description: Resource not found
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               success:
 *                 type: boolean
 *                 example: false
 *               message:
 *                 type: string
 *                 example: "Resource not found"
 *     ServerError:
 *       description: Internal server error
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               success:
 *                 type: boolean
 *                 example: false
 *               message:
 *                 type: string
 *                 example: "Internal server error"
 *               error:
 *                 type: string
 *                 example: "Detailed error message (in development)"
 */
