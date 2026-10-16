import dotenv from "dotenv";
dotenv.config();

export const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "LISL EKYC Admin API Docs",
      version: "1.0.0",
      description: "API documentation for Admin Panel",
    },
    servers: [
      {
        url: process.env.BACKEND_SERVER,
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT", // optional, just for display
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: [
    "./swagger/schemas.js",
    "./swagger/auth.swagger.js",
    "./swagger/branch.swagger.js",
    "./swagger/dashboard.swagger.js",
    "./swagger/logs.swagger.js",
    "./swagger/manageUserDetailsRoutes.swagger.js",
    "./swagger/master.swagger.js",
    "./swagger/referral.swagger.js",
    "./swagger/scheme.swagger.js",
    "./swagger/user.swagger.js",
    "./swagger/approveController.swagger.js",
    "./swagger/push.swagger.js",
    "./swagger/pushCDSL.swagger.js",
    "./swagger/bseConfig.swagger.js",
    "./swagger/nseConfig.swagger.js",
    "./swagger/pushManage.swagger.js",
    "./swagger/dpId.swagger.js",
  ],
};
