import axios from "axios";
import User from "../models/User.js";
import { v4 as uuidv4 } from 'uuid';

const FIU_BASE_URL = process.env.FIU_BASE_URL;
const FIU_ID = "LAKSHMISHREE_PROD";
const REDIRECTION_KEY = "eKozkrspzYOdUp";

export const initiateAARedirect = async (req, res) => {
    try {
        const mobileNumber = typeof req.user === 'object' && req.user.mobileNumber 
            ? req.user.mobileNumber 
            : req.user;
        const user = await User.findOne({ mobileNumber });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Step 1: Get Auth Token
        const authPayload = {
            fiuID: FIU_ID,
            redirection_key: REDIRECTION_KEY,
            userId: "bisen@lakshmishree.com"
        };

        const authResponse = await axios.post(`${FIU_BASE_URL}/api/FIU/Authentication`, authPayload);

        if (!authResponse.data || !authResponse.data.token) {
            return res.status(400).json({
                success: false,
                message: "Failed to generate auth token",
                error: authResponse.data
            });
        }

        const { token, sessionId } = authResponse.data;

        // Step 2: Generate Redirect URL
        const clienttrnxid = uuidv4();

        const redirectPayload = {
            clienttrnxid: clienttrnxid,
            fiuID: FIU_ID,
            userId: user.email,
            aaCustomerHandleId: `${user.mobileNumber}@CAMSAA`, 
            aaCustomerMobile: String(user.mobileNumber),
            sessionId: sessionId,
            useCaseid: "627"
        };

        const config = {
            headers: {
                Authorization: `Bearer ${token}`
            }
        };

        const redirectResponse = await axios.post(`${FIU_BASE_URL}/api/FIU/RedirectAA`, redirectPayload, config);

        if (redirectResponse.data && redirectResponse.data.redirectionurl) {
            return res.status(200).json({
                success: true,
                redirectionUrl: redirectResponse.data.redirectionurl,
                clientTxnId: clienttrnxid,
                message: "AA Redirection URL Generated Successfully"
            });
        } else {
             return res.status(400).json({
                success: false,
                message: "Failed to generate redirection URL",
                error: redirectResponse.data
            });
        }

    } catch (error) {
        console.error("AA Process Error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal Server Error during AA Process",
            error: error.message
        });
    }
}

export const aaDataRetrievalWebhook = async (req, res) => {
    try {
        console.log("AA Data Retrieval Webhook Received:", JSON.stringify(req.body, null, 2));
        
        // TODO: Process the received data
        // The data payload structure will depend on the AA provider's specification
        
        return res.status(200).json({
            success: true,
            message: "Data Retrieval Webhook received successfully"
        });
    } catch (error) {
        console.error("AA Data Webhook Error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal Server Error processing Data Webhook",
            error: error.message
        });
    }
};
