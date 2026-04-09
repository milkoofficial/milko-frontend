const { query } = require('../config/database');

async function ensureDeliveriesTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS deliveries (
      id SERIAL PRIMARY KEY,
      delivery_schedule_id INTEGER NOT NULL REFERENCES delivery_schedules(id) ON DELETE CASCADE,
      user_id INTEGER,
      date DATE NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'delivered')),
      delivered_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (delivery_schedule_id, date)
    );
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_deliveries_date_status ON deliveries(date, status);`);
}

async function getDeliveriesForDate(date, slot) {
  const slotClause = slot === 'morning'
    ? `AND COALESCE(s.delivery_time, '00:00')::time < TIME '14:00'`
    : slot === 'evening'
      ? `AND COALESCE(s.delivery_time, '23:59')::time >= TIME '14:00'`
      : '';

  const result = await query(
    `
      SELECT
        ds.id,
        ds.subscription_id,
        ds.delivery_date,
        ds.status AS base_status,
        ds.delivered_at AS base_delivered_at,
        s.user_id,
        s.delivery_time,
        u.name AS user_name,
        u.email AS user_email,
        a.latitude,
        a.longitude,
        COALESCE(d.status, ds.status) AS status,
        COALESCE(d.delivered_at, ds.delivered_at) AS delivered_at
      FROM delivery_schedules ds
      JOIN subscriptions s ON s.id = ds.subscription_id
      LEFT JOIN users u ON u.id = s.user_id
      LEFT JOIN addresses a ON a.id = s.address_id
      LEFT JOIN deliveries d ON d.delivery_schedule_id = ds.id AND d.date = ds.delivery_date
      WHERE ds.delivery_date = $1
        AND s.status = 'active'
        AND a.latitude IS NOT NULL
        AND a.longitude IS NOT NULL
        ${slotClause}
      ORDER BY COALESCE(s.delivery_time, '23:59')::time, ds.id
    `,
    [date]
  );

  return result.rows.map((row) => ({
    id: row.id,
    subscriptionId: row.subscription_id,
    userId: row.user_id,
    userName: row.user_name || null,
    userEmail: row.user_email || null,
    date: row.delivery_date,
    deliveryTime: row.delivery_time || null,
    lat: Number(row.latitude),
    lng: Number(row.longitude),
    status: row.status,
    deliveredAt: row.delivered_at || null,
  }));
}

async function markDelivered({ deliveryId, date }) {
  await query(
    `
      INSERT INTO deliveries (delivery_schedule_id, user_id, date, status, delivered_at)
      SELECT ds.id, s.user_id, $2::date, 'delivered', NOW()
      FROM delivery_schedules ds
      JOIN subscriptions s ON s.id = ds.subscription_id
      WHERE ds.id = $1
      ON CONFLICT (delivery_schedule_id, date)
      DO UPDATE SET status = 'delivered', delivered_at = NOW(), updated_at = NOW()
    `,
    [deliveryId, date]
  );

  await query(
    `
      UPDATE delivery_schedules
      SET status = 'delivered',
          delivered_at = NOW(),
          updated_at = NOW()
      WHERE id = $1
    `,
    [deliveryId]
  );
}

module.exports = {
  ensureDeliveriesTable,
  getDeliveriesForDate,
  markDelivered,
};

