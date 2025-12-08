import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Users, Bus } from 'lucide-react-native';
import Colors from '@/constants/colors';

export default function RoleSelectScreen() {
  const router = useRouter();

  const selectRole = (role: 'commuter' | 'operator') => {
    if (role === 'commuter') {
      router.push('/(commuter)/auth' as any);
    } else {
      router.push('/(operator)/auth' as any);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[Colors.primary, Colors.primaryDark]}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.logo}>RidePass</Text>
          <Text style={styles.subtitle}>Choose your role</Text>
        </View>

        <View style={styles.cardsContainer}>
          <Pressable
            style={({ pressed }) => [
              styles.card,
              pressed && styles.cardPressed,
            ]}
            onPress={() => selectRole('commuter')}
          >
            <View style={styles.cardIconContainer}>
              <Users size={48} color={Colors.primary} strokeWidth={2} />
            </View>
            <Text style={styles.cardTitle}>I&apos;m a Commuter</Text>
            <Text style={styles.cardDescription}>
              Buy passes and travel with ease
            </Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.card,
              pressed && styles.cardPressed,
            ]}
            onPress={() => selectRole('operator')}
          >
            <View style={styles.cardIconContainer}>
              <Bus size={48} color={Colors.primary} strokeWidth={2} />
            </View>
            <Text style={styles.cardTitle}>I&apos;m an Operator</Text>
            <Text style={styles.cardDescription}>
              Scan QR codes and validate rides
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 60,
  },
  logo: {
    fontSize: 48,
    fontWeight: '800' as const,
    color: Colors.textInverse,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: Colors.textInverse,
    opacity: 0.9,
  },
  cardsContainer: {
    flex: 1,
    gap: 20,
  },
  card: {
    backgroundColor: Colors.textInverse,
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  cardPressed: {
    opacity: 0.95,
    transform: [{ scale: 0.98 }],
  },
  cardIconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 8,
  },
  cardDescription: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
});
