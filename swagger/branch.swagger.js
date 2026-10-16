/**
 * @swagger
 * components:
 *   schemas:
 *     Branch:
 *       type: object
 *       required:
 *         - branchName
 *         - branchCode
 *         - series
 *         - prefix
 *       properties:
 *         branchName:
 *           type: string
 *         branchCode:
 *           type: string
 *         series:
 *           type: string
 *         prefix:
 *           type: string
 *       example:
 *         branchName: Mumbai
 *         branchCode: MUM
 *         series: 001
 *         prefix: MUM

 * tags:
 *   - name: Branch
 *     description: Branch management
 */
/**
 * @swagger
 * /admin/branches:
 *   post:
 *     summary: Add a new branch (Admin only)
 *     description: Requires Admin role
 *     tags: [Branch]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Branch'
 *     responses:
 *       201:
 *         description: Branch created successfully
 *       400:
 *         description: Validation error
 *       409:
 *         description: Duplicate branch
 */
/**
 * @swagger
 * /admin/branches/{id}:
 *   put:
 *     summary: Edit an existing branch (Admin only)
 *     description: Requires Admin role
 *     tags: [Branch]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: Branch ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Branch'
 *     responses:
 *       200:
 *         description: Branch updated successfully
 *       404:
 *         description: Branch not found
 *       409:
 *         description: Duplicate value
 */
/**
 * @swagger
 * /admin/branches:
 *   get:
 *     summary: Get all branches
 *     description: Requires Admin role
 *     tags: [Branch]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: A list of branches
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Branch'
 */
