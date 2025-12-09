// Sign In Screen
import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { Button, Input } from '../../components';
import { useAuthStore } from '../../stores';
import { COLORS } from '../../theme';
import { Screen } from '../../types';

interface Props {
  onNavigate: (screen: Screen) => void;
}

export function SignInScreen({ onNavigate }: Props) {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const { signIn, isLoading } = useAuthStore();

  async function handleSignIn() {
    if (!phone.trim() || !password) {
      Alert.alert('Error', 'Please enter phone and password');
      return;
    }

    const result = await signIn(phone, password);
    if (!result.success) {
      Alert.alert('Error', result.error || 'Sign in failed');
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.logo}>
          <Text style={styles.logoText}>NZ</Text>
        </View>
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>Sign in with your phone number</Text>

        <View style={styles.form}>
          <Input
            label="Phone Number"
            placeholder="0771234567"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            autoCapitalize="none"
          />

          <Input
            label="Password"
            placeholder="Enter password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <Button
            title="Sign In"
            onPress={handleSignIn}
            loading={isLoading}
            disabled={!phone || !password}
            size="large"
            style={styles.button}
          />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Don't have an account? </Text>
          <TouchableOpacity onPress={() => onNavigate('signup')}>
            <Text style={styles.link}>Sign Up</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flexGrow: 1,
    backgroundColor: COLORS.background,
    padding: 24,
    justifyContent: 'center',
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 24,
  },
  logoText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
    marginTop: 8,
  },
  form: {
    marginBottom: 24,
  },
  button: {
    marginTop: 16,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  footerText: {
    color: COLORS.textSecondary,
  },
  link: {
    color: COLORS.primary,
    fontWeight: '600',
  },
});
