function detectInputType(input) {
  const mobileRegex = /^[6-9][0-9]{9}$/;
  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (mobileRegex.test(input)) return "mobileNumber";
  if (panRegex.test(input.toUpperCase())) return "PAN";
  if (emailRegex.test(input.toLowerCase())) return "email";
  return "unknown";
}


export default detectInputType