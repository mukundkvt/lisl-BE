# Backend API Map

This file is the quick-reference API surface for the Express backend.

## Base mounts

- User-facing routes: `/api/...`
- Admin web + admin APIs:
  - `/admin/...`
  - `/api/admin/...`
  - `/api/admin/push-manage/...`
- Swagger UI: `/api-docs`

## User auth APIs

Source: `routes/userAuthRoutes.js`

- `POST /api/send_mobile_otp`
- `POST /api/resend_mobile_otp`
- `POST /api/verify_mobile_otp`
- `POST /api/send_email_otp`
- `POST /api/resend_email_otp`
- `POST /api/verify_email_otp`
- `POST /api/login_user`
- `GET /api/is_logged_in`

## User KYC APIs

Source: `routes/kycRoutes.js`

- `POST /api/check_pan`
- `POST /api/confirm_pan`
- `POST /api/extract_pan`
- `POST /api/confirm_extract_pan`
- `GET /api/process_cams_kra`
- `GET /api/verify_cams_kra`
- `GET /api/get_user_details`
- `POST /api/create_digilocker_url`
- `POST /api/digilocker/webhook`
- `POST /api/get_digilocker_details`
- `POST /api/hybrid_bank_account_verification`
- `POST /api/reverse_penny_drop_create_link`
- `POST /api/verify_reverse_penny_drop`
- `POST /api/confirm_bank`
- `POST /api/upload_bank_proof`
- `POST /api/create_ipv_url`
- `POST /api/get_ipv_details`
- `POST /api/save_geo_location`
- `POST /api/submit_manual_kyc`
- `POST /api/submit_profile`
- `GET /api/get_profile`
- `GET /api/get_address`
- `POST /api/submit_exchange`
- `GET /api/get_exchange`
- `POST /api/save_ddpi_consent`

## PDF / document APIs

Source: `routes/pdfRoutes.js`

- `POST /api/fill_form`
- `POST /api/fill_annexure_j`

## Contract / eSign APIs

Source: `routes/contractRoutes.js`

- `POST /api/create_contract_url`
- `POST /api/pull_contract`
- `POST /api/create_annexure_j_url`
- `POST /api/pull_annexure_j`
- `POST /api/contract/webhook`

## Location APIs

Source: `routes/locationRoutes.js`

- `GET /api/states`
- `GET /api/get_districts/:state`

## Account aggregator APIs

Source: `routes/accountAggregatorRoutes.js`

- `POST /api/aa/redirect`
- `POST /api/aa/webhook`

## Upload and signature APIs

Source: `routes/uploadRoutes.js`, `routes/signatureRoutes.js`, `routes/fileRoutes.js`

- `POST /api/upload`
- `POST /api/signature/upload`

Auxiliary file manager routes exist in `fileRoutes.js` but do not appear mounted in `index.js`:

- `POST /upload`
- `GET /get_recent_file/:page`
- `GET /search_file`
- `DELETE /delete/:filename`
- `PUT /update_alt/:id`

## Admin auth APIs

Source: `routes/adminAuthRoutes.js`

- `POST /admin/login`
- `POST /admin/register`
- `GET /admin/check_auth_status`
- `POST /admin/change-password`
- `POST /admin/change-password-by-admin`

## Admin user / branch APIs

Source: `routes/adminUserRoutes.js`, `routes/branchRoutes.js`

### Internal user management

- `POST /admin/users`
- `GET /admin/users`
- `PUT /admin/users/:id`
- `GET /admin/users/relationship-managers`
- `GET /admin/users/rm-and-ap`
- `GET /admin/users/check-login-name/:loginName`
- `GET /admin/users/check-employee-id/:employeeId`
- `PATCH /admin/users/status`
- `GET /admin/users/counts-by-role`
- `POST /admin/register-with-referral`
- `GET /admin/validate-referral/:referralCode`
- `GET /admin/users/:userId/referral-info`
- `GET /admin/users/get_rm_by_branchid/:branchId`

### Branch management

- `POST /admin/branches`
- `PUT /admin/branches/:id`
- `GET /admin/branches`

## Referral APIs

Source: `routes/referralRoutes.js`

- `GET /admin/referral/track/:code`
- `GET /admin/referral/info/:code`
- `POST /admin/referral`
- `GET /admin/referral/my`
- `GET /admin/referral`
- `GET /admin/referral/:id/stats`
- `PUT /admin/referral/:id`
- `DELETE /admin/referral/:id`

## Scheme APIs

Source: `routes/schemeRoutes.js`

- `POST /admin/schemes`
- `GET /admin/schemes`
- `GET /admin/schemes/accessible`
- `GET /admin/schemes/:id`
- `PUT /admin/schemes/:id`
- `DELETE /admin/schemes/:id`
- `POST /admin/schemes/:id/set-default`
- `GET /admin/schemes/assignment-status/:adminUserId`
- `PUT /admin/schemes/assignment-status/:adminUserId`

## Logs APIs

Source: `routes/logsRoutes.js`

- `GET /admin/audit-logs`
- `GET /admin/mobile-otp-logs/:mobileNumber`
- `GET /admin/email-otp-logs/:email`

## Dashboard and approval APIs

Source: `routes/dashboardRoutes.js`, `routes/approveRoutes.js`

### Dashboard

- `GET /api/admin/dashboard/users`
- `GET /api/admin/dashboard/users/details/address/:userId`
- `GET /api/admin/dashboard/users/details/profile/:userId`
- `GET /api/admin/dashboard/users/details/bank/:userId`
- `GET /api/admin/dashboard/users/details/exchange/:userId`
- `GET /api/admin/dashboard/users/details/ipv/:userId`
- `GET /api/admin/dashboard/users/details/digital-signature/:userId`
- `GET /api/admin/dashboard/users/details/pdf-generation/:userId`
- `GET /api/admin/dashboard/users/search`
- `GET /api/admin/dashboard/users/status-counts`
- `GET /api/admin/dashboard/users/summary-matrix`
- `GET /api/admin/dashboard/users/stage-list`
- `GET /api/admin/dashboard/users/onboarding-graph`
- `GET /api/admin/dashboard/users/rejected-user/:userId`

### Approval

- `PUT /api/admin/user-approval/:userId`
- `GET /api/admin/user-approval-status/:userId`

## Admin master / managed edit APIs

Source: `routes/manageUserDetailsRoutes.js`, `routes/masterRoutes.js`

### Managed user edits

`manageUserDetailsRoutes.js` contains admin update routes for key user sections and should be checked directly when changing admin-side edit behavior.

### Master actions

- `GET /api/admin/user/master-search`
- `DELETE /api/admin/user/master-delete/:userId`

## Config APIs

### BSE config

Source: `routes/bseConfigRoutes.js`

- `GET /api/admin/bse-config`
- `POST /api/admin/bse-config`

### NSE config

Source: `routes/nseConfigRoutes.js`

- `PUT /api/admin/nse`
- `GET /api/admin/nse`

### CAMS config

Source: `routes/camsConfigRoutes.js`

- `POST /api/admin/cams`
- `PUT /api/admin/cams`
- `GET /api/admin/cams`

### DP ID config

Source: `routes/dpIdRoutes.js`

Route file exists and should be consulted directly for exact payload shape when changing DP ID behavior.

## Push / downstream integration APIs

Source: `routes/pushRoutes.js`, `routes/pushManageRoute.js`

### Push execution

- `POST /api/admin/push_to_sharepro/:userId`
- `POST /api/admin/push_to_nse/:userId`
- `POST /api/admin/push_to_bse_mfi/:userId`
- `POST /api/admin/push_to_kra/:userId`
- `POST /api/admin/upload_bse`
- `POST /api/admin/push_to_cdsl/auth/:userId`
- `POST /api/admin/push_to_cdsl/setup/:userId`
- `POST /api/admin/push_to_cdsl/modify/:userId`
- `POST /api/admin/push_to_cdsl/status/:userId`
- `POST /api/admin/push_to_cdsl/download/:userId`
- `POST /api/admin/generate_ckyc_bulk`

### Push management

- `GET /api/admin/push-manage/status/:userId`
- `GET /api/admin/push-manage/logs/:userId/:section`

## Dev-only / tooling routes

Source: `routes/devRoutes.js`

- `GET /pdf-grid/:page`
- `GET /pdf-grid-all`

This route file is present in the repo but is not currently mounted in `index.js`.

## Frontend-consumed APIs (most important integration points)

These routes are currently called by the React client:

- OTP flow: mobile/email send, resend, verify, login
- PAN flow: `check_pan`, `extract_pan`, `confirm_pan`, `confirm_extract_pan`
- address flow: `create_digilocker_url`, `get_digilocker_details`, `process_cams_kra`, `verify_cams_kra`, `submit_manual_kyc`, `get_user_details`
- bank flow: hybrid bank verification, reverse penny drop, bank proof upload, confirm bank
- profile flow: `get_address`, `submit_profile`, `get_profile`
- exchange flow: `get_exchange`, `submit_exchange`, `upload`
- IPV flow: `create_ipv_url`, `get_ipv_details`, `save_geo_location`
- signature flow: `signature/upload`
- PDF / contract flow: `fill_form`, `fill_annexure_j`, `create_contract_url`, `pull_contract`, `create_annexure_j_url`, `pull_annexure_j`
- DDPI flow: `save_ddpi_consent`

## Maintenance rule

If any route is added, removed, renamed, re-mounted, or repurposed, update this file in the same commit/change.
