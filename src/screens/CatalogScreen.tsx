import { useRouter } from 'expo-router';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { ProductCard } from '../components/ProductCard';
import { ErrorState, LoadingState } from '../components/ScreenState';
import { Button } from '../components/Button';
import { SessionExpiredError } from '../api/errors';
import { useCatalog } from '../hooks/use-catalog';
import { useCartStore } from '../state/cart-store';
import { cartItemCount } from '../domain/cart';
import { theme } from '../theme';

export function CatalogScreen() {
  const router = useRouter();
  const { data, isPending, isError, error, refetch, isFetching } = useCatalog();
  const cart = useCartStore((state) => state.cart);
  const addItem = useCartStore((state) => state.addItem);
  const count = cartItemCount(cart);

  if (isPending) return <LoadingState label="Loading today's coffees" />;

  if (isError) {
    // A dead session is not a "try again" situation — the retry button would
    // just fail the same way, so we send them to sign in instead.
    const expired = error instanceof SessionExpiredError;
    return (
      <ErrorState
        title={expired ? 'Your session has expired' : "We couldn't load the coffees"}
        detail={
          expired ? 'Sign in again to keep shopping.' : 'Check your connection and try again.'
        }
        retryLabel={expired ? 'Sign in' : 'Try again'}
        onRetry={expired ? () => router.replace('/sign-in') : () => refetch()}
      />
    );
  }

  const qtyOf = (productId: string) =>
    cart.lines.find((line) => line.productId === productId)?.qty ?? 0;

  return (
    <View style={styles.screen}>
      <FlatList
        testID="catalog-list"
        data={data}
        keyExtractor={(product) => product.id}
        contentContainerStyle={styles.list}
        refreshing={isFetching}
        onRefresh={() => refetch()}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>This week&apos;s roasts</Text>
            <Text style={styles.subtitle}>Free delivery over £35</Text>
          </View>
        }
        renderItem={({ item }) => (
          <ProductCard product={item} qtyInCart={qtyOf(item.id)} onAdd={addItem} />
        )}
      />

      {count > 0 && (
        <View style={styles.bar}>
          <Button
            testID="view-basket"
            label={`View basket (${count})`}
            onPress={() => router.push('/cart')}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.bg },
  list: { padding: theme.space(4), gap: theme.space(3), paddingBottom: theme.space(24) },
  header: { gap: theme.space(1), paddingBottom: theme.space(2) },
  title: { fontSize: 26, fontWeight: '800', color: theme.colors.text },
  subtitle: { fontSize: 14, color: theme.colors.muted },
  bar: {
    position: 'absolute',
    left: theme.space(4),
    right: theme.space(4),
    bottom: theme.space(6),
  },
});
