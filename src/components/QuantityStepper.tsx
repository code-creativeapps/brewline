import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MAX_QTY_PER_LINE } from '../domain/cart';
import { theme } from '../theme';

type Props = {
  label: string;
  qty: number;
  onChange: (qty: number) => void;
  testID: string;
};

export function QuantityStepper({ label, qty, onChange, testID }: Props) {
  return (
    <View style={styles.row} accessibilityLabel={`Quantity for ${label}`}>
      <Pressable
        testID={`${testID}-decrement`}
        accessibilityRole="button"
        accessibilityLabel={`Decrease quantity of ${label}`}
        onPress={() => onChange(qty - 1)}
        style={styles.button}
      >
        <Text style={styles.symbol}>−</Text>
      </Pressable>
      <Text testID={`${testID}-value`} style={styles.value}>
        {qty}
      </Text>
      <Pressable
        testID={`${testID}-increment`}
        accessibilityRole="button"
        accessibilityLabel={`Increase quantity of ${label}`}
        accessibilityState={{ disabled: qty >= MAX_QTY_PER_LINE }}
        disabled={qty >= MAX_QTY_PER_LINE}
        onPress={() => onChange(qty + 1)}
        style={[styles.button, qty >= MAX_QTY_PER_LINE && styles.buttonDisabled]}
      >
        <Text style={styles.symbol}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.space(2) },
  button: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: { opacity: 0.4 },
  symbol: { fontSize: 18, color: theme.colors.text, lineHeight: 22 },
  value: { minWidth: 24, textAlign: 'center', fontSize: 16, fontWeight: '600' },
});
