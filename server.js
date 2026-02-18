const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors()); // Allow Nginx to talk to Node
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- API ROUTES ONLY ---

// API Route - Sending the order email
app.post('/api/order', async (req, res) => {
    console.log("Order received, processing...");
    
    const { customer, cart, total } = req.body;

    try {
        // Setup the mailman (Transporter)
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });

        // Create HTML list for email
        const productsList = cart.map(item => 
            `<tr>
                <td style="padding: 8px; border: 1px solid #ddd;">${item.name}</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${item.qty}</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${item.price} MDL</td>
             </tr>`
        ).join('');

        const mailOptions = {
            from: 'Luci Boutique Server',
            to: process.env.EMAIL_USER, 
            subject: `COMANDA NOUA: ${customer.name} - ${total} MDL`,
            html: `
                <div style="font-family: Arial, sans-serif; color: #333;">
                    <h1 style="color: #aa0132;">Comandă Nouă!</h1>
                    <p><strong>Client:</strong> ${customer.name}</p>
                    <p><strong>Telefon:</strong> ${customer.phone}</p>
                    <p><strong>Email:</strong> ${customer.email}</p>
                    <p><strong>Adresă:</strong> ${customer.address}</p>
                    
                    <h3>Detalii Comandă:</h3>
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="background: #f4f4f4;">
                                <th style="padding: 8px; border: 1px solid #ddd;">Produs</th>
                                <th style="padding: 8px; border: 1px solid #ddd;">Cantitate</th>
                                <th style="padding: 8px; border: 1px solid #ddd;">Preț</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${productsList}
                        </tbody>
                    </table>
                    <h2 style="text-align: right; color: #aa0132;">Total: ${total} MDL</h2>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);
        res.json({ success: true, message: 'Comanda a fost trimisă cu succes!' });

    } catch (error) {
        console.error('Email error:', error);
        res.status(500).json({ success: false, error: 'Ceva nu a mers bine la server.' });
    }
});

// Start the engine
app.listen(PORT, () => {
    console.log(`API Server started on http://localhost:${PORT}`);
});
