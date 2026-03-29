const subscriptionModel = require('../models/subscription');
const productModel = require('../models/product');
const { createOrder } = require('../config/razorpay');
const { ValidationError, NotFoundError } = require('../utils/errors');
const { getClient } = require('../config/database');
const walletService = require('./walletService');

/**
 * Subscription Service
 * Handles subscription business logic
 */

/**
 * Create a new subscription
 * Creates subscription record and Razorpay order for payment
 * @param {Object} subscriptionData - Subscription data
 * @returns {Promise<Object>} Subscription and Razorpay order
 */
const createSubscription = async (subscriptionData) => {
  const { userId, productId, litresPerDay, durationMonths, deliveryTime } = subscriptionData;

  // Validate product exists and is active
  const product = await productModel.getProductById(productId);
  if (!product) {
    throw new NotFoundError('Product');
  }

  if (product.isActive === false) {
    throw new ValidationError('Product is not available');
  }

  await subscriptionModel.ensureSubscriptionSchema();
  await walletService.ensureWalletSchema();

  // Calculate dates
  const startDate = new Date();
  const endDate = new Date();
  endDate.setMonth(endDate.getMonth() + durationMonths);

  // Calculate total amount (price per litre * litres per day * days in duration)
  const daysInDuration = durationMonths * 30;
  const perUnitPrice =
    product.sellingPrice !== null && product.sellingPrice !== undefined
      ? Number(product.sellingPrice)
      : Number(product.pricePerLitre);
  const totalQty = litresPerDay * daysInDuration;
  const totalAmount = perUnitPrice * totalQty;

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const balRes = await client.query(`SELECT wallet_balance FROM users WHERE id = $1 FOR UPDATE`, [userId]);
    const walletBalance = balRes.rows.length > 0 ? parseFloat(balRes.rows[0].wallet_balance || 0) : 0;
    const walletUsed = Math.max(0, Math.min(walletBalance, totalAmount));
    const remainingAmount = Math.max(0, Math.round((totalAmount - walletUsed) * 100) / 100);

    if (walletUsed > 0) {
      await client.query(`UPDATE users SET wallet_balance = wallet_balance - $1, updated_at = NOW() WHERE id = $2`, [
        walletUsed,
        userId,
      ]);
    }

    let razorpayOrder = null;
    if (remainingAmount > 0) {
      razorpayOrder = await createOrder({
        amount: Math.round(remainingAmount * 100),
        currency: 'INR',
        receipt: `milko_sub_${userId}_${Date.now()}`,
        notes: {
          userId,
          productId,
          litresPerDay,
          durationMonths,
          deliveryTime,
        },
      });
    }

    const subRes = await client.query(
      `
      INSERT INTO subscriptions (
        user_id, product_id, litres_per_day, duration_months, delivery_time,
        start_date, end_date, razorpay_subscription_id, status,
        total_qty, delivered_qty, remaining_qty, per_unit_price, total_amount, total_amount_paid, wallet_used, purchased_at,
        created_at, updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending',$9,$10,$11,$12,$13,$14,$15,$16,NOW(),NOW())
      RETURNING id
      `,
      [
        userId,
        productId,
        litresPerDay,
        durationMonths,
        deliveryTime,
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0],
        razorpayOrder ? razorpayOrder.id : null,
        totalQty,
        0,
        totalQty,
        perUnitPrice,
        totalAmount,
        walletUsed,
        walletUsed,
        new Date().toISOString(),
      ]
    );

    const subscriptionId = subRes.rows[0].id;

    if (walletUsed > 0) {
      await client.query(
        `
        INSERT INTO wallet_transactions (user_id, type, amount, source, reference_id)
        VALUES ($1,'debit',$2,'subscription',$3)
        ON CONFLICT DO NOTHING
        `,
        [userId, walletUsed, `subscription:${subscriptionId}`]
      );
    }

    await client.query('COMMIT');

    if (remainingAmount <= 0) {
      const subscription = await activateSubscription(subscriptionId);
      return { subscription, razorpayOrder: null };
    }

    const subscription = await subscriptionModel.getSubscriptionById(subscriptionId);
    return {
      subscription,
      razorpayOrder: {
        id: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        orderId: razorpayOrder.id,
        key: process.env.RAZORPAY_KEY_ID,
      },
    };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
};

/**
 * Activate subscription after payment confirmation
 * Called by webhook handler after successful payment
 * @param {string} subscriptionId - Subscription ID
 * @returns {Promise<Object>} Updated subscription
 */
const activateSubscription = async (subscriptionId) => {
  const subscription = await subscriptionModel.getSubscriptionById(subscriptionId);
  if (!subscription) {
    throw new NotFoundError('Subscription');
  }

  // Update status to active
  await subscriptionModel.updateSubscriptionStatus(subscriptionId, 'active');
  const { query } = require('../config/database');
  await query(
    `
    UPDATE subscriptions
    SET total_amount_paid = COALESCE(total_amount, total_amount_paid),
        purchased_at = COALESCE(purchased_at, NOW()),
        updated_at = NOW()
    WHERE id = $1
    `,
    [subscriptionId]
  );

  // Generate delivery schedules
  await subscriptionModel.generateDeliverySchedules(
    subscriptionId,
    subscription.startDate,
    subscription.endDate
  );

  return await subscriptionModel.getSubscriptionById(subscriptionId);
};

/**
 * Pause subscription
 * @param {string} subscriptionId - Subscription ID
 * @param {string|null} userId - User ID (for authorization check, null for admin)
 * @returns {Promise<Object>} Updated subscription
 */
const pauseSubscription = async (subscriptionId, userId) => {
  const subscription = await subscriptionModel.getSubscriptionById(subscriptionId);
  if (!subscription) {
    throw new NotFoundError('Subscription');
  }

  // Check authorization (user owns subscription or is admin - userId is null for admin)
  if (userId && subscription.userId !== userId) {
    throw new ValidationError('Unauthorized');
  }

  if (subscription.status !== 'active') {
    throw new ValidationError('Only active subscriptions can be paused');
  }

  return await subscriptionModel.updateSubscriptionStatus(subscriptionId, 'paused');
};

/**
 * Resume subscription
 * @param {string} subscriptionId - Subscription ID
 * @param {string|null} userId - User ID (for authorization check, null for admin)
 * @returns {Promise<Object>} Updated subscription
 */
const resumeSubscription = async (subscriptionId, userId) => {
  const subscription = await subscriptionModel.getSubscriptionById(subscriptionId);
  if (!subscription) {
    throw new NotFoundError('Subscription');
  }

  // Check authorization (userId is null for admin)
  if (userId && subscription.userId !== userId) {
    throw new ValidationError('Unauthorized');
  }

  if (subscription.status !== 'paused') {
    throw new ValidationError('Only paused subscriptions can be resumed');
  }

  return await subscriptionModel.updateSubscriptionStatus(subscriptionId, 'active');
};

/**
 * Cancel subscription
 * @param {string} subscriptionId - Subscription ID
 * @param {string} userId - User ID (for authorization check)
 * @returns {Promise<Object>} Updated subscription
 */
const cancelSubscription = async (subscriptionId, userId) => {
  await subscriptionModel.ensureSubscriptionSchema();
  await walletService.ensureWalletSchema();

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const subRes = await client.query(
      `
      SELECT s.*, p.selling_price, p.price_per_litre
      FROM subscriptions s
      LEFT JOIN products p ON p.id = s.product_id
      WHERE s.id = $1
      FOR UPDATE
      `,
      [subscriptionId]
    );
    if (subRes.rows.length === 0) throw new NotFoundError('Subscription');
    const s = subRes.rows[0];

    if (String(s.user_id) !== String(userId)) {
      throw new ValidationError('Unauthorized');
    }

    if (s.status === 'cancelled') {
      await client.query('COMMIT');
      return await subscriptionModel.getSubscriptionById(subscriptionId);
    }

    const perUnitPrice =
      s.per_unit_price !== null && s.per_unit_price !== undefined
        ? parseFloat(s.per_unit_price)
        : s.selling_price !== null && s.selling_price !== undefined
          ? parseFloat(s.selling_price)
          : parseFloat(s.price_per_litre);

    let remainingQty = s.remaining_qty !== null && s.remaining_qty !== undefined ? parseFloat(s.remaining_qty) : null;
    if (remainingQty === null) {
      const pending = await client.query(
        `SELECT COUNT(*)::int AS c FROM delivery_schedules WHERE subscription_id = $1 AND status = 'pending' AND delivery_date >= CURRENT_DATE`,
        [subscriptionId]
      );
      const pendingDays = pending.rows[0]?.c || 0;
      remainingQty = pendingDays * parseFloat(s.litres_per_day);
    }

    const refundAmount = Math.max(0, Math.round(remainingQty * perUnitPrice * 100) / 100);

    if (refundAmount > 0) {
      await client.query(`SELECT wallet_balance FROM users WHERE id = $1 FOR UPDATE`, [userId]);

      const inserted = await client.query(
        `
        INSERT INTO wallet_transactions (user_id, type, amount, source, reference_id)
        VALUES ($1,'credit',$2,'refund',$3)
        ON CONFLICT DO NOTHING
        RETURNING id
        `,
        [userId, refundAmount, `refund:subscription:${subscriptionId}`]
      );

      if (inserted.rows.length > 0) {
        await client.query(`UPDATE users SET wallet_balance = wallet_balance + $1, updated_at = NOW() WHERE id = $2`, [
          refundAmount,
          userId,
        ]);
      }
    }

    await client.query(
      `
      UPDATE subscriptions
      SET status = 'cancelled',
          cancelled_at = NOW(),
          remaining_qty = 0,
          updated_at = NOW()
      WHERE id = $1
      `,
      [subscriptionId]
    );

    await client.query(
      `
      UPDATE delivery_schedules
      SET status = 'cancelled', updated_at = NOW()
      WHERE subscription_id = $1 AND delivery_date >= CURRENT_DATE AND status = 'pending'
      `,
      [subscriptionId]
    );

    await client.query('COMMIT');
    return await subscriptionModel.getSubscriptionById(subscriptionId);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
};

const cancelTodaysDelivery = async (subscriptionId, userId) => {
  await subscriptionModel.ensureSubscriptionSchema();

  const client = await getClient();
  try {
    await client.query('BEGIN');
    const subRes = await client.query(
      `SELECT * FROM subscriptions WHERE id = $1 FOR UPDATE`,
      [subscriptionId]
    );
    if (subRes.rows.length === 0) throw new NotFoundError('Subscription');
    const s = subRes.rows[0];
    if (String(s.user_id) !== String(userId)) throw new ValidationError('Unauthorized');
    if (s.status !== 'active') throw new ValidationError('Only active subscriptions can skip delivery');

    const today = new Date().toISOString().split('T')[0];

    await client.query(
      `
      INSERT INTO paused_dates (subscription_id, date, reason, created_at)
      VALUES ($1,$2,'cancel_today',NOW())
      ON CONFLICT (subscription_id, date) DO UPDATE SET reason = 'cancel_today'
      `,
      [subscriptionId, today]
    );

    await client.query(
      `
      INSERT INTO delivery_schedules (subscription_id, delivery_date, status, created_at, updated_at)
      VALUES ($1,$2,'skipped',NOW(),NOW())
      ON CONFLICT (subscription_id, delivery_date) DO UPDATE SET status = 'skipped', updated_at = NOW()
      `,
      [subscriptionId, today]
    );

    const upd = await client.query(
      `
      UPDATE subscriptions
      SET end_date = end_date + INTERVAL '1 day',
          total_qty = total_qty + litres_per_day,
          remaining_qty = remaining_qty + litres_per_day,
          updated_at = NOW()
      WHERE id = $1
      RETURNING end_date
      `,
      [subscriptionId]
    );

    const newEnd = upd.rows[0].end_date.toISOString().split('T')[0];
    const paused = await client.query(`SELECT 1 FROM paused_dates WHERE subscription_id = $1 AND date = $2`, [
      subscriptionId,
      newEnd,
    ]);
    if (paused.rows.length === 0) {
      await client.query(
        `
        INSERT INTO delivery_schedules (subscription_id, delivery_date, status, created_at, updated_at)
        VALUES ($1,$2,'pending',NOW(),NOW())
        ON CONFLICT (subscription_id, delivery_date) DO NOTHING
        `,
        [subscriptionId, newEnd]
      );
    }

    await client.query('COMMIT');
    return await subscriptionModel.getSubscriptionById(subscriptionId);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
};

module.exports = {
  createSubscription,
  activateSubscription,
  pauseSubscription,
  resumeSubscription,
  cancelSubscription,
  cancelTodaysDelivery,
};
