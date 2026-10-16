import moment from 'moment-timezone';

/**
 * Formats a date to Indian Standard Time (IST) string representation
 * @param {Date|string} dateInput - Date object or date string to format
 * @returns {string} Formatted date string in IST (DD/MM/YYYY HH:MM:SS)
 */
function formatToIST(dateInput) {
  // Check if dateInput is valid
  if (!dateInput) return 'N/A';
  
  // Create a moment object with the input date and set timezone to IST
  const istDate = moment(dateInput).tz('Asia/Kolkata');
  
  // Check if date is valid
  if (!istDate.isValid()) return 'N/A';
  
  // Format the date in DD/MM/YYYY HH:MM:SS format
  return istDate.format('DD/MM/YYYY HH:mm:ss');
}

/**
 * Converts a date to Indian Standard Time (IST) Date object
 * When stored in MongoDB, this will still show as UTC time but with +5:30 hours offset
 * @param {Date|string} dateInput - Date object or date string to convert
 * @returns {Date} Date object with IST offset applied
 */
function getISTDate(dateInput) {
  if (!dateInput) return null;
  
  try {
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return null;
    return date;
  } catch (error) {
    console.error('Error converting date:', error);
    return null;
  }
}

export { formatToIST, getISTDate };
export default formatToIST;