import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, ".env") });

import User from "./models/User.js";
import Branch from "./models/Branch.js";

const run = async () => {
  try {
    await mongoose.connect(process.env.DATABASE);
    
    // Find branch
    const headBranch = await Branch.findOne({ branchName: { $in: ["Head", "VARANASI HO"] } });
    if (!headBranch) {
      console.log("No Head or VARANASI HO branch found in DB");
      process.exit(1);
    }
    
    const branchObj = {
      _id: headBranch._id,
      name: headBranch.branchName,
    };
    
    console.log("Found branch:", branchObj);
    
    // Update first user by ID
    const user1 = await User.findByIdAndUpdate("6a7bf28ed3ead15cc14f82e8", { branch: branchObj }, { new: true });
    if (user1) {
      console.log(`Assigned branch to user ID: ${user1._id} (Mobile: ${user1.mobileNumber})`);
    } else {
      console.log("User 6a7bf28ed3ead15cc14f82e8 not found.");
    }
    
    // Update second user by mobile
    const user2 = await User.findOneAndUpdate({ mobileNumber: 9026199181 }, { branch: branchObj }, { new: true });
    if (user2) {
      console.log(`Assigned branch to user Mobile: 9026199181 (ID: ${user2._id})`);
    } else {
      console.log("User with mobile 9026199181 not found.");
    }
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

run();
