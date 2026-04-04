const subscriptionService = require('../services/subscriptionService');
const subscriptionModel = require('../models/subscription');
const { ValidationError } = require('../utils/errors');
const { getPayment: getRazorpayPayment } = require('../config/razorpay');

/**
 * Subscription Controller
 * Handles subscription HTTP requests
 */

/**
 * Get all subscriptions for current user
 * GET /api/subscriptions
 */
const getMySubscriptions = async (req, res, next) => {
  try {
    const subscriptions = await subscriptionModel.getSubscriptionsByUserId(req.user.id);

    res.json({
      success: true,
      data: subscriptions,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get subscription by ID
 * GET /api/subscriptions/:id
 */
const getSubscriptionById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const subscription = await subscriptionModel.getSubscriptionById(id);

    // Check authorization
    if (subscription.userId !== req.user.id && req.user.role !== 'admin') {
      throw new ValidationError('Unauthorized');
    }

    res.json({
      success: true,
      data: subscription,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create new subscription
 * POST /api/subscriptions
 */
const createSubscription = async (req, res, next) => {
  try {
    const { productId, litresPerDay, durationMonths, durationDays, deliveryTime, paymentMethod, addressId } =
      req.body;

    if (!productId || !litresPerDay || !deliveryTime) {
      throw new ValidationError('All fields are required');
    }
    const hasDuration =
      (durationDays != null && durationDays !== '' && Number(durationDays) >= 1) ||
      (durationMonths != null && durationMonths !== '' && Number(durationMonths) >= 1);
    if (!hasDuration) {
      throw new ValidationError('Duration is required (durationDays or durationMonths)');
    }
    const method = (paymentMethod || 'wallet').toString().toLowerCase();
    if (method !== 'wallet' && method !== 'online') {
      throw new ValidationError('Invalid payment method');
    }

    const result = await subscriptionService.createSubscription({
      userId: req.user.id,
      productId,
      litresPerDay,
      durationMonths,
      durationDays,
      deliveryTime,
      paymentMethod: method,
      addressId: addressId || null,
    });

    res.status(201).json({
      success: true,
      data: result,
      message: 'Subscription created. Please complete payment.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Pause subscription
 * POST /api/subscriptions/:id/pause
 */
const pauseSubscription = async (req, res, next) => {
  try {
    const { id } = req.params;
    const subscription = await subscriptionService.pauseSubscription(id, req.user.id);

    res.json({
      success: true,
      data: subscription,
      message: 'Subscription paused',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Resume subscription
 * POST /api/subscriptions/:id/resume
 */
const resumeSubscription = async (req, res, next) => {
  try {
    const { id } = req.params;
    const subscription = await subscriptionService.resumeSubscription(id, req.user.id);

    res.json({
      success: true,
      data: subscription,
      message: 'Subscription resumed',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Cancel subscription
 * POST /api/subscriptions/:id/cancel
 */
const cancelSubscription = async (req, res, next) => {
  try {
    const { id } = req.params;
    const subscription = await subscriptionService.cancelSubscription(id, req.user.id);

    res.json({
      success: true,
      data: subscription,
      message: 'Subscription cancelled',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Cancel today's delivery (skip delivery for today, extend end date by +1 day)
 * POST /api/subscriptions/:id/cancel-today
 */
const cancelTodaysDelivery = async (req, res, next) => {
  try {
    const { id } = req.params;
    const subscription = await subscriptionService.cancelTodaysDelivery(id, req.user.id);

    res.json({
      success: true,
      data: subscription,
      message: "Today's delivery cancelled",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Setup Razorpay AutoPay mandate for a subscription.
 * POST /api/subscriptions/:id/setup-autopay
 */
const setupAutoPay = async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = await subscriptionService.setupAutoPay(id, req.user.id);
    res.json({
      success: true,
      data,
      message: data.alreadyLinked ? 'AutoPay already linked' : 'AutoPay setup created',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/subscriptions/:id/remove-autopay
 */
const removeAutoPay = async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = await subscriptionService.removeAutoPay(id, req.user.id);
    res.json({ success: true, data, message: 'AutoPay removed' });
  } catch (error) {
    next(error);
  }
};

const renewExpiredInit = async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = await subscriptionService.renewExpiredSubscriptionInit(id, req.user.id);
    res.json({ success: true, data, message: 'Renewal payment initiated' });
  } catch (error) {
    next(error);
  }
};

const renewExpiredVerify = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { razorpay_order_id: razorpayOrderId, razorpay_payment_id: razorpayPaymentId } = req.body || {};
    if (!razorpayOrderId || !razorpayPaymentId) {
      throw new ValidationError('razorpay_order_id and razorpay_payment_id are required');
    }
    const data = await subscriptionService.renewExpiredSubscriptionVerify(
      id,
      req.user.id,
      razorpayOrderId,
      razorpayPaymentId
    );
    res.json({ success: true, data, message: 'Subscription renewed successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * Verify Razorpay payment and activate subscription
 * POST /api/subscriptions/verify-payment
 * Body: { razorpay_order_id, razorpay_payment_id }
 */
const verifyPayment = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const { razorpay_order_id: razorpayOrderId, razorpay_payment_id: razorpayPaymentId } = req.body || {};
    if (!userId) throw new ValidationError('User not found');
    if (!razorpayOrderId || !razorpayPaymentId) {
      throw new ValidationError('razorpay_order_id and razorpay_payment_id are required');
    }

    const payment = await getRazorpayPayment(razorpayPaymentId);
    if (payment.status !== 'captured') {
      return res.status(400).json({ success: false, error: 'Payment not captured' });
    }
    if (payment.order_id !== razorpayOrderId) {
      return res.status(400).json({ success: false, error: 'Order ID mismatch' });
    }

    const sub = await subscriptionModel.getSubscriptionsByUserId(userId);
    const match = sub.find((s) => s.razorpaySubscriptionId === razorpayOrderId);
    if (!match) return res.status(404).json({ success: false, error: 'Subscription not found' });

    const updated = await subscriptionService.activateSubscription(match.id);

    res.json({ success: true, data: updated, message: 'Payment verified' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMySubscriptions,
  getSubscriptionById,
  createSubscription,
  pauseSubscription,
  resumeSubscription,
  cancelSubscription,
  cancelTodaysDelivery,
  setupAutoPay,
  removeAutoPay,
  renewExpiredInit,
  renewExpiredVerify,
  verifyPayment,
};
