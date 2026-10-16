import { getISTDate } from '../utils/convertToIndianTimeDate.js';

// Test the fixed getISTDate function
console.log('Testing fixed getISTDate function...');

// Test with current date
const now = new Date();
console.log('Current date (UTC):', now.toISOString());
console.log('Current date (Local):', now.toString());

// Test the fixed getISTDate function
const istDate = getISTDate(now);
console.log('\nIST Date:');
console.log('ISO String:', istDate.toISOString());
console.log('Local String:', istDate.toString());

// Verify the time difference is +5:30 hours
const timeDiffHours = (istDate.getTime() - now.getTime()) / (1000 * 60 * 60);
console.log('\nTime difference in hours:', timeDiffHours);
console.log('Expected difference: 5.5 hours');

// Simulate MongoDB storage and retrieval
console.log('\nSimulating MongoDB storage and retrieval:');
console.log('When stored in MongoDB, the date would be shown as:', istDate.toISOString());
console.log('But this actually represents IST time which is:', new Date(istDate.getTime()).toString());

// Test with a specific date
const specificDate = new Date('2023-01-01T12:00:00Z');
console.log('\nSpecific date (2023-01-01T12:00:00Z):');
console.log('UTC:', specificDate.toISOString());
const specificISTDate = getISTDate(specificDate);
console.log('After getISTDate:', specificISTDate.toISOString());
console.log('Local representation:', specificISTDate.toString());

// Test with current time and show what would be displayed in India
const currentTime = new Date();
const currentIST = getISTDate(currentTime);
console.log('\nCurrent time:');
console.log('UTC time:', currentTime.toISOString());
console.log('After getISTDate (what MongoDB would store):', currentIST.toISOString());
console.log('Current time in India (should be around +5:30):', new Date(currentIST.getTime()).toLocaleTimeString('en-IN'));