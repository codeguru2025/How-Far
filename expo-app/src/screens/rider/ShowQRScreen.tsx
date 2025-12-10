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
import { useTripStore } from '../../stores';
import { getBookingQRCode, subscribeToBooking } from '../../api/trips';

interface Props {
  onNavigate: (screen: Screen) => void;
}

export function ShowQRScreen({ onNavigate }: Props) {
  const { activeBooking, setActiveBooking } = useTripStore();
  const [qrData, setQrData] = useState<{ qrToken: string; bookingData: any } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
  homeButton: {
    marginHorizontal: 20,
    marginTop: 12,
  },
  bottomPadding: {
    height: 40,
  },
});

