import { Stack } from 'expo-router';
import Colors from '@/constants/colors';

export default function OperatorLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: Colors.primary,
        },
        headerTintColor: Colors.textInverse,
        headerTitleStyle: {
          fontWeight: '700' as const,
        },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="auth" options={{ headerShown: false }} />
      <Stack.Screen name="home" options={{ title: 'Operator Scanner' }} />
    </Stack>
  );
}
