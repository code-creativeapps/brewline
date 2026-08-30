import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { PromoInvalidError } from '../api/errors';
import { useApi } from '../api/provider';
import { Button } from '../components/Button';
import { QuantityStepper } from '../components/QuantityStepper';
import { EmptyState, ErrorState, LoadingState } from '../components/ScreenState';
import { formatMoney } from '../domain/money';
import { amountToFreeShipping, priceCart } from '../domain/pricing';
import { normalisePromoCode, type Promo } from '../domain/promo';
import { useCatalog } from '../hooks/use-catalog';
import { useCartStore } from '../state/cart-store';
import { theme } from '../theme';

export function CartScreen() {
  const router = useRouter();
  const api = useApi();
  const { data: catalog, isPending, isError, refetch } = useCatalog();
  const cart = useCartStore((state) => state.cart);
  const setQty = useCartStore((state) => state.setQty);
  const removeItem = useCartStore((state) => state.removeItem);
  const applyPromo = useCartStore((state) => state.applyPromo);
  const removePromo = useCartStore((state) => state.removePromo);

  const [code, setCode] = useState('');

  const promoMutation = useMutation<Promo, Error, string>({
    mutationFn: (value) => api.validatePromo(normalisePromoCode(value)),
    onSuccess: (promo) => {
      applyPromo(promo);
      setCode('');
    },
  });

  if (isPending) return <LoadingState label="Loading your basket" />;
  if (isError) {
    return (
      <ErrorState
        title="We couldn't price your basket"
        detail="The coffee list failed to load."
        onRetry={() => refetch()}
      />
    );
  }

  const receipt = priceCart(cart, catalog);

  if (receipt.lines.length === 0) {
    return <EmptyState title="Your basket is empty" detail="Add a bag of coffee to get started." />;
  }

  const toFreeShipping = amountToFreeShipping(receipt);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {receipt.unavailableProductIds.length > 0 && (
        <Text testID="unavailable-notice" accessibilityRole="alert" style={styles.notice}>
          {receipt.unavailableProductIds.length} item(s) sold out and were removed.
        </Text>
      )}

      {receipt.lines.map((line) => (
        <View key={line.productId} testID={`cart-line-${line.productId}`} style={styles.line}>
          <View style={styles.lineTop}>
            <Text style={styles.lineName}>{line.name}</Text>
            <Text testID={`cart-line-${line.productId}-total`} style={styles.lineTotal}>
              {formatMoney(line.totalCents)}
            </Text>
          </View>
          <Text style={styles.lineUnit}>{formatMoney(line.unitCents)} each</Text>
          {line.bulkSavingCents > 0 && (
            <Text testID={`cart-line-${line.productId}-bulk`} style={styles.saving}>
              Bulk saving −{formatMoney(line.bulkSavingCents)}
            </Text>
          )}
          <View style={styles.lineActions}>
            <QuantityStepper
              testID={`qty-${line.productId}`}
              label={line.name}
              qty={line.qty}
              onChange={(qty) => setQty(line.productId, qty)}
            />
            <Button
              testID={`remove-${line.productId}`}
              label={`Remove ${line.name}`}
              variant="secondary"
              onPress={() => removeItem(line.productId)}
              style={styles.removeButton}
            />
          </View>
        </View>
      ))}

      <View style={styles.promoBlock}>
        <Text style={styles.sectionTitle}>Promo code</Text>
        {cart.promo ? (
          <View style={styles.promoApplied}>
            <Text testID="applied-promo" style={styles.promoCode}>
              {cart.promo.code} applied
            </Text>
            <Button
              testID="remove-promo"
              label="Remove code"
              variant="secondary"
              onPress={removePromo}
              style={styles.removeButton}
            />
          </View>
        ) : (
          <View style={styles.promoRow}>
            <TextInput
              testID="promo-input"
              accessibilityLabel="Promo code"
              placeholder="BREW10"
              autoCapitalize="characters"
              autoCorrect={false}
              value={code}
              onChangeText={setCode}
              style={styles.promoInput}
              placeholderTextColor={theme.colors.muted}
            />
            <Button
              testID="apply-promo"
              label="Apply"
              busy={promoMutation.isPending}
              disabled={code.trim().length === 0}
              onPress={() => promoMutation.mutate(code)}
              style={styles.applyButton}
            />
          </View>
        )}
        {promoMutation.isError && (
          <Text testID="promo-error" accessibilityRole="alert" style={styles.error}>
            {promoMutation.error instanceof PromoInvalidError
              ? promoMutation.error.message
              : "We couldn't check that code. Try again."}
          </Text>
        )}
      </View>

      <View style={styles.totals}>
        <Row label="Goods" value={formatMoney(receipt.goodsCents)} testID="total-goods" />
        {receipt.bulkSavingsCents > 0 && (
          <Row
            label="Bulk savings"
            value={`−${formatMoney(receipt.bulkSavingsCents)}`}
            testID="total-bulk"
            tone="success"
          />
        )}
        {receipt.promoDiscountCents > 0 && (
          <Row
            label={`Promo ${cart.promo?.code ?? ''}`.trim()}
            value={`−${formatMoney(receipt.promoDiscountCents)}`}
            testID="total-promo"
            tone="success"
          />
        )}
        <Row
          label="Delivery"
          value={receipt.shippingCents === 0 ? 'Free' : formatMoney(receipt.shippingCents)}
          testID="total-shipping"
        />
        <Row label="VAT (20%)" value={formatMoney(receipt.taxCents)} testID="total-tax" />
        <View style={styles.divider} />
        <Row label="Total" value={formatMoney(receipt.totalCents)} testID="total-due" emphasis />
        {toFreeShipping > 0 && (
          <Text testID="free-shipping-hint" style={styles.hint}>
            Spend {formatMoney(toFreeShipping)} more for free delivery.
          </Text>
        )}
      </View>

      <Button testID="go-to-checkout" label="Checkout" onPress={() => router.push('/checkout')} />
    </ScrollView>
  );
}

function Row({
  label,
  value,
  testID,
  emphasis,
  tone,
}: {
  label: string;
  value: string;
  testID: string;
  emphasis?: boolean;
  tone?: 'success';
}) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, emphasis && styles.rowEmphasis]}>{label}</Text>
      <Text
        testID={testID}
        // One accessible string, so a screen reader (and our tests) never read a
        // number stranded from its label.
        accessibilityLabel={`${label}: ${value}`}
        style={[
          styles.rowValue,
          emphasis && styles.rowEmphasis,
          tone === 'success' && styles.saving,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.bg },
  content: { padding: theme.space(4), gap: theme.space(3), paddingBottom: theme.space(12) },
  notice: { color: theme.colors.danger, fontSize: 13 },
  line: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.space(4),
    gap: theme.space(1.5),
  },
  lineTop: { flexDirection: 'row', justifyContent: 'space-between', gap: theme.space(3) },
  lineName: { flex: 1, fontSize: 16, fontWeight: '700', color: theme.colors.text },
  lineTotal: { fontSize: 16, fontWeight: '700', color: theme.colors.text },
  lineUnit: { fontSize: 13, color: theme.colors.muted },
  saving: { color: theme.colors.success, fontSize: 13, fontWeight: '600' },
  lineActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: theme.space(2),
  },
  removeButton: { minHeight: 36, paddingHorizontal: theme.space(3) },
  promoBlock: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.space(4),
    gap: theme.space(2),
  },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: theme.colors.muted },
  promoRow: { flexDirection: 'row', gap: theme.space(2) },
  promoInput: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius,
    paddingHorizontal: theme.space(3),
    fontSize: 16,
    color: theme.colors.text,
  },
  applyButton: { minHeight: 44, paddingHorizontal: theme.space(4) },
  promoApplied: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  promoCode: { fontSize: 15, fontWeight: '700', color: theme.colors.success },
  error: { color: theme.colors.danger, fontSize: 13 },
  totals: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.space(4),
    gap: theme.space(2),
  },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  rowLabel: { fontSize: 14, color: theme.colors.muted },
  rowValue: { fontSize: 14, color: theme.colors.text },
  rowEmphasis: { fontSize: 18, fontWeight: '800', color: theme.colors.text },
  divider: { height: 1, backgroundColor: theme.colors.border, marginVertical: theme.space(1) },
  hint: { fontSize: 13, color: theme.colors.muted },
});
