# Backend AI Context

## Stack

- Runtime: Node.js
- Framework: Express
- Database: MongoDB via Mongoose
- Auth: JWT-based bearer auth
- File handling: Multer + local `uploads/`
- Docs: Swagger UI at `/api-docs`
- Notable libraries: `pdf-lib`, `sharp`, `archiver`, `xlsx`, `node-fetch`, `nodemailer`

## Entry point

- Main server file: `index.js`
- Database connection: `config/connectDB.js`
- Static file mounts:
  - `/uploads`
  - `/assets`
  - `/models`
  - `/public` root static serving

## Route mounting strategy

### Admin-facing mounts

- `/admin`
  - branch routes
  - admin auth routes
  - admin user routes
  - referral routes
  - scheme routes
  - logs routes
- `/api/admin`
  - dashboard
  - approval
  - manage user details
  - master
  - BSE config
  - NSE config
  - CAMS config
  - push routes
  - DP ID routes
- `/api/admin/push-manage`
  - push status / push logs

### User-facing mounts

- `/api`
  - user auth
  - KYC routes
  - PDF routes
  - contract routes
  - location routes
  - account aggregator routes
  - upload routes
  - signature routes

## Domain model overview

### Core user model

Main schema: `models/User.js`

The `User` document is the central onboarding aggregate. Key areas:

- identity and auth
  - `mobileNumber`, `mobileVerified`
  - `email`, `emailVerified`
  - OTP data and OTP logs
- personal identity
  - `prefix`, `gender`
  - `name`, `fatherName`, `motherName`
  - `dateOfBirth`
  - `PAN`, `panDetails`, `PAN_file`, `panConfirmed`
- address and proof
  - `address`
  - `addressProof.type/number/frontImage/backImage/mergedPdf`
  - Aadhaar artifacts: `aadhaar_file`, `aadhaar_number`, `aadhaar_photo`, `aadhaar_xml`
- DigiLocker / CAMS KRA / IPV
  - `digilocker_request_id`, `digilocker_details`
  - `camskra_available`
  - `ipv_request_id`, `ipv_details`
  - geolocation and liveness state
- bank / financial / exchange / profile data
  - profile, income, occupation, nominees, communication data
- signature / PDF / eSign / onboarding artifacts
- downstream push state
  - nested `pushTo` sections hold status and logs for KRA/CKYC/CDSL/etc.
- workflow progress
  - `max_step_completed`
  - `userStatus`

### Other persistent models

- `AdminUser.js`: admin panel users and roles
- `Branch.js`: branch metadata
- `Scheme.js`: schemes assignable to internal users
- `Referral.js`: referral tracking and stats
- `BseConfig.js`: BSE integration config
- `NseConfig.js`: NSE integration config
- `CamsConfig.js`: CAMS config
- `DpId.js`: DP ID related configuration
- `DeletedUserSchema.js`: deleted or archived user tracking

## Controller ownership map

### Onboarding and user journey

- `userAuthController.js`
  - mobile OTP, email OTP, login, auth status
- `kycController.js`
  - PAN verification
  - PAN extraction from uploaded image
  - DigiLocker URL creation + callback consumption helpers
  - CAMS KRA processing / verification
  - bank confirmation support
  - IPV URL/details
  - geolocation save
  - manual KYC submit
  - profile / address retrieval
  - DDPI consent
- `exchangeController.js`
  - exchange selection save + retrieval
- `signatureController.js`
  - signature upload
- `pdfController.js`
  - final PDF and Annexure generation / filling
- `contractController.js`
  - contract / Annexure J URL generation, pull endpoints, webhook
- `accountAggregatorController.js`
  - AA redirect initiation and webhook handling
- `locationController.js`
  - states + districts

### Admin and internal operations

- `authController.js`
  - admin login/register/password changes
- `adminUserController.js`
  - internal user CRUD and role-linked lookup
- `branchController.js`
  - branch CRUD
- `dashboardController.js`
  - admin dashboard counts, stage lists, graphs, detail panels
- `approveController.js`
  - user approval state
- `manageUserDetailsController.js`
  - internal edits to user onboarding data
- `masterController.js`
  - master search and hard-delete style operations
- `logsController.js`
  - audit / OTP logs
- `referralController.js`
  - referral management
- `schemeController.js`
  - scheme management and assignment
- `bseConfigController.js`, `nseConfigController.js`, `camsConfigController.js`, `dpIdController.js`
  - platform configuration

### Push / downstream integration controllers

- `pushKRAController.js`
- `pushBseMfiController.js`
- `pushNSEController.js`
- `pushShareProController.js`
- `pushCDSL.js`
- `pushCKYC.js`
- `pushManageController.js`
- `uploadBseController.js`

These controllers are responsible for pushing approved user data to third-party systems, generating files, polling status, and maintaining push logs in the user document.

## External integrations

The backend integrates with multiple third-party systems and uses environment variables heavily for credentials and base URLs.

### User journey integrations

- PAN validation / extraction provider
- DigiLocker
- CAMS KRA
- hybrid bank account verification
- reverse penny drop verification
- IPV / liveness provider
- eSign / contract delivery workflow
- account aggregator callback flow

### Registry / platform push integrations

- KRA
- BSE MFI
- NSE
- SharePro
- CDSL
- CKYC bulk generation and ZIP packaging

## File and artifact generation

- `uploads/` stores user-uploaded and generated files
- `assets/` contains templates and branding resources
- `public/` contains helper HTML pages for PDF tooling
- `pushCKYC.js` builds:
  - bulk TXT file
  - nested ZIP output
  - per-user inner ZIPs containing POA / PHOTO / SIGNATURE
- `pdfController.js` and `contractController.js` generate onboarding PDFs / Annexure J / contract files

## Swagger documentation source

Swagger config file: `swagger/swaggerOptions.js`

Included swagger sources cover:

- auth
- branch
- dashboard
- logs
- manage user details
- master
- referral
- scheme
- user
- approval
- push
- CDSL push
- BSE config
- NSE config
- push management
- DP ID

## Important middleware and utilities

### Middleware

- `middlewares/auth-middleware.js`
  - internal/admin auth + role guards
- `middlewares/userAuth-middleware.js`
  - end-user auth
- `middlewares/requestLogger.js`
  - request-level logging

### Utility modules

- `fileUpload.js`
- `extractNameParts.js`
- `extractAddress.js`
- `detectInputType.js`
- `convertToIndianTimeDate.js`
- `formatDate.js`
- `logger.js`
- checksum / encryption helpers for push integrations

## Important operational notes

- `index.js` mounts `uploadRoutes` twice under `/api`; this looks redundant and should be treated carefully before cleanup
- There is a `devRoutes.js` file present but it is not mounted in `index.js`
- The codebase uses local file paths in several flows; changes to upload handling must be checked against both DB fields and static mounts
- Many controllers persist third-party request IDs and raw provider responses inside the user document

## Current documentation maintenance rule

If any backend change touches:

- controller logic
- route paths
- schema shape
- webhook behavior
- push integrations
- generated file naming / packaging

then update this file and `AI_API_MAP.md` in the same change.
