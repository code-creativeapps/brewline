import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '../components/Button';
import { EmptyState } from '../components/ScreenState';
import { formatMoney } from '../domain/money';
import { useOrderStore } from '../state/order-store';
import { theme } from '../theme';

export function OrderScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const order = useOrderStore((state) => (id ? state.orders[id] : undefined));

  if (!order) {
    return <EmptyState title="Order not found" detail="This confirmation link has expired." />;
  }

  return (
    <View style={styles.screen}>
      <Text testID="order-confirmed" style={styles.title}>
        Order confirmed
      </Text>
      <Text testID="order-reference" style={styles.reference}>
        {order.reference}
      </Text>
      <Text style={styles.detail}>
        We&apos;ve emailed your receipt to {order.email}. Roasted and shipped within {order.etaDays}{' '}
        days.
      </Text>
      <Text testID="order-total" style={styles.total}>
        Paid {formatMoney(order.totalCents)}
      </Text>
      <Button testID="back-to-shop" label="Back to shop" onPress={() => router.replace('/')} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.space(3),
    padding: theme.space(6),
  },
  title: { fontSize: 26, fontWeight: '800', color: theme.colors.success },
  reference: { fontSize: 20, fontWeight: '700', color: theme.colors.text, letterSpacing: 1 },
  detail: { fontSize: 15, color: theme.colors.muted, textAlign: 'center' },
  total: { fontSize: 18, fontWeight: '700', color: theme.colors.text },
});
