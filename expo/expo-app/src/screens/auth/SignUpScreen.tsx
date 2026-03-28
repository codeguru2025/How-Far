// Sign Up Screen - Role-based registration
import React, { useState } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity, 
  StyleSheet, 
  KeyboardAvoidingView, 
  Platform, 
  Alert 
} from 'react-native';
import { Button, Input } from '../../components';
import { useAuthStore } from '../../stores';
import { COLORS } from '../../theme';
import { Screen, UserRole, VehicleType } from '../../types';
import { supabase } from '../../api/supabase';
import * as Location from 'expo-location';

interface Props {
  onNavigate: (screen: Screen) => void;
}

const VEHICLE_TYPES: { type: VehicleType; name: string; icon: string }[] = [
  { type: 'sedan', name: 'Sedan', icon: '🚗' },
  { type: 'suv', name: 'SUV', icon: '🚙' },
  { type: 'minivan', name: 'Minivan', icon: '🚐' },
  { type: 'motorcycle', name: 'Motorcycle', icon: '🏍️' },
];

export function SignUpScreen({ onNavigate }: Props) {
  const [step, setStep] = useState(1); // 1=Basic Info, 2=Role, 3=Vehicle (drivers only)
  
  // Step 1: Basic Info
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  
  // Step 2: Role
  const [role, setRole] = useState<UserRole | null>(null);
  
  // Step 3: Vehicle (for drivers)
  const [vehicleType, setVehicleType] = useState<VehicleType>('sedan');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [color, setColor] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [seatCount, setSeatCount] = useState('4');
  
  const { signUp, isLoading } = useAuthStore();
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleBack() {
    if (step === 1) {
      onNavigate('signin');
    } else {
      setStep(step - 1);
    }
  }

  function handleNextFromBasic() {
    if (!firstName || !phone || password.length < 6) {
      Alert.alert('Error', 'Please fill all fields (password min 6 chars)');
      return;
    }
    setStep(2);
  }

  function handleRoleSelect(selectedRole: UserRole) {
    setRole(selectedRole);
    if (selectedRole === 'driver') {
      setStep(3); // Go to vehicle step
    } else {
      handleFinalSubmit(selectedRole); // Complete registration
    }
  }

  async function handleFinalSubmit(finalRole: UserRole = role!) {
    setIsSubmitting(true);
    
    try {
      // Create user account with role
      const result = await signUp({ 
        phone, 
        password, 
        firstName, 
        lastName,
        role: finalRole,
      });
      
      if (!result.success) {
        Alert.alert('Error', result.error || 'Sign up failed');
        setIsSubmitting(false);
        return;
      }

      // Get user from auth store (already set by signUp with correct role)
      const currentUser = useAuthStore.getState().user;
      
      if (!currentUser?.id) {
        Alert.alert('Error', 'Failed to get user data. Please try again.');
        setIsSubmitting(false);
        return;
      }

      // If driver, create driver and vehicle records
      await createDriverIfNeeded(currentUser.id, finalRole);
      
    } catch (error) {
      console.error('Signup error:', error);
      Alert.alert('Error', 'Something went wrong. Please try again.');
      setIsSubmitting(false);
    }
  }

  async function createDriverIfNeeded(userId: string, finalRole: UserRole) {
    if (finalRole !== 'driver') {
      // Commuter - just show success
      Alert.alert(
        'Welcome! 🎉',
        'Your account is ready. Find rides going your way!',
        [{ text: 'Get Started' }]
      );
      setIsSubmitting(false);
      return;
    }

    // Driver - create driver and vehicle records
    try {
      // Get location
      let latitude = -17.8250;
      let longitude = 31.0500;
      
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const location = await Location.getCurrentPositionAsync({});
          latitude = location.coords.latitude;
          longitude = location.coords.longitude;
        }
      } catch (e) {
        console.log('Could not get location');
      }

      // Create driver record
      const { data: driver, error: driverError } = await supabase
        .from('drivers')
        .insert({
          user_id: userId,
          first_name: firstName,
          last_name: lastName || '',
          phone_number: phone,
          is_online: false,
          is_available: true,
          current_latitude: latitude,
          current_longitude: longitude,
          rating: 5.0,
        })
        .select()
        .single();

      if (driverError) {
        console.error('Driver creation error:', driverError);
        Alert.alert('Warning', 'Account created but driver profile failed. Contact support.');
        setIsSubmitting(false);
        return;
      }

      // Create vehicle record
      const seats = parseInt(seatCount) || 4;
      const yearNum = parseInt(year) || new Date().getFullYear();

      const { error: vehicleError } = await supabase
        .from('vehicles')
        .insert({
          driver_id: driver.id,
          type: vehicleType,
          make: make.trim() || 'Unknown',
          model: model.trim() || 'Unknown',
          year: yearNum,
          color: color.trim() || 'Unknown',
          registration_number: registrationNumber.trim().toUpperCase() || 'PENDING',
          seat_count: seats,
          is_active: true,
        });

      if (vehicleError) {
        console.error('Vehicle creation error:', vehicleError);
        // Don't block - vehicle can be added later
      }

      Alert.alert(
        'Welcome, Driver! 🎉',
        'Your driver account is ready. Start creating trips to earn money!',
        [{ text: 'Get Started' }]
      );
    } catch (error) {
      console.error('Driver setup error:', error);
      Alert.alert('Warning', 'Account created but there was an issue setting up driver profile.');
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleDriverSubmit() {
    if (!make.trim() || !model.trim() || !color.trim() || !registrationNumber.trim()) {
      Alert.alert('Missing Info', 'Please fill in all vehicle details');
      return;
    }
    handleFinalSubmit('driver');
  }

  // Render based on step
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <TouchableOpacity onPress={handleBack}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>

        {/* Progress Indicator */}
        <View style={styles.progress}>
          <View style={[styles.progressDot, step >= 1 && styles.progressDotActive]} />
          <View style={[styles.progressLine, step >= 2 && styles.progressLineActive]} />
          <View style={[styles.progressDot, step >= 2 && styles.progressDotActive]} />
          {role === 'driver' && (
            <>
              <View style={[styles.progressLine, step >= 3 && styles.progressLineActive]} />
              <View style={[styles.progressDot, step >= 3 && styles.progressDotActive]} />
            </>
          )}
        </View>

        {step === 1 && (
          <>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Let's get you started</Text>

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
                title="Continue"
                onPress={handleNextFromBasic}
                disabled={!firstName || !phone || password.length < 6}
                size="large"
                style={styles.button}
              />
            </View>
          </>
        )}

        {step === 2 && (
          <>
            <Text style={styles.title}>How will you use the app?</Text>
            <Text style={styles.subtitle}>Choose your primary role</Text>

            <View style={styles.roleContainer}>
              <TouchableOpacity 
                style={styles.roleCard}
                onPress={() => handleRoleSelect('passenger')}
              >
                <Text style={styles.roleIcon}>🚶</Text>
                <Text style={styles.roleTitle}>I'm a Commuter</Text>
                <Text style={styles.roleDescription}>
                  Find rides going my way, book seats, and pay easily
                </Text>
                <View style={styles.roleFeatures}>
                  <Text style={styles.roleFeature}>🔍 Find available trips</Text>
                  <Text style={styles.roleFeature}>💳 Pay with wallet</Text>
                  <Text style={styles.roleFeature}>📍 Track your ride</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.roleCard}
                onPress={() => handleRoleSelect('driver')}
              >
                <Text style={styles.roleIcon}>🚗</Text>
                <Text style={styles.roleTitle}>I'm a Driver</Text>
                <Text style={styles.roleDescription}>
                  Create trips, pick up passengers, and earn money
                </Text>
                <View style={styles.roleFeatures}>
                  <Text style={styles.roleFeature}>📍 Set your route</Text>
                  <Text style={styles.roleFeature}>💰 Earn per passenger</Text>
                  <Text style={styles.roleFeature}>📷 Scan QR to get paid</Text>
                </View>
              </TouchableOpacity>
            </View>
          </>
        )}

        {step === 3 && (
          <>
            <Text style={styles.title}>Your Vehicle</Text>
            <Text style={styles.subtitle}>Add your vehicle details</Text>

            <View style={styles.form}>
              {/* Vehicle Type */}
              <Text style={styles.label}>Vehicle Type</Text>
              <View style={styles.typeGrid}>
                {VEHICLE_TYPES.map((item) => (
                  <TouchableOpacity
                    key={item.type}
                    style={[styles.typeCard, vehicleType === item.type && styles.typeCardSelected]}
                    onPress={() => setVehicleType(item.type)}
                  >
                    <Text style={styles.typeIcon}>{item.icon}</Text>
                    <Text style={[styles.typeName, vehicleType === item.type && styles.typeNameSelected]}>
                      {item.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.row}>
                <View style={styles.halfInput}>
                  <Input
                    label="Make"
                    placeholder="Toyota"
                    value={make}
                    onChangeText={setMake}
                  />
                </View>
                <View style={styles.halfInput}>
                  <Input
                    label="Model"
                    placeholder="Corolla"
                    value={model}
                    onChangeText={setModel}
                  />
                </View>
              </View>

              <View style={styles.row}>
                <View style={styles.halfInput}>
                  <Input
                    label="Year"
                    placeholder="2020"
                    value={year}
                    onChangeText={setYear}
                    keyboardType="number-pad"
                  />
                </View>
                <View style={styles.halfInput}>
                  <Input
                    label="Color"
                    placeholder="Silver"
                    value={color}
                    onChangeText={setColor}
                  />
                </View>
              </View>

              <View style={styles.row}>
                <View style={styles.halfInput}>
                  <Input
                    label="Registration #"
                    placeholder="ABC 1234"
                    value={registrationNumber}
                    onChangeText={setRegistrationNumber}
                  />
                </View>
                <View style={styles.halfInput}>
                  <Input
                    label="Seats"
                    placeholder="4"
                    value={seatCount}
                    onChangeText={setSeatCount}
                    keyboardType="number-pad"
                  />
                </View>
              </View>

              <Button
                title={isSubmitting ? 'Creating Account...' : 'Complete Registration'}
                onPress={handleDriverSubmit}
                loading={isSubmitting}
                disabled={!make || !model || !color || !registrationNumber}
                size="large"
                style={styles.button}
              />
            </View>
          </>
        )}

        {/* Sign In Link */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <TouchableOpacity onPress={() => onNavigate('signin')}>
            <Text style={styles.footerLink}>Sign In</Text>
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
    paddingTop: 60,
  },
  back: {
    color: COLORS.primary,
    fontWeight: '500',
    marginBottom: 16,
  },
  progress: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  progressDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#E5E7EB',
  },
  progressDotActive: {
    backgroundColor: COLORS.primary,
  },
  progressLine: {
    width: 40,
    height: 3,
    backgroundColor: '#E5E7EB',
  },
  progressLineActive: {
    backgroundColor: COLORS.primary,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginBottom: 24,
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
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 12,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  typeCard: {
    width: '48%',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  typeCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '10',
  },
  typeIcon: {
    fontSize: 28,
    marginBottom: 6,
  },
  typeName: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
  },
  typeNameSelected: {
    color: COLORS.primary,
  },
  roleContainer: {
    gap: 16,
  },
  roleCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 24,
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  roleIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  roleTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
  },
  roleDescription: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 16,
    lineHeight: 20,
  },
  roleFeatures: {
    gap: 8,
  },
  roleFeature: {
    fontSize: 14,
    color: COLORS.text,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  footerText: {
    color: COLORS.textSecondary,
  },
  footerLink: {
    color: COLORS.primary,
    fontWeight: '600',
  },
});
