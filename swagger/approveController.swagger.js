/**
 * @swagger
 * tags:
 *   name: Manage User Approvals
 *   description: Endpoints to manage user approval status
 */

/**
 * @swagger
 * /api/admin/user-approval/{userId}:
 *   put:
 *     summary: Update a user's approval status
 *     description: Allows an admin to approve or reject a specific section of a user's profile.
 *     tags: [Manage User Approvals]
 *     parameters:
 *       - name: userId
 *         in: path
 *         required: true
 *         description: ID of the user whose approval status will be updated
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       description: Approval status update details
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *               - section
 *             properties:
 *               status:
 *                 type: string
 *                 description: New status of the section
 *                 enum: [pending, approved, rejected]
 *                 example: approved
 *               section:
 *                 type: string
 *                 description: The section of the user profile to update
 *                 example: address
 *               reason:
 *                 type: string
 *                 description: Reason for rejection (required if status is rejected)
 *                 example: "Address proof invalid"
 *     responses:
 *       200:
 *         description: User approval updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: User approval updated successfully
 *       400:
 *         description: Bad request (invalid status or section)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Invalid status
 *       403:
 *         description: Admin not found or unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Admin not found or unauthorized
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
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
 *                 message:
 *                   type: string
 *                   example: Internal server error
 *                 error:
 *                   type: string
 *                   example: Error details here
 *     security:
 *       - bearerAuth: []
 */

/**
 * @swagger
 * /api/admin/user-approval-status/{userId}:
 *   get:
 *     summary: Get user approval status
 *     description: Retrieve approval status for all sections of a user, including overall status and last approval time.
 *     tags: [Manage User Approvals]
 *     parameters:
 *       - name: userId
 *         in: path
 *         required: true
 *         description: ID of the user
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User approval status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 allApproved:
 *                   type: boolean
 *                   description: True if all required sections are approved
 *                   example: false
 *                 lastApprovedAt:
 *                   type: string
 *                   format: date-time
 *                   description: Timestamp of the last approval action across all sections
 *                   example: "2023-10-27T10:00:00.000Z"
 *                 addressStatus:
 *                   type: string
 *                   description: Status of address approval
 *                   enum: [pending, approved, rejected]
 *                   example: pending
 *                 profileStatus:
 *                   type: string
 *                   description: Status of profile approval
 *                   enum: [pending, approved, rejected]
 *                   example: pending
 *                 bankStatus:
 *                   type: string
 *                   description: Status of bank approval
 *                   enum: [pending, approved, rejected]
 *                   example: pending
 *                 dematStatus:
 *                   type: string
 *                   description: Status of demat approval
 *                   enum: [pending, approved, rejected]
 *                   example: pending
 *                 exchangeStatus:
 *                   type: string
 *                   description: Status of exchange approval
 *                   enum: [pending, approved, rejected]
 *                   example: pending
 *                 ipvStatus:
 *                   type: string
 *                   description: Status of IPV approval
 *                   enum: [pending, approved, rejected]
 *                   example: pending
 *                 digitalSignStatus:
 *                   type: string
 *                   description: Status of digital sign approval
 *                   enum: [pending, approved, rejected]
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *                   description: User creation timestamp
 *                   example: "2023-01-01T10:00:00.000Z"
 *                 clientCode:
 *                   type: string
 *                   description: User client code
 *                   example: "CLIENT123"
 *                 name:
 *                   type: object
 *                   properties:
 *                     fullName:
 *                       type: string
 *                     firstName:
 *                       type: string
 *                     middleName:
 *                       type: string
 *                     lastName:
 *                       type: string
 *                 nameAsPerAddressProof:
 *                   type: object
 *                   properties:
 *                     fullName:
 *                       type: string
 *                     firstName:
 *                       type: string
 *                     middleName:
 *                       type: string
 *                     lastName:
 *                       type: string
 *                 isNameMatchPAN:
 *                   type: boolean
 *                   description: Whether name matches PAN
 *                   example: true
 *                 referredBy:
 *                   type: object
 *                   description: Referral details (optional)
 *                   properties:
 *                     _id:
 *                       type: string
 *                     name:
 *                       type: string
 *                     employeeId:
 *                       type: string
 *                     role:
 *                       type: string
 *                     mobile:
 *                       type: string
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 *     security:
 *       - bearerAuth: []
 */
