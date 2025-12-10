// Add Vehicle Screen - Driver adds a new vehicle
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

interface Props {
  onNavigate: (screen: Screen) => void;
}

const VEHICLE_TYPES: { type: VehicleType; name: string; icon: string }[] = [
  { type: 'sedan', name: 'Sedan', icon: '🚗' },
  { type: 'suv', name: 'SUV', icon: '🚙' },
  { type: 'minivan', name: 'Minivan', icon: '🚐' },
  { type: 'motorcycle', name: 'Motorcycle', icon: '🏍️' },
];

export function AddVehicleScreen({ onNavigate }: Props) {
  const { user } = useAuthStore();
  const [vehicleType, setVehicleType] = useState<VehicleType>('sedan');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [color, setColor] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    // Validation
    if (!make.trim() || !model.trim() || !color.trim() || !registrationNumber.trim()) {
      Alert.alert('Missing Info', 'Please fill in all fields');
      return;
    }

    const yearNum = parseInt(year);
    if (isNaN(yearNum) || yearNum < 1990 || yearNum > new Date().getFullYear() + 1) {
      Alert.alert('Invalid Year', 'Please enter a valid year (1990 - present)');
      return;
    }

    setIsSubmitting(true);
    try {
      // Get driver ID
      const { data: driver, error: driverError } = await supabase
        .from('drivers')
        .select('id')
        .eq('user_id', user?.id)
        .single();

      if (driverError || !driver) {
        Alert.alert('Error', 'You are not registered as a driver');
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
          is_active: true,
        });

      if (vehicleError) {
        if (vehicleError.code === '23505') {
          Alert.alert('Error', 'This registration number is already registered');
        } else {
          console.error('Vehicle error:', vehicleError);
          Alert.alert('Error', 'Failed to add vehicle. Please try again.');
        }
        setIsSubmitting(false);
        return;
      }

      Alert.alert(
        'Vehicle Added! 🎉',
        `Your ${color} ${make} ${model} has been registered.`,
        [{ text: 'OK', onPress: () => onNavigate('driver-home') }]
      );
    } catch (error) {
      console.error('Add vehicle error:', error);
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
        <TouchableOpacity onPress={() => onNavigate('driver-home')} style={styles.backButton}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Vehicle</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
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
          title={isSubmitting ? 'Adding Vehicle...' : 'Add Vehicle'}
          onPress={handleSubmit}
          loading={isSubmitting}
          size="large"
          style={styles.submitButton}
        />

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
  content: {
    flex: 1,
    padding: 20,
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
  submitButton: {
    marginTop: 24,
  },
  bottomPadding: {
    height: 40,
  },
});

