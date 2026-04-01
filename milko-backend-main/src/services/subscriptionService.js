const subscriptionModel = require('../models/subscription');
const productModel = require('../models/product');
const {
  createOrder,
  createPlan,
  createAutoPaySubscription,
  cancelRazorpaySubscription,
  getPayment,
  hasRazorpayKeys,
} = require('../config/razorpay');
const { ValidationError, NotFoundError } = require('../utils/errors');
const { getClient, query } = require('../config/database');
const walletService = require('./walletService');

const AUTOPAY_FAILURE_MESSAGE = 'Autopay failed: Either low balance or Issue with the provider.';

function formatSubscriptionEndDateYmd(row) {
  const v = row.end_date;
  if (v instanceof Date) return v.toISOString().split('T')[0];
  return String(v).slice(0, 10);
}

/** First charge at 00:00 IST on the calendar day after `end_date` (subscription last day). */
function getAutopayFirstChargeUnixSeconds(endDateYmd) {
  const endDateStartsIst = new Date(`${endDateYmd}T00:00:00+05:30`);
  const nextMidnightIst = new Date(endDateStartsIst.getTime() + 24 * 60 * 60 * 1000);
  return Math.floor(nextMidnightIst.getTime() / 1000);
}

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
  const { userId, productId, litresPerDay, durationMonths, deliveryTime, paymentMethod = 'wallet', addressId = null } = subscriptionData;

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

    if (addressId) {
      const addrRes = await client.query(`SELECT id FROM addresses WHERE id = $1 AND user_id = $2`, [addressId, userId]);
      if (addrRes.rows.length === 0) {
        throw new ValidationError('Invalid delivery address');
      }
    }

    let walletUsed = 0;
    let remainingAmount = totalAmount;

    if (paymentMethod === 'wallet') {
      const balRes = await client.query(`SELECT wallet_balance FROM users WHERE id = $1`, [userId]);
      const walletBalance = balRes.rows.length > 0 ? parseFloat(balRes.rows[0].wallet_balance || 0) : 0;
      walletUsed = Math.max(0, Math.min(walletBalance, totalAmount));
      remainingAmount = Math.max(0, Math.round((totalAmount - walletUsed) * 100) / 100);
    }

    let razorpayOrder = null;
    if (remainingAmount > 0) {
      if (!hasRazorpayKeys) {
        throw new ValidationError('Online payment is not available. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.');
      }

      razorpayOrder = await createOrder({
        amount: Math.round(remainingAmount * 100),
        currency: 'INR',
        // Razorpay receipt max length is 40 chars.
        receipt: `sub_${Date.now()}_${String(userId).replace(/-/g, '').slice(0, 8)}`,
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
        address_id,
        start_date, end_date, razorpay_subscription_id, status,
        total_qty, delivered_qty, remaining_qty, per_unit_price, total_amount, total_amount_paid, wallet_used, purchased_at,
        created_at, updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending',$10,$11,$12,$13,$14,$15,$16,$17,NOW(),NOW())
      RETURNING id
      `,
      [
        userId,
        productId,
        litresPerDay,
        durationMonths,
        deliveryTime,
        addressId,
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

    await client.query('COMMIT');

    if (remainingAmount <= 0) {
      const subscription = await activateSubscription(subscriptionId);
      return { subscription, razorpayOrder: null };
    }

    const subscription = await subscriptionModel.getSubscriptionById(subscriptionId);
    return {
      subscription,
      razorpayOrder: razorpayOrder
        ? {
            id: razorpayOrder.id,
            amount: razorpayOrder.amount,
            currency: razorpayOrder.currency,
            orderId: razorpayOrder.id,
            key: process.env.RAZORPAY_KEY_ID,
          }
        : null,
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
  await subscriptionModel.ensureSubscriptionSchema();
  await walletService.ensureWalletSchema();
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const subRes = await client.query(`SELECT * FROM subscriptions WHERE id = $1 FOR UPDATE`, [subscriptionId]);
    if (subRes.rows.length === 0) throw new NotFoundError('Subscription');
    const s = subRes.rows[0];

    if (s.status === 'active') {
      await client.query('COMMIT');
      return await subscriptionModel.getSubscriptionById(subscriptionId);
    }

    const walletUsed = parseFloat(s.wallet_used || 0);
    if (walletUsed > 0) {
      const txRef = `subscription:${subscriptionId}:activation`;
      const txExists = await client.query(
        `SELECT 1 FROM wallet_transactions WHERE user_id = $1 AND type = 'debit' AND source = 'subscription' AND reference_id = $2 LIMIT 1`,
        [s.user_id, txRef]
      );

      if (txExists.rows.length === 0) {
        const balRes = await client.query(`SELECT wallet_balance FROM users WHERE id = $1 FOR UPDATE`, [s.user_id]);
        const walletBalance = balRes.rows.length > 0 ? parseFloat(balRes.rows[0].wallet_balance || 0) : 0;
        if (walletBalance < walletUsed) {
          throw new ValidationError('Wallet balance is insufficient to activate this subscription');
        }

        await client.query(`UPDATE users SET wallet_balance = wallet_balance - $1, updated_at = NOW() WHERE id = $2`, [
          walletUsed,
          s.user_id,
        ]);

        await client.query(
          `
          INSERT INTO wallet_transactions (user_id, type, amount, source, reference_id)
          VALUES ($1,'debit',$2,'subscription',$3)
          `,
          [s.user_id, walletUsed, txRef]
        );
      }
    }

    await client.query(
      `
      UPDATE subscriptions
      SET status = 'active',
          total_amount_paid = COALESCE(total_amount, total_amount_paid),
          purchased_at = COALESCE(purchased_at, NOW()),
          updated_at = NOW()
      WHERE id = $1
      `,
      [subscriptionId]
    );

    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }

  const subscription = await subscriptionModel.getSubscriptionById(subscriptionId);
  if (!subscription) throw new NotFoundError('Subscription');

  // Generate schedules after successful activation.
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
      FOR UPDATE OF s
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

const setupAutoPay = async (subscriptionId, userId) => {
  await subscriptionModel.ensureSubscriptionSchema();
  if (!hasRazorpayKeys) {
    throw new ValidationError('Online payment is not available. Set Razorpay keys first.');
  }

  const runRazorpaySetup = async () => {
    const subRes = await query(`SELECT * FROM subscriptions WHERE id = $1`, [subscriptionId]);
    if (subRes.rows.length === 0) throw new NotFoundError('Subscription');
    const s = subRes.rows[0];
    if (String(s.user_id) !== String(userId)) throw new ValidationError('Unauthorized');
    if (s.status !== 'active' && s.status !== 'paused') {
      throw new ValidationError('AutoPay can be set only for active or paused subscriptions');
    }

    if (String(s.razorpay_subscription_id || '').startsWith('sub_')) {
      return {
        razorpaySubscriptionId: s.razorpay_subscription_id,
        shortUrl: null,
        alreadyLinked: true,
      };
    }

    const endYmd = formatSubscriptionEndDateYmd(s);
    const durationMonths = Math.max(1, parseInt(s.duration_months || 1, 10));

    const periodAmountInr = Math.max(
      1,
      Math.round(
        parseFloat(s.per_unit_price || 0) *
          parseFloat(s.litres_per_day || 0) *
          durationMonths *
          30
      )
    );
    const amountPaise = Math.max(101, Math.round(periodAmountInr * 100));

    let startAt = getAutopayFirstChargeUnixSeconds(endYmd);
    const nowSec = Math.floor(Date.now() / 1000);
    if (startAt <= nowSec + 120) {
      startAt = nowSec + 120;
    }

    const plan = await createPlan({
      amount: amountPaise,
      period: 'monthly',
      interval: durationMonths,
      name: `Milko sub #${subscriptionId} renew`,
      description: `AutoPay renewal for subscription #${subscriptionId}`,
      notes: { subscriptionId: String(subscriptionId), userId: String(userId) },
    });

    const rpSub = await createAutoPaySubscription({
      planId: plan.id,
      totalCount: 120,
      startAt,
      notes: { subscriptionId: String(subscriptionId), userId: String(userId) },
    });

    await query(
      `UPDATE subscriptions
       SET razorpay_subscription_id = $1,
           autopay_failure_reason = NULL,
           updated_at = NOW()
       WHERE id = $2`,
      [rpSub.id, subscriptionId]
    );

    return {
      razorpaySubscriptionId: rpSub.id,
      shortUrl: rpSub.short_url || null,
      alreadyLinked: false,
    };
  };

  try {
    return await runRazorpaySetup();
  } catch (e1) {
    try {
      return await runRazorpaySetup();
    } catch (e2) {
      await query(
        `UPDATE subscriptions
         SET status = 'expired',
             autopay_failure_reason = $1,
             updated_at = NOW()
         WHERE id = $2`,
        [AUTOPAY_FAILURE_MESSAGE, subscriptionId]
      );
      throw new ValidationError(AUTOPAY_FAILURE_MESSAGE);
    }
  }
};

/**
 * Extend subscription period after Razorpay recurring charge (AutoPay).
 * Idempotent per payment id.
 */
const applyAutopaySubscriptionRenewalFromPayment = async (razorpaySubscriptionId, paymentId) => {
  await subscriptionModel.ensureSubscriptionSchema();
  const payment = await getPayment(paymentId);
  if (payment.status !== 'captured') {
    console.log('[Autopay renewal] Payment not captured', paymentId);
    return null;
  }

  const client = await getClient();
  let milkoSubscriptionId = null;
  try {
    await client.query('BEGIN');
    const subRes = await client.query(
      `SELECT * FROM subscriptions WHERE razorpay_subscription_id = $1 FOR UPDATE`,
      [razorpaySubscriptionId]
    );
    if (subRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return null;
    }
    const s = subRes.rows[0];
    milkoSubscriptionId = String(s.id);

    if (String(s.razorpay_payment_id || '') === String(paymentId)) {
      await client.query('COMMIT');
      return await subscriptionModel.getSubscriptionById(milkoSubscriptionId);
    }
    if (s.status !== 'active' && s.status !== 'paused') {
      await client.query('ROLLBACK');
      console.log('[Autopay renewal] Skip; status is', s.status);
      return null;
    }

    const now = new Date();
    const startDate = now.toISOString().split('T')[0];
    const endDateObj = new Date(now);
    endDateObj.setMonth(endDateObj.getMonth() + parseInt(s.duration_months || 1, 10));
    const endDate = endDateObj.toISOString().split('T')[0];
    const totalQty = parseFloat(s.litres_per_day || 0) * parseInt(s.duration_months || 1, 10) * 30;
    const totalAmount = parseFloat(s.per_unit_price || 0) * totalQty;

    await client.query(
      `
      UPDATE subscriptions
      SET status = 'active',
          initial_start_date = COALESCE(initial_start_date, start_date),
          start_date = $1,
          end_date = $2,
          renewed_at = NOW(),
          renewal_order_id = NULL,
          razorpay_payment_id = $3,
          total_qty = $4,
          delivered_qty = 0,
          remaining_qty = $4,
          total_amount = $5,
          total_amount_paid = $5,
          autopay_failure_reason = NULL,
          updated_at = NOW()
      WHERE id = $6
      `,
      [startDate, endDate, paymentId, totalQty, totalAmount, milkoSubscriptionId]
    );

    await client.query(`DELETE FROM paused_dates WHERE subscription_id = $1`, [milkoSubscriptionId]);
    await client.query(`DELETE FROM delivery_schedules WHERE subscription_id = $1`, [milkoSubscriptionId]);

    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }

  const renewed = await subscriptionModel.getSubscriptionById(milkoSubscriptionId);
  await subscriptionModel.generateDeliverySchedules(
    milkoSubscriptionId,
    renewed.startDate,
    renewed.endDate
  );

  return await subscriptionModel.getSubscriptionById(milkoSubscriptionId);
};

/**
 * Remove AutoPay: cancel Razorpay recurring subscription and clear local link.
 */
const removeAutoPay = async (subscriptionId, userId) => {
  await subscriptionModel.ensureSubscriptionSchema();
  if (!hasRazorpayKeys) {
    throw new ValidationError('Online payment is not available. Set Razorpay keys first.');
  }

  const sub = await subscriptionModel.getSubscriptionById(subscriptionId);
  if (!sub) throw new NotFoundError('Subscription');
  if (String(sub.userId) !== String(userId)) throw new ValidationError('Unauthorized');
  if (sub.status !== 'active' && sub.status !== 'paused') {
    throw new ValidationError('AutoPay can only be removed for active or paused subscriptions');
  }

  const rpId = sub.razorpaySubscriptionId;
  if (!rpId || !String(rpId).startsWith('sub_')) {
    throw new ValidationError('No AutoPay mandate is linked');
  }

  try {
    await cancelRazorpaySubscription(rpId);
  } catch (e) {
    console.warn('[removeAutoPay] Razorpay cancel failed; clearing local link anyway:', e?.message || e);
  }

  await query(
    `UPDATE subscriptions SET razorpay_subscription_id = NULL, updated_at = NOW() WHERE id = $1`,
    [subscriptionId]
  );

  return subscriptionModel.getSubscriptionById(subscriptionId);
};

const renewExpiredSubscriptionInit = async (subscriptionId, userId) => {
  await subscriptionModel.ensureSubscriptionSchema();
  if (!hasRazorpayKeys) {
    throw new ValidationError('Online payment is not available. Set Razorpay keys first.');
  }

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
    if (s.status !== 'expired') throw new ValidationError('Only expired subscriptions can be renewed here');

    const amountInr = Math.max(
      1,
      Math.round(parseFloat(s.per_unit_price || 0) * parseFloat(s.litres_per_day || 0) * parseInt(s.duration_months || 1, 10) * 30)
    );

    const razorpayOrder = await createOrder({
      amount: amountInr * 100,
      currency: 'INR',
      receipt: `renew_${Date.now()}_${String(userId).replace(/-/g, '').slice(0, 8)}`,
      notes: {
        subscriptionId: String(subscriptionId),
        userId: String(userId),
        flow: 'renew_expired',
      },
    });

    await client.query(
      `UPDATE subscriptions SET renewal_order_id = $1, updated_at = NOW() WHERE id = $2`,
      [razorpayOrder.id, subscriptionId]
    );

    await client.query('COMMIT');
    return {
      subscriptionId: String(subscriptionId),
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

const renewExpiredSubscriptionVerify = async (subscriptionId, userId, razorpayOrderId, razorpayPaymentId) => {
  await subscriptionModel.ensureSubscriptionSchema();
  const payment = await getPayment(razorpayPaymentId);
  if (payment.status !== 'captured') throw new ValidationError('Payment not captured');
  if (payment.order_id !== razorpayOrderId) throw new ValidationError('Order ID mismatch');

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
    if (s.status !== 'expired') throw new ValidationError('Subscription is not expired');
    if (!s.renewal_order_id || s.renewal_order_id !== razorpayOrderId) {
      throw new ValidationError('Invalid renewal order');
    }

    const now = new Date();
    const startDate = now.toISOString().split('T')[0];
    const endDateObj = new Date(now);
    endDateObj.setMonth(endDateObj.getMonth() + parseInt(s.duration_months || 1, 10));
    const endDate = endDateObj.toISOString().split('T')[0];
    const totalQty = parseFloat(s.litres_per_day || 0) * parseInt(s.duration_months || 1, 10) * 30;
    const totalAmount = parseFloat(s.per_unit_price || 0) * totalQty;

    await client.query(
      `
      UPDATE subscriptions
      SET status = 'active',
          initial_start_date = COALESCE(initial_start_date, start_date),
          start_date = $1,
          end_date = $2,
          renewed_at = NOW(),
          renewal_order_id = NULL,
          razorpay_payment_id = $3,
          total_qty = $4,
          delivered_qty = 0,
          remaining_qty = $4,
          total_amount = $5,
          total_amount_paid = $5,
          updated_at = NOW()
      WHERE id = $6
      `,
      [startDate, endDate, razorpayPaymentId, totalQty, totalAmount, subscriptionId]
    );

    await client.query(`DELETE FROM paused_dates WHERE subscription_id = $1`, [subscriptionId]);
    await client.query(`DELETE FROM delivery_schedules WHERE subscription_id = $1`, [subscriptionId]);

    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }

  const renewed = await subscriptionModel.getSubscriptionById(subscriptionId);
  await subscriptionModel.generateDeliverySchedules(
    subscriptionId,
    renewed.startDate,
    renewed.endDate
  );

  return await subscriptionModel.getSubscriptionById(subscriptionId);
};

/**
 * Create/activate subscription from a paid checkout order that contains a subscription line item.
 * Idempotent by checkout_order_id.
 */
const createFromCheckoutOrder = async (orderId) => {
  await subscriptionModel.ensureSubscriptionSchema();
  await walletService.ensureWalletSchema();
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const existingRes = await client.query(
      `SELECT id, status FROM subscriptions WHERE checkout_order_id = $1 LIMIT 1`,
      [orderId]
    );
    if (existingRes.rows.length > 0) {
      const existingId = existingRes.rows[0].id;
      await client.query('COMMIT');
      if (existingRes.rows[0].status !== 'active') {
        return await activateSubscription(existingId);
      }
      return await subscriptionModel.getSubscriptionById(existingId);
    }

    const orderRes = await client.query(
      `
      SELECT id, user_id, payment_status
      FROM orders
      WHERE id = $1
      LIMIT 1
      `,
      [orderId]
    );
    if (orderRes.rows.length === 0) {
      await client.query('COMMIT');
      return null;
    }
    const order = orderRes.rows[0];

    const itemRes = await client.query(
      `
      SELECT product_id, product_name, variation_size, unit_price
      FROM order_items
      WHERE order_id = $1
        AND LOWER(product_name) LIKE 'subscription for %'
      ORDER BY created_at ASC
      LIMIT 1
      `,
      [orderId]
    );
    if (itemRes.rows.length === 0) {
      await client.query('COMMIT');
      return null;
    }

    const item = itemRes.rows[0];
    const details = String(item.variation_size || '');
    const qtyMatch = details.match(/Qty:\s*([0-9]+(?:\.[0-9]+)?)\s*L\/day/i);
    const monthsMatch = details.match(/Period:\s*([0-9]+)\s*month/i);
    const deliveryMatch = details.match(/Delivery:\s*(.+)$/i);

    const litresPerDay = qtyMatch ? parseFloat(qtyMatch[1]) : 0;
    const durationMonths = monthsMatch ? parseInt(monthsMatch[1], 10) : 0;
    const deliveryTime = deliveryMatch ? String(deliveryMatch[1]).trim() : '';
    if (!item.product_id || !litresPerDay || !durationMonths || !deliveryTime) {
      await client.query('COMMIT');
      return null;
    }

    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + durationMonths);

    const days = Math.max(1, Math.round(durationMonths * 30));
    const totalQty = litresPerDay * days;
    const totalAmount = parseFloat(item.unit_price || 0);
    const perUnitPrice = totalQty > 0 ? (totalAmount / totalQty) : 0;
    const isAlreadyPaid = ['paid', 'cod'].includes(String(order.payment_status || '').toLowerCase());

    const insertRes = await client.query(
      `
      INSERT INTO subscriptions (
        user_id, product_id, litres_per_day, duration_months, delivery_time,
        start_date, end_date, razorpay_subscription_id, status, checkout_order_id,
        total_qty, delivered_qty, remaining_qty, per_unit_price, total_amount, total_amount_paid, wallet_used, purchased_at,
        created_at, updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,NULL,'pending',$8,$9,$10,$11,$12,$13,$14,$15,NOW(),NOW(),NOW())
      RETURNING id
      `,
      [
        order.user_id,
        item.product_id,
        litresPerDay,
        durationMonths,
        deliveryTime,
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0],
        orderId,
        totalQty,
        0,
        totalQty,
        perUnitPrice,
        totalAmount,
        isAlreadyPaid ? totalAmount : 0,
        0,
      ]
    );

    const subscriptionId = insertRes.rows[0].id;
    await client.query('COMMIT');

    if (isAlreadyPaid) {
      return await activateSubscription(subscriptionId);
    }
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
  createFromCheckoutOrder,
  pauseSubscription,
  resumeSubscription,
  cancelSubscription,
  cancelTodaysDelivery,
  setupAutoPay,
  removeAutoPay,
  applyAutopaySubscriptionRenewalFromPayment,
  renewExpiredSubscriptionInit,
  renewExpiredSubscriptionVerify,
};
