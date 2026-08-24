import {
  resolveStripeProvider,
  stripeProviderReady,
} from '../providers/stripeProduction.mjs';

const CODE_PATTERN = /^[A-Z0-9-]{3,32}$/;
const PROMOTION_ID_PATTERN = /^promo_[A-Za-z0-9_-]+$/;
const FIVE_YEARS_MS = 5 * 365 * 24 * 60 * 60 * 1000;

function normaliseCouponReference(promotion, couponsById) {
  const embedded = promotion?.coupon;
  if (embedded && typeof embedded === 'object') return embedded;
  const reference = promotion?.promotion?.coupon;
  if (reference && typeof reference === 'object') return reference;
  const couponId = typeof reference === 'string'
    ? reference
    : typeof embedded === 'string'
      ? embedded
      : null;
  return couponId ? couponsById.get(couponId) || { id: couponId } : {};
}

function presentPromotion(promotion, couponsById) {
  const coupon = normaliseCouponReference(promotion, couponsById);
  return {
    id: promotion.id,
    code: promotion.code,
    active: Boolean(promotion.active),
    created: promotion.created ?? null,
    expires_at: promotion.expires_at ?? null,
    max_redemptions: promotion.max_redemptions ?? null,
    times_redeemed: promotion.times_redeemed || 0,
    restrictions: {
      first_time_transaction: Boolean(promotion.restrictions?.first_time_transaction),
      minimum_amount: promotion.restrictions?.minimum_amount ?? null,
      minimum_amount_currency: promotion.restrictions?.minimum_amount_currency ?? null,
    },
    metadata: promotion.metadata || {},
    coupon: {
      id: coupon.id || null,
      name: coupon.name || null,
      duration: coupon.duration || 'once',
      percent_off: coupon.percent_off ?? null,
      amount_off: coupon.amount_off ?? null,
      currency: coupon.currency || null,
      valid: coupon.valid !== false,
    },
  };
}

function requirePositiveInteger(value, field, max = 100000) {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > max) {
    throw new Error(`${field} must be a whole number between 1 and ${max}.`);
  }
  return parsed;
}

function dollarsToCents(value, field) {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 10000) {
    throw new Error(`${field} must be between $0.01 and $10,000.00.`);
  }
  return Math.round(parsed * 100);
}

function parseExpiry(value) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  const now = Date.now();
  if (!Number.isFinite(timestamp) || timestamp <= now + 60_000) {
    throw new Error('Expiry must be a valid future date and time.');
  }
  if (timestamp > now + FIVE_YEARS_MS) {
    throw new Error('Expiry cannot be more than five years away.');
  }
  return Math.floor(timestamp / 1000);
}

function validateCreate(body) {
  const code = String(body?.code || '').trim().toUpperCase();
  if (!CODE_PATTERN.test(code)) {
    throw new Error('Code must be 3–32 characters using letters, numbers, or hyphens.');
  }
  const name = String(body?.name || code).trim();
  if (!name || name.length > 40) throw new Error('Campaign name must be 1–40 characters.');
  const discountType = body?.discount_type;
  if (!['percent', 'amount'].includes(discountType)) {
    throw new Error('Discount type must be percentage or fixed amount.');
  }
  const duration = body?.duration;
  if (!['once', 'forever'].includes(duration)) {
    throw new Error('Duration must be first payment or every payment.');
  }

  let percentOff = null;
  let amountOff = null;
  if (discountType === 'percent') {
    percentOff = Number(body?.discount_value);
    if (!Number.isFinite(percentOff) || percentOff <= 0 || percentOff > 100) {
      throw new Error('Percentage discount must be greater than 0 and no more than 100.');
    }
    percentOff = Math.round(percentOff * 100) / 100;
  } else {
    amountOff = dollarsToCents(body?.discount_value, 'Fixed discount');
  }

  const internalNote = String(body?.internal_note || '').trim();
  if (internalNote.length > 500) throw new Error('Internal note must be 500 characters or fewer.');

  return {
    code,
    name,
    duration,
    percentOff,
    amountOff,
    currency: 'aud',
    maxRedemptions: requirePositiveInteger(body?.max_redemptions, 'Redemption limit'),
    expiresAt: parseExpiry(body?.expires_at),
    firstTimeOnly: Boolean(body?.first_time_only),
    minimumAmount: dollarsToCents(body?.minimum_amount, 'Minimum spend'),
    internalNote,
  };
}

export default async function managePromotions(ctx) {
  const { body, user, respond } = ctx;
  if (!user) return respond(401, { error: 'authentication required' });
  if (user.role !== 'admin') return respond(403, { error: 'admin access required' });
  let provider;
  try {
    provider = resolveStripeProvider(ctx.stripeProvider, process.env);
  } catch (error) {
    return respond(500, { error: error.message, code: 'stripe_provider_invalid' });
  }
  if (!stripeProviderReady(provider, process.env)) {
    return respond(503, { error: 'Promotion management is unavailable while payments are disabled.' });
  }

  const providerMode = provider.providerId || 'stripe';
  const action = body?.action;

  try {
    if (action === 'list') {
      const result = await provider.listPromotionCodes();
      const couponsById = new Map(result.coupons.map((coupon) => [coupon.id, coupon]));
      const promotions = result.promotionCodes
        .map((promotion) => presentPromotion(promotion, couponsById))
        .sort((a, b) => (b.created || 0) - (a.created || 0));
      return respond(200, { promotions, has_more: result.hasMore, mode: providerMode });
    }

    if (action === 'create') {
      const input = validateCreate(body);
      const metadata = {
        assesssuite_created_by_user_id: String(user.id || '').slice(0, 200),
        assesssuite_created_by_email: String(user.email || '').slice(0, 200),
        assesssuite_internal_note: input.internalNote,
      };
      let coupon = null;
      try {
        coupon = await provider.createCoupon({ ...input, metadata });
        const promotion = await provider.createPromotionCode({ couponId: coupon.id, ...input, metadata });
        return respond(201, {
          promotion: presentPromotion(promotion, new Map([[coupon.id, coupon]])),
          mode: providerMode,
        });
      } catch (error) {
        if (coupon?.id) {
          try {
            await provider.deleteCoupon(coupon.id);
          } catch {
            // Preserve the original failure. Stripe's dashboard can reconcile
            // an unlikely orphan coupon using the attached creator metadata.
          }
        }
        throw error;
      }
    }

    if (action === 'deactivate') {
      const id = String(body?.promotion_id || '').trim();
      const promotionIdPattern = provider.promotionIdPattern || PROMOTION_ID_PATTERN;
      if (!promotionIdPattern.test(id)) throw new Error('A valid promotion code id is required.');
      const promotion = await provider.deactivatePromotionCode(id);
      return respond(200, { promotion: presentPromotion(promotion, new Map()), mode: providerMode });
    }

    return respond(400, { error: 'Action must be list, create, or deactivate.' });
  } catch (error) {
    const isStripeFailure = typeof provider.errorClass === 'function'
      && error instanceof provider.errorClass;
    const status = isStripeFailure
      ? (error.status >= 400 && error.status < 500 ? error.status : 502)
      : 400;
    return respond(status, { error: error.message || 'Promotion action failed.' });
  }
}
