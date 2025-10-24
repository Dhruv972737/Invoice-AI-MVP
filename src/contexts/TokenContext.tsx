// ============================================
// TOKEN MANAGEMENT & PAYMENT SYSTEM
// Complete billing and subscription management
// ============================================

import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { CreditCard, Zap, Crown, Building, Check, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// ============================================
// TYPES
// ============================================

export interface TokenData {
  dailyFreeTokens: number;
  dailyFreeTokensUsed: number;
  purchasedTokens: number;
  purchasedTokensUsed: number;
  totalLifetimeTokensUsed: number;
  lastDailyReset: string;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  displayName: string;
  description: string;
  dailyTokenQuota: number;
  priceMonthly: number;
  priceYearly: number;
  features: string[];
  isActive: boolean;
}

// ============================================
// TOKEN CONTEXT
// ============================================

interface TokenContextType {
  tokenData: TokenData | null;
  subscriptionPlan: SubscriptionPlan | null;
  loading: boolean;
  refreshTokenData: () => Promise<void>;
  consumeTokens: (amount: number, operation: string) => Promise<boolean>;
  getRemainingTokens: () => number;
  getTokenUsagePercentage: () => number;
}

const TokenContext = createContext<TokenContextType | undefined>(undefined);

export function TokenProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [tokenData, setTokenData] = useState<TokenData | null>(null);
  const [subscriptionPlan, setSubscriptionPlan] = useState<SubscriptionPlan | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshTokenData = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      // Get token data
      const { data: tokens, error: tokenError } = await supabase
        .from('user_tokens')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (tokenError || !tokens) {
        console.error('Token data error:', tokenError);
        setLoading(false);
        return;
      }

      setTokenData({
        dailyFreeTokens: tokens.daily_free_tokens,
        dailyFreeTokensUsed: tokens.daily_free_tokens_used,
        purchasedTokens: tokens.purchased_tokens,
        purchasedTokensUsed: tokens.purchased_tokens_used,
        totalLifetimeTokensUsed: tokens.total_lifetime_tokens_used,
        lastDailyReset: tokens.last_daily_reset
      });

      // Get subscription plan
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('subscription_plan')
        .eq('id', user.id)
        .single();

      if (profileError || !profile) {
        console.error('Profile error:', profileError);
        setLoading(false);
        return;
      }

      const { data: plan, error: planError } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('name', profile.subscription_plan)
        .single();

      if (planError || !plan) {
        console.error('Subscription plan error:', planError);
        setLoading(false);
        return;
      }

      setSubscriptionPlan({
        id: plan.id,
        name: plan.name,
        displayName: plan.display_name,
        description: plan.description,
        dailyTokenQuota: plan.daily_token_quota,
        priceMonthly: plan.price_monthly,
        priceYearly: plan.price_yearly,
        features: plan.features,
        isActive: plan.is_active
      });
    } catch (error) {
      console.error('Error refreshing token data:', error);
    } finally {
      setLoading(false);
    }
  };

  const consumeTokens = async (amount: number, operation: string): Promise<boolean> => {
    if (!user || !tokenData) return false;

    try {
      const { data, error } = await supabase.rpc('consume_tokens', {
        p_user_id: user.id,
        p_tokens_to_consume: amount,
        p_agent_name: 'system',
        p_operation_type: operation
      });

      if (error) throw error;

      if (data.success) {
        await refreshTokenData();
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error consuming tokens:', error);
      return false;
    }
  };

  const getRemainingTokens = (): number => {
    if (!tokenData) return 0;
    const dailyRemaining = tokenData.dailyFreeTokens - tokenData.dailyFreeTokensUsed;
    const purchasedRemaining = tokenData.purchasedTokens - tokenData.purchasedTokensUsed;
    return dailyRemaining + purchasedRemaining;
  };

  const getTokenUsagePercentage = (): number => {
    if (!tokenData) return 0;
    const totalAvailable = tokenData.dailyFreeTokens + tokenData.purchasedTokens;
    const totalUsed = tokenData.dailyFreeTokensUsed + tokenData.purchasedTokensUsed;
    return totalAvailable > 0 ? (totalUsed / totalAvailable) * 100 : 0;
  };

  useEffect(() => {
    if (user) {
      refreshTokenData();
      // Refresh every 30 seconds
      const interval = setInterval(refreshTokenData, 30000);
      return () => clearInterval(interval);
    }
  }, [user]);

  return (
    <TokenContext.Provider value={{
      tokenData,
      subscriptionPlan,
      loading,
      refreshTokenData,
      consumeTokens,
      getRemainingTokens,
      getTokenUsagePercentage
    }}>
      {children}
    </TokenContext.Provider>
  );
}

export function useTokens() {
  const context = useContext(TokenContext);
  if (!context) throw new Error('useTokens must be used within TokenProvider');
  return context;
}

// ============================================
// TOKEN DISPLAY COMPONENT
// ============================================

export function TokenDisplay() {
  const { tokenData, subscriptionPlan, getRemainingTokens, getTokenUsagePercentage } = useTokens();
  const { t } = useTranslation();

  if (!tokenData || !subscriptionPlan) return null;

  const remaining = getRemainingTokens();
  const usagePercentage = getTokenUsagePercentage();
  const isLowTokens = usagePercentage > 80;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          <Zap className="w-5 h-5 text-yellow-500" />
          <span className="font-semibold text-gray-900 dark:text-white">{t('tokens.title')}</span>
        </div>
        <span className="text-2xl font-bold text-gray-900 dark:text-white">{remaining}</span>
      </div>

      <div className="space-y-2">
        {/* Daily Free Tokens */}
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-600 dark:text-gray-400">{t('tokens.dailyFree')}</span>
            <span className="text-gray-900 dark:text-white">
              {tokenData.dailyFreeTokens - tokenData.dailyFreeTokensUsed} / {tokenData.dailyFreeTokens}
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all"
              style={{ width: `${(tokenData.dailyFreeTokensUsed / tokenData.dailyFreeTokens) * 100}%` }}
            />
          </div>
        </div>

        {/* Purchased Tokens */}
        {tokenData.purchasedTokens > 0 && (
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600 dark:text-gray-400">{t('tokens.purchased')}</span>
              <span className="text-gray-900 dark:text-white">
                {tokenData.purchasedTokens - tokenData.purchasedTokensUsed} / {tokenData.purchasedTokens}
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-green-600 h-2 rounded-full transition-all"
                style={{ width: `${(tokenData.purchasedTokensUsed / tokenData.purchasedTokens) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Low Token Warning */}
        {isLowTokens && (
          <div className="flex items-center space-x-2 text-amber-600 dark:text-amber-400 text-sm mt-2">
            <AlertCircle className="w-4 h-4" />
            <span>{t('tokens.runningLow')}</span>
          </div>
        )}

        {/* Reset Timer */}
        <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
          {t('tokens.resetsDaily')}
        </div>
      </div>
    </div>
  );
}

// ============================================
// SUBSCRIPTION PLANS COMPONENT
// ============================================

export function SubscriptionPlans() {
  const { t } = useTranslation();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const { subscriptionPlan } = useTokens();

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    const { data } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('is_active', true)
      .order('daily_token_quota');

    if (data) {
      setPlans(data.map(p => ({
        id: p.id,
        name: p.name,
        displayName: p.display_name,
        description: p.description,
        dailyTokenQuota: p.daily_token_quota,
        priceMonthly: p.price_monthly,
        priceYearly: p.price_yearly,
        features: p.features,
        isActive: p.is_active
      })));
    }
  };

  const getPlanIcon = (planName: string) => {
    switch (planName) {
      case 'free': return <Zap className="w-8 h-8" />;
      case 'pro': return <CreditCard className="w-8 h-8" />;
      case 'business': return <Building className="w-8 h-8" />;
      case 'enterprise': return <Crown className="w-8 h-8" />;
      default: return <Zap className="w-8 h-8" />;
    }
  };

  const getPlanColor = (planName: string) => {
    switch (planName) {
      case 'free': return 'border-gray-300 dark:border-gray-600';
      case 'pro': return 'border-blue-500';
      case 'business': return 'border-purple-500';
      case 'enterprise': return 'border-amber-500';
      default: return 'border-gray-300';
    }
  };

  return (
    <div className="space-y-6">
      {/* Billing Toggle */}
      <div className="flex items-center justify-center space-x-4">
        <button
          onClick={() => setBillingCycle('monthly')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            billingCycle === 'monthly'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
          }`}
        >
          {t('subscription.monthly')}
        </button>
        <button
          onClick={() => setBillingCycle('yearly')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            billingCycle === 'yearly'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
          }`}
        >
          {t('subscription.yearly')} <span className="text-sm">({t('subscription.save', { percent: '17' })})</span>
        </button>
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {plans.map(plan => {
          const price = billingCycle === 'monthly' ? plan.priceMonthly : plan.priceYearly / 12;
          const isCurrentPlan = subscriptionPlan?.name === plan.name;

          return (
            <div
              key={plan.id}
              className={`bg-white dark:bg-gray-800 rounded-lg p-6 border-2 ${getPlanColor(plan.name)} ${
                isCurrentPlan ? 'ring-2 ring-blue-500' : ''
              }`}
            >
              {/* Icon */}
              <div className="mb-4 text-blue-600 dark:text-blue-400">
                {getPlanIcon(plan.name)}
              </div>

              {/* Plan Name */}
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                {plan.displayName}
              </h3>

              {/* Description */}
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                {plan.description}
              </p>

              {/* Price */}
              <div className="mb-4">
                {price > 0 ? (
                  <>
                    <span className="text-3xl font-bold text-gray-900 dark:text-white">
                      ${price.toFixed(2)}
                    </span>
                    <span className="text-gray-600 dark:text-gray-400">{t('subscription.perMonth')}</span>
                  </>
                ) : (
                  <span className="text-3xl font-bold text-gray-900 dark:text-white">{t('subscription.free')}</span>
                )}
              </div>

              {/* Tokens */}
              <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">{t('subscription.dailyTokens')}</span>
                  <span className="font-bold text-blue-600 dark:text-blue-400">
                    {plan.dailyTokenQuota}
                  </span>
                </div>
              </div>

              {/* Features */}
              <ul className="space-y-2 mb-6">
                {plan.features.slice(0, 5).map((feature, idx) => (
                  <li key={idx} className="flex items-start space-x-2 text-sm">
                    <Check className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-700 dark:text-gray-300">{feature}</span>
                  </li>
                ))}
              </ul>

              {/* CTA Button */}
              <button
                disabled={isCurrentPlan}
                className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
                  isCurrentPlan
                    ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {isCurrentPlan ? t('subscription.currentPlan') : plan.name === 'free' ? t('subscription.getStarted') : t('subscription.upgradeNow')}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================
// TOKEN PURCHASE COMPONENT
// ============================================

export function TokenPurchase() {
  const { t } = useTranslation();
  const [selectedPackage, setSelectedPackage] = useState<number>(100);
  const { user } = useAuth();

  const packages = [
    { tokens: 100, price: 9.99, popular: false },
    { tokens: 500, price: 39.99, popular: true },
    { tokens: 1000, price: 69.99, popular: false },
    { tokens: 5000, price: 299.99, popular: false }
  ];

  const handlePurchase = async () => {
    if (!user) return;

    try {
      const backend = import.meta.env.VITE_BACKEND_URL || '';
      const resp = await fetch(`${backend}/api/payments/create-checkout-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          tokens: selectedPackage,
          amount_cents: Math.floor(selectedPackage * 100 * 0.09) // naive price formula: $0.09 per token
        })
      });

      const data = await resp.json();
      if (data?.url) {
        // Redirect to Stripe Checkout
        window.location.href = data.url;
      } else if (data?.sessionId) {
        // fallback
        window.location.href = `${backend}/checkout?session_id=${data.sessionId}`;
      } else {
        console.error('Failed to create checkout session', data);
        alert('Failed to initiate payment. Please try again later.');
      }
    } catch (err) {
      console.error('Purchase error:', err);
      alert('Payment failed: ' + (err as any).message);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        {t('tokens.purchase.title')}
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {packages.map(pkg => (
          <button
            key={pkg.tokens}
            onClick={() => setSelectedPackage(pkg.tokens)}
            className={`relative p-4 border-2 rounded-lg transition-all ${
              selectedPackage === pkg.tokens
                ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-300 dark:border-gray-600'
            }`}
          >
            {pkg.popular && (
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded-full">
                  {t('tokens.purchase.popular')}
                </span>
              </div>
            )}
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                {pkg.tokens}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">{t('tokens.purchase.tokens')}</div>
              <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
                ${pkg.price}
              </div>
            </div>
          </button>
        ))}
      </div>

      <button
        onClick={handlePurchase}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-lg font-medium transition-colors"
      >
        {t('tokens.purchase.button', { count: selectedPackage })}
      </button>
    </div>
  );
}