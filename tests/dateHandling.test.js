import { getISTDate } from '../utils/convertToIndianTimeDate.js';

// Test the date handling functions
console.log('Testing date handling functions...');

// Test with current date
const now = new Date();
console.log('Current date:', now);

// formatToIST is no longer used since we removed the indianTime field

// Test getISTDate
const istDate = getISTDate(now);
console.log('IST Date object:', istDate);
console.log('IST Date toString:', istDate.toString());

// Test with null/invalid inputs
console.log('\nTesting with invalid inputs:');
console.log('getISTDate(null):', getISTDate(null));
console.log('getISTDate("invalid"):', getISTDate('invalid'));

// Test with specific date
const specificDate = new Date('2023-01-01T12:00:00Z');
console.log('\nTesting with specific date:', specificDate);
console.log('IST Date object:', getISTDate(specificDate));

// Test creating a user object with the new schema structure
console.log('\nTesting user object creation with timestamp only:');
const mockOtpLog = {
  otp: 123456,
  mobile: '9876543210',
  timestamp: getISTDate(new Date()),
  isVerify: false
};

console.log('OTP Log:', mockOtpLog);
console.log('timestamp type:', typeof mockOtpLog.timestamp);
console.log('timestamp is Date?', mockOtpLog.timestamp instanceof Date);
console.log('timestamp value:', mockOtpLog.timestamp.toString());