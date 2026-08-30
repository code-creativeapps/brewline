import { StyleSheet, Text, View } from 'react-native';

import type { Product } from '../domain/catalog';
import { formatMoney } from '../domain/money';
import { theme } from '../theme';

import { Button } from './Button';

type Props = {
  product: Product;
  qtyInCart: number;
  onAdd: (productId: string) => void;
};

export function ProductCard({ product, qtyInCart, onAdd }: Props) {
  return (
    <View testID={`product-${product.id}`} style={styles.card}>
      <View style={styles.header}>
        <View style={styles.titleBlock}>
          <Text style={styles.name}>{product.name}</Text>
          <Text style={styles.origin}>
            {product.origin} · {product.roast} roast
          </Text>
        </View>
        <Text style={styles.price}>{formatMoney(product.priceCents)}</Text>
      </View>

      {product.bulkDiscount && (
        <Text style={styles.bulk}>
          {product.bulkDiscount.percentOff}% off {product.bulkDiscount.minQty}+ bags
        </Text>
      )}

      <View style={styles.footer}>
        {qtyInCart > 0 && (
          <Text testID={`product-${product.id}-in-cart`} style={styles.inCart}>
            {qtyInCart} in basket
          </Text>
        )}
        <Button
          testID={`add-${product.id}`}
          label={`Add ${product.name}`}
          onPress={() => onAdd(product.id)}
          style={styles.addButton}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.space(4),
    gap: theme.space(2),
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', gap: theme.space(3) },
  titleBlock: { flex: 1, gap: theme.space(1) },
  name: { fontSize: 17, fontWeight: '700', color: theme.colors.text },
  origin: { fontSize: 13, color: theme.colors.muted, textTransform: 'capitalize' },
  price: { fontSize: 17, fontWeight: '700', color: theme.colors.text },
  bulk: { fontSize: 13, color: theme.colors.success, fontWeight: '600' },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: theme.space(3),
  },
  inCart: { fontSize: 13, color: theme.colors.muted, marginRight: 'auto' },
  addButton: { paddingHorizontal: theme.space(4), minHeight: 40 },
});
