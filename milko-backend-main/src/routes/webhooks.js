const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhookController');

/**
 * Webhook Routes
 * Base path: /api/webhooks
 * These routes are public (called by external services)
 * Security is handled via signature verification
 */

// Razorpay webhook
// Note: This route should NOT use body-parser JSON middleware
// Razorpay requires raw body for signature verification
router.post(
  '/razorpay',
  express.raw({ type: 'application/json' }),
  webhookController.handleRazorpayWebhook
);

module.exports = router;

