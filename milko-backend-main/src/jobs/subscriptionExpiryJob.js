const { query } = require('../config/database');
const subscriptionModel = require('../models/subscription');

/** Run at least once per hour; cheap UPDATE with indexed columns. */
const INTERVAL_MS = 60 * 60 * 1000;

/**
 * Expire subscriptions whose period has ended and no Razorpay AutoPay mandate is linked.
 * AutoPay rows (razorpay_subscription_id like 'sub_%') are skipped — renewal/charge handles those.
 * Uses Asia/Kolkata calendar date for "today".
 */
async function expireSubscriptionsWithoutAutopay() {
  await subscriptionModel.ensureSubscriptionSchema();
  const result = await query(
    `
    UPDATE subscriptions
    SET status = 'expired', updated_at = NOW()
    WHERE status IN ('active', 'paused')
    AND end_date < (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date
    AND (
      razorpay_subscription_id IS NULL
      OR razorpay_subscription_id NOT LIKE 'sub_%'
    )
    `
  );

  const n = result.rowCount || 0;
  if (n > 0) {
    console.log(
      `[subscription-expiry] Marked ${n} subscription(s) expired (past end_date, no AutoPay mandate).`
    );
  }
}

function startSubscriptionExpiryJob() {
  expireSubscriptionsWithoutAutopay().catch((e) =>
    console.error('[subscription-expiry] initial run failed:', e)
  );
  setInterval(() => {
    expireSubscriptionsWithoutAutopay().catch((e) =>
      console.error('[subscription-expiry] run failed:', e)
    );
  }, INTERVAL_MS);
}

module.exports = {
  startSubscriptionExpiryJob,
  expireSubscriptionsWithoutAutopay,
};
