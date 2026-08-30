import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { theme } from '../theme';

import { Button } from './Button';

export function LoadingState({ label }: { label: string }) {
  return (
    <View testID="loading-state" style={styles.center} accessibilityRole="progressbar">
      <ActivityIndicator color={theme.colors.accent} />
      <Text style={styles.muted}>{label}</Text>
    </View>
  );
}

export function ErrorState({
  title,
  detail,
  onRetry,
  retryLabel = 'Try again',
}: {
  title: string;
  detail?: string;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  return (
    <View testID="error-state" style={styles.center}>
      <Text accessibilityRole="alert" style={styles.title}>
        {title}
      </Text>
      {!!detail && <Text style={styles.muted}>{detail}</Text>}
      {onRetry && <Button label={retryLabel} onPress={onRetry} testID="retry-button" />}
    </View>
  );
}

export function EmptyState({ title, detail }: { title: string; detail?: string }) {
  return (
    <View testID="empty-state" style={styles.center}>
      <Text style={styles.title}>{title}</Text>
      {!!detail && <Text style={styles.muted}>{detail}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.space(3),
    padding: theme.space(6),
  },
  title: { fontSize: 17, fontWeight: '700', color: theme.colors.text, textAlign: 'center' },
  muted: { fontSize: 14, color: theme.colors.muted, textAlign: 'center' },
});
