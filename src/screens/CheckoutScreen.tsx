import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CardDeclinedError, SessionExpiredError } from '../api/errors';
import { useApi } from '../api/provider';
import type { Order, OrderDraft } from '../api/types';
import { Button } from '../components/Button';
import { TextField } from '../components/TextField';
import { EmptyState, ErrorState, LoadingState } from '../components/ScreenState';
import {
  EMPTY_CHECKOUT_FORM,
  formatCardNumber,
  formatExpiry,
  validateCheckout,
  type CheckoutErrors,
  type CheckoutField,
  type CheckoutForm,
} from '../domain/checkout';
import { formatMoney } from '../domain/money';
import { priceCart } from '../domain/pricing';
import { useCatalog } from '../hooks/use-catalog';
import { useCartStore } from '../state/cart-store';
import { useOrderStore } from '../state/order-store';
import { theme } from '../theme';

export function CheckoutScreen() {
  const router = useRouter();
  const api = useApi();
  const { data: catalog, isPending, isError, refetch } = useCatalog();
  const cart = useCartStore((state) => state.cart);
  const clearCart = useCartStore((state) => state.clear);
  const recordOrder = useOrderStore((state) => state.recordOrder);

  const [form, setForm] = useState<CheckoutForm>(EMPTY_CHECKOUT_FORM);
  const [touched, setTouched] = useState<Partial<Record<CheckoutField, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);

  const errors: CheckoutErrors = useMemo(() => validateCheckout(form, new Date()), [form]);
  // Don't shout at someone who hasn't finished typing: an error shows once the
  // field is blurred, or once they've tried to pay.
  const visible = (field: CheckoutField) =>
    submitted || touched[field] ? errors[field] : undefined;

  const payMutation = useMutation<Order, Error, OrderDraft>({
    mutationFn: (draft) => api.createOrder(draft),
    onSuccess: (order) => {
      recordOrder(order);
      clearCart();
      router.replace(`/order/${order.id}`);
    },
  });

  if (isPending) return <LoadingState label="Preparing checkout" />;
  if (isError) {
    return <ErrorState title="Checkout is unavailable" onRetry={() => refetch()} />;
  }

  const receipt = priceCart(cart, catalog);
  if (receipt.lines.length === 0) {
    return <EmptyState title="Nothing to pay for" detail="Your basket is empty." />;
  }

  const set = (field: CheckoutField) => (value: string) =>
    setForm((current) => ({ ...current, [field]: value }));

  const onPay = () => {
    setSubmitted(true);
    if (Object.keys(errors).length > 0) return;
    payMutation.mutate({
      lines: cart.lines.map((line) => ({ ...line })),
      promoCode: cart.promo?.code,
      name: form.name.trim(),
      email: form.email.trim(),
      card: { number: form.cardNumber, expiry: form.expiry, cvc: form.cvc },
      totalCents: receipt.totalCents,
    });
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.summary}>
          <Text style={styles.summaryLabel}>Total to pay</Text>
          <Text testID="checkout-total" style={styles.summaryValue}>
            {formatMoney(receipt.totalCents)}
          </Text>
        </View>

        <TextField
          testID="field-name"
          label="Name on card"
          value={form.name}
          onChangeText={set('name')}
          onBlur={() => setTouched((t) => ({ ...t, name: true }))}
          error={visible('name')}
          autoCapitalize="words"
        />
        <TextField
          testID="field-email"
          label="Email"
          value={form.email}
          onChangeText={set('email')}
          onBlur={() => setTouched((t) => ({ ...t, email: true }))}
          error={visible('email')}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <TextField
          testID="field-card"
          label="Card number"
          value={form.cardNumber}
          onChangeText={(value) => set('cardNumber')(formatCardNumber(value))}
          onBlur={() => setTouched((t) => ({ ...t, cardNumber: true }))}
          error={visible('cardNumber')}
          keyboardType="number-pad"
          placeholder="4242 4242 4242 4242"
        />
        <View style={styles.pair}>
          <View style={styles.pairItem}>
            <TextField
              testID="field-expiry"
              label="Expiry"
              value={form.expiry}
              onChangeText={(value) => set('expiry')(formatExpiry(value))}
              onBlur={() => setTouched((t) => ({ ...t, expiry: true }))}
              error={visible('expiry')}
              keyboardType="number-pad"
              placeholder="MM/YY"
            />
          </View>
          <View style={styles.pairItem}>
            <TextField
              testID="field-cvc"
              label="CVC"
              value={form.cvc}
              onChangeText={set('cvc')}
              onBlur={() => setTouched((t) => ({ ...t, cvc: true }))}
              error={visible('cvc')}
              keyboardType="number-pad"
              maxLength={4}
            />
          </View>
        </View>

        {payMutation.isError && (
          <Text testID="payment-error" accessibilityRole="alert" style={styles.error}>
            {paymentMessage(payMutation.error)}
          </Text>
        )}

        <Button
          testID="pay-button"
          label={`Pay ${formatMoney(receipt.totalCents)}`}
          busy={payMutation.isPending}
          onPress={onPay}
        />
        <Text style={styles.legal}>
          Test build — no real payment is taken. Card ending 0002 is always declined.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function paymentMessage(error: Error): string {
  if (error instanceof CardDeclinedError) return error.message;
  if (error instanceof SessionExpiredError) return 'Your session expired. Sign in and try again.';
  return "We couldn't take your payment. No money has left your account — please try again.";
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.bg },
  content: { padding: theme.space(4), gap: theme.space(4), paddingBottom: theme.space(12) },
  summary: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.space(4),
    gap: theme.space(1),
  },
  summaryLabel: { fontSize: 13, color: theme.colors.muted, fontWeight: '600' },
  summaryValue: { fontSize: 28, fontWeight: '800', color: theme.colors.text },
  pair: { flexDirection: 'row', gap: theme.space(3) },
  pairItem: { flex: 1 },
  error: { color: theme.colors.danger, fontSize: 14 },
  legal: { fontSize: 12, color: theme.colors.muted, textAlign: 'center' },
});
