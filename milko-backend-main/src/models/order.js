const { query } = require('../config/database');
const productReviewModel = require('./productReview');

let schemaEnsured = false;

async function ensureOrdersSchema() {
  if (schemaEnsured) return;

  // Safe to run multiple times (IF NOT EXISTS everywhere)
  await query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);

  await query(`
    CREATE TABLE IF NOT EXISTS orders (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      order_number TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'placed' CHECK (status IN ('placed', 'confirmed', 'package_prepared', 'out_for_delivery', 'delivered', 'cancelled', 'refunded')),
      payment_method TEXT NOT NULL CHECK (payment_method IN ('cod', 'online', 'wallet')),
      payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded', 'cod')),
      currency VARCHAR(3) NOT NULL DEFAULT 'INR',
      subtotal DECIMAL(10, 2) NOT NULL CHECK (subtotal >= 0),
      discount DECIMAL(10, 2) NOT NULL DEFAULT 0 CHECK (discount >= 0),
      delivery_charges DECIMAL(10, 2) NOT NULL DEFAULT 0 CHECK (delivery_charges >= 0),
      total DECIMAL(10, 2) NOT NULL CHECK (total >= 0),
      wallet_used DECIMAL(10, 2) NOT NULL DEFAULT 0 CHECK (wallet_used >= 0),
      delivery_address JSONB NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS order_items (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id INTEGER,
      variation_id INTEGER,
      product_name TEXT NOT NULL,
      variation_size TEXT,
      unit_price DECIMAL(10, 2) NOT NULL CHECK (unit_price >= 0),
      quantity INTEGER NOT NULL CHECK (quantity > 0),
      line_total DECIMAL(10, 2) NOT NULL CHECK (line_total >= 0),
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await query(`CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);`);

  // Razorpay order ID for online payments (link to Razorpay gateway)
  await query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS razorpay_order_id VARCHAR(255);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_orders_razorpay_order_id ON orders(razorpay_order_id) WHERE razorpay_order_id IS NOT NULL;`);
  await query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS card_last4 VARCHAR(4);`);
  await query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS card_network VARCHAR(50);`);
  await query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS wallet_used DECIMAL(10, 2) NOT NULL DEFAULT 0;`);

  await query(`ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_method_check;`);
  await query(`ALTER TABLE orders ADD CONSTRAINT orders_payment_method_check CHECK (payment_method IN ('cod', 'online', 'wallet'));`);

  // Optional: when order is delivered or out for delivery (admin can set)
  await query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_date DATE;`);
  
  // Add timestamp columns for status tracking
  await query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS package_prepared_at TIMESTAMP;`);
  await query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS out_for_delivery_at TIMESTAMP;`);
  await query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP;`);
  await query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS fulfilled_at TIMESTAMP;`);

  // Update status CHECK to allow package_prepared, out_for_delivery, refunded (for DBs created before these were added)
  await query(`ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;`);
  await query(`ALTER TABLE orders ADD CONSTRAINT orders_status_check CHECK (status IN ('placed', 'confirmed', 'package_prepared', 'out_for_delivery', 'delivered', 'cancelled', 'refunded'));`);

  // order_feedback: one row per order, rating (emoji: least/neutral/most), + detailed (quality_stars, delivery_agent_stars, on_time_stars, value_for_money_stars, would_order_again)
  await query(`
    CREATE TABLE IF NOT EXISTS order_feedback (
      order_id UUID PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id),
      rating TEXT NOT NULL CHECK (rating IN ('least','neutral','most')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await query(`ALTER TABLE order_feedback DROP CONSTRAINT IF EXISTS order_feedback_rating_check;`);
  await query(`ALTER TABLE order_feedback ALTER COLUMN rating DROP NOT NULL;`);
  await query(`
    DO $$ BEGIN
      ALTER TABLE order_feedback ADD CONSTRAINT order_feedback_rating_check
      CHECK (rating IS NULL OR rating IN ('least','neutral','most'));
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `).catch(() => {});
  await query(`ALTER TABLE order_feedback ADD COLUMN IF NOT EXISTS quality_stars INTEGER;`);
  await query(`ALTER TABLE order_feedback ADD COLUMN IF NOT EXISTS delivery_agent_stars INTEGER;`);
  await query(`ALTER TABLE order_feedback ADD COLUMN IF NOT EXISTS on_time_stars INTEGER;`);
  await query(`ALTER TABLE order_feedback ADD COLUMN IF NOT EXISTS value_for_money_stars INTEGER;`);
  await query(`ALTER TABLE order_feedback ADD COLUMN IF NOT EXISTS would_order_again TEXT;`);

  schemaEnsured = true;
}

async function createOrder({
  id,
  userId,
  orderNumber,
  status,
  paymentMethod,
  paymentStatus,
  currency,
  subtotal,
  discount,
  deliveryCharges,
  total,
  deliveryAddress,
  items,
  razorpayOrderId = null,
  walletUsed = 0,
}) {
  await ensureOrdersSchema();

  const orderRes = await query(
    `
    INSERT INTO orders (
      id, user_id, order_number, status, payment_method, payment_status,
      currency, subtotal, discount, delivery_charges, total, wallet_used, delivery_address, razorpay_order_id
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
    RETURNING id, user_id, order_number, status, payment_method, payment_status, currency,
              subtotal, discount, delivery_charges, total, wallet_used, delivery_address, created_at
    `,
    [
      id,
      userId,
      orderNumber,
      status,
      paymentMethod,
      paymentStatus,
      currency,
      subtotal,
      discount,
      deliveryCharges,
      total,
      walletUsed,
      deliveryAddress,
      razorpayOrderId,
    ]
  );

  const order = orderRes.rows[0];

  for (const it of items) {
    await query(
      `
      INSERT INTO order_items (
        order_id, product_id, variation_id, product_name, variation_size, unit_price, quantity, line_total
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      `,
      [
        order.id,
        it.productId,
        it.variationId,
        it.productName,
        it.variationSize,
        it.unitPrice,
        it.quantity,
        it.lineTotal,
      ]
    );
    
    // Reduce product quantity by the ordered quantity
    await query(
      `
      UPDATE products 
      SET quantity = GREATEST(0, quantity - $1), updated_at = NOW()
      WHERE id = $2
      `,
      [it.quantity, it.productId]
    );
  }

  return {
    id: order.id,
    userId: order.user_id,
    orderNumber: order.order_number,
    status: order.status,
    paymentMethod: order.payment_method,
    paymentStatus: order.payment_status,
    currency: order.currency,
    subtotal: parseFloat(order.subtotal),
    discount: parseFloat(order.discount),
    deliveryCharges: parseFloat(order.delivery_charges),
    total: parseFloat(order.total),
    walletUsed: parseFloat(order.wallet_used || 0),
    deliveryAddress: order.delivery_address,
    createdAt: order.created_at ? new Date(order.created_at).toISOString() : null,
  };
}

async function listOrdersForUser(userId) {
  await ensureOrdersSchema();

  const orderRes = await query(
    `
    SELECT
      o.id,
      o.order_number,
      o.status,
      o.payment_method,
      o.payment_status,
      o.currency,
      o.total,
      o.created_at,
      o.delivery_date,
      of.quality_stars
    FROM orders o
    LEFT JOIN order_feedback of ON of.order_id = o.id
    WHERE o.user_id = $1
    ORDER BY o.created_at DESC
    `,
    [userId]
  );

  const orders = orderRes.rows;
  if (orders.length === 0) return [];

  const orderIds = orders.map((o) => o.id);
  const itemRes = await query(
    `
    SELECT
      oi.order_id,
      oi.product_name,
      oi.variation_size,
      oi.variation_id,
      oi.quantity,
      oi.unit_price,
      oi.line_total,
      oi.product_id,
      p.image_url
    FROM order_items oi
    LEFT JOIN products p ON p.id = oi.product_id
    WHERE oi.order_id = ANY($1)
    ORDER BY oi.order_id, oi.created_at
    `,
    [orderIds]
  );

  const itemsByOrder = {};
  for (const row of itemRes.rows) {
    const k = row.order_id;
    if (!itemsByOrder[k]) itemsByOrder[k] = [];
    itemsByOrder[k].push({
      productName: row.product_name || 'Product',
      variationSize: row.variation_size || null,
      variationId: row.variation_id != null ? row.variation_id : null,
      quantity: row.quantity != null ? parseInt(row.quantity, 10) : 1,
      unitPrice: row.unit_price != null ? parseFloat(row.unit_price) : 0,
      lineTotal: row.line_total != null ? parseFloat(row.line_total) : 0,
      productId: row.product_id,
      imageUrl: row.image_url || null,
    });
  }

  return orders.map((r) => ({
    id: r.id,
    orderNumber: r.order_number,
    status: r.status,
    paymentMethod: r.payment_method,
    paymentStatus: r.payment_status,
    currency: r.currency || 'INR',
    total: r.total !== null ? parseFloat(r.total) : 0,
    itemsCount: (itemsByOrder[r.id] || []).length,
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : null,
    deliveryDate: r.delivery_date ? new Date(r.delivery_date).toISOString().slice(0, 10) : null,
    items: itemsByOrder[r.id] || [],
    qualityStars: r.quality_stars != null ? parseInt(r.quality_stars, 10) : null,
  }));
}

async function listAllOrdersAdmin() {
  await ensureOrdersSchema();

  const res = await query(
    `
    SELECT
      o.id AS order_id,
      o.order_number,
      o.created_at AS ordered_at,
      u.name AS user_name,
      u.email AS user_email,
      o.total AS amount,
      o.currency,
      o.payment_method,
      o.payment_status,
      o.fulfilled_at,
      (
        SELECT COUNT(*)
        FROM order_items oi
        WHERE oi.order_id = o.id
      ) AS items_count,
      o.status AS delivery_status
    FROM orders o
    LEFT JOIN users u ON u.id = o.user_id
    ORDER BY o.created_at DESC
    `
  );

  return res.rows.map((row) => ({
    orderId: String(row.order_id),
    orderNumber: String(row.order_number),
    orderedAt: row.ordered_at ? new Date(row.ordered_at).toISOString() : null,
    customerName: row.user_name || null,
    customerEmail: row.user_email || null,
    amount: row.amount !== null ? parseFloat(row.amount) : null,
    currency: row.currency || 'INR',
    paymentMethod: row.payment_method || 'online',
    paymentStatus: row.payment_status || 'pending',
    fulfilledAt: row.fulfilled_at ? new Date(row.fulfilled_at).toISOString() : null,
    itemsCount: row.items_count !== null ? parseInt(row.items_count, 10) : 0,
    deliveryStatus: row.delivery_status || 'pending',
  }));
}

async function updatePaymentStatusByRazorpayOrderId(razorpayOrderId, paymentStatus) {
  await ensureOrdersSchema();
  await query(
    `UPDATE orders SET payment_status = $1, updated_at = NOW() WHERE razorpay_order_id = $2`,
    [paymentStatus, razorpayOrderId]
  );
}

async function updateOrderCardByRazorpayOrderId(razorpayOrderId, cardLast4, cardNetwork) {
  await ensureOrdersSchema();
  await query(
    `UPDATE orders SET card_last4 = $1, card_network = $2, updated_at = NOW() WHERE razorpay_order_id = $3`,
    [cardLast4 || null, cardNetwork || null, razorpayOrderId]
  );
}

/**
 * Get a single order by ID for a user (customer's own order)
 * Returns full order with items, subtotal, discount, total, and user name/email
 */
async function getOrderByIdForUser(userId, orderId) {
  await ensureOrdersSchema();

  const orderRes = await query(
    `
    SELECT
      o.id,
      o.order_number,
      o.status,
      o.payment_method,
      o.payment_status,
      o.currency,
      o.subtotal,
      o.discount,
      o.delivery_charges,
      o.total,
      o.delivery_address,
      o.created_at,
      o.delivery_date,
      o.package_prepared_at,
      o.out_for_delivery_at,
      o.delivered_at,
      o.fulfilled_at,
      o.card_last4,
      o.card_network,
      u.name AS user_name,
      u.email AS user_email
    FROM orders o
    LEFT JOIN users u ON u.id = o.user_id
    WHERE o.id = $1 AND o.user_id = $2
    `,
    [orderId, userId]
  );

  if (orderRes.rows.length === 0) return null;
  const r = orderRes.rows[0];

  const itemRes = await query(
    `
    SELECT
      oi.product_name,
      oi.variation_size,
      oi.variation_id,
      oi.quantity,
      oi.unit_price,
      oi.line_total,
      oi.product_id,
      p.image_url
    FROM order_items oi
    LEFT JOIN products p ON p.id = oi.product_id
    WHERE oi.order_id = $1
    ORDER BY oi.created_at
    `,
    [orderId]
  );

  const items = itemRes.rows.map((row) => ({
    productName: row.product_name || 'Product',
    variationSize: row.variation_size || null,
    variationId: row.variation_id != null ? row.variation_id : null,
    quantity: row.quantity != null ? parseInt(row.quantity, 10) : 1,
    unitPrice: row.unit_price != null ? parseFloat(row.unit_price) : 0,
    lineTotal: row.line_total != null ? parseFloat(row.line_total) : 0,
    productId: row.product_id,
    imageUrl: row.image_url || null,
  }));

  const fbRes = await query(
    `SELECT rating, quality_stars, delivery_agent_stars, on_time_stars, value_for_money_stars, would_order_again FROM order_feedback WHERE order_id = $1`,
    [orderId]
  );
  const feedbackSubmitted = fbRes.rows.length > 0;
  const feedbackRating = fbRes.rows[0]?.rating || null;
  const fr = fbRes.rows[0];
  const qualityStars = fr?.quality_stars != null ? parseInt(fr.quality_stars, 10) : null;
  const deliveryAgentStars = fr?.delivery_agent_stars != null ? parseInt(fr.delivery_agent_stars, 10) : null;
  const onTimeStars = fr?.on_time_stars != null ? parseInt(fr.on_time_stars, 10) : null;
  const valueForMoneyStars = fr?.value_for_money_stars != null ? parseInt(fr.value_for_money_stars, 10) : null;
  const wouldOrderAgain = fr?.would_order_again || null;

  return {
    id: r.id,
    orderNumber: r.order_number,
    status: r.status,
    paymentMethod: r.payment_method,
    paymentStatus: r.payment_status,
    currency: r.currency || 'INR',
    subtotal: r.subtotal != null ? parseFloat(r.subtotal) : 0,
    discount: r.discount != null ? parseFloat(r.discount) : 0,
    deliveryCharges: r.delivery_charges != null ? parseFloat(r.delivery_charges) : 0,
    total: r.total != null ? parseFloat(r.total) : 0,
    deliveryAddress: r.delivery_address,
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : null,
    deliveryDate: r.delivery_date ? new Date(r.delivery_date).toISOString().slice(0, 10) : null,
    packagePreparedAt: r.package_prepared_at ? new Date(r.package_prepared_at).toISOString() : null,
    outForDeliveryAt: r.out_for_delivery_at ? new Date(r.out_for_delivery_at).toISOString() : null,
    deliveredAt: r.delivered_at ? new Date(r.delivered_at).toISOString() : null,
    fulfilledAt: r.fulfilled_at ? new Date(r.fulfilled_at).toISOString() : null,
    cardLast4: r.card_last4 || null,
    cardNetwork: r.card_network || null,
    customer: {
      name: r.user_name || '',
      email: r.user_email || '',
    },
    items,
    feedbackSubmitted,
    feedbackRating,
    qualityStars,
    deliveryAgentStars,
    onTimeStars,
    valueForMoneyStars,
    wouldOrderAgain,
  };
}

/**
 * Submit order feedback (emoji: least, neutral, most). One per order. Order must be delivered and belong to user.
 */
async function submitOrderFeedback(orderId, userId, rating) {
  await ensureOrdersSchema();
  const valid = ['least', 'neutral', 'most'].includes(rating);
  if (!valid) throw new Error('Invalid rating');

  const orderCheck = await query(
    `SELECT id, status FROM orders WHERE id = $1 AND user_id = $2`,
    [orderId, userId]
  );
  if (orderCheck.rows.length === 0) throw new Error('Order not found');
  if (orderCheck.rows[0].status !== 'delivered') throw new Error('Feedback only allowed for delivered orders');

  await query(
    `INSERT INTO order_feedback (order_id, user_id, rating) VALUES ($1, $2, $3)
     ON CONFLICT (order_id) DO NOTHING`,
    [orderId, userId, rating]
  );
}

/**
 * Submit detailed order feedback (How was it? popup): quality stars → product reviews for each item;
 * delivery_agent_stars, on_time_stars, value_for_money_stars, would_order_again → order_feedback.
 * Order must be delivered and belong to user.
 */
async function submitDetailedFeedback(orderId, userId, data) {
  await ensureOrdersSchema();
  const { qualityStars, deliveryAgentStars, onTimeStars, valueForMoneyStars, wouldOrderAgain } = data;

  const q = (v) => (v != null && Number.isFinite(Number(v)) && (v = parseInt(String(v), 10)) >= 1 && v <= 5) ? v : null;
  const qs = q(qualityStars);
  const das = q(deliveryAgentStars);
  const ots = q(onTimeStars);
  const vfms = q(valueForMoneyStars);
  const woa = String(wouldOrderAgain || '').trim();
  if (!['Yes', 'Maybe', 'No'].includes(woa)) throw new Error('wouldOrderAgain must be Yes, Maybe, or No');
  if (!qs || !das || !ots || !vfms) throw new Error('qualityStars, deliveryAgentStars, onTimeStars, valueForMoneyStars must be 1–5');

  const order = await getOrderByIdForUser(userId, orderId);
  if (!order) throw new Error('Order not found');
  if (order.status !== 'delivered') throw new Error('Feedback only for delivered orders');

  const existing = await query(`SELECT quality_stars FROM order_feedback WHERE order_id = $1`, [orderId]);
  if (existing.rows.length > 0 && existing.rows[0].quality_stars != null) {
    throw new Error('You have already submitted this feedback');
  }

  const reviewerName = order.customer?.name || 'Customer';
  const productIds = [...new Set((order.items || []).map((it) => it.productId).filter((id) => id != null))];

  for (const productId of productIds) {
    await productReviewModel.createProductReview(productId, {
      userId,
      reviewerName,
      rating: qs,
      comment: null,
      isApproved: true,
    });
  }

  await query(
    `INSERT INTO order_feedback (order_id, user_id, quality_stars, delivery_agent_stars, on_time_stars, value_for_money_stars, would_order_again)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (order_id) DO UPDATE SET
       quality_stars = EXCLUDED.quality_stars,
       delivery_agent_stars = EXCLUDED.delivery_agent_stars,
       on_time_stars = EXCLUDED.on_time_stars,
       value_for_money_stars = EXCLUDED.value_for_money_stars,
       would_order_again = EXCLUDED.would_order_again`,
    [orderId, userId, qs, das, ots, vfms, woa]
  );

  return { qualityStars: qs };
}

/**
 * Get feedback stats for admin: emoji counts + detailed (delivery agent, on time, value for money, would order again).
 */
async function getFeedbackStats() {
  await ensureOrdersSchema();
  const res = await query(
    `SELECT rating, COUNT(*)::int AS c FROM order_feedback WHERE rating IS NOT NULL GROUP BY rating`
  );
  const counts = { least: 0, neutral: 0, most: 0 };
  for (const row of res.rows) {
    if (counts[row.rating] !== undefined) counts[row.rating] = row.c;
  }
  const total = counts.least + counts.neutral + counts.most;

  const fillStarDist = async (col) => {
    const r = await query(
      `SELECT ${col} AS v, COUNT(*)::int AS c FROM order_feedback WHERE ${col} IS NOT NULL AND ${col} BETWEEN 1 AND 5 GROUP BY ${col}`
    );
    const d = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const row of r.rows) {
      const v = parseInt(row.v, 10);
      if (v >= 1 && v <= 5) d[v] = row.c;
    }
    return d;
  };

  const [deliveryAgentStars, onTimeStars, valueForMoneyStars] = await Promise.all([
    fillStarDist('delivery_agent_stars'),
    fillStarDist('on_time_stars'),
    fillStarDist('value_for_money_stars'),
  ]);

  const woaRes = await query(
    `SELECT would_order_again AS v, COUNT(*)::int AS c FROM order_feedback WHERE would_order_again IN ('Yes','Maybe','No') GROUP BY would_order_again`
  );
  const wouldOrderAgain = { Yes: 0, Maybe: 0, No: 0 };
  for (const row of woaRes.rows) {
    if (wouldOrderAgain[row.v] !== undefined) wouldOrderAgain[row.v] = row.c;
  }

  return {
    least: counts.least,
    neutral: counts.neutral,
    most: counts.most,
    total,
    leastPct: total ? Math.round((counts.least / total) * 1000) / 10 : 0,
    neutralPct: total ? Math.round((counts.neutral / total) * 1000) / 10 : 0,
    mostPct: total ? Math.round((counts.most / total) * 1000) / 10 : 0,
    deliveryAgentStars,
    onTimeStars,
    valueForMoneyStars,
    wouldOrderAgain,
  };
}

/**
 * Get order by ID for admin (includes all details)
 */
async function getOrderByIdForAdmin(orderId) {
  await ensureOrdersSchema();

  const orderRes = await query(
    `
    SELECT
      o.*,
      u.name AS user_name,
      u.email AS user_email
    FROM orders o
    LEFT JOIN users u ON u.id = o.user_id
    WHERE o.id = $1
    `,
    [orderId]
  );

  if (orderRes.rows.length === 0) return null;
  const r = orderRes.rows[0];

  const itemRes = await query(
    `
    SELECT
      oi.product_name,
      oi.variation_size,
      oi.quantity,
      oi.unit_price,
      oi.line_total,
      oi.product_id,
      p.image_url
    FROM order_items oi
    LEFT JOIN products p ON p.id = oi.product_id
    WHERE oi.order_id = $1
    ORDER BY oi.created_at
    `,
    [orderId]
  );

  const items = itemRes.rows.map((row) => ({
    productName: row.product_name || 'Product',
    variationSize: row.variation_size || null,
    quantity: row.quantity != null ? parseInt(row.quantity, 10) : 1,
    unitPrice: row.unit_price != null ? parseFloat(row.unit_price) : 0,
    lineTotal: row.line_total != null ? parseFloat(row.line_total) : 0,
    productId: row.product_id,
    imageUrl: row.image_url || null,
  }));

  return {
    id: r.id,
    orderNumber: r.order_number,
    status: r.status,
    paymentMethod: r.payment_method,
    paymentStatus: r.payment_status,
    currency: r.currency || 'INR',
    subtotal: r.subtotal != null ? parseFloat(r.subtotal) : 0,
    discount: r.discount != null ? parseFloat(r.discount) : 0,
    deliveryCharges: r.delivery_charges != null ? parseFloat(r.delivery_charges) : 0,
    total: r.total != null ? parseFloat(r.total) : 0,
    deliveryAddress: r.delivery_address,
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : null,
    deliveryDate: r.delivery_date ? new Date(r.delivery_date).toISOString().slice(0, 10) : null,
    packagePreparedAt: r.package_prepared_at ? new Date(r.package_prepared_at).toISOString() : null,
    outForDeliveryAt: r.out_for_delivery_at ? new Date(r.out_for_delivery_at).toISOString() : null,
    deliveredAt: r.delivered_at ? new Date(r.delivered_at).toISOString() : null,
    fulfilledAt: r.fulfilled_at ? new Date(r.fulfilled_at).toISOString() : null,
    customer: {
      name: r.user_name || '',
      email: r.user_email || '',
    },
    items,
  };
}

/**
 * Mark order as package prepared
 */
async function markAsPackagePrepared(orderId) {
  await ensureOrdersSchema();

  const result = await query(
    `
    UPDATE orders
    SET status = 'package_prepared', package_prepared_at = NOW(), updated_at = NOW()
    WHERE id = $1 AND status = 'placed'
    RETURNING *
    `,
    [orderId]
  );

  if (result.rows.length === 0) {
    throw new Error('Order not found or already processed');
  }

  return result.rows[0];
}

/**
 * Mark order as out for delivery
 */
async function markAsOutForDelivery(orderId) {
  await ensureOrdersSchema();

  const result = await query(
    `
    UPDATE orders
    SET status = 'out_for_delivery', out_for_delivery_at = NOW(), updated_at = NOW()
    WHERE id = $1 AND status = 'package_prepared'
    RETURNING *
    `,
    [orderId]
  );

  if (result.rows.length === 0) {
    throw new Error('Order not found or not in package_prepared state');
  }

  return result.rows[0];
}

/**
 * Mark order as delivered
 */
async function markAsDelivered(orderId) {
  await ensureOrdersSchema();

  const result = await query(
    `
    UPDATE orders
    SET status = 'delivered', delivered_at = NOW(), delivery_date = CURRENT_DATE, updated_at = NOW()
    WHERE id = $1 AND status = 'out_for_delivery'
    RETURNING *
    `,
    [orderId]
  );

  if (result.rows.length === 0) {
    throw new Error('Order not found or not in out_for_delivery state');
  }

  return result.rows[0];
}

/**
 * Mark order as fulfilled (COD collection / finalization)
 * - For COD orders: sets payment_status = 'paid'
 * - For all orders: sets fulfilled_at (only once)
 */
async function markAsFulfilled(orderId) {
  await ensureOrdersSchema();

  // Set fulfilled_at once
  const res1 = await query(
    `
    UPDATE orders
    SET fulfilled_at = COALESCE(fulfilled_at, NOW()), updated_at = NOW()
    WHERE id = $1 AND status IN ('out_for_delivery', 'delivered')
    RETURNING payment_method, payment_status, fulfilled_at
    `,
    [orderId]
  );

  if (res1.rows.length === 0) {
    throw new Error('Order not found or not ready to be fulfilled');
  }

  const { payment_method: pm } = res1.rows[0];

  if (pm === 'cod') {
    await query(
      `
      UPDATE orders
      SET payment_status = 'paid', updated_at = NOW()
      WHERE id = $1
      `,
      [orderId]
    );
  }

  return true;
}

/**
 * List order-deliveries for admin deliveries section
 * (orders that have reached package prepared or beyond)
 */
async function listOrderDeliveriesAdmin() {
  await ensureOrdersSchema();

  const res = await query(
    `
    SELECT
      o.id AS order_id,
      o.order_number,
      o.status,
      o.created_at AS ordered_at,
      o.payment_method,
      o.payment_status,
      o.total AS amount,
      o.currency,
      o.package_prepared_at,
      o.out_for_delivery_at,
      o.delivered_at,
      o.fulfilled_at,
      u.name AS user_name,
      u.email AS user_email,
      (
        SELECT COUNT(*)
        FROM order_items oi
        WHERE oi.order_id = o.id
      ) AS items_count
    FROM orders o
    LEFT JOIN users u ON u.id = o.user_id
    WHERE o.status IN ('package_prepared', 'out_for_delivery', 'delivered')
    ORDER BY COALESCE(o.out_for_delivery_at, o.package_prepared_at, o.created_at) DESC
    `
  );

  return res.rows.map((row) => ({
    orderId: String(row.order_id),
    orderNumber: String(row.order_number),
    status: row.status,
    orderedAt: row.ordered_at ? new Date(row.ordered_at).toISOString() : null,
    paymentMethod: row.payment_method,
    paymentStatus: row.payment_status,
    amount: row.amount !== null ? parseFloat(row.amount) : null,
    currency: row.currency || 'INR',
    itemsCount: row.items_count !== null ? parseInt(row.items_count, 10) : 0,
    packagePreparedAt: row.package_prepared_at ? new Date(row.package_prepared_at).toISOString() : null,
    outForDeliveryAt: row.out_for_delivery_at ? new Date(row.out_for_delivery_at).toISOString() : null,
    deliveredAt: row.delivered_at ? new Date(row.delivered_at).toISOString() : null,
    fulfilledAt: row.fulfilled_at ? new Date(row.fulfilled_at).toISOString() : null,
    customerName: row.user_name || null,
    customerEmail: row.user_email || null,
  }));
}

module.exports = {
  ensureOrdersSchema,
  createOrder,
  listOrdersForUser,
  listAllOrdersAdmin,
  updatePaymentStatusByRazorpayOrderId,
  updateOrderCardByRazorpayOrderId,
  getOrderByIdForUser,
  getOrderByIdForAdmin,
  markAsPackagePrepared,
  markAsOutForDelivery,
  markAsDelivered,
  markAsFulfilled,
  listOrderDeliveriesAdmin,
  submitOrderFeedback,
  submitDetailedFeedback,
  getFeedbackStats,
};
