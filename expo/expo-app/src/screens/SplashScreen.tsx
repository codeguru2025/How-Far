// Splash Screen
import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Image } from 'react-native';
import { COLORS } from '../theme';

export function SplashScreen() {
  return (
    <View style={styles.container}>
      <Image 
        source={require('../../assets/splash-icon.png')} 
        style={styles.logo}
        resizeMode="contain"
      />
      <Text style={styles.title}>How Far</Text>
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
    width: 150,
    height: 150,
    marginBottom: 24,
  },
  title: {
    fontSize: 36,
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

