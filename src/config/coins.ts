// Coin prices and packages. The store product ids must match the in-app
// products created in Google Play Console (and App Store Connect later).

export const COIN_COSTS = {
  chatUnlock: 15,
  insights: 20,
} as const;

export const INSIGHTS_DAYS = 30;

export type CoinPackage = {
  id: string;
  productId: string;
  coins: number;
  // Shown only as a fallback; the app displays the store's localized price.
  priceUsd: number;
  best?: boolean;
  // Web purchases through Paystack, in the currency's minor unit (kobo for NGN).
  paystackAmount: number;
  paystackCurrency: string;
};

// Paystack prices. Override one with PAYSTACK_PRICE_COINS_100=750000 (minor units).
export const PAYSTACK_CURRENCY = process.env.PAYSTACK_CURRENCY || 'NGN';

const paystackPrice = (productId: string, fallback: number): number =>
  Number(process.env[`PAYSTACK_PRICE_${productId.toUpperCase()}`] ?? fallback);

export const COIN_PACKAGES: CoinPackage[] = [
  {
    id: 'coins_100',
    productId: 'coins_100',
    coins: 100,
    priceUsd: 4.99,
    paystackAmount: paystackPrice('coins_100', 750_000),
    paystackCurrency: PAYSTACK_CURRENCY,
  },
  {
    id: 'coins_500',
    productId: 'coins_500',
    coins: 500,
    priceUsd: 19.99,
    best: true,
    paystackAmount: paystackPrice('coins_500', 3_000_000),
    paystackCurrency: PAYSTACK_CURRENCY,
  },
  {
    id: 'coins_1000',
    productId: 'coins_1000',
    coins: 1000,
    priceUsd: 34.99,
    paystackAmount: paystackPrice('coins_1000', 5_200_000),
    paystackCurrency: PAYSTACK_CURRENCY,
  },
  {
    id: 'coins_5000',
    productId: 'coins_5000',
    coins: 5000,
    priceUsd: 99.99,
    paystackAmount: paystackPrice('coins_5000', 15_000_000),
    paystackCurrency: PAYSTACK_CURRENCY,
  },
];

export const findPackageByProductId = (productId: string): CoinPackage | undefined =>
  COIN_PACKAGES.find((pkg) => pkg.productId === productId);

// Set ENFORCE_CHAT_UNLOCK=false to let any match chat for free, which keeps the
// old Expo app working while it is still in use.
export const isChatUnlockEnforced = (): boolean => process.env.ENFORCE_CHAT_UNLOCK !== 'false';

// Coins given to brand-new accounts so the paid features can be tried.
export const SIGNUP_BONUS_COINS = Number(process.env.SIGNUP_BONUS_COINS ?? 500);

// refId on bonus transactions, so the app can tell a welcome gift from a later one.
export const SIGNUP_BONUS_REF = 'signup';
