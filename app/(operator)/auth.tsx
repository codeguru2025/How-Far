import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Phone, Bus } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useApp } from '@/contexts/AppContext';
import { User } from '@/types';

export default function OperatorAuthScreen() {
  const router = useRouter();
  const { saveUser } = useApp();
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [step, setStep] = useState<'phone' | 'details'>('phone');

  const handlePhoneSubmit = () => {
    if (phone.length < 9) {
      Alert.alert('Invalid Phone', 'Please enter a valid phone number');
      return;
    }
    setStep('details');
  };

  const handleDetailsSubmit = async () => {
    if (name.trim().length < 2) {
      Alert.alert('Invalid Name', 'Please enter your name');
      return;
    }
    if (vehicleNumber.trim().length < 2) {
      Alert.alert('Invalid Vehicle', 'Please enter your vehicle number');
      return;
    }

    const user: User = {
      id: Date.now().toString(),
      phoneNumber: phone,
      name: name.trim(),
      role: 'operator',
      createdAt: new Date().toISOString(),
    };

    await saveUser(user);
    router.replace('/(operator)/home' as any);
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[Colors.secondary, Colors.primary]}
        style={StyleSheet.absoluteFill}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
      >
        <View style={styles.header}>
          <Bus size={64} color={Colors.textInverse} strokeWidth={1.5} />
          <Text style={styles.logo}>Operator Portal</Text>
          <Text style={styles.subtitle}>
            {step === 'phone' ? 'Enter your phone number' : 'Complete your profile'}
          </Text>
        </View>

        <View style={styles.formContainer}>
          {step === 'phone' ? (
            <>
              <View style={styles.inputContainer}>
                <Phone size={24} color={Colors.textSecondary} />
                <TextInput
                  style={styles.input}
                  placeholder="07X XXX XXXX"
                  placeholderTextColor={Colors.textSecondary}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  maxLength={10}
                  autoFocus
                />
              </View>
              <Pressable
                style={({ pressed }) => [
                  styles.button,
                  pressed && styles.buttonPressed,
                ]}
                onPress={handlePhoneSubmit}
              >
                <Text style={styles.buttonText}>Continue</Text>
              </Pressable>
            </>
          ) : (
            <>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="Your name"
                  placeholderTextColor={Colors.textSecondary}
                  value={name}
                  onChangeText={setName}
                  autoFocus
                  autoCapitalize="words"
                />
              </View>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="Vehicle number (e.g. ABC 123)"
                  placeholderTextColor={Colors.textSecondary}
                  value={vehicleNumber}
                  onChangeText={setVehicleNumber}
                  autoCapitalize="characters"
                />
              </View>
              <Pressable
                style={({ pressed }) => [
                  styles.button,
                  pressed && styles.buttonPressed,
                ]}
                onPress={handleDetailsSubmit}
              >
                <Text style={styles.buttonText}>Start Scanning</Text>
              </Pressable>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
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
    paddingTop: 100,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 60,
  },
  logo: {
    fontSize: 32,
    fontWeight: '800' as const,
    color: Colors.textInverse,
    marginTop: 16,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: Colors.textInverse,
    opacity: 0.9,
  },
  formContainer: {
    gap: 20,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.textInverse,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 18,
    gap: 12,
  },
  input: {
    flex: 1,
    fontSize: 18,
    color: Colors.text,
  },
  button: {
    backgroundColor: Colors.textInverse,
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.secondary,
  },
});
