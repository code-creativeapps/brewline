import { StyleSheet, Text, TextInput, View, type KeyboardTypeOptions } from 'react-native';

import { theme } from '../theme';

type Props = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  onBlur?: () => void;
  error?: string;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: 'none' | 'words';
  maxLength?: number;
  testID: string;
};

export function TextField({ label, value, onChangeText, onBlur, error, testID, ...rest }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        testID={testID}
        // The label is the accessible name, so tests query the field the same
        // way a screen-reader user reaches it.
        accessibilityLabel={label}
        accessibilityHint={error}
        value={value}
        onChangeText={onChangeText}
        onBlur={onBlur}
        style={[styles.input, !!error && styles.inputError]}
        placeholderTextColor={theme.colors.muted}
        {...rest}
      />
      {!!error && (
        <Text testID={`${testID}-error`} accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: theme.space(1.5) },
  label: { fontSize: 13, fontWeight: '600', color: theme.colors.muted },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius,
    paddingHorizontal: theme.space(3.5),
    fontSize: 16,
    color: theme.colors.text,
    backgroundColor: theme.colors.surface,
  },
  inputError: { borderColor: theme.colors.danger },
  error: { color: theme.colors.danger, fontSize: 13 },
});
