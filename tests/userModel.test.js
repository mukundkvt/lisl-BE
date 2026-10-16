import mongoose from 'mongoose';
import User from '../models/User.js';
import { getISTDate } from '../utils/convertToIndianTimeDate.js';

// Connect to test database
const connectDB = async () => {
  try {
    console.log('Connecting to test database...');
    await mongoose.connect('mongodb://localhost:27017/kycadmin_test', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Connected to test database');
  } catch (error) {
    console.error('Database connection error:', error);
    process.exit(1);
  }
};

// Test User model with new date handling
const testUserModel = async () => {
  try {
    // Create a test user with OTP logs
    const testUser = new User({
      mobileNumber: 9999999999,
      otp: {
        otp: 123456,
        expiry: new Date(),
        send_count: 1
      },
      otpLogs: [{
        otp: 123456,
        mobile: '9999999999',
        timestamp: getISTDate(new Date()), // Using IST date with +5:30 offset
        isVerify: false
      }],
      emailOtpLogs: [{
        otp: 654321,
        email: 'test@example.com',
        timestamp: getISTDate(new Date()), // Using IST date with +5:30 offset
        isVerify: false
      }]
    });

    // Validate the user model
    await testUser.validate();
    console.log('User model validation successful');
    
    // Check the types of date fields
    console.log('\nChecking date field types:');
    console.log('otpLogs[0].timestamp type:', typeof testUser.otpLogs[0].timestamp);
    console.log('otpLogs[0].timestamp is Date?', testUser.otpLogs[0].timestamp instanceof Date);
    console.log('emailOtpLogs[0].timestamp type:', typeof testUser.emailOtpLogs[0].timestamp);
    console.log('emailOtpLogs[0].timestamp is Date?', testUser.emailOtpLogs[0].timestamp instanceof Date);
    
    // Display the date fields
     console.log('\nDate field values:');
     console.log('otpLogs[0].timestamp (ISO):', testUser.otpLogs[0].timestamp.toISOString());
     console.log('otpLogs[0].timestamp (Local):', testUser.otpLogs[0].timestamp.toString());
     console.log('emailOtpLogs[0].timestamp (ISO):', testUser.emailOtpLogs[0].timestamp.toISOString());
     console.log('emailOtpLogs[0].timestamp (Local):', testUser.emailOtpLogs[0].timestamp.toString());
     
     // Verify the time difference from UTC
     const now = new Date();
     const istNow = getISTDate(now);
     const timeDiffHours = (istNow.getTime() - now.getTime()) / (1000 * 60 * 60);
     console.log('\nTime difference from UTC in hours:', timeDiffHours);
     console.log('Expected difference: 5.5 hours');
    
    console.log('\nTest completed successfully');
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    // Disconnect from database
    await mongoose.disconnect();
    console.log('Disconnected from test database');
  }
};

// Run the test
connectDB().then(() => {
  testUserModel();
});