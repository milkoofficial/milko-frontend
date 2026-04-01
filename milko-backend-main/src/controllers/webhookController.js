const subscriptionService = require('../services/subscriptionService');
const { verifyWebhookSignature, getPayment } = require('../config/razorpay');
const { ValidationError } = require('../utils/errors');

/**
 * Webhook Controller
 * Handles Razorpay webhook events
 */

/**
 * Handle Razorpay webhook
 * POST /api/webhooks/razorpay
 * 
 * Webhook events to handle:
 * - payment.captured: Payment successful, activate subscription
 * - payment.failed: Payment failed, mark subscription as failed
 * - subscription.activated: Subscription activated
 * - subscription.cancelled: Subscription cancelled
 */
const handleRazorpayWebhook = async (req, res, next) => {
  try {
    const webhookSignature = req.headers['x-razorpay-signature'];
    
    // req.body is raw buffer from express.raw() middleware
    const webhookBody = req.body.toString();

    // Verify webhook signature
    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(webhookBody)
      .digest('hex');

    if (webhookSignature !== expectedSignature) {
      return res.status(401).json({
        success: false,
        error: 'Invalid webhook signature',
      });
    }

    // Parse JSON body
    const body = JSON.parse(webhookBody);
    const event = body.event;
    const payload = body.payload;

    console.log('Razorpay webhook event:', event);

    // Handle different webhook events
    switch (event) {
      case 'payment.captured':
        // Payment successful - activate subscription
        await handlePaymentCaptured(payload);
        break;

      case 'payment.failed':
        // Payment failed - log for admin review
        await handlePaymentFailed(payload);
        break;

      case 'subscription.activated':
        // Subscription activated
        await handleSubscriptionActivated(payload);
        break;

      case 'subscription.cancelled':
        // Subscription cancelled
        await handleSubscriptionCancelled(payload);
        break;

      case 'subscription.charged':
        await handleSubscriptionCharged(payload);
        break;

      default:
        console.log('Unhandled webhook event:', event);
    }

    // Always return 200 to acknowledge webhook receipt
    res.status(200).json({
      success: true,
      message: 'Webhook received',
    });
  } catch (error) {
    console.error('Webhook error:', error);
    // Still return 200 to prevent Razorpay from retrying
    res.status(200).json({
      success: false,
      error: 'Webhook processing failed',
    });
  }
};

/**
 * Handle payment captured event
 * Supports: (1) Subscriptions, (2) One-time orders (checkout)
 */
const handlePaymentCaptured = async (payload) => {
  const payment = payload.payment.entity;
  const razorpayOrderId = payment.order_id;

  const { query } = require('../config/database');
  const orderModel = require('../models/order');
  const walletService = require('../services/walletService');

  // 0) Wallet top-up
  if (payment.notes?.wallet_topup === '1' && payment.notes?.user_id) {
    const userId = payment.notes.user_id;
    const amount = Math.round((Number(payment.amount) / 100) * 100) / 100;
    await walletService.creditWallet({
      userId,
      amount,
      source: 'razorpay',
      referenceId: payment.id,
    });
    console.log(`[Razorpay webhook] Wallet credited for user ${userId} (payment ${payment.id})`);
    return;
  }

  // 0b) Razorpay recurring subscription charge → extend same Milko subscription (AutoPay renewal)
  if (payment.subscription_id) {
    const renewed = await subscriptionService.applyAutopaySubscriptionRenewalFromPayment(
      payment.subscription_id,
      payment.id
    );
    if (renewed) {
      console.log(`[Razorpay webhook] AutoPay renewal applied (payment ${payment.id})`);
      return;
    }
  }

  // 1) Try subscription (razorpay_subscription_id = order_id for subscription flows)
  const subResult = await query(
    'SELECT id FROM subscriptions WHERE razorpay_subscription_id = $1',
    [razorpayOrderId]
  );
  if (subResult.rows.length > 0) {
    const subscriptionId = subResult.rows[0].id;
    await subscriptionService.activateSubscription(subscriptionId);
    console.log(`[Razorpay webhook] Subscription ${subscriptionId} activated after payment`);
    return;
  }

  // 2) One-time checkout order
  const orderResult = await query(
    'SELECT id FROM orders WHERE razorpay_order_id = $1 AND payment_status = $2',
    [razorpayOrderId, 'pending']
  );
  if (orderResult.rows.length > 0) {
    await orderModel.updatePaymentStatusByRazorpayOrderId(razorpayOrderId, 'paid');
    await subscriptionService.createFromCheckoutOrder(orderResult.rows[0].id);
    console.log(`[Razorpay webhook] Order ${orderResult.rows[0].id} marked paid`);
  }
};

/**
 * Handle payment failed event
 */
const handlePaymentFailed = async (payload) => {
  const payment = payload.payment.entity;
  console.log('Payment failed:', payment.id, payment.error_description);
  // Log for admin review - could send notification
};

/**
 * Recurring subscription charge succeeded (same as payment.captured for subscription payments).
 */
const handleSubscriptionCharged = async (payload) => {
  const payment = payload.payment?.entity;
  const sub = payload.subscription?.entity;
  if (!payment?.id || !sub?.id) return;
  const renewed = await subscriptionService.applyAutopaySubscriptionRenewalFromPayment(sub.id, payment.id);
  if (renewed) {
    console.log(`[Razorpay webhook] subscription.charged applied for ${sub.id}`);
  }
};

/**
 * Handle subscription activated event
 */
const handleSubscriptionActivated = async (payload) => {
  const subscription = payload.subscription.entity;
  console.log('Subscription activated:', subscription.id);
  // Additional handling if needed
};

/**
 * Handle subscription cancelled event
 */
const handleSubscriptionCancelled = async (payload) => {
  const subscription = payload.subscription.entity;
  console.log('Subscription cancelled:', subscription.id);
  
  // Update subscription status in database
  const { query } = require('../config/database');
  await query(
    'UPDATE subscriptions SET status = $1 WHERE razorpay_subscription_id = $2',
    ['cancelled', subscription.id]
  );
};

module.exports = {
  handleRazorpayWebhook,
};
