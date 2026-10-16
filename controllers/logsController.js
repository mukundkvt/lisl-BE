import User from '../models/User.js';
import { getISTDate } from '../utils/convertToIndianTimeDate.js';
import xlsx from 'xlsx';

// Get Audit Logs
const getAuditLogs = async (req, res) => {
    try {
        const { startDate, endDate, search } = req.query;
        const query = {};

        // Date Filter (dd-mm-yyyy)
        if (startDate && endDate) {
            const parseDate = (dateStr) => {
                const [day, month, year] = dateStr.split('-');
                return new Date(`${year}-${month}-${day}`);
            };

            const start = parseDate(startDate);
            start.setHours(0, 0, 0, 0);

            const end = parseDate(endDate);
            end.setHours(23, 59, 59, 999);

            query.createdAt = { $gte: start, $lte: end };
        }

        // Search Filter (PAN, Name)
        if (search) {
            query.$or = [
                { PAN: { $regex: search, $options: 'i' } },
                { 'name.fullName': { $regex: search, $options: 'i' } }
            ];
        }

        const users = await User.find(query).lean();

        const data = users.map((user, index) => {
            // Helper to get nested properties safely
            const get = (obj, path, def = '') => {
                return path.split('.').reduce((o, p) => (o ? o[p] : undefined), obj) || def;
            };

            const confirmStatus = get(user, 'bank_account_details.confirm_status');
            const status = confirmStatus === 'verified' ? 'SUCCESS' : (confirmStatus === 'failed' ? 'FAILED' : confirmStatus || '');

            // Get last email OTP
            const lastEmailOtp = user.emailOtpLogs && user.emailOtpLogs.length > 0
                ? user.emailOtpLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0].otp
                : (user.emailOtp?.otp || '');

            return {
                SNO: index + 1,
                PAN: user.PAN || '',
                ACCOUNTNUMBER: user.dpId || '',
                UNIQUEID: user.lsid || '',
                CLIENTCODE: user.clientCode || '',
                PANNAME: get(user, 'name.fullName'),
                IFSC: get(user, 'bank_account_details.ifsc_code'),
                MICR: get(user, 'bank_account_details.micr_code'),
                BANKACCOUNTNUMBER: get(user, 'bank_account_details.account_number'),
                BANKNAME: get(user, 'bank_account_details.bank_name'),
                longitude: user.geolocation?.coordinates?.longitude || '',
                latitude: user.geolocation?.coordinates?.latitude || '',
                BankBeneficiaryName: get(user, 'bank_account_details.account_holder_name'),
                STATUS: status,
                BankVerificationRequestNo: get(user, 'bank_account_details.verification_request_id'),
                Email: user.email || '',
                EmailOTP: lastEmailOtp,
                EmailVerifiedDate: user.emailVerifiedAt ? getISTDate(user.emailVerifiedAt) : '',
                EsignCompletedDate: user.digitalSignatureContract?.signedTime ? getISTDate(user.digitalSignatureContract.signedTime) : '',
                IPVCompletedDate: user.ipv_details?.captured_at ? getISTDate(user.ipv_details.captured_at) : '',
                Esignedby: get(user, 'digitalSignatureContract.signer_name'),
                EsignGender: get(user, 'digitalSignatureContract.signerGender'),
                EsignAadhaarDOByear: get(user, 'digitalSignatureContract.signerYearOfBirth'),
                EsignaadhaarNo: '',
                RequestStatusPath: user.kycType || '',
                NSDLLog: user.panDetails ? JSON.stringify(user.panDetails) : ''
            };
        });

        const wb = xlsx.utils.book_new();
        const ws = xlsx.utils.json_to_sheet(data);
        xlsx.utils.book_append_sheet(wb, ws, 'Customers');

        const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

        res.setHeader('Content-Disposition', 'attachment; filename="AuditLog.xlsx"');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);

    } catch (error) {
        console.error('Error generating audit logs:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error' 
        });
    }
};

// Get mobile OTP logs by mobile number (latest first)
const getMobileOtpLogs = async (req, res) => {
    try {
        const { mobileNumber } = req.params;
        const { page = 1, limit = 10 } = req.query;
        
        // Convert to integers
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        
        if (!mobileNumber) {
            return res.status(400).json({ 
                success: false, 
                message: 'Mobile number is required' 
            });
        }

        const user = await User.findOne({ mobileNumber });
        
        if (!user) {
            return res.status(200).json({
                success: true,
                data: [],
                total: 0,
                page: pageNum,
                limit: limitNum,
                pages: 0
            });
        }

        // Sort the OTP logs in reverse chronological order (latest first)
        const sortedLogs = user.otpLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        // Calculate pagination
        const totalLogs = sortedLogs.length;
        const totalPages = Math.ceil(totalLogs / limitNum);
        
        // Apply pagination
        const startIndex = (pageNum - 1) * limitNum;
        const endIndex = pageNum * limitNum;
        const paginatedLogs = sortedLogs.slice(startIndex, endIndex);

        return res.status(200).json({
            success: true,
            data: paginatedLogs,
            total: totalLogs,
            page: pageNum,
            limit: limitNum,
            pages: totalPages
        });
    } catch (error) {
        console.error('Error fetching mobile OTP logs:', error);
        return res.status(500).json({ 
            success: false, 
            message: 'Internal server error' 
        });
    }
};

// Get email OTP logs by email (latest first)
const getEmailOtpLogs = async (req, res) => {
    try {
        const { email } = req.params;
        const { page = 1, limit = 10 } = req.query;
        
        // Convert to integers
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        
        if (!email) {
            return res.status(400).json({ 
                success: false, 
                message: 'Email is required' 
            });
        }

        const user = await User.findOne({ email: { $regex: new RegExp('^' + email + '$', 'i') } });
        
        if (!user) {
            return res.status(200).json({
                success: true,
                data: [],
                total: 0,
                page: pageNum,
                limit: limitNum,
                pages: 0
            });
        }

        // Sort the OTP logs in reverse chronological order (latest first)
        const sortedLogs = user.emailOtpLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        // Calculate pagination
        const totalLogs = sortedLogs.length;
        const totalPages = Math.ceil(totalLogs / limitNum);
        
        // Apply pagination
        const startIndex = (pageNum - 1) * limitNum;
        const endIndex = pageNum * limitNum;
        const paginatedLogs = sortedLogs.slice(startIndex, endIndex);

        return res.status(200).json({
            success: true,
            data: paginatedLogs,
            total: totalLogs,
            page: pageNum,
            limit: limitNum,
            pages: totalPages
        });
    } catch (error) {
        console.error('Error fetching email OTP logs:', error);
        return res.status(500).json({ 
            success: false, 
            message: 'Internal server error' 
        });
    }
};

export { getMobileOtpLogs, getEmailOtpLogs, getAuditLogs };