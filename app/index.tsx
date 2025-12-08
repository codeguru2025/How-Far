import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useApp } from '@/contexts/AppContext';
import Colors from '@/constants/colors';

export default function IndexScreen() {
  const router = useRouter();
  const { user, isLoading } = useApp();

  useEffect(() => {
    if (!isLoading) {
      if (user) {
        if (user.role === 'commuter') {
          router.replace('/(commuter)/home' as any);
        } else {
          router.replace('/(operator)/home' as any);
        }
      } else {
        router.replace('/onboarding');
      }
    }
  }, [user, isLoading, router]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>RidePass</Text>
      <Text style={styles.subtitle}>Loading...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 48,
    fontWeight: '800' as const,
    color: Colors.textInverse,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textInverse,
    opacity: 0.8,
  },
});
