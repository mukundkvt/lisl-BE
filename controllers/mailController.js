//For User

import nodemailer from 'nodemailer';

// Create a transporter using the extracted credentials
const transporter = nodemailer.createTransport({
    host: 'mail.nayavision.com',
    port: 465,
    secure: true, // true for 465, false for other ports
    auth: {
        user: 'connect@nayavision.com',
        pass: 'mRzb3b?fv5Eb',
    },
});

// Function to send email
const contactUsEmail = async (req, res) => {
    const { name, email, mobile, location, services, message, centre } = req.body; 

    // Create HTML table for email content with enhanced styling
    const htmlContent = `
        <h2 style="color: #333; font-family: Arial, sans-serif;">New Contact Form Submission</h2>
        <table style="width: 100%; border-collapse: collapse; font-family: Arial, sans-serif; margin-top: 20px;">
            <tr style="background-color: #f2f2f2;">
                <th style="border: 1px solid #ddd; padding: 12px; text-align: left; font-weight: bold; color: #333;">Field</th>
                <th style="border: 1px solid #ddd; padding: 12px; text-align: left; font-weight: bold; color: #333;">Details</th>
            </tr>
            <tr>
                <td style="border: 1px solid #ddd; padding: 12px; background-color: #ffffff;">Name</td>
                <td style="border: 1px solid #ddd; padding: 12px; background-color: #ffffff;">${name}</td>
            </tr>
            <tr style="background-color: #f9f9f9;">
                <td style="border: 1px solid #ddd; padding: 12px;">Email</td>
                <td style="border: 1px solid #ddd; padding: 12px;">${email}</td>
            </tr>
            <tr>
                <td style="border: 1px solid #ddd; padding: 12px; background-color: #ffffff;">Mobile</td>
                <td style="border: 1px solid #ddd; padding: 12px; background-color: #ffffff;">${mobile}</td>
            </tr>
            <tr style="background-color: #f9f9f9;">
                <td style="border: 1px solid #ddd; padding: 12px;">Location</td>
                <td style="border: 1px solid #ddd; padding: 12px;">${location}</td>
            </tr>
            <tr>
                <td style="border: 1px solid #ddd; padding: 12px; background-color: #ffffff;">Services</td>
                <td style="border: 1px solid #ddd; padding: 12px; background-color: #ffffff;">${services}</td>
            </tr>
            <tr style="background-color: #f9f9f9;">
                <td style="border: 1px solid #ddd; padding: 12px;">Centre</td>
                <td style="border: 1px solid #ddd; padding: 12px;">${centre}</td>
            </tr>
            <tr>
                <td style="border: 1px solid #ddd; padding: 12px; background-color: #ffffff;">Message</td>
                <td style="border: 1px solid #ddd; padding: 12px; background-color: #ffffff;">${message}</td>
            </tr>
        </table>
    `;

    const mailOptions = {
        from: 'connect@nayavision.com',
        to: 'hrxgaurav@gmail.com',
        subject: 'New Contact Form Submission', 
        html: htmlContent, // Use HTML content
    };

    try {
        await transporter.sendMail(mailOptions);
        res.status(200).send('Email sent successfully');
    } catch (error) {
        console.error('Error sending email:', error);
        res.status(500).send('Error sending email');
    }
};

export { contactUsEmail };
