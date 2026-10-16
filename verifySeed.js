
import mongoose from "mongoose";
import User from "./models/User.js";
import dotenv from "dotenv";

dotenv.config();

const verifySeed = async () => {
  try {
    await mongoose.connect(process.env.DATABASE);
    console.log("Connected to MongoDB...");

    const pipeline = [
      {
        $match: { 
            userStatus: { $ne: "none" },
            PAN: { $exists: true, $ne: null }
        }
      },
      {
        $addFields: {
          channel: {
            $switch: {
              branches: [
                { case: { $ifNull: ["$authorisedPerson._id", false] }, then: "AP" },
                { case: { $ifNull: ["$relationshipManager._id", false] }, then: "RM" }
              ],
              default: "DIRECT"
            }
          },
          stage: {
            $switch: {
              branches: [
                { case: { $eq: ["$userStatus", "completed"] }, then: "Sent to B.O" },
                { case: { $eq: ["$userStatus", "rejected"] }, then: "Rejection" },
                { case: { $eq: ["$digitalSignatureContract.signedByClient", true] }, then: "Esign" },
                { case: { $eq: ["$ipv_details.verificationStatus", true] }, then: "IPV" },
                { case: { $ifNull: ["$bank_account_details.account_number", false] }, then: "Bank" },
                { case: { $ne: [{ $ifNull: ["$address.addressLine1", ""] }, ""] }, then: "Address" },
                { case: true, then: "Prospects" }
              ],
              default: "Prospects"
            }
          }
        }
      },
      {
        $group: {
          _id: { channel: "$channel", stage: "$stage" },
          count: { $sum: 1 }
        }
      },
      { $sort: { "_id.channel": 1, "_id.stage": 1 } }
    ];

    const results = await User.aggregate(pipeline);
    
    console.log("\n--- Verification Results ---");
    console.table(results.map(r => ({
        Channel: r._id.channel,
        Stage: r._id.stage,
        Count: r.count
    })));

    process.exit();
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

verifySeed();
