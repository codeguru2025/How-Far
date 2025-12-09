// Splash Screen
import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { COLORS } from '../theme';

export function SplashScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.logo}>
        <Text style={styles.logoText}>NZ</Text>
      </View>
      <Text style={styles.title}>Ndeip-Zthin</Text>
      <Text style={styles.subtitle}>Your ride, your way</Text>
      <ActivityIndicator size="large" color="#FFFFFF" style={styles.loader} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 120,
    height: 120,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  logoText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 8,
  },
  loader: {
    marginTop: 40,
  },
});

