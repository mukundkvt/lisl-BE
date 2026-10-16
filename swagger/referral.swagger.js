/**
 * @swagger
 * tags:
 *   name: Referral
 *   description: Referral management and tracking
 */

/**
 * @swagger
 * /admin/track/{code}:
 *   get:
 *     summary: Track a referral click
 *     tags: [Referral]
 *     parameters:
 *       - in: path
 *         name: code
 *         schema:
 *           type: string
 *         required: true
 *         description: The referral code to track
 *     responses:
 *       200:
 *         description: Referral click tracked successfully
 *       404:
 *         description: Referral not found
 */

/**
 * @swagger
 * /admin/info/{code}:
 *   get:
 *     summary: Get referral information for display
 *     tags: [Referral]
 *     parameters:
 *       - in: path
 *         name: code
 *         schema:
 *           type: string
 *         required: true
 *         description: The referral code
 *     responses:
 *       200:
 *         description: Referral information retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 referral:
 *                   $ref: '#/components/schemas/Referral'
 *       404:
 *         description: Referral not found
 */

/**
 * @swagger
 * /admin/referral:
 *   post:
 *     summary: Create a new referral campaign
 *     tags: [Referral]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               campaignName:
 *                 type: string
 *                 description: Name of the referral campaign
 *               schemeId:
 *                 type: string
 *                 description: ID of the scheme to create referral for
 *             required:
 *               - campaignName
 *               - schemeId
 *     responses:
 *       201:
 *         description: Referral campaign created successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *
 *   get:
 *     summary: Get all referrals (Admin and Supervisor only)
 *     tags: [Referral]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of all referrals
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Referral'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */

/**
 * @swagger
 * /admin/referral/my:
 *   get:
 *     summary: Get current user's referrals
 *     tags: [Referral]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of user's referrals
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Referral'
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /admin/referral/{id}/stats:
 *   get:
 *     summary: Get referral statistics
 *     tags: [Referral]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: The referral ID
 *     responses:
 *       200:
 *         description: Referral statistics retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Referral not found
 */

/**
 * @swagger
 * /admin/referral/{id}:
 *   put:
 *     summary: Update referral (owner or admin/supervisor)
 *     tags: [Referral]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: The referral ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               campaignName:
 *                 type: string
 *               maxUses:
 *                 type: number
 *               expiresAt:
 *                 type: string
 *                 format: date-time
 *             required:
 *                 - campaignName
 *                 - maxUses
 *                 - expiresAt
 *     responses:
 *       200:
 *         description: Referral updated successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Referral not found
 *
 *   delete:
 *     summary: Delete referral (owner or admin/supervisor)
 *     tags: [Referral]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: The referral ID
 *     responses:
 *       200:
 *         description: Referral deleted successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Referral not found
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Referral:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: The auto-generated ID of the referral
 *         campaignName:
 *           type: string
 *           description: Name of the referral campaign
 *         referralCode:
 *           type: string
 *           description: Unique code for the referral
 *         createdBy:
 *           type: string
 *           description: ID of the user who created the referral
 *         maxUses:
 *           type: number
 *           description: Maximum number of times the referral can be used
 *         currentUses:
 *           type: number
 *           description: Current number of times the referral has been used
 *         expiresAt:
 *           type: string
 *           format: date-time
 *           description: Expiration date of the referral
 *         clicks:
 *           type: number
 *           description: Number of times the referral link has been clicked
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Date when the referral was created
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Date when the referral was last updated
 *       example:
 *         _id: "60d5ec49f8c7b0001c8c4c8c"
 *         campaignName: "Summer Promo"
 *         referralCode: "SUMMER2023"
 *         createdBy: "60d5ec49f8c7b0001c8c4c8d"
 *         maxUses: 100
 *         currentUses: 10
 *         expiresAt: "2023-08-31T23:59:59.000Z"
 *         clicks: 50
 *         createdAt: "2023-07-01T10:00:00.000Z"
 *         updatedAt: "2023-07-15T12:30:00.000Z"
 *
 *       404:
 *         description: Referral campaign not found
 *       500:
 *         description: Server error
 *
 *   delete:
 *     summary: Delete referral campaign (Admin only)
 *     tags: [Referral]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: Referral campaign ID
 *     responses:
 *       200:
 *         description: Referral campaign deleted successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 *       404:
 *         description: Referral campaign not found
 *       500:
 *         description: Server error
 */
/**
 * @swagger
 * /admin/referrals/{id}/analytics:
 *   get:
 *     summary: Get referral campaign analytics
 *     tags: [Referral]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: Referral campaign ID
 *     responses:
 *       200:
 *         description: Referral campaign analytics
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
 *                     totalClicks:
 *                       type: integer
 *                       example: 150
 *                     totalConversions:
 *                       type: integer
 *                       example: 25
 *                     conversionRate:
 *                       type: number
 *                       format: float
 *                       example: 16.67
 *                     campaignDetails:
 *                       $ref: '#/components/schemas/Referral'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Referral campaign not found
 *       500:
 *         description: Server error
 */



/**
 * @swagger
 * /admin/register-with-referral:
 *   post:
 *     summary: Register user with referral code (Public endpoint)
 *     tags: [Referral]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: User's full name
 *                 example: "John Doe"
 *               mobile:
 *                 type: string
 *                 description: User's mobile number
 *                 example: "9876543210"
 *               email:
 *                 type: string
 *                 format: email
 *                 description: User's email address
 *                 example: "john.doe@example.com"
 *               referralCode:
 *                 type: string
 *                 description: Optional referral code
 *                 example: "REF123456"
 *             required:
 *               - name
 *               - mobile
 *               - email
 *     responses:
 *       201:
 *         description: User registered successfully with referral
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
 *                   example: "User registered successfully with referral"
 *                 data:
 *                   type: object
 *                   properties:
 *                     userId:
 *                       type: string
 *                     assignedScheme:
 *                       $ref: '#/components/schemas/Scheme'
 *       400:
 *         description: Invalid input or user already exists
 *       404:
 *         description: Invalid referral code
 *       500:
 *         description: Server error
 */
/**
 * @swagger
 * /admin/validate-referral/{referralCode}:
 *   get:
 *     summary: Validate referral code (Public endpoint)
 *     tags: [Referral]
 *     parameters:
 *       - in: path
 *         name: referralCode
 *         schema:
 *           type: string
 *         required: true
 *         description: Referral code to validate
 *     responses:
 *       200:
 *         description: Referral code validation result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 valid:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     campaignName:
 *                       type: string
 *                     schemeName:
 *                       type: string
 *                     expiryDate:
 *                       type: string
 *                       format: date
 *       404:
 *         description: Invalid referral code
 *       500:
 *         description: Server error
 */
/**
 * @swagger
 * /admin/users/{userId}/referral-info:
 *   get:
 *     summary: Get user's referral information (Protected endpoint)
 *     tags: [Referral]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         schema:
 *           type: string
 *         required: true
 *         description: User ID
 *     responses:
 *       200:
 *         description: User's referral information
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
 *                     hasReferral:
 *                       type: boolean
 *                     referralDetails:
 *                       $ref: '#/components/schemas/Referral'
 *                     assignedScheme:
 *                       $ref: '#/components/schemas/Scheme'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
/**
 * @swagger
 * components:
 *   schemas:
 *     Referral:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           example: "507f1f77bcf86cd799439011"
 *         campaignName:
 *           type: string
 *           example: "Summer 2024 Campaign"
 *         referralCode:
 *           type: string
 *           example: "REF123456"
 *         schemeId:
 *           type: string
 *           example: "507f1f77bcf86cd799439012"
 *         createdBy:
 *           type: string
 *           example: "507f1f77bcf86cd799439013"
 *         expiryDate:
 *           type: string
 *           format: date
 *           example: "2024-12-31"
 *         isActive:
 *           type: boolean
 *           example: true
 *         clickCount:
 *           type: integer
 *           example: 150
 *         conversionCount:
 *           type: integer
 *           example: 25
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *     Scheme:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           example: "507f1f77bcf86cd799439011"
 *         name:
 *           type: string
 *           example: "Premium Scheme"
 *         description:
 *           type: string
 *           example: "Premium banking scheme with enhanced benefits"
 *         isDefault:
 *           type: boolean
 *           example: false
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */