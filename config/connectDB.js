import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();
const Db_Link = process.env.DATABASE;

const connectDB = async()=>{
    try {
        await mongoose.connect(Db_Link);
        console.log("DB has been connected successfully")
    } catch (error) {
        console.log(`Failed to connect : ${error}`)
    }
}

export default connectDB;