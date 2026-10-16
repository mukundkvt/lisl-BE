/**
 * @swagger
 * tags:
 *   name: Schemes
 *   description: Scheme management endpoints
 */

/**
 * @swagger
 * /admin/schemes:
 *   post:
 *     summary: Create a new scheme
 *     tags: [Schemes]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - schemeName
 *               - isDefault
 *             properties:
 *               schemeName:
 *                 type: string
 *                 description: The name of the scheme
 *               description:
 *                 type: string
 *                 description: A description of the scheme
 *               isDefault:
 *                 type: boolean
 *                 description: Whether this scheme is the default scheme
 *               cMSegmentTradingBrokerage:
 *                 type: number
 *                 description: CM segment trading brokerage
 *               fOSegmentTradingBrokerage:
 *                 type: number
 *                 description: FO segment trading brokerage
 *               currencyTradingBrokerage:
 *                 type: number
 *                 description: Currency segment trading brokerage
 *               mCXNCDEXTradingBrokerage:
 *                 type: number
 *                 description: MCX/NCDEX segment trading brokerage
 *               cMSegmentDeliveryBrokerage:
 *                 type: number
 *                 description: CM segment delivery brokerage
 *               fOSegmentDeliveryBrokerage:
 *                 type: number
 *                 description: FO segment delivery brokerage
 *               currencyDeliveryBrokerage:
 *                 type: number
 *                 description: Currency segment delivery brokerage
 *               mCXNCDEXDeliveryBrokerage:
 *                 type: number
 *                 description: MCX/NCDEX segment delivery brokerage
 *               cMSegmentMinimumBrokerageInPaisa:
 *                 type: number
 *                 description: CM segment minimum brokerage in paisa
 *               fOSegmentMinimumBrokerageInPaisa:
 *                 type: number
 *                 description: FO segment minimum brokerage in paisa
 *               currencyMinimumBrokerageInPaisa:
 *                 type: number
 *                 description: Currency segment minimum brokerage in paisa
 *               mCXNCDEXMinimumBrokerageInPaisa:
 *                 type: number
 *                 description: MCX/NCDEX segment minimum brokerage in paisa
 *               fOSegmentOptionBrokerageInRs:
 *                 type: number
 *                 description: FO segment option brokerage in rupees
 *               currencyOptionBrokerageInRs:
 *                 type: number
 *                 description: Currency segment option brokerage in rupees
 *               mCXNCDEXOptionBrokerageInRs:
 *                 type: number
 *                 description: MCX/NCDEX segment option brokerage in rupees
 *               cBrkgBasketNSE:
 *                 type: number
 *                 description: Basket brokerage for NSE
 *               cBrkgBasketBSE:
 *                 type: number
 *                 description: Basket brokerage for BSE
 *               cBrkgBasketFO:
 *                 type: number
 *                 description: Basket brokerage for FO
 *               nDelCMBrkg:
 *                 type: number
 *                 description: Delivery CM brokerage
 *               nDelCMBrkgMin:
 *                 type: number
 *                 description: Minimum delivery CM brokerage
 *               nSqCMBrkg:
 *                 type: number
 *                 description: Square off CM brokerage
 *               nSqCMBrkgMin:
 *                 type: number
 *                 description: Minimum square off CM brokerage
 *               nFutBrkg:
 *                 type: number
 *                 description: Futures brokerage
 *               nFutBrkgMin:
 *                 type: number
 *                 description: Minimum futures brokerage
 *               isActive:
 *                 type: boolean
 *                 description: Whether the scheme is active
 *             example:
 *               schemeName: "Standard Scheme"
 *               isDefault: false
 *               cMSegmentTradingBrokerage: 0.1
 *               fOSegmentTradingBrokerage: 0.1
 *               currencyTradingBrokerage: 0.1
 *               mCXNCDEXTradingBrokerage: 0.1
 *               cMSegmentDeliveryBrokerage: 0.1
 *               fOSegmentDeliveryBrokerage: 0.1
 *               currencyDeliveryBrokerage: 0.1
 *               mCXNCDEXDeliveryBrokerage: 0.1
 *               cMSegmentMinimumBrokerageInPaisa: 10
 *               fOSegmentMinimumBrokerageInPaisa: 10
 *               currencyMinimumBrokerageInPaisa: 10
 *               mCXNCDEXMinimumBrokerageInPaisa: 10
 *               fOSegmentOptionBrokerageInRs: 10
 *               currencyOptionBrokerageInRs: 10
 *               mCXNCDEXOptionBrokerageInRs: 10
 *               cBrkgBasketNSE: "Standard Scheme"
 *               cBrkgBasketBSE: "Standard Scheme"
 *               cBrkgBasketFO: "Standard Scheme"
 *               nDelCMBrkg: 0.1
 *               nDelCMBrkgMin: 10
 *               nSqCMBrkg: 0.1
 *               nSqCMBrkgMin: 10
 *               nFutBrkg: 0.1
 *               nFutBrkgMin: 10
 *               isActive: true
 *     responses:
 *       201:
 *         description: Scheme created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Scheme'
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */

/**
 * @swagger
 * /admin/schemes:
 *   get:
 *     summary: Get all schemes
 *     tags: [Schemes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: Filter schemes by active status
 *     responses:
 *       200:
 *         description: A list of schemes
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 count:
 *                   type: integer
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                         description: The scheme's unique identifier
 *                       schemeName:
 *                         type: string
 *                         description: The name of the scheme
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */

/**
 * @swagger
 * /admin/schemes/accessible:
 *   get:
 *     summary: Get schemes accessible to current user (AP/RM only)
 *     tags: [Schemes]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Accessible schemes retrieved successfully
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
 *                         example: "60d5ec49f8c7b7001c8e4d8a"
 *                       schemeId:
 *                         type: number
 *                         example: 1
 *                       schemeName:
 *                         type: string
 *                         example: "Default Scheme"
 *               examples:
 *                 AccessibleSchemesFound:
 *                   value:
 *                     success: true
 *                     data:
 *                       - _id: "60d5ec49f8c7b7001c8e4d8a"
 *                         schemeId: 1
 *                         schemeName: "Default Scheme"
 *                       - _id: "60d5ec49f8c7b7001c8e4d8b"
 *                         schemeId: 2
 *                         schemeName: "Another Scheme"
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Forbidden
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/responses/ForbiddenError'
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
 *                 error:
 *                   type: string
 *                   example: "Failed to fetch accessible schemes"
 */

/**
 * @swagger
 * /admin/schemes/{id}:
 *   get:
 *     tags: [Schemes]
 *     summary: Get a scheme by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The scheme ID
 *     responses:
 *       200:
 *         description: Scheme retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Scheme'
 *             examples:
 *               SchemeFound:
 *                 value:
 *                   success: true
 *                   data:
 *                     _id: "60d5ec49f8c7b7001c8e4d8a"
 *                     schemeId: 1
 *                     schemeName: "Default Scheme"
 *                     isActive: true
 *                     isDefault: true
 *                     createdAt: "2023-01-01T12:00:00.000Z"
 *                     updatedAt: "2023-01-01T12:00:00.000Z"
 *       404:
 *         description: Scheme not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: "Scheme not found"
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
 *                 error:
 *                   type: string
 *                   example: "Failed to fetch scheme"
 *
 * /admin/schemes/assignment-status/{adminUserId}:
 *   put:
 *     summary: Update scheme assignment status for an Admin User
 *     tags: [Schemes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: adminUserId
 *         schema:
 *           type: string
 *         required: true
 *         description: The ID of the Admin User
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - schemes
 *             properties:
 *               schemes:
 *                 type: array
 *                 description: An array of scheme objects with their assignment status
 *                 items:
 *                   type: object
 *                   required:
 *                     - _id
 *                     - schemeName
 *                     - isAssigned
 *                   properties:
 *                     _id:
 *                       type: string
 *                       description: The ID of the scheme
 *                     schemeName:
 *                       type: string
 *                       description: The name of the scheme
 *                     isAssigned:
 *                       type: boolean
 *                       description: Whether the scheme is assigned to the Admin User
 *             example:
 *               schemes:
 *                 - _id: "68a402ea190bded74c2a07cd"
 *                   schemeName: "LISL"
 *                   isAssigned: true
 *                 - _id: "68a578d179ba640af19e9ff1"
 *                   schemeName: "New Schemes"
 *                   isAssigned: false
 *                 - _id: "68a57cf579ba640af19e9ffa"
 *                   schemeName: "hello"
 *                   isAssigned: false
 *                 - _id: "68a5a49a79ba640af19ea023"
 *                   schemeName: "asbns"
 *                   isAssigned: true
 *     responses:
 *       200:
 *         description: Scheme assignment status updated successfully
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
 *                   example: "Scheme assignment status updated successfully."
 *                 assignedSchemes:
 *                   type: array
 *                   items:
 *                     type: string
 *                   example:
 *                     - "60c72b2f9b1d8c001c8e4d1a"
 *       400:
 *         description: Invalid input or default scheme cannot be unassigned
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: "Admin User ID and an array of schemes are required."
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Admin User not found
 *       500:
 *         description: Internal server error

 */

/**
 * @swagger
 * /admin/schemes/{id}:
 *   put:
 *     summary: Update a scheme by ID
 *     tags: [Schemes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The scheme's MongoDB _id
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               schemeName:
 *                 type: string
 *                 description: The name of the scheme
 *               description:
 *                 type: string
 *                 description: A description of the scheme
 *               isDefault:
 *                 type: boolean
 *                 description: Whether this scheme is the default scheme
 *               cMSegmentTradingBrokerage:
 *                 type: number
 *                 description: CM segment trading brokerage
 *               fOSegmentTradingBrokerage:
 *                 type: number
 *                 description: FO segment trading brokerage
 *               currencyTradingBrokerage:
 *                 type: number
 *                 description: Currency segment trading brokerage
 *               mCXNCDEXTradingBrokerage:
 *                 type: number
 *                 description: MCX/NCDEX segment trading brokerage
 *               cMSegmentDeliveryBrokerage:
 *                 type: number
 *                 description: CM segment delivery brokerage
 *               fOSegmentDeliveryBrokerage:
 *                 type: number
 *                 description: FO segment delivery brokerage
 *               currencyDeliveryBrokerage:
 *                 type: number
 *                 description: Currency segment delivery brokerage
 *               mCXNCDEXDeliveryBrokerage:
 *                 type: number
 *                 description: MCX/NCDEX segment delivery brokerage
 *               cMSegmentMinimumBrokerageInPaisa:
 *                 type: number
 *                 description: CM segment minimum brokerage in paisa
 *               fOSegmentMinimumBrokerageInPaisa:
 *                 type: number
 *                 description: FO segment minimum brokerage in paisa
 *               currencyMinimumBrokerageInPaisa:
 *                 type: number
 *                 description: Currency segment minimum brokerage in paisa
 *               mCXNCDEXMinimumBrokerageInPaisa:
 *                 type: number
 *                 description: MCX/NCDEX segment minimum brokerage in paisa
 *               fOSegmentOptionBrokerageInRs:
 *                 type: number
 *                 description: FO segment option brokerage in rupees
 *               currencyOptionBrokerageInRs:
 *                 type: number
 *                 description: Currency segment option brokerage in rupees
 *               mCXNCDEXOptionBrokerageInRs:
 *                 type: number
 *                 description: MCX/NCDEX segment option brokerage in rupees
 *               cBrkgBasketNSE:
 *                 type: number
 *                 description: Basket brokerage for NSE
 *               cBrkgBasketBSE:
 *                 type: number
 *                 description: Basket brokerage for BSE
 *               cBrkgBasketFO:
 *                 type: number
 *                 description: Basket brokerage for FO
 *               nDelCMBrkg:
 *                 type: number
 *                 description: Delivery CM brokerage
 *               nDelCMBrkgMin:
 *                 type: number
 *                 description: Minimum delivery CM brokerage
 *               nSqCMBrkg:
 *                 type: number
 *                 description: Square off CM brokerage
 *               nSqCMBrkgMin:
 *                 type: number
 *                 description: Minimum square off CM brokerage
 *               nFutBrkg:
 *                 type: number
 *                 description: Futures brokerage
 *               nFutBrkgMin:
 *                 type: number
 *                 description: Minimum futures brokerage
 *               isActive:
 *                 type: boolean
 *                 description: Whether the scheme is active
 *             example:
 *               schemeName: "Updated Scheme Name"
 *               description: "Updated description for the scheme."
 *               isDefault: true
 *               cMSegmentTradingBrokerage: 0.15
 *               isActive: false
 *     responses:
 *       200:
 *         description: Scheme updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Scheme'
 *       400:
 *         description: Invalid input
 *       404:
 *         description: Scheme not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */

/**
 * @swagger
 * /admin/schemes/{id}:
 *   delete:
 *     summary: Delete a scheme by ID
 *     tags: [Schemes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The scheme's MongoDB _id
 *     responses:
 *       200:
 *         description: Scheme deleted successfully
 *       404:
 *         description: Scheme not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */

/**
 * @swagger
 * /admin/schemes/set-default/{id}:
 *   put:
 *     summary: Set a scheme as default
 *     tags: [Schemes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The scheme's MongoDB _id to set as default
 *     responses:
 *       200:
 *         description: Scheme set as default successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Scheme'
 *       404:
 *         description: Scheme not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */


/**
 * @swagger
 * /admin/schemes/{schemeId}/assign-access/{userId}:
 *   post:
 *     summary: Assign scheme access to a user
 *     tags: [Schemes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: schemeId
 *         required: true
 *         schema:
 *           type: string
 *         description: The scheme's MongoDB _id
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the user to assign access to
 *     responses:
 *       200:
 *         description: Scheme access assigned successfully
 *       404:
 *         description: Scheme or User not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */

/**
 * @swagger
 * /admin/schemes/{schemeId}/remove-access/{userId}:
 *   delete:
 *     summary: Remove scheme access from a user
 *     tags: [Schemes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: schemeId
 *         required: true
 *         schema:
 *           type: string
 *         description: The scheme's MongoDB _id
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the user to remove access from
 *     responses:
 *       200:
 *         description: Scheme access removed successfully
 *       404:
 *         description: Scheme or User not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */

/**
 * @swagger
 * /admin/schemes/{schemeId}/users:
 *   get:
 *     summary: Get users associated with a scheme
 *     tags: [Schemes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: schemeId
 *         required: true
 *         schema:
 *           type: string
 *         description: The scheme's MongoDB _id
 *     responses:
 *       200:
 *         description: A list of users associated with the scheme
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/User'
 *       404:
 *         description: Scheme not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */

/**
 * @swagger
 * /admin/schemes/assignment-status/{adminUserId}:
 *   get:
 *     summary: Get all schemes with their assignment status for a specific Admin User
 *     tags: [Schemes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: adminUserId
 *         required: true
 *         schema:
 *           type: string
 *         description: The Admin User's MongoDB _id
 *     responses:
 *       200:
 *         description: A list of schemes with their assignment status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                         description: The scheme's MongoDB _id
 *                       schemeName:
 *                         type: string
 *                         description: The name of the scheme
 *                       isAssigned:
 *                         type: boolean
 *                         description: True if the scheme is assigned to the user, false otherwise
 *       400:
 *         description: Invalid Admin User ID
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Admin User not found
 */
