import { ActivityIndicator, Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';

import { theme } from '../theme';

type Props = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  busy?: boolean;
  testID?: string;
  style?: ViewStyle;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  busy = false,
  testID,
  style,
}: Props) {
  const isDisabled = disabled || busy;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      // The accessible name stays `label` while busy so queries don't have to
      // guess at a spinner state; `disabled` carries the busy information.
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy }}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' ? styles.primary : styles.secondary,
        isDisabled && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator
          color={variant === 'primary' ? theme.colors.accentText : theme.colors.accent}
        />
      ) : (
        <Text style={[styles.label, variant === 'secondary' && styles.labelSecondary]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    borderRadius: theme.radius,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.space(5),
  },
  primary: { backgroundColor: theme.colors.accent },
  secondary: { backgroundColor: 'transparent', borderWidth: 1, borderColor: theme.colors.border },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.8 },
  label: { color: theme.colors.accentText, fontSize: 16, fontWeight: '600' },
  labelSecondary: { color: theme.colors.text },
});
