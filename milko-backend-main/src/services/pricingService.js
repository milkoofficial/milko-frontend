const { query } = require('../config/database');
const siteContentModel = require('../models/siteContent');

function toFiniteNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function roundMoney(value) {
  return Math.max(0, Math.round(Number(value || 0) * 100) / 100);
}

function normalizeDeliveryRatesConfig(metadata) {
  const warehouseLatitude = toFiniteNumber(metadata?.warehouseLatitude);
  const warehouseLongitude = toFiniteNumber(metadata?.warehouseLongitude);
  const ranges = Array.isArray(metadata?.ranges)
    ? metadata.ranges
        .map((row) => {
          const startMeters = toFiniteNumber(row?.startMeters);
          const endMeters = toFiniteNumber(row?.endMeters);
          const rate = toFiniteNumber(row?.rate);
          if (startMeters === null || endMeters === null || rate === null) return null;
          return {
            startMeters: Math.max(0, Math.round(startMeters)),
            endMeters: Math.max(0, Math.round(endMeters)),
            rate: roundMoney(rate),
          };
        })
        .filter((row) => !!row && row.endMeters >= row.startMeters)
        .sort((a, b) => a.startMeters - b.startMeters || a.endMeters - b.endMeters)
    : [];

  return {
    warehouseLatitude: warehouseLatitude ?? undefined,
    warehouseLongitude: warehouseLongitude ?? undefined,
    ranges,
  };
}

function calculateDistanceMeters(lat1, lng1, lat2, lng2) {
  const toRadians = (deg) => (deg * Math.PI) / 180;
  const earthRadiusMeters = 6371000;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2)
    + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusMeters * c;
}

function resolveDeliveryRate(config, customerLatitude, customerLongitude) {
  if (
    !Number.isFinite(config.warehouseLatitude)
    || !Number.isFinite(config.warehouseLongitude)
    || !Number.isFinite(customerLatitude)
    || !Number.isFinite(customerLongitude)
  ) {
    return { distanceMeters: null, charge: 0 };
  }

  const distanceMeters = Math.round(
    calculateDistanceMeters(
      Number(config.warehouseLatitude),
      Number(config.warehouseLongitude),
      Number(customerLatitude),
      Number(customerLongitude),
    ),
  );

  if (config.ranges.length === 0) {
    return { distanceMeters, charge: 0 };
  }

  const directMatch = config.ranges.find(
    (row) => distanceMeters >= row.startMeters && distanceMeters <= row.endMeters,
  );
  if (directMatch) {
    return { distanceMeters, charge: directMatch.rate };
  }

  const lastRange = config.ranges[config.ranges.length - 1];
  if (lastRange && distanceMeters > lastRange.endMeters) {
    return { distanceMeters, charge: lastRange.rate };
  }

  return { distanceMeters, charge: 0 };
}

async function getPlatformFeeAmount() {
  try {
    const data = await siteContentModel.getContentByType('platform_fee');
    const metadataAmount = toFiniteNumber(data?.metadata?.amount);
    const titleAmount = toFiniteNumber(data?.title);
    const amount = metadataAmount !== null ? metadataAmount : titleAmount;
    return amount !== null && amount > 0 ? roundMoney(amount) : 0;
  } catch {
    return 0;
  }
}

async function getDeliveryRatesConfig() {
  try {
    const data = await siteContentModel.getContentByType('delivery_rates');
    return normalizeDeliveryRatesConfig(data?.metadata || {});
  } catch {
    return { ranges: [] };
  }
}

function extractAddressCoordinates(deliveryAddress) {
  return {
    latitude: toFiniteNumber(deliveryAddress?.latitude),
    longitude: toFiniteNumber(deliveryAddress?.longitude),
  };
}

async function isFirstProductOrder(userId) {
  if (!userId) return false;

  try {
    const res = await query(
      `
      SELECT COUNT(*)::int AS c
      FROM orders
      WHERE user_id = $1
        AND payment_status IN ('paid', 'cod')
      `,
      [userId],
    );
    return Number(res.rows?.[0]?.c || 0) === 0;
  } catch {
    return false;
  }
}

async function calculateCheckoutFees({ userId, itemsCount, deliveryAddress }) {
  const [platformFee, deliveryRatesConfig, firstOrder] = await Promise.all([
    getPlatformFeeAmount(),
    getDeliveryRatesConfig(),
    itemsCount > 0 ? isFirstProductOrder(userId) : Promise.resolve(false),
  ]);

  const { latitude, longitude } = extractAddressCoordinates(deliveryAddress);
  const deliveryRate = resolveDeliveryRate(deliveryRatesConfig, latitude, longitude);
  const deliveryCharges = itemsCount > 0 && firstOrder ? 0 : roundMoney(deliveryRate.charge);

  return {
    platformFee,
    deliveryCharges,
    isFirstProductOrder: firstOrder,
    deliveryDistanceMeters: deliveryRate.distanceMeters,
  };
}

module.exports = {
  calculateCheckoutFees,
  getPlatformFeeAmount,
  roundMoney,
};
