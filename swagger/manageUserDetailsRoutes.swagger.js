/**
 * @swagger
 * tags:
 *   name: Manage User Details
 *   description: Endpoints to manage user details
 */

/**
 * @swagger
 * /api/admin/manageuser/{userId}/address-proof-number:
 *   put:
 *     summary: Update a user's address proof number
 *     description: Updates only the address proof number of a specific user.
 *     tags: [Manage User Details]
 *     parameters:
 *       - name: userId
 *         in: path
 *         required: true
 *         description: ID of the user whose address proof number will be updated
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       description: New address proof number
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - addressProof_Number
 *             properties:
 *               addressProof_Number:
 *                 type: string
 *                 example: "A123456789"
 *     responses:
 *       200:
 *         description: Address proof number updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Address proof number updated successfully
 *                 user:
 *                   type: object
 *                   description: Updated user document
 *       400:
 *         description: Bad request, missing address proof number
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Address proof number is required
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
 * /api/admin/manageuser/{userId}/address:
 *   put:
 *     summary: Update a user's address
 *     description: Updates only the provided fields of a user's address.
 *     tags: [Manage User Details]
 *     parameters:
 *       - name: userId
 *         in: path
 *         required: true
 *         description: ID of the user whose address will be updated
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       description: Updated address fields
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               addressLine1:
 *                 type: string
 *                 example: "123 Main St"
 *               addressLine2:
 *                 type: string
 *                 example: "Apt 4B"
 *               addressLine3:
 *                 type: string
 *                 example: "Near Park"
 *               city:
 *                 type: string
 *                 example: "New York"
 *     responses:
 *       200:
 *         description: Address updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Address updated successfully
 *                 address:
 *                   type: object
 *                   description: Updated address object
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
 * /api/admin/manageuser/{userId}/bank-details:
 *   put:
 *     summary: Update a user's bank details
 *     description: Updates bank name, MICR code, and address in bank account details.
 *     tags: [Manage User Details]
 *     parameters:
 *       - name: userId
 *         in: path
 *         required: true
 *         description: ID of the user whose bank details will be updated
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       description: Updated bank details fields
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               bank_name:
 *                 type: string
 *                 example: "State Bank of India"
 *               micr_code:
 *                 type: string
 *                 example: "123456789"
 *               address:
 *                 type: string
 *                 example: "Nariman Point, Mumbai"
 *     responses:
 *       200:
 *         description: Bank details updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Bank details updated successfully
 *                 data:
 *                   type: object
 *                   description: Updated bank details object
 *       400:
 *         description: Bad request
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: No fields provided for update
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
