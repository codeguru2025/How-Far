// Register as Driver Screen - User registers to become a driver
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { COLORS } from '../../theme';
import { Screen, VehicleType } from '../../types';
import { Button } from '../../components';
import { useAuthStore } from '../../stores';
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

export function RegisterDriverScreen({ onNavigate }: Props) {
  const { user } = useAuthStore();
  const [step, setStep] = useState(1); // 1 = Driver info, 2 = Vehicle info
  
  // Driver info
  const [firstName, setFirstName] = useState(user?.first_name || '');
  const [lastName, setLastName] = useState(user?.last_name || '');
  const [phoneNumber, setPhoneNumber] = useState(user?.phone_number || '');
  
  // Vehicle info
  const [vehicleType, setVehicleType] = useState<VehicleType>('sedan');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [color, setColor] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [seatCount, setSeatCount] = useState('4');
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleNext() {
    if (!firstName.trim() || !lastName.trim() || !phoneNumber.trim()) {
      Alert.alert('Missing Info', 'Please fill in all fields');
      return;
    }
    setStep(2);
  }

  async function handleSubmit() {
    // Validation
    if (!make.trim() || !model.trim() || !color.trim() || !registrationNumber.trim()) {
      Alert.alert('Missing Info', 'Please fill in all vehicle details');
      return;
    }

    const yearNum = parseInt(year);
    if (isNaN(yearNum) || yearNum < 1990 || yearNum > new Date().getFullYear() + 1) {
      Alert.alert('Invalid Year', 'Please enter a valid year (1990 - present)');
      return;
    }

    const seats = parseInt(seatCount);
    if (isNaN(seats) || seats < 1 || seats > 50) {
      Alert.alert('Invalid Seats', 'Please enter a valid number of seats (1-50)');
      return;
    }

    setIsSubmitting(true);
    try {
      // Get current location
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
        console.log('Could not get location, using default');
      }

      // Create driver record
      const { data: driver, error: driverError } = await supabase
        .from('drivers')
        .insert({
          user_id: user?.id,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          phone_number: phoneNumber.trim(),
          is_online: false,
          is_available: true,
          current_latitude: latitude,
          current_longitude: longitude,
          rating: 5.0,
        })
        .select()
        .single();

      if (driverError) {
        console.error('Driver error:', driverError);
        if (driverError.code === '23505') {
          Alert.alert('Already Registered', 'You are already registered as a driver.');
        } else {
          Alert.alert('Error', 'Failed to register as driver. Please try again.');
        }
        setIsSubmitting(false);
        return;
      }

      // Add vehicle
      const { error: vehicleError } = await supabase
        .from('vehicles')
        .insert({
          driver_id: driver.id,
          type: vehicleType,
          make: make.trim(),
          model: model.trim(),
          year: yearNum,
          color: color.trim(),
          registration_number: registrationNumber.trim().toUpperCase(),
          seat_count: seats,
          is_active: true,
        });

      if (vehicleError) {
        console.error('Vehicle error:', vehicleError);
        // Driver was created but vehicle failed - still show success
        Alert.alert(
          'Partial Success',
          'You are registered as a driver but there was an issue adding your vehicle. You can add it later.',
          [{ text: 'OK', onPress: () => onNavigate('home') }]
        );
        return;
      }

      Alert.alert(
        'Welcome, Driver! 🎉',
        `You're now registered as a driver with your ${color} ${make} ${model}. Start creating trips to earn money!`,
        [{ text: 'Start Driving', onPress: () => onNavigate('home') }]
      );
    } catch (error) {
      console.error('Registration error:', error);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => step === 1 ? onNavigate('home') : setStep(1)} 
          style={styles.backButton}
        >
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {step === 1 ? 'Become a Driver' : 'Add Your Vehicle'}
        </Text>
        <View style={styles.placeholder} />
      </View>

      {/* Progress */}
      <View style={styles.progress}>
        <View style={[styles.progressStep, styles.progressStepActive]}>
          <Text style={styles.progressNumber}>1</Text>
        </View>
        <View style={[styles.progressLine, step >= 2 && styles.progressLineActive]} />
        <View style={[styles.progressStep, step >= 2 && styles.progressStepActive]}>
          <Text style={styles.progressNumber}>2</Text>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {step === 1 ? (
          <>
            {/* Driver Info */}
            <View style={styles.infoCard}>
              <Text style={styles.infoIcon}>🚗</Text>
              <Text style={styles.infoTitle}>Start Earning Today</Text>
              <Text style={styles.infoText}>
                Register as a driver to create trips and earn money by offering rides to passengers going your way.
              </Text>
            </View>

            <Text style={styles.label}>First Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Your first name"
              value={firstName}
              onChangeText={setFirstName}
              autoCapitalize="words"
            />

            <Text style={styles.label}>Last Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Your last name"
              value={lastName}
              onChangeText={setLastName}
              autoCapitalize="words"
            />

            <Text style={styles.label}>Phone Number</Text>
            <TextInput
              style={styles.input}
              placeholder="+263..."
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              keyboardType="phone-pad"
            />

            <Button
              title="Next: Add Vehicle"
              onPress={handleNext}
              size="large"
              style={styles.nextButton}
            />
          </>
        ) : (
          <>
            {/* Vehicle Type */}
            <Text style={styles.sectionTitle}>Vehicle Type</Text>
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

            {/* Make */}
            <Text style={styles.label}>Make (Brand)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Toyota, Honda, Ford"
              value={make}
              onChangeText={setMake}
              autoCapitalize="words"
            />

            {/* Model */}
            <Text style={styles.label}>Model</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Corolla, Civic, Focus"
              value={model}
              onChangeText={setModel}
              autoCapitalize="words"
            />

            {/* Year */}
            <Text style={styles.label}>Year</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., 2020"
              value={year}
              onChangeText={setYear}
              keyboardType="number-pad"
              maxLength={4}
            />

            {/* Color */}
            <Text style={styles.label}>Color</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Silver, Black, White"
              value={color}
              onChangeText={setColor}
              autoCapitalize="words"
            />

            {/* Registration Number */}
            <Text style={styles.label}>Registration Number</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., ABC 1234"
              value={registrationNumber}
              onChangeText={setRegistrationNumber}
              autoCapitalize="characters"
            />

            {/* Seat Count */}
            <Text style={styles.label}>Number of Passenger Seats</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., 4"
              value={seatCount}
              onChangeText={setSeatCount}
              keyboardType="number-pad"
              maxLength={2}
            />
            <Text style={styles.seatHint}>
              How many passengers can you carry? (excluding driver)
            </Text>

            {/* Preview */}
            {make && model && (
              <View style={styles.preview}>
                <Text style={styles.previewTitle}>Your Vehicle</Text>
                <View style={styles.previewCard}>
                  <Text style={styles.previewIcon}>
                    {VEHICLE_TYPES.find(t => t.type === vehicleType)?.icon || '🚗'}
                  </Text>
                  <View style={styles.previewInfo}>
                    <Text style={styles.previewName}>{make} {model}</Text>
                    <Text style={styles.previewDetails}>
                      {year} • {color || 'Color'} • {registrationNumber || 'REG NUM'}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Submit Button */}
            <Button
              title={isSubmitting ? 'Registering...' : 'Complete Registration'}
              onPress={handleSubmit}
              loading={isSubmitting}
              size="large"
              style={styles.submitButton}
            />
          </>
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: COLORS.surface,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backIcon: {
    fontSize: 22,
    color: COLORS.text,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  placeholder: {
    width: 40,
  },
  progress: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    backgroundColor: COLORS.surface,
    gap: 0,
  },
  progressStep: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressStepActive: {
    backgroundColor: COLORS.primary,
  },
  progressNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  progressLine: {
    width: 60,
    height: 4,
    backgroundColor: '#E5E7EB',
  },
  progressLineActive: {
    backgroundColor: COLORS.primary,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  infoCard: {
    backgroundColor: COLORS.primary + '10',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
  },
  infoIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  infoTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 12,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
  },
  typeCard: {
    width: '48%',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  typeCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '10',
  },
  typeIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  typeName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  typeNameSelected: {
    color: COLORS.primary,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: COLORS.text,
  },
  seatHint: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 6,
    marginLeft: 4,
  },
  preview: {
    marginTop: 32,
    marginBottom: 16,
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 12,
  },
  previewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary + '15',
    borderRadius: 16,
    padding: 20,
  },
  previewIcon: {
    fontSize: 40,
    marginRight: 16,
  },
  previewInfo: {
    flex: 1,
  },
  previewName: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  previewDetails: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  nextButton: {
    marginTop: 32,
  },
  submitButton: {
    marginTop: 24,
  },
  bottomPadding: {
    height: 40,
  },
});

