import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '../src/components/Button';
import { theme } from '../src/theme';

/** Placeholder: the SessionExpiredError path in the catalog lands here. */
export default function SignInScreen() {
  const router = useRouter();
  return (
    <View style={styles.screen}>
      <Text testID="sign-in-title" style={styles.title}>
        Sign in to continue
      </Text>
      <Button testID="sign-in-continue" label="Continue" onPress={() => router.replace('/')} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.space(4),
    padding: theme.space(6),
  },
  title: { fontSize: 22, fontWeight: '800', color: theme.colors.text },
});
