const { query, getClient } = require('../config/database');
const { transformSubscription } = require('../utils/transform');

/**
 * Subscription Model
 * Handles all database operations for subscriptions
 */

function subscriptionInputToYmd(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'string') {
    const s = value.trim().slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
  }
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}-${String(value.getUTCDate()).padStart(2, '0')}`;
  }
  const s = String(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

function pgDateRowToYmd(v) {
  if (v == null || v === undefined) return '';
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return '';
    return `${v.getUTCFullYear()}-${String(v.getUTCMonth() + 1).padStart(2, '0')}-${String(v.getUTCDate()).padStart(2, '0')}`;
  }
  const s = String(v).trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
}

function addOneCalendarDayYmd(ymd) {
  const [y, m, d] = ymd.split('-').map((x) => parseInt(x, 10));
  const ms = Date.UTC(y, m - 1, d) + 86400000;
  const u = new Date(ms);
  return `${u.getUTCFullYear()}-${String(u.getUTCMonth() + 1).padStart(2, '0')}-${String(u.getUTCDate()).padStart(2, '0')}`;
}

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
  await query(`ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS renewed_at TIMESTAMPTZ;`);
  await query(`ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS initial_start_date DATE;`);
  await query(`ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS renewal_order_id VARCHAR(255);`);
  await query(`ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS autopay_failure_reason TEXT;`);
  await query(`ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS address_id INTEGER;`);
  await query(`ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS checkout_order_id UUID;`);
  await query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_checkout_order_id ON subscriptions(checkout_order_id) WHERE checkout_order_id IS NOT NULL;`);
  await query(`ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS duration_days INTEGER;`);
  await query(`ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS first_day_shift_applied BOOLEAN NOT NULL DEFAULT FALSE;`);
  await query(`ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS first_day_shift_reason VARCHAR(64);`);

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
 * Creates daily delivery entries from start_date to end_date (inclusive), skipping paused dates.
 * Uses calendar YYYY-MM-DD stepping only — avoids mixing `new Date("YYYY-MM-DD")` (UTC) with local setDate (off-by-one).
 *
 * @param {object} [options]
 * @param {string|null} [options.skipShiftedFirstDayYmd] — When slot-shift applied (missed first slot, bonus day at end),
 *   omit the first calendar day (start_date) from admin deliveries; the extended end date still gets a row.
 */
const generateDeliverySchedules = async (subscriptionId, startDate, endDate, options = {}) => {
  await ensureSubscriptionSchema();
  const client = await getClient();
  const schedules = [];

  const startYmd = subscriptionInputToYmd(startDate);
  const endYmd = subscriptionInputToYmd(endDate);
  if (!startYmd || !endYmd) {
    throw new Error('generateDeliverySchedules: invalid start or end date');
  }

  const skipShiftedFirstDayYmd =
    typeof options.skipShiftedFirstDayYmd === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(options.skipShiftedFirstDayYmd) &&
    options.skipShiftedFirstDayYmd === startYmd
      ? options.skipShiftedFirstDayYmd
      : null;

  try {
    await client.query('BEGIN');

    const pausedDatesResult = await client.query(
      'SELECT date FROM paused_dates WHERE subscription_id = $1',
      [subscriptionId]
    );
    const pausedDates = new Set(
      pausedDatesResult.rows.map((row) => pgDateRowToYmd(row.date)).filter(Boolean)
    );

    let cur = startYmd;
    while (cur.localeCompare(endYmd) <= 0) {
      if (skipShiftedFirstDayYmd && cur === skipShiftedFirstDayYmd) {
        cur = addOneCalendarDayYmd(cur);
        continue;
      }
      if (!pausedDates.has(cur)) {
        const result = await client.query(
          `INSERT INTO delivery_schedules (subscription_id, delivery_date, status, created_at)
           VALUES ($1, $2, 'pending', NOW())
           ON CONFLICT (subscription_id, delivery_date) DO NOTHING
           RETURNING *`,
          [subscriptionId, cur]
        );

        if (result.rows.length > 0) {
          schedules.push(result.rows[0]);
        }
      }

      cur = addOneCalendarDayYmd(cur);
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
