// Show QR Screen - Rider shows QR code to driver for payment
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { COLORS } from '../../theme';
import { Screen } from '../../types';
import { Button } from '../../components';
import { useTripStore, useAuthStore } from '../../stores';
import { getBookingQRCode, subscribeToBooking } from '../../api/trips';
import { getOrCreateConversation } from '../../api/messaging';

interface Props {
  onNavigate: (screen: Screen, params?: any) => void;
}

export function ShowQRScreen({ onNavigate }: Props) {
  const { activeBooking, setActiveBooking, selectedTrip } = useTripStore();
  const { user } = useAuthStore();
  const [qrData, setQrData] = useState<{ qrToken: string; bookingData: any } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpeningChat, setIsOpeningChat] = useState(false);

  async function handleMessageDriver() {
    if (!activeBooking || !user) {
      Alert.alert('Error', 'Cannot open chat - booking details not found');
      return;
    }

    setIsOpeningChat(true);
    try {
      // Get driver ID from booking's trip data or selectedTrip
      let driverId = selectedTrip?.owner_id || selectedTrip?.driver_id;
      
      // If selectedTrip not available, fetch driver from booking's trip
      if (!driverId && activeBooking.trip_id) {
        const { supabase } = await import('../../api/supabase');
        const { data: trip } = await supabase
          .from('trips')
          .select('owner_id')
          .eq('id', activeBooking.trip_id)
          .single();
        driverId = trip?.owner_id;
      }

      if (!driverId) {
        Alert.alert('Error', 'Driver information not found');
        return;
      }

      const { conversation, error } = await getOrCreateConversation(
        activeBooking.id,
        activeBooking.trip_id,
        driverId,
        user.id
      );

      if (error || !conversation) {
        console.error('Chat error:', error);
        Alert.alert('Error', error || 'Could not open chat');
        return;
      }

      // Navigate to chat
      onNavigate('chat', {
        conversationId: conversation.id,
        otherUserName: 'Driver',
        isDriver: false,
      });
    } catch (error: any) {
      console.error('Open chat error:', error);
      Alert.alert('Error', error?.message || 'Failed to open chat');
    } finally {
      setIsOpeningChat(false);
    }
  }

  useEffect(() => {
    loadQRCode();
    
    // Subscribe to booking updates
    let unsubscribe: (() => void) | null = null;
    if (activeBooking?.id) {
      unsubscribe = subscribeToBooking(activeBooking.id, (updatedBooking) => {
        setActiveBooking(updatedBooking);
        
        // If payment completed, show success
        if (updatedBooking.payment_status === 'paid') {
          Alert.alert(
            'Payment Successful! 🎉',
            `$${(updatedBooking.fare || 0).toFixed(2)} has been paid.\n\nEnjoy your ride!`,
            [{ text: 'OK', onPress: () => onNavigate('commuter-home') }]
          );
        }
      });
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBooking?.id]);

  async function loadQRCode() {
    if (!activeBooking?.id) {
      Alert.alert('Error', 'No active booking found');
      onNavigate('home');
      return;
    }

    setIsLoading(true);
    try {
      const data = await getBookingQRCode(activeBooking.id);
      if (data) {
        setQrData(data);
      } else {
        Alert.alert('Error', 'Failed to generate QR code');
      }
    } catch (error) {
      console.error('Load QR error:', error);
      Alert.alert('Error', 'Failed to load QR code');
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Generating QR Code...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => onNavigate('commuter-home')}
        >
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle}>Your Ride Pass</Text>
          <Text style={styles.headerSubtitle}>Show this QR code to the driver</Text>
        </View>
        <View style={styles.headerPlaceholder} />
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
      {/* QR Code Display */}
      <View style={styles.qrContainer}>
        <View style={styles.qrBox}>
          {qrData?.qrToken ? (
            <QRCode
              value={JSON.stringify({
                token: qrData.qrToken,
                bookingId: activeBooking?.id,
                amount: activeBooking?.fare || 0,
                seats: activeBooking?.seats || 1,
              })}
              size={200}
              color={COLORS.text}
              backgroundColor="#FFFFFF"
            />
          ) : (
            <View style={styles.qrPlaceholder}>
              <Text style={styles.qrToken}>Loading...</Text>
            </View>
          )}
        </View>

        {/* Token Display */}
        <View style={styles.tokenContainer}>
          <Text style={styles.tokenLabel}>Booking Code</Text>
          <Text style={styles.tokenValue}>{qrData?.qrToken}</Text>
        </View>
      </View>

      {/* Booking Details */}
      <View style={styles.detailsContainer}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Amount</Text>
          <Text style={styles.detailValue}>${(activeBooking?.fare || 0).toFixed(2)}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Seats</Text>
          <Text style={styles.detailValue}>{activeBooking?.seats || 1}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Service Fee (2.5%)</Text>
          <Text style={styles.detailValue}>
            ${((activeBooking?.fare || 0) * 0.025).toFixed(2)}
          </Text>
        </View>
        <View style={[styles.detailRow, styles.totalRow]}>
          <Text style={styles.totalLabel}>Total to Pay</Text>
          <Text style={styles.totalValue}>
            ${((activeBooking?.fare || 0) * 1.025).toFixed(2)}
          </Text>
        </View>
      </View>

      {/* Vehicle Info - Help rider identify the car */}
      {selectedTrip?.vehicle_info && (
        <View style={styles.vehicleCard}>
          <Text style={styles.vehicleTitle}>🚗 Look for this vehicle:</Text>
          <View style={styles.vehicleDetails}>
            <Text style={styles.vehicleMake}>
              {selectedTrip.vehicle_info.make} {selectedTrip.vehicle_info.model}
            </Text>
            <Text style={styles.vehicleColor}>
              {selectedTrip.vehicle_info.color}
            </Text>
            <Text style={styles.vehiclePlate}>
              {selectedTrip.vehicle_info.registration_number}
            </Text>
          </View>
        </View>
      )}

      {/* Status */}
      <View style={styles.statusContainer}>
        <View style={styles.statusDot} />
        <Text style={styles.statusText}>Waiting for driver to scan...</Text>
      </View>

      {/* Instructions */}
      <View style={styles.instructions}>
        <Text style={styles.instructionsTitle}>How it works:</Text>
        <Text style={styles.instructionItem}>1. Show this QR code to the driver</Text>
        <Text style={styles.instructionItem}>2. Driver scans and payment is instant</Text>
        <Text style={styles.instructionItem}>3. Amount is deducted from your wallet</Text>
      </View>

      {/* View Map Button */}
      <Button
        title="🗺️ View Driver on Map"
        onPress={() => onNavigate('rider-map')}
        style={styles.mapButton}
      />

      {/* Message Driver Button */}
      <Button
        title={isOpeningChat ? "Opening..." : "💬 Message Driver"}
        onPress={handleMessageDriver}
        disabled={isOpeningChat}
        style={styles.messageButton}
      />

      {/* Back Button */}
      <Button
        title="Back to Home"
        onPress={() => onNavigate('commuter-home')}
        variant="outline"
        style={styles.homeButton}
      />
      
      <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  loadingText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginTop: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: COLORS.primary,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backIcon: {
    fontSize: 22,
    color: '#FFFFFF',
  },
  headerTextContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerPlaceholder: {
    width: 40,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  qrContainer: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  qrBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  qrPlaceholder: {
    width: 200,
    height: 200,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  qrToken: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  tokenContainer: {
    marginTop: 20,
    alignItems: 'center',
  },
  tokenLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  tokenValue: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.primary,
    marginTop: 4,
    letterSpacing: 2,
  },
  detailsContainer: {
    marginHorizontal: 20,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 20,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  detailLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
  },
  totalRow: {
    borderBottomWidth: 0,
    marginTop: 8,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.primary,
  },
  vehicleCard: {
    backgroundColor: '#FEF3C7',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 20,
    marginTop: 16,
    alignItems: 'center',
  },
  vehicleTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400E',
    marginBottom: 8,
  },
  vehicleDetails: {
    alignItems: 'center',
  },
  vehicleMake: {
    fontSize: 18,
    fontWeight: '700',
    color: '#78350F',
  },
  vehicleColor: {
    fontSize: 14,
    color: '#92400E',
    marginTop: 4,
  },
  vehiclePlate: {
    fontSize: 16,
    fontWeight: '700',
    color: '#78350F',
    backgroundColor: '#FDE68A',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 8,
    letterSpacing: 1,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.warning,
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  instructions: {
    marginHorizontal: 20,
    marginTop: 24,
    backgroundColor: COLORS.primary + '10',
    borderRadius: 12,
    padding: 16,
  },
  instructionsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
    marginBottom: 10,
  },
  instructionItem: {
    fontSize: 13,
    color: COLORS.text,
    marginBottom: 6,
  },
  mapButton: {
    marginHorizontal: 20,
    marginTop: 16,
  },
  messageButton: {
    marginHorizontal: 20,
    marginTop: 12,
    backgroundColor: '#3B82F6',
  },
  homeButton: {
    marginHorizontal: 20,
    marginTop: 12,
  },
  bottomPadding: {
    height: 40,
  },
});

