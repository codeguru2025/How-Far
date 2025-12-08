import { Stack } from 'expo-router';
import Colors from '@/constants/colors';

export default function CommuterLayout() {
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
      <Stack.Screen name="home" options={{ headerShown: false }} />
      <Stack.Screen name="plans" options={{ title: 'Choose Your Plan' }} />
      <Stack.Screen name="payment" options={{ title: 'Payment' }} />
      <Stack.Screen name="history" options={{ title: 'Ride History' }} />
    </Stack>
  );
}
