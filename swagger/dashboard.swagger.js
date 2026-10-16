
/**
 * @swagger
 * /api/admin/dashboard/users:
 *   get:
 *     summary: Get users based on admin user role
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Fetches users based on the logged-in admin's role:
 *       - Authorised Person: Returns users referred by that AP
 *       - Relationship Manager: Returns users referred by RM and their team members (APs)
 *       - Branch: Returns all users under that branch, including RM and AP referrals
 *       - Scrutiny Officer/Supervisor: Returns all users
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
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by PAN, clientCode, name, city, or pincode
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter by start date (YYYY-MM-DD)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter by end date (YYYY-MM-DD)
 *       - in: query
 *         name: userStatus
 *         schema:
 *           type: string
 *           enum: [none, pending, approved, esigned, rejected, completed]
 *         description: Filter by user status
 *     responses:
 *       200:
 *         description: Successfully retrieved users
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 page:
 *                   type: integer
 *                   example: 1
 *                 limit:
 *                   type: integer
 *                   example: 10
 *                 totalUsers:
 *                   type: integer
 *                   example: 100
 *                 totalPages:
 *                   type: integer
 *                   example: 10
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                         example: 60d0fe4f5b86d7001c88c8c8
 *                       clientCode:
 *                         type: string
 *                         nullable: true
 *                         example: UCC12345
 *                       name:
 *                         type: string
 *                         example: John Doe
 *                       gender:
 *                         type: string
 *                         example: male
 *                       email:
 *                         type: string
 *                         example: john.doe@example.com
 *                       mobileNumber:
 *                         type: string
 *                         example: "9876543210"
 *                       PAN:
 *                         type: string
 *                         example: ABCDE1234F
 *                       panConfirmed:
 *                         type: boolean
 *                         example: true
 *                       createdAt:
 *                         type: string
 *                         example: "2023-10-27T10:00:00.000Z"
 *                       updatedAt:
 *                         type: string
 *                         example: "2023-10-27T10:00:00.000Z"
 *                       userStatus:
 *                         type: string
 *                         example: pending
 *                       referredBy:
 *                         type: object
 *                         properties:
 *                           name:
 *                             type: string
 *                             example: Jane Smith
 *                           employeeId:
 *                             type: string
 *                             example: EMP123
 *                           role:
 *                             type: string
 *                             example: Relationship Manager
 *                       kycType:
 *                         type: string
 *                         example: Digilocker
 *                       approvals:
 *                         type: object
 *                         properties:
 *                           address:
 *                             type: object
 *                             properties:
 *                               status:
 *                                 type: string
 *                                 example: pending
 *                           profile:
 *                             type: object
 *                             properties:
 *                               status:
 *                                 type: string
 *                                 example: pending
 *                           bank:
 *                             type: object
 *                             properties:
 *                               status:
 *                                 type: string
 *                                 example: pending
 *                           demat:
 *                             type: object
 *                             properties:
 *                               status:
 *                                 type: string
 *                                 example: pending
 *                           exchange:
 *                             type: object
 *                             properties:
 *                               status:
 *                                 type: string
 *                                 example: pending
 *                           ipv:
 *                             type: object
 *                             properties:
 *                               status:
 *                                 type: string
 *                                 example: pending
 *                           digitalSign:
 *                             type: object
 *                             properties:
 *                               status:
 *                                 type: string
 *                                 example: pending
 *       403:
 *         description: Unauthorized role
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /api/admin/dashboard/users/summary-matrix:
 *   get:
 *     summary: Get dashboard summary matrix (Channel vs Stage)
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Returns a matrix count of users categorized by Channel (Direct, RM, AP) and Stage (Prospects, Address, Bank, IPV, Esign, Rejection, Sent to B.O).
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *         description: Filter by start date (DD/MM/YYYY)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *         description: Filter by end date (DD/MM/YYYY)
 *     responses:
 *       200:
 *         description: Successfully retrieved dashboard summary matrix
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   description: Object keys are channels (direct, rm, ap, total) based on user role.
 *                   properties:
 *                     direct:
 *                       type: object
 *                       properties:
 *                         Prospects: { type: integer, example: 10 }
 *                         Address: { type: integer, example: 5 }
 *                         Bank: { type: integer, example: 2 }
 *                         IPV: { type: integer, example: 3 }
 *                         Esign: { type: integer, example: 1 }
 *                         Rejection: { type: integer, example: 0 }
 *                         Sent to B.O: { type: integer, example: 4 }
 *                     rm:
 *                       type: object
 *                       description: Same structure as direct
 *                     ap:
 *                       type: object
 *                       description: Same structure as direct
 *                     total:
 *                       type: object
 *                       description: Sum of all visible channels
 *       403:
 *         description: Unauthorized role
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /api/admin/dashboard/users/stage-list:
 *   get:
 *     summary: Get user list by dashboard stage and channel
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Returns detailed list of users for a specific cell in the dashboard matrix (Channel x Stage).
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *         description: Filter by start date (DD/MM/YYYY)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *         description: Filter by end date (DD/MM/YYYY)
 *       - in: query
 *         name: channel
 *         required: true
 *         schema:
 *           type: string
 *           enum: [DIRECT, RM, AP, ALL]
 *         description: User acquisition channel (use ALL for all channels)
 *       - in: query
 *         name: stage
 *         required: true
 *         schema:
 *           type: string
 *           enum: [Prospects, Address, Bank, IPV, Esign, Rejection, Sent to B.O]
 *         description: User application stage
 *     responses:
 *       200:
 *         description: Successfully retrieved user list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 count:
 *                   type: integer
 *                   example: 10
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                         example: 60d0fe4f5b86d7001c88c8c8
 *                       name:
 *                         type: string
 *                         example: John Doe
 *                       email:
 *                         type: string
 *                         example: john@example.com
 *                       mobileNumber:
 *                         type: string
 *                         example: "9876543210"
 *                       PAN:
 *                         type: string
 *                         example: ABCDE1234F
 *                       clientCode:
 *                         type: string
 *                         example: CLT001
 *                       createdAt:
 *                         type: string
 *                         example: 27/10/2023
 *       400:
 *         description: Missing required parameters
 */
 
 /**
 * @swagger
 * /api/admin/dashboard/users/onboarding-graph:
 *   get:
 *     summary: Get user onboarding graph and stats
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Returns onboarding statistics (Today, Week, Month, Financial Year) and graph data based on filter.
 *       "Onboarded" refers to users who have successfully submitted their application (Signed).
 *     parameters:
 *       - in: query
 *         name: filter
 *         schema:
 *           type: string
 *           enum: [weekly, monthly, yearly]
 *           default: weekly
 *         description: Filter for graph data frequency/range
 *     responses:
 *       200:
 *         description: Successfully retrieved onboarding graph data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     stats:
 *                       type: object
 *                       properties:
 *                         today:
 *                           type: integer
 *                           example: 5
 *                         thisWeek:
 *                           type: integer
 *                           example: 25
 *                         thisMonth:
 *                           type: integer
 *                           example: 120
 *                         thisFinancialYear:
 *                           type: integer
 *                           example: 1500
 *                     graphData:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           date:
 *                             type: string
 *                             description: "Date format: 'DD/MM/YYYY' for weekly/monthly, 'MonthName, Year' for yearly"
 *                             example: "27/10/2023"
 *                           count:
 *                             type: integer
 *                             example: 10
 *       500:
 *         description: Internal server error
 */


/**
 * @swagger
 * /api/admin/dashboard/users/details/address/{userId}:
 *   get:
 *     summary: Get user address details by user ID
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Fetches the address details of a specific user.
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: Unique ID of the user
 *     responses:
 *       200:
 *         description: Successfully retrieved user address details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 message:
 *                   type: string
 *                   example: User address fetched successfully
 *                 userAddress:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: object
 *                       properties:
 *                         fullName:
 *                           type: string
 *                           example: John Doe
 *                     address:
 *                       type: object
 *                       properties:
 *                         addressLine1:
 *                           type: string
 *                           example: 123 Main St
 *                         city:
 *                           type: string
 *                           example: Mumbai
 *                         pincode:
 *                           type: string
 *                           example: 400001
 *                     addressProof:
 *                       type: object
 *                       properties:
 *                         type:
 *                           type: string
 *                           example: aadhaar
 *                         number:
 *                           type: string
 *                           example: 123456789012
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
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       403:
 *         description: Forbidden - Access denied
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */


/**
 * @swagger
 * /api/admin/dashboard/users/details/profile/{userId}:
 *   get:
 *     summary: Get user profile details by user ID
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Fetches the profile details of a specific user.
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: Unique ID of the user
 *     responses:
 *       200:
 *         description: Successfully retrieved user profile details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 message:
 *                   type: string
 *                   example: User profile fetched successfully
 *                 userProfile:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: object
 *                       properties:
 *                         fullName:
 *                           type: string
 *                           example: John Doe
 *                     email:
 *                       type: string
 *                       example: john.doe@example.com
 *                     mobileNumber:
 *                       type: string
 *                       example: 9876543210
 *                     PAN:
 *                       type: string
 *                       example: ABCDE1234F
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
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       403:
 *         description: Forbidden - Access denied
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */


/**
 * @swagger
 * /api/admin/dashboard/users/details/bank/{userId}:
 *   get:
 *     summary: Get user bank details by user ID
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Fetches the bank details of a specific user.
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: Unique ID of the user
 *     responses:
 *       200:
 *         description: Successfully retrieved user bank details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 message:
 *                   type: string
 *                   example: User bank details fetched successfully
 *                 bankDetails:
 *                   type: object
 *                   properties:
 *                     bank_account_details:
 *                       type: object
 *                       properties:
 *                         account_number:
 *                           type: string
 *                           example: 1234567890
 *                         ifsc_code:
 *                           type: string
 *                           example: SBIN0001234
 *                         bank_name:
 *                           type: string
 *                           example: SBI
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
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       403:
 *         description: Forbidden - Access denied
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */


/**
 * @swagger
 * /api/admin/dashboard/users/details/exchange/{userId}:
 *   get:
 *     summary: Get user exchange details by user ID
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Fetches the exchange details of a specific user.
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: Unique ID of the user
 *     responses:
 *       200:
 *         description: Successfully retrieved user exchange details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 message:
 *                   type: string
 *                   example: User Exchange fetched successfully
 *                 userExchange:
 *                   type: object
 *                   properties:
 *                     exchange:
 *                       type: object
 *                       properties:
 *                         segments:
 *                           type: object
 *                           properties:
 *                             Cash:
 *                               type: boolean
 *                               example: true
 *                             FO:
 *                               type: boolean
 *                               example: false
 *                     appliedScheme:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           schemeName:
 *                             type: string
 *                             example: "Premium Plan"
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
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       403:
 *         description: Forbidden - Access denied
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */


/**
 * @swagger
 * /api/admin/dashboard/users/details/digital-signature/{userId}:
 *   get:
 *     summary: Get user digital signature by user ID
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Fetches the uploaded digital signature of a specific user.
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: Unique ID of the user
 *     responses:
 *       200:
 *         description: Successfully retrieved user digital signature
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 message:
 *                   type: string
 *                   example: User Digital Signature fetched successfully
 *                 digitalSignature:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: object
 *                       properties:
 *                         fullName:
 *                           type: string
 *                           example: John Doe
 *                     aadhaarXML:
 *                       type: string
 *                       example: "xml_string"
 *                     digitalSignatureContract:
 *                       type: object
 *                       properties:
 *                         signedTime:
 *                           type: string
 *                           example: "2023-10-27T10:00:00.000Z"
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
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       403:
 *         description: Forbidden - Access denied
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */


/**
 * @swagger
 * /api/admin/dashboard/users/details/ipv/{userId}:
 *   get:
 *     summary: Get user In-Person Verification (IPV) details by user ID
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Fetches the IPV details of a specific user.  
 *       Requires proper access permissions based on the admin's role.
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: Unique ID of the user
 *     responses:
 *       200:
 *         description: Successfully retrieved user IPV details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 message:
 *                   type: string
 *                   example: User IPV details fetched successfully
 *                 ipv_details:
 *                   type: object
 *                   properties:
 *                     panFile:
 *                       type: string
 *                       example: "pan.pdf"
 *                     adharPhoto:
 *                       type: string
 *                       example: "adhar.png"
 *                     ipv_details:
 *                       type: object
 *                       properties:
 *                         verifiedBy:
 *                           type: string
 *                           example: "Admin User"
 *                         date:
 *                           type: string
 *                           example: "2025-09-13"
 *                     geolocation:
 *                       type: object
 *                       properties:
 *                         latitude:
 *                           type: number
 *                           example: 28.6139
 *                         longitude:
 *                           type: number
 *                           example: 77.2090
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
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       403:
 *         description: Forbidden - Access denied
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */


/**
 * @swagger
 * /api/admin/dashboard/users/details/pdf-generation/{userId}:
 *   get:
 *     summary: Get user PDF generation details by user ID 
 *     description: Fetches basic user info and digital signature contract details for PDF generation.
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: userId
 *         in: path
 *         required: true
 *         description: ID of the user
 *         schema:
 *           type: string
 *           example: 64f5c5b2e9c8f1a2b3d4e5f6
 *     responses:
 *       200:
 *         description: Successfully fetched PDF generation details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 message:
 *                   type: string
 *                   example: User pdfGeneration details fetched successfully
 *                 pdfGeneration_details:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: object
 *                       properties:
 *                         fullName:
 *                           type: string
 *                           example: John Doe
 *                     PAN:
 *                       type: string
 *                       example: ABCDE1234F
 *                     digitalSignatureContract:
 *                       type: object
 *                       properties:
 *                         signedByClient:
 *                           type: boolean
 *                           example: true
 *                         signedPdf:
 *                           type: string
 *                           example: https://example.com/signed-contract.pdf
 *                         unSignedPdf:
 *                           type: string
 *                           example: https://example.com/unsigned-contract.pdf
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
 *       403:
 *         description: Forbidden - Access denied
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: failed
 *                 message:
 *                   type: string
 *                   example: Access denied
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: failed
 *                 message:
 *                   type: string
 *                   example: User not found
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: failed
 *                 message:
 *                   type: string
 *                   example: Internal server error
 */


/**
 * @swagger
 * /api/admin/dashboard/users/search:
 *   get:
 *     summary: Search users with hierarchical filtering and partial matching
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Searches for users based on various criteria, including hierarchical filtering
 *       (e.g., by Authorised Person, Relationship Manager, Branch, Scrutiny Officer, Supervisor, Admin, Management)
 *       and partial matching for mobile number, full name, PAN, email, and clientCode.
 *       The results are paginated and sorted by creation date in descending order.
 *     parameters:
 *       - in: query
 *         name: mobile
 *         schema:
 *           type: string
 *         description: Partial match for user's mobile number
 *       - in: query
 *         name: name
 *         schema:
 *           type: string
 *         description: Partial match for user's full name
 *       - in: query
 *         name: PAN
 *         schema:
 *           type: string
 *         description: Partial match for user's PAN
 *       - in: query
 *         name: email
 *         schema:
 *           type: string
 *         description: Partial match for user's email
 *       - in: query
 *         name: clientCode
 *         schema:
 *           type: string
 *         description: Partial match for user's client code
 *     responses:
 *       200:
 *         description: Successfully retrieved user search results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 message:
 *                   type: string
 *                   example: Users fetched successfully
 *                 users:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                         example: 60d0fe4f5b86d7001c88c8c8
 *                       fullName:
 *                         type: string
 *                         example: John Doe
 *                       PAN:
 *                         type: string
 *                         example: ABCDE1234F
 *                       mobileNumber:
 *                         type: string
 *                         example: "9876543210"
 *                       email:
 *                         type: string
 *                         example: john.doe@example.com
 *                       clientCode:
 *                         type: string
 *                         example: "CLT001"
 *                       referredBy:
 *                         type: string
 *                         description: How the user was referred (e.g., Direct, AP, RM)
 *                       referrerName:
 *                         type: string
 *                         description: Full name of the referrer
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                         example: 2023-10-27T10:00:00.000Z
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       403:
 *         description: Forbidden - Access denied
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /api/admin/dashboard/users/status-counts:
 *   get:
 *     summary: Get user status counts
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Retrieves counts of users for each user status (none, pending, approved, esigned, rejected, completed).
 *     responses:
 *       200:
 *         description: Successfully retrieved user status counts
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 message:
 *                   type: string
 *                   example: User status counts fetched successfully
 *                 counts:
 *                   type: object
 *                   properties:
 *                     none:
 *                       type: integer
 *                       example: 10
 *                     pending:
 *                       type: integer
 *                       example: 5
 *                     approved:
 *                       type: integer
 *                       example: 20
 *                     esigned:
 *                       type: integer
 *                       example: 15
 *                     rejected:
 *                       type: integer
 *                       example: 3
 *                     completed:
 *                       type: integer
 *                       example: 12
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       403:
 *         description: Forbidden - Access denied
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /api/admin/dashboard/users/rejected-user/{userId}:
 *   get:
 *     summary: Get rejected user details by user ID
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Fetches the rejection details (rejectedBy, rejectedAt, rejectionReason) for all rejected steps of a specific user.
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: Unique ID of the user
 *     responses:
 *       200:
 *         description: Successfully retrieved user rejection details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       field:
 *                         type: string
 *                         example: "address"
 *                       status:
 *                         type: string
 *                         example: "rejected"
 *                       rejectionReason:
 *                         type: string
 *                         example: "Invalid document"
 *                       rejectedBy:
 *                         type: object
 *                         properties:
 *                           name:
 *                             type: string
 *                             example: "Admin User"
 *                           employeeId:
 *                             type: string
 *                             example: "EMP001"
 *                       rejectedAt:
 *                         type: string
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
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       403:
 *         description: Forbidden - Access denied
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
