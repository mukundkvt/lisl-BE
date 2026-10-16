import mongoose from "mongoose";
import User from "./models/User.js";
import AdminUser from "./models/AdminUser.js";
import dotenv from "dotenv";

dotenv.config();

const indianFirstNames = [
  "Aarav", "Vihaan", "Aditya", "Sai", "Ishaan", "Shaurya", "Atharv", "Vivaan", "Reyansh", "Arjun",
  "Ananya", "Diya", "Saanvi", "Aadhya", "Myra", "Pari", "Anayra", "Kiara", "Siya", "Riya",
  "Rohan", "Vikram", "Rahul", "Suresh", "Ramesh", "Priya", "Sneha", "Anjali", "Kavita", "Sunita"
];

const indianLastNames = [
  "Sharma", "Verma", "Gupta", "Malhotra", "Singh", "Kumar", "Patel", "Mehta", "Shah", "Jain",
  "Reddy", "Nair", "Rao", "Desai", "Joshi", "Yadav", "Mishra", "Pandey", "Chopra", "Kapoor"
];

const cities = [
  { city: "Mumbai", state: "Maharashtra", pincode: "400001" },
  { city: "Delhi", state: "Delhi", pincode: "110001" },
  { city: "Bangalore", state: "Karnataka", pincode: "560001" },
  { city: "Hyderabad", state: "Telangana", pincode: "500001" },
  { city: "Chennai", state: "Tamil Nadu", pincode: "600001" },
  { city: "Kolkata", state: "West Bengal", pincode: "700001" },
  { city: "Pune", state: "Maharashtra", pincode: "411001" },
  { city: "Ahmedabad", state: "Gujarat", pincode: "380001" },
  { city: "Jaipur", state: "Rajasthan", pincode: "302001" },
  { city: "Lucknow", state: "Uttar Pradesh", pincode: "226001" }
];

const kycTypes = ["Digilocker", "Aadhaar XML", "Offline"];

const statuses = ["pending", "approved", "esigned", "rejected", "completed"];

// Helper to get random item
const getRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Helper to generate random date within range
const getRandomDate = (start, end) => {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
};

const generateRandomMobile = () => {
    return Math.floor(6000000000 + Math.random() * 4000000000); // 6xxxxxxxxx to 9xxxxxxxxx
};

const generateRandomPan = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const nums = "0123456789";
    let pan = "";
    for(let i=0; i<5; i++) pan += chars.charAt(Math.floor(Math.random() * chars.length));
    for(let i=0; i<4; i++) pan += nums.charAt(Math.floor(Math.random() * nums.length));
    pan += chars.charAt(Math.floor(Math.random() * chars.length));
    return pan;
};

const seedUsers = async () => {
  try {
    await mongoose.connect(process.env.DATABASE);
    console.log("Connected to MongoDB...");

    // 1. Delete existing users
    console.log("Deleting existing users...");
    await User.deleteMany({});
    console.log("All existing users deleted.");

    // 2. Fetch Real Admin Users (RM and AP)
    const rms = await AdminUser.find({ role: "Relationship Manager", status: "Active" });
    const aps = await AdminUser.find({ role: "Authorised Person", status: "Active" });
    
    console.log(`Found ${rms.length} RMs and ${aps.length} APs.`);

    if (rms.length === 0 && aps.length === 0) {
        console.warn("WARNING: No active RMs or APs found in DB. 'Relationship Manager' and 'Authorised Person' channels will not be populated correctly.");
    }

    const users = [];
    const now = new Date();
    
    // Time ranges
    const startOfToday = new Date(now); startOfToday.setHours(0,0,0,0);
    const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - now.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfFY = new Date(now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1, 3, 1);
    const startOfLastYear = new Date(now.getFullYear() - 1, 0, 1);

    // Create 500 users
    for (let i = 0; i < 500; i++) {
      const firstName = getRandom(indianFirstNames);
      const lastName = getRandom(indianLastNames);
      const fullName = `${firstName} ${lastName}`;
      const location = getRandom(cities);
      
      // Determine Channel
      let channelOptions = ["Direct"];
      if (rms.length > 0) channelOptions.push("Relationship Manager");
      if (aps.length > 0) channelOptions.push("Authorised Person");
      
      const channel = getRandom(channelOptions);
      
      let referredBy = null;
      let relationshipManager = null;
      let authorisedPerson = null;

      if (channel === "Relationship Manager" && rms.length > 0) {
        const rm = getRandom(rms);
        const rmData = {
          _id: rm._id,
          name: rm.name,
          employeeId: rm.employeeId
        };
        relationshipManager = rmData;
        referredBy = { ...rmData, role: "Relationship Manager", mobile: rm.mobile };
      } else if (channel === "Authorised Person" && aps.length > 0) {
        const ap = getRandom(aps);
        const apData = {
          _id: ap._id,
          name: ap.name,
          employeeId: ap.employeeId
        };
        authorisedPerson = apData;
        referredBy = { ...apData, role: "Authorised Person", mobile: ap.mobile };
      }

      // Determine Date
      let date;
      const rand = Math.random();
      if (rand < 0.1) date = getRandomDate(startOfToday, now); // 10% Today
      else if (rand < 0.3) date = getRandomDate(startOfWeek, now); // 20% This Week
      else if (rand < 0.5) date = getRandomDate(startOfMonth, now); // 20% This Month
      else if (rand < 0.8) date = getRandomDate(startOfFY, now); // 30% This FY
      else date = getRandomDate(startOfLastYear, startOfFY); // 20% Older

      // Determine Target Stage
      const targetStages = ["Prospects", "Address", "Bank", "IPV", "Esign", "Rejection", "Sent to B.O"];
      const targetStage = getRandom(targetStages);

      // Defaults
      let userStatus = "pending";
      let address = {}; // Empty by default
      let bank_account_details = {}; // Empty
      let ipv_details = {}; // Empty
      let digitalSignatureContract = { signedByClient: false, signedTime: null };

      // Populate based on Target Stage
      switch (targetStage) {
        case "Sent to B.O":
            userStatus = "completed";
            digitalSignatureContract = { signedByClient: true, signedTime: date };
            ipv_details = { verificationStatus: true, verificationDate: date };
            bank_account_details = { 
                account_number: Math.floor(1000000000 + Math.random() * 9000000000).toString(),
                bank_name: "HDFC Bank",
                ifsc_code: "HDFC0001234",
                confirm_status: "verified"
            }; 
            address = {
                addressLine1: `${Math.floor(Math.random() * 100)}, Gandhi Nagar`,
                city: location.city,
                state: location.state,
                pincode: location.pincode,
                country: "India"
            };
            break;

        case "Rejection":
            userStatus = "rejected";
            // Populate random amount of data for rejected users
            address = {
                addressLine1: `${Math.floor(Math.random() * 100)}, Gandhi Nagar`,
                city: location.city,
                state: location.state,
                pincode: location.pincode,
                country: "India"
            };
            // 50% chance they had bank details
            if (Math.random() > 0.5) {
                bank_account_details = { 
                    account_number: Math.floor(1000000000 + Math.random() * 9000000000).toString(),
                    bank_name: "HDFC Bank"
                };
            }
            break;

        case "Esign":
            userStatus = "esigned";
            digitalSignatureContract = { signedByClient: true, signedTime: date };
            ipv_details = { verificationStatus: true, verificationDate: date };
            bank_account_details = { 
                account_number: Math.floor(1000000000 + Math.random() * 9000000000).toString(),
                bank_name: "HDFC Bank",
                ifsc_code: "HDFC0001234",
                confirm_status: "verified"
            };
            address = {
                addressLine1: `${Math.floor(Math.random() * 100)}, Gandhi Nagar`,
                city: location.city,
                state: location.state,
                pincode: location.pincode,
                country: "India"
            };
            break;

        case "IPV":
            // Needs IPV=true, but Esign=false
            ipv_details = { verificationStatus: true, verificationDate: date };
            bank_account_details = { 
                account_number: Math.floor(1000000000 + Math.random() * 9000000000).toString(),
                bank_name: "HDFC Bank",
                ifsc_code: "HDFC0001234",
                confirm_status: "verified"
            };
            address = {
                addressLine1: `${Math.floor(Math.random() * 100)}, Gandhi Nagar`,
                city: location.city,
                state: location.state,
                pincode: location.pincode,
                country: "India"
            };
            break;

        case "Bank":
            // Needs Bank=exists, but IPV=false
            bank_account_details = { 
                account_number: Math.floor(1000000000 + Math.random() * 9000000000).toString(),
                bank_name: "HDFC Bank",
                ifsc_code: "HDFC0001234",
                confirm_status: "verified"
            };
            address = {
                addressLine1: `${Math.floor(Math.random() * 100)}, Gandhi Nagar`,
                city: location.city,
                state: location.state,
                pincode: location.pincode,
                country: "India"
            };
            break;

        case "Address":
            // Needs Address=exists, but Bank=false
            address = {
                addressLine1: `${Math.floor(Math.random() * 100)}, Gandhi Nagar`,
                city: location.city,
                state: location.state,
                pincode: location.pincode,
                country: "India"
            };
            break;

        case "Prospects":
            // Needs PAN (all have PAN), but Address=empty
            break;
      }

      // Client Code logic
      const clientCode = `LISP${Math.floor(10000 + Math.random() * 90000)}`;

      const user = {
        mobileNumber: generateRandomMobile(),
        lsid: `lsid_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: {
          fullName: fullName,
          firstName: firstName,
          lastName: lastName
        },
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${Math.floor(Math.random()*1000)}@example.com`,
        address: address,
        PAN: generateRandomPan(),
        panConfirmed: true,
        userStatus: userStatus,
        
        // Correctly populate Channel fields for Dashboard
        relationshipManager: relationshipManager,
        authorisedPerson: authorisedPerson,
        referredBy: referredBy,

        createdAt: date,
        updatedAt: date,
        digitalSignatureContract: digitalSignatureContract,
        
        // Populate Stage-driving fields
        bank_account_details: bank_account_details,
        ipv_details: ipv_details,

        // New Fields Requested
        kycType: getRandom(kycTypes),
        clientCode: clientCode,

        // Populate stages for summary matrix (Approvals)
        approvals: {
            address: { status: address.addressLine1 ? 'approved' : 'pending' },
            profile: { status: address.addressLine1 ? 'approved' : 'pending' },
            bank: { status: bank_account_details.account_number ? 'approved' : 'pending' },
            ipv: { status: ipv_details.verificationStatus ? 'approved' : 'pending' },
            digitalSign: { status: digitalSignatureContract.signedByClient ? 'approved' : 'pending' }
        }
      };

      users.push(user);
    }

    await User.insertMany(users);
    console.log(`Successfully seeded ${users.length} users with real RM/AP data!`);
    
    process.exit();
  } catch (error) {
    console.error("Error seeding users:", error);
    process.exit(1);
  }
};

seedUsers();
