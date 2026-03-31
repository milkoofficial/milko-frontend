const { query, getClient } = require('../config/database');
const { transformSubscription } = require('../utils/transform');

/**
 * Subscription Model
 * Handles all database operations for subscriptions
 */

let schemaEnsured = false;

async function ensureSubscriptionSchema() {
  if (schemaEnsured) return;

  await query(`ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS total_qty NUMERIC(12, 2) NOT NULL DEFAULT 0;`);
  await query(`ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS delivered_qty NUMERIC(12, 2) NOT NULL DEFAULT 0;`);
  await query(`ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS remaining_qty NUMERIC(12, 2) NOT NULL DEFAULT 0;`);
  await query(`ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS per_unit_price NUMERIC(12, 2);`);
  await query(`ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS total_amount NUMERIC(12, 2);`);
  await query(`ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS total_amount_paid NUMERIC(12, 2) NOT NULL DEFAULT 0;`);
  await query(`ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS wallet_used NUMERIC(12, 2) NOT NULL DEFAULT 0;`);
  await query(`ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS purchased_at TIMESTAMPTZ;`);
  await query(`ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;`);
  await query(`ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS address_id INTEGER;`);

  // Ensure delivery schedule + paused dates tables exist.
  // Live deployments may run partially without executing schema.sql migrations.
  await query(`
    CREATE TABLE IF NOT EXISTS delivery_schedules (
      id SERIAL PRIMARY KEY,
      subscription_id INTEGER NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
      delivery_date DATE NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'skipped', 'cancelled')),
      delivered_at TIMESTAMPTZ,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(subscription_id, delivery_date)
    );
  `);

  await query(`CREATE INDEX IF NOT EXISTS idx_delivery_schedules_date ON delivery_schedules(delivery_date);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_delivery_schedules_subscription ON delivery_schedules(subscription_id);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_delivery_schedules_status ON delivery_schedules(status);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_delivery_schedules_date_status ON delivery_schedules(delivery_date, status);`);

  await query(`
    CREATE TABLE IF NOT EXISTS paused_dates (
      id SERIAL PRIMARY KEY,
      subscription_id INTEGER NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
      date DATE NOT NULL,
      reason TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(subscription_id, date)
    );
  `);

  await query(`CREATE INDEX IF NOT EXISTS idx_paused_dates_subscription ON paused_dates(subscription_id);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_paused_dates_date ON paused_dates(date);`);

  schemaEnsured = true;
}

/**
 * Create a new subscription
 * @param {Object} subscriptionData - Subscription data
 * @returns {Promise<Object>} Created subscription (camelCase format)
 */
const createSubscription = async (subscriptionData) => {
  await ensureSubscriptionSchema();
  const {
    userId,
    productId,
    litresPerDay,
    durationMonths,
    deliveryTime,
    startDate,
    endDate,
    razorpaySubscriptionId,
    totalQty = 0,
    deliveredQty = 0,
    remainingQty = 0,
    perUnitPrice = null,
    totalAmount = null,
    totalAmountPaid = 0,
    walletUsed = 0,
    purchasedAt = null,
  } = subscriptionData;

  const result = await query(
    `INSERT INTO subscriptions 
     (user_id, product_id, litres_per_day, duration_months, delivery_time, 
      start_date, end_date, razorpay_subscription_id, status,
      total_qty, delivered_qty, remaining_qty, per_unit_price, total_amount, total_amount_paid, wallet_used, purchased_at,
      created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', $9, $10, $11, $12, $13, $14, $15, $16, NOW(), NOW())
     RETURNING *`,
    [
      userId,
      productId,
      litresPerDay,
      durationMonths,
      deliveryTime,
      startDate,
      endDate,
      razorpaySubscriptionId,
      totalQty,
      deliveredQty,
      remainingQty,
      perUnitPrice,
      totalAmount,
      totalAmountPaid,
      walletUsed,
      purchasedAt,
    ]
  );

  // Fetch with product data for transformation
  return await getSubscriptionById(result.rows[0].id);
};

/**
 * Get all subscriptions for a user
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Array of subscriptions (camelCase format)
 */
const getSubscriptionsByUserId = async (userId) => {
  await ensureSubscriptionSchema();
  const result = await query(
    `SELECT s.*, p.name as product_name, p.description as product_description, 
            p.price_per_litre, p.image_url as product_image_url,
            a.id as address_id,
            a.name as address_name,
            a.street as address_street,
            a.city as address_city,
            a.state as address_state,
            a.postal_code as address_postal_code,
            a.country as address_country,
            a.phone as address_phone,
            a.latitude as address_latitude,
            a.longitude as address_longitude
     FROM subscriptions s
     LEFT JOIN products p ON s.product_id = p.id
     LEFT JOIN addresses a ON s.address_id = a.id
     WHERE s.user_id = $1
     ORDER BY s.created_at DESC`,
    [userId]
  );

  return result.rows.map(transformSubscription);
};

/**
 * Get all subscriptions (for admin)
 * @returns {Promise<Array>} Array of all subscriptions (camelCase format)
 */
const getAllSubscriptions = async () => {
  await ensureSubscriptionSchema();
  const result = await query(
    `SELECT s.*, p.name as product_name, p.description as product_description,
            p.price_per_litre, p.image_url as product_image_url,
            u.name as user_name, u.email as user_email
     FROM subscriptions s
     LEFT JOIN products p ON s.product_id = p.id
     LEFT JOIN users u ON s.user_id = u.id
     ORDER BY s.created_at DESC`
  );

  return result.rows.map(transformSubscription);
};

/**
 * Get subscription by ID
 * @param {string} subscriptionId - Subscription ID
 * @returns {Promise<Object|null>} Subscription object or null (camelCase format)
 */
const getSubscriptionById = async (subscriptionId) => {
  await ensureSubscriptionSchema();
  const result = await query(
    `SELECT s.*, p.name as product_name, p.description as product_description, 
            p.price_per_litre, p.image_url as product_image_url,
            a.id as address_id,
            a.name as address_name,
            a.street as address_street,
            a.city as address_city,
            a.state as address_state,
            a.postal_code as address_postal_code,
            a.country as address_country,
            a.phone as address_phone,
            a.latitude as address_latitude,
            a.longitude as address_longitude
     FROM subscriptions s
     LEFT JOIN products p ON s.product_id = p.id
     LEFT JOIN addresses a ON s.address_id = a.id
     WHERE s.id = $1`,
    [subscriptionId]
  );

  const row = result.rows[0];
  if (!row) return null;

  const sub = transformSubscription(row);

  const schedulesRes = await query(
    `SELECT delivery_date::text AS delivery_date, status
     FROM delivery_schedules
     WHERE subscription_id = $1
     ORDER BY delivery_date`,
    [subscriptionId]
  );
  const deliverySchedules = schedulesRes.rows.map((r) => ({
    deliveryDate: r.delivery_date,
    status: r.status,
  }));

  const pausedRes = await query(
    `SELECT date::text AS d FROM paused_dates WHERE subscription_id = $1`,
    [subscriptionId]
  );
  const pausedDates = pausedRes.rows.map((r) => r.d);

  return { ...sub, deliverySchedules, pausedDates };
};

/**
 * Update subscription status
 * @param {string} subscriptionId - Subscription ID
 * @param {string} status - New status
 * @returns {Promise<Object>} Updated subscription (camelCase format)
 */
const updateSubscriptionStatus = async (subscriptionId, status) => {
  await ensureSubscriptionSchema();
  const result = await query(
    `UPDATE subscriptions 
     SET status = $1, updated_at = NOW() 
     WHERE id = $2
     RETURNING *`,
    [status, subscriptionId]
  );

  // Need to fetch with product data for transformation
  return await getSubscriptionById(subscriptionId);
};

/**
 * Generate delivery schedules for a subscription
 * Creates daily delivery entries from start_date to end_date, skipping paused dates
 * @param {string} subscriptionId - Subscription ID
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Promise<Array>} Array of created delivery schedules
 */
const generateDeliverySchedules = async (subscriptionId, startDate, endDate) => {
  await ensureSubscriptionSchema();
  const client = await getClient();
  const schedules = [];
  
  try {
    await client.query('BEGIN');

    // Get paused dates for this subscription
    const pausedDatesResult = await client.query(
      'SELECT date FROM paused_dates WHERE subscription_id = $1',
      [subscriptionId]
    );
    const pausedDates = new Set(
      pausedDatesResult.rows.map(row => row.date.toISOString().split('T')[0])
    );

    // Generate dates from start to end
    const currentDate = new Date(startDate);
    const end = new Date(endDate);

    while (currentDate <= end) {
      const dateStr = currentDate.toISOString().split('T')[0];

      // Skip paused dates
      if (!pausedDates.has(dateStr)) {
        const result = await client.query(
          `INSERT INTO delivery_schedules (subscription_id, delivery_date, status, created_at)
           VALUES ($1, $2, 'pending', NOW())
           ON CONFLICT (subscription_id, delivery_date) DO NOTHING
           RETURNING *`,
          [subscriptionId, dateStr]
        );

        if (result.rows.length > 0) {
          schedules.push(result.rows[0]);
        }
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    await client.query('COMMIT');
    return schedules;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  ensureSubscriptionSchema,
  createSubscription,
  getSubscriptionsByUserId,
  getAllSubscriptions,
  getSubscriptionById,
  updateSubscriptionStatus,
  generateDeliverySchedules,
};
