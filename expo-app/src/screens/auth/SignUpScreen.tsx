// Sign Up Screen
import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { Button, Input } from '../../components';
import { useAuthStore } from '../../stores';
import { COLORS } from '../../theme';
import { Screen } from '../../types';

interface Props {
  onNavigate: (screen: Screen) => void;
}

export function SignUpScreen({ onNavigate }: Props) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const { signUp, isLoading } = useAuthStore();

  async function handleSignUp() {
    if (!firstName || !phone || password.length < 6) {
      Alert.alert('Error', 'Please fill all fields (password min 6 chars)');
      return;
    }

    const result = await signUp({ phone, password, firstName, lastName });
    if (!result.success) {
      Alert.alert('Error', result.error || 'Sign up failed');
    } else {
      Alert.alert('Success', 'Account created!');
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
      <ScrollView contentContainerStyle={styles.container}>
        <TouchableOpacity onPress={() => onNavigate('signin')}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        
        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.subtitle}>Sign up with your phone number</Text>

        <View style={styles.form}>
          <View style={styles.row}>
            <View style={styles.halfInput}>
              <Input
                label="First Name"
                placeholder="Bekithemba"
                value={firstName}
                onChangeText={setFirstName}
              />
            </View>
            <View style={styles.halfInput}>
              <Input
                label="Last Name"
                placeholder="Ndlovu"
                value={lastName}
                onChangeText={setLastName}
              />
            </View>
          </View>

          <Input
            label="Phone Number"
            placeholder="0771234567"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />

          <Input
            label="Password"
            placeholder="Min 6 characters"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <Button
            title="Create Account"
            onPress={handleSignUp}
            loading={isLoading}
            disabled={!firstName || !phone || password.length < 6}
            size="large"
            style={styles.button}
          />
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
    paddingTop: 60,
  },
  back: {
    color: COLORS.primary,
    fontWeight: '500',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginBottom: 32,
    marginTop: 8,
  },
  form: {
    marginBottom: 24,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  button: {
    marginTop: 16,
  },
});
