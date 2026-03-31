const crypto = require('crypto');
const { ValidationError } = require('../utils/errors');
const { query, getClient } = require('../config/database');
const orderModel = require('../models/order');
const couponService = require('../services/couponService');
const { createOrder: createRazorpayOrder, hasRazorpayKeys, getPayment: getRazorpayPayment } = require('../config/razorpay');
const walletService = require('../services/walletService');

function normalizeInt(val) {
  if (val === null || val === undefined || val === '') return null;
  const n = parseInt(String(val), 10);
  return Number.isFinite(n) ? n : null;
}

/**
 * Create an order (COD / Online placeholder)
 * POST /api/orders
 */
const createOrder = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const { items, deliveryAddress, couponCode, paymentMethod, subscriptionItem } = req.body || {};

    if (!userId) throw new ValidationError('User not found');
    const hasNormalItems = Array.isArray(items) && items.length > 0;
    const hasSubscriptionItem = !!subscriptionItem && typeof subscriptionItem === 'object';
    if (!hasNormalItems && !hasSubscriptionItem) throw new ValidationError('Order items are required');
    if (!deliveryAddress) throw new ValidationError('Delivery address is required');

    const method = (paymentMethod || 'cod').toString().toLowerCase();
    if (method !== 'cod' && method !== 'online' && method !== 'wallet') throw new ValidationError('Invalid payment method');

    // Compute item pricing server-side
    const computedItems = [];
    let subtotal = 0;

    for (const raw of (Array.isArray(items) ? items : [])) {
      const productId = normalizeInt(raw?.productId);
      const variationId = normalizeInt(raw?.variationId);
      const quantity = normalizeInt(raw?.quantity);

      if (!productId || !quantity || quantity <= 0) {
        throw new ValidationError('Invalid order item');
      }

      const productRes = await query(
        `
        SELECT id, name, price_per_litre, selling_price
        FROM products
        WHERE id = $1
        `,
        [productId]
      );
      if (productRes.rows.length === 0) throw new ValidationError('Product not found');
      const p = productRes.rows[0];

      let variation = null;
      if (variationId) {
        const varRes = await query(
          `
          SELECT id, size, price_multiplier, price
          FROM product_variations
          WHERE id = $1 AND product_id = $2
          `,
          [variationId, productId]
        );
        if (varRes.rows.length === 0) throw new ValidationError('Invalid product variation');
        variation = varRes.rows[0];
      }

      const basePrice = p.selling_price !== null && p.selling_price !== undefined
        ? parseFloat(p.selling_price)
        : parseFloat(p.price_per_litre);

      const mult = variation?.price_multiplier !== null && variation?.price_multiplier !== undefined
        ? parseFloat(variation.price_multiplier)
        : 1;

      const unitPrice = variation?.price !== null && variation?.price !== undefined
        ? parseFloat(variation.price)
        : basePrice * mult;

      const lineTotal = unitPrice * quantity;
      subtotal += lineTotal;

      computedItems.push({
        productId,
        variationId,
        productName: p.name,
        variationSize: variation?.size || null,
        unitPrice,
        quantity,
        lineTotal,
        isSubscription: false,
      });
    }

    if (hasSubscriptionItem) {
      const subscriptionProductId = normalizeInt(subscriptionItem?.productId);
      const litresPerDay = Number(subscriptionItem?.litresPerDay);
      const durationMonths = Number(subscriptionItem?.durationMonths);
      const deliveryTime = (subscriptionItem?.deliveryTime || '').toString();

      if (!subscriptionProductId || !Number.isFinite(litresPerDay) || litresPerDay <= 0 || !Number.isFinite(durationMonths) || durationMonths <= 0) {
        throw new ValidationError('Invalid subscription item');
      }

      const subProductRes = await query(
        `
        SELECT id, name, price_per_litre, selling_price, is_membership_eligible
        FROM products
        WHERE id = $1
        `,
        [subscriptionProductId]
      );
      if (subProductRes.rows.length === 0) throw new ValidationError('Subscription product not found');
      const sp = subProductRes.rows[0];
      if (!sp.is_membership_eligible) throw new ValidationError('Selected product is not eligible for subscription');

      const perUnit = sp.selling_price !== null && sp.selling_price !== undefined
        ? parseFloat(sp.selling_price)
        : parseFloat(sp.price_per_litre);
      const days = Math.max(1, Math.round(durationMonths * 30));
      const subscriptionAmount = perUnit * litresPerDay * days;
      subtotal += subscriptionAmount;

      computedItems.push({
        productId: subscriptionProductId,
        variationId: null,
        productName: `Subscription for ${sp.name}`,
        variationSize: `Qty: ${litresPerDay} L/day | Period: ${durationMonths} month(s) | Delivery: ${deliveryTime}`,
        unitPrice: subscriptionAmount,
        quantity: 1,
        lineTotal: subscriptionAmount,
        isSubscription: true,
      });
    }

    // Coupon (optional)
    let discount = 0;
    let normalizedCouponCode = null;
    if (couponCode) {
      normalizedCouponCode = String(couponCode).trim().toUpperCase();
      const coupon = await couponService.validateCoupon(normalizedCouponCode, subtotal);
      if (coupon.discountType === 'percentage') {
        discount = (subtotal * coupon.discountValue) / 100;
        if (coupon.maxDiscountAmount && discount > coupon.maxDiscountAmount) {
          discount = coupon.maxDiscountAmount;
        }
      } else {
        discount = coupon.discountValue;
      }
      discount = Math.min(discount, subtotal);
    }

    const deliveryCharges = 0;
    const total = subtotal - discount + deliveryCharges;

    const id = crypto.randomUUID();
    const orderNumber = id.split('-')[0].toUpperCase();

    if (method === 'cod') {
      const order = await orderModel.createOrder({
        id,
        userId,
        orderNumber,
        status: 'placed',
        paymentMethod: 'cod',
        paymentStatus: 'cod',
        currency: 'INR',
        subtotal,
        discount,
        deliveryCharges,
        total,
        deliveryAddress,
        items: computedItems,
      });

      return res.status(201).json({
        success: true,
        data: {
          ...order,
          couponCode: normalizedCouponCode,
        },
        message: 'Order placed successfully',
      });
    }

    await orderModel.ensureOrdersSchema();
    if (method === 'wallet') {
      await walletService.ensureWalletSchema();
    }

    const client = await getClient();
    try {
      await client.query('BEGIN');

      let walletUsed = 0;
      let remaining = total;

      if (method === 'wallet') {
        const balRes = await client.query(`SELECT wallet_balance FROM users WHERE id = $1 FOR UPDATE`, [userId]);
        const walletBalance = balRes.rows.length > 0 ? parseFloat(balRes.rows[0].wallet_balance || 0) : 0;

        walletUsed = Math.max(0, Math.min(walletBalance, total));
        remaining = Math.max(0, Math.round((total - walletUsed) * 100) / 100);

        // For mixed wallet + online payments, wallet is debited only after Razorpay verification.
        // For pure wallet payments (remaining = 0), debit immediately in this transaction.
        if (walletUsed > 0 && remaining <= 0) {
          await client.query(
            `UPDATE users SET wallet_balance = wallet_balance - $1, updated_at = NOW() WHERE id = $2`,
            [walletUsed, userId]
          );

          await client.query(
            `
            INSERT INTO wallet_transactions (user_id, type, amount, source, reference_id)
            VALUES ($1, 'debit', $2, 'purchase', $3)
            ON CONFLICT DO NOTHING
            `,
            [userId, walletUsed, id]
          );
        }
      }

      let razorpayOrderId = null;
      if (remaining > 0) {
        if (!hasRazorpayKeys) {
          throw new ValidationError('Online payment is not available. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.');
        }
        const rp = await createRazorpayOrder({
          amount: Math.round(remaining * 100),
          currency: 'INR',
          receipt: `milko_${orderNumber}_${Date.now()}`,
          notes: { order_id: id, order_number: orderNumber },
        });
        razorpayOrderId = rp.id;
      }

      const paymentMethodFinal = method === 'wallet' ? (walletUsed > 0 ? 'wallet' : 'online') : 'online';
      const paymentStatusFinal = remaining > 0 ? 'pending' : 'paid';

      await client.query(
        `
        INSERT INTO orders (
          id, user_id, order_number, status, payment_method, payment_status,
          currency, subtotal, discount, delivery_charges, total, wallet_used, delivery_address, razorpay_order_id
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
        `,
        [
          id,
          userId,
          orderNumber,
          'placed',
          paymentMethodFinal,
          paymentStatusFinal,
          'INR',
          subtotal,
          discount,
          deliveryCharges,
          total,
          walletUsed,
          deliveryAddress,
          razorpayOrderId,
        ]
      );

      for (const it of computedItems) {
        await client.query(
          `
          INSERT INTO order_items (
            order_id, product_id, variation_id, product_name, variation_size, unit_price, quantity, line_total
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
          `,
          [id, it.productId, it.variationId, it.productName, it.variationSize, it.unitPrice, it.quantity, it.lineTotal]
        );

        if (!it.isSubscription) {
          await client.query(
            `
            UPDATE products
            SET quantity = GREATEST(0, quantity - $1), updated_at = NOW()
            WHERE id = $2
            `,
            [it.quantity, it.productId]
          );
        }
      }

      await client.query('COMMIT');

      if (razorpayOrderId) {
        return res.status(201).json({
          success: true,
          data: {
            orderId: id,
            orderNumber,
            razorpayOrderId,
            key: process.env.RAZORPAY_KEY_ID,
            currency: 'INR',
            amount: Math.round(remaining * 100),
            walletUsed: Math.round(walletUsed * 100) / 100,
          },
          message: 'Open Razorpay to complete payment',
        });
      }

      return res.status(201).json({
        success: true,
        data: {
          orderId: id,
          orderNumber,
          paymentStatus: 'paid',
          walletUsed: Math.round(walletUsed * 100) / 100,
        },
        message: paymentMethodFinal === 'wallet' ? 'Order paid using wallet' : 'Order paid',
      });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Verify Razorpay payment and mark order as paid
 * POST /api/orders/verify-payment
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

    const orderRow = await query(
      'SELECT id, user_id, wallet_used, payment_status FROM orders WHERE razorpay_order_id = $1',
      [razorpayOrderId]
    );
    if (orderRow.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }
    if (orderRow.rows[0].user_id !== userId) {
      return res.status(403).json({ success: false, error: 'Not your order' });
    }

    const orderId = orderRow.rows[0].id;
    const walletUsed = parseFloat(orderRow.rows[0].wallet_used || 0);
    const paymentStatus = String(orderRow.rows[0].payment_status || '');

    const client = await getClient();
    try {
      await client.query('BEGIN');

      // Idempotency: debit only if wallet transaction for this order doesn't exist yet.
      // This must run even when payment_status is already 'paid' (e.g. webhook updated status first).
      if (walletUsed > 0) {
        const txExists = await client.query(
          `SELECT 1 FROM wallet_transactions WHERE user_id = $1 AND type = 'debit' AND source = 'purchase' AND reference_id = $2 LIMIT 1`,
          [userId, orderId]
        );

        if (txExists.rows.length === 0) {
          const balRes = await client.query(`SELECT wallet_balance FROM users WHERE id = $1 FOR UPDATE`, [userId]);
          const walletBalance = balRes.rows.length > 0 ? parseFloat(balRes.rows[0].wallet_balance || 0) : 0;
          if (walletBalance + 1e-9 < walletUsed) {
            throw new ValidationError('Wallet balance is insufficient to complete this payment');
          }

          await client.query(`UPDATE users SET wallet_balance = wallet_balance - $1, updated_at = NOW() WHERE id = $2`, [
            walletUsed,
            userId,
          ]);

          await client.query(
            `
            INSERT INTO wallet_transactions (user_id, type, amount, source, reference_id)
            VALUES ($1, 'debit', $2, 'purchase', $3)
            ON CONFLICT DO NOTHING
            `,
            [userId, walletUsed, orderId]
          );
        }
      }

      await client.query(
        `UPDATE orders SET payment_status = 'paid', updated_at = NOW() WHERE razorpay_order_id = $1`,
        [razorpayOrderId]
      );

      if (payment.method === 'card' && payment.card) {
        const last4 = payment.card.last4 || '';
        const network = (payment.card.network || payment.card.brand || '').toString();
        await client.query(
          `UPDATE orders SET payment_card_last4 = $1, payment_card_network = $2, updated_at = NOW() WHERE razorpay_order_id = $3`,
          [last4, network, razorpayOrderId]
        );
      }

      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    res.json({
      success: true,
      data: { orderId, paymentStatus: 'paid' },
      message: 'Payment verified',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * List current user's orders
 * GET /api/orders
 */
const getMyOrders = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) throw new ValidationError('User not found');
    const orders = await orderModel.listOrdersForUser(userId);
    res.json({ success: true, data: orders });
  } catch (error) {
    next(error);
  }
};

/**
 * Get a single order by ID (customer's own order only)
 * GET /api/orders/:id
 */
const getOrderById = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const { id: orderId } = req.params;
    if (!userId) throw new ValidationError('User not found');
    if (!orderId) throw new ValidationError('Order ID is required');
    const order = await orderModel.getOrderByIdForUser(userId, orderId);
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }
    res.json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
};

/**
 * Submit order feedback (emoji: least, neutral, most). One per order, locked after submit.
 * POST /api/orders/:id/feedback
 * Body: { rating: 'least'|'neutral'|'most' }
 */
const submitFeedback = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const { id: orderId } = req.params;
    const { rating } = req.body || {};
    if (!userId) throw new ValidationError('User not found');
    if (!orderId) throw new ValidationError('Order ID is required');
    if (!rating || !['least', 'neutral', 'most'].includes(String(rating))) {
      throw new ValidationError('rating must be one of: least, neutral, most');
    }
    await orderModel.submitOrderFeedback(orderId, userId, String(rating));
    res.json({ success: true, data: { submitted: true } });
  } catch (error) {
    next(error);
  }
};

/**
 * Submit detailed order feedback (How was it? popup).
 * POST /api/orders/:id/detailed-feedback
 * Body: { qualityStars, deliveryAgentStars, onTimeStars, valueForMoneyStars, wouldOrderAgain }
 */
const submitDetailedFeedback = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const { id: orderId } = req.params;
    const { qualityStars, deliveryAgentStars, onTimeStars, valueForMoneyStars, wouldOrderAgain } = req.body || {};
    if (!userId) throw new ValidationError('User not found');
    if (!orderId) throw new ValidationError('Order ID is required');
    const data = { qualityStars, deliveryAgentStars, onTimeStars, valueForMoneyStars, wouldOrderAgain };
    const result = await orderModel.submitDetailedFeedback(orderId, userId, data);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createOrder,
  getMyOrders,
  getOrderById,
  verifyPayment,
  submitFeedback,
  submitDetailedFeedback,
};
