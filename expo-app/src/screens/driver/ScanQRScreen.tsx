// Scan QR Screen - Driver scans rider's QR code for payment
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { COLORS } from '../../theme';
import { Screen, QRPaymentResult } from '../../types';
import { Button } from '../../components';
import { supabase } from '../../api/supabase';
import { useWalletStore } from '../../stores';

interface Props {
  onNavigate: (screen: Screen) => void;
}

export function ScanQRScreen({ onNavigate }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [qrCode, setQrCode] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentResult, setPaymentResult] = useState<QRPaymentResult | null>(null);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const { fetchWallet } = useWalletStore();

  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission]);

  async function handleBarCodeScanned({ data }: { type: string; data: string }) {
    setScanned(true);
    
    try {
      // Parse the QR code data
      const qrData = JSON.parse(data);
      if (__DEV__) console.log('Scanned QR data:', qrData);
      
      if (qrData.token && qrData.bookingId) {
        await processPayment(qrData.bookingId, qrData.amount || 0);
      } else {
        Alert.alert('Invalid QR Code', 'This QR code is not a valid booking code.');
        setScanned(false);
      }
    } catch {
      // If not JSON, try as plain token
      if (data.startsWith('QR-')) {
        setQrCode(data);
        await processPaymentByToken(data);
      } else {
        Alert.alert('Invalid QR Code', 'Could not read the QR code.');
        setScanned(false);
      }
    }
  }

  async function processPayment(bookingId: string, amount: number) {
    setIsProcessing(true);
    
    try {
      // Get booking details
      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .select('*, trips(*)')
        .eq('id', bookingId)
        .single();

      if (bookingError || !booking) {
        Alert.alert('Error', 'Booking not found');
        setScanned(false);
        setIsProcessing(false);
        return;
      }

      if (booking.payment_status === 'paid') {
        Alert.alert('Already Paid', 'This booking has already been paid.');
        setScanned(false);
        setIsProcessing(false);
        return;
      }

      const fareAmount = booking.fare || amount;
      const riderFee = Math.round(fareAmount * 0.025 * 100) / 100; // 2.5%
      const driverFee = Math.round(fareAmount * 0.075 * 100) / 100; // 7.5%
      const riderTotal = fareAmount + riderFee;
      const driverReceives = fareAmount - driverFee;

      // Get rider's wallet
      const { data: riderWallet, error: riderWalletError } = await supabase
        .from('wallets')
        .select('id, balance')
        .eq('user_id', booking.commuter_id)
        .single();

      if (riderWalletError || !riderWallet) {
        Alert.alert('Error', 'Rider wallet not found');
        setScanned(false);
        setIsProcessing(false);
        return;
      }

      if (riderWallet.balance < riderTotal) {
        Alert.alert('Insufficient Funds', `Rider doesn't have enough balance. Needs $${riderTotal.toFixed(2)}`);
        setScanned(false);
        setIsProcessing(false);
        return;
      }

      // Get driver's wallet (from trip)
      const { data: driver } = await supabase
        .from('drivers')
        .select('user_id')
        .eq('id', booking.trips?.driver_id)
        .single();

      if (!driver) {
        Alert.alert('Error', 'Driver not found');
        setScanned(false);
        setIsProcessing(false);
        return;
      }

      const { data: driverWallet } = await supabase
        .from('wallets')
        .select('id, balance')
        .eq('user_id', driver.user_id)
        .single();

      // Deduct from rider
      await supabase
        .from('wallets')
        .update({ balance: riderWallet.balance - riderTotal })
        .eq('id', riderWallet.id);

      // Credit driver
      if (driverWallet) {
        await supabase
          .from('wallets')
          .update({ balance: driverWallet.balance + driverReceives })
          .eq('id', driverWallet.id);
      }

      // Update booking status
      await supabase
        .from('bookings')
        .update({ 
          status: 'completed',
          payment_status: 'paid',
        })
        .eq('id', bookingId);

      // Refresh driver's wallet
      if (driver.user_id) {
        await fetchWallet(driver.user_id);
      }

      // Show success
      setPaymentResult({
        success: true,
        amount_paid: riderTotal,
        rider_fee: riderFee,
        driver_fee: driverFee,
        driver_received: driverReceives,
      });

    } catch (error) {
      console.error('Payment error:', error);
      Alert.alert('Error', 'Payment processing failed');
      setScanned(false);
    } finally {
      setIsProcessing(false);
    }
  }

  async function processPaymentByToken(token: string) {
    setIsProcessing(true);
    
    try {
      // Extract booking ID from token (QR-XXXXXXXX format)
      const bookingIdPrefix = token.replace('QR-', '').toLowerCase();
      
      // Find booking by ID prefix
      const { data: bookings } = await supabase
        .from('bookings')
        .select('id')
        .ilike('id', `${bookingIdPrefix}%`)
        .limit(1);

      if (bookings && bookings.length > 0) {
        await processPayment(bookings[0].id, 0);
      } else {
        Alert.alert('Not Found', 'Could not find booking with this code');
        setScanned(false);
      }
    } catch (error) {
      console.error('Token lookup error:', error);
      Alert.alert('Error', 'Could not process code');
      setScanned(false);
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleManualProcess() {
    if (!qrCode.trim()) {
      Alert.alert('Error', 'Please enter the QR code');
      return;
    }
    await processPaymentByToken(qrCode.trim().toUpperCase());
  }

  function handleNewScan() {
    setQrCode('');
    setPaymentResult(null);
    setScanned(false);
    setShowManualEntry(false);
  }

  if (paymentResult?.success) {
    return (
      <View style={styles.container}>
        {/* Success Screen */}
        <View style={styles.successContainer}>
          <View style={styles.successIcon}>
            <Text style={styles.successIconText}>✓</Text>
          </View>
          <Text style={styles.successTitle}>Payment Received!</Text>
          <Text style={styles.successSubtitle}>The rider has been charged successfully</Text>

          <View style={styles.paymentDetails}>
            <View style={styles.paymentRow}>
              <Text style={styles.paymentLabel}>Total Ride</Text>
              <Text style={styles.paymentValue}>${paymentResult.amount_paid?.toFixed(2)}</Text>
            </View>
            <View style={styles.paymentRow}>
              <Text style={styles.paymentLabel}>Platform Fee (7.5%)</Text>
              <Text style={[styles.paymentValue, styles.feeText]}>
                -${paymentResult.driver_fee?.toFixed(2)}
              </Text>
            </View>
            <View style={[styles.paymentRow, styles.totalPaymentRow]}>
              <Text style={styles.totalLabel}>You Receive</Text>
              <Text style={styles.totalAmount}>${paymentResult.driver_received?.toFixed(2)}</Text>
            </View>
          </View>

          <View style={styles.successActions}>
            <Button
              title="Scan Another"
              onPress={handleNewScan}
              variant="outline"
              style={styles.actionButton}
            />
            <Button
              title="Back to Dashboard"
              onPress={() => onNavigate('trip-dashboard')}
              style={styles.actionButton}
            />
          </View>
        </View>
      </View>
    );
  }

  if (!permission) {
    return (
      <View style={styles.container}>
        <Text style={styles.permissionText}>Requesting camera permission...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => onNavigate('trip-dashboard')} style={styles.backButton}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Scan QR Code</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.noPermission}>
          <Text style={styles.noPermissionIcon}>📷</Text>
          <Text style={styles.noPermissionText}>Camera permission denied</Text>
          <Text style={styles.noPermissionSubtext}>Please enable camera access in settings</Text>
          <Button
            title="Use Manual Entry"
            onPress={() => setShowManualEntry(true)}
            variant="outline"
            style={{ marginTop: 20 }}
          />
        </View>
        {showManualEntry && (
          <View style={styles.manualContainer}>
            <Text style={styles.manualLabel}>Enter QR Code Manually</Text>
            <TextInput
              style={styles.codeInput}
              placeholder="e.g., QR-ABC12345"
              value={qrCode}
              onChangeText={setQrCode}
              autoCapitalize="characters"
              autoCorrect={false}
            />
            <Button
              title={isProcessing ? 'Processing...' : 'Process Payment'}
              onPress={handleManualProcess}
              loading={isProcessing}
              size="large"
            />
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => onNavigate('trip-dashboard')} style={styles.backButton}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Scan QR Code</Text>
        <TouchableOpacity onPress={() => setShowManualEntry(!showManualEntry)} style={styles.keyboardButton}>
          <Text style={styles.keyboardIcon}>⌨️</Text>
        </TouchableOpacity>
      </View>

      {!showManualEntry ? (
        <>
          {/* Camera Scanner */}
          <View style={styles.scannerContainer}>
            <CameraView
              style={StyleSheet.absoluteFillObject}
              facing="back"
              barcodeScannerSettings={{
                barcodeTypes: ['qr'],
              }}
              onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
            />
            <View style={styles.overlay}>
              <View style={styles.scanFrame}>
                <View style={[styles.corner, styles.cornerTopLeft]} />
                <View style={[styles.corner, styles.cornerTopRight]} />
                <View style={[styles.corner, styles.cornerBottomLeft]} />
                <View style={[styles.corner, styles.cornerBottomRight]} />
              </View>
            </View>
          </View>

          {/* Instructions */}
          <View style={styles.instructions}>
            <Text style={styles.instructionsText}>
              {isProcessing ? 'Processing payment...' : 
               scanned ? 'QR Code detected!' : 
               'Point camera at rider\'s QR code'}
            </Text>
          </View>

          {scanned && !isProcessing && (
            <Button
              title="Tap to Scan Again"
              onPress={() => setScanned(false)}
              variant="outline"
              style={styles.rescanButton}
            />
          )}
        </>
      ) : (
        <View style={styles.manualFullContainer}>
          <Text style={styles.manualTitle}>Enter Code Manually</Text>
          <Text style={styles.manualSubtitle}>
            Ask the rider for their booking code
          </Text>
          
          <TextInput
            style={styles.codeInput}
            placeholder="e.g., QR-ABC12345"
            value={qrCode}
            onChangeText={setQrCode}
            autoCapitalize="characters"
            autoCorrect={false}
          />
          
          <Button
            title={isProcessing ? 'Processing...' : 'Process Payment'}
            onPress={handleManualProcess}
            loading={isProcessing}
            size="large"
            style={styles.processButton}
          />
          
          <Button
            title="Use Camera Instead"
            onPress={() => setShowManualEntry(false)}
            variant="outline"
            style={styles.switchButton}
          />
        </View>
      )}

      {/* How it works */}
      <View style={styles.howItWorks}>
        <Text style={styles.howItWorksTitle}>💡 Payment breakdown:</Text>
        <Text style={styles.howItWorksText}>
          Rider pays: Fare + 2.5% fee{'\n'}
          You receive: Fare - 7.5% fee
        </Text>
      </View>
    </View>
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
  keyboardButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyboardIcon: {
    fontSize: 20,
  },
  placeholder: {
    width: 40,
  },
  permissionText: {
    flex: 1,
    textAlign: 'center',
    marginTop: 100,
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  noPermission: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  noPermissionIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  noPermissionText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  noPermissionSubtext: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 8,
  },
  scannerContainer: {
    flex: 1,
    overflow: 'hidden',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  scanFrame: {
    width: 250,
    height: 250,
    backgroundColor: 'transparent',
  },
  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: '#FFFFFF',
  },
  cornerTopLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
  },
  cornerTopRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
  },
  cornerBottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
  },
  cornerBottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
  },
  instructions: {
    backgroundColor: COLORS.surface,
    padding: 20,
    alignItems: 'center',
  },
  instructionsText: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.text,
  },
  rescanButton: {
    margin: 20,
  },
  manualContainer: {
    margin: 20,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 20,
  },
  manualFullContainer: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  manualTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  manualSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
  },
  manualLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 12,
  },
  codeInput: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 16,
    fontSize: 20,
    textAlign: 'center',
    letterSpacing: 2,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 20,
  },
  processButton: {
    marginBottom: 16,
  },
  switchButton: {
    marginTop: 8,
  },
  howItWorks: {
    margin: 20,
    backgroundColor: COLORS.primary + '10',
    borderRadius: 12,
    padding: 16,
  },
  howItWorksTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
    marginBottom: 8,
  },
  howItWorksText: {
    fontSize: 13,
    color: COLORS.text,
    lineHeight: 20,
  },
  // Success screen styles
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  successIconText: {
    fontSize: 40,
    color: '#FFFFFF',
  },
  successTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.text,
  },
  successSubtitle: {
    fontSize: 15,
    color: COLORS.textSecondary,
    marginTop: 8,
  },
  paymentDetails: {
    width: '100%',
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 20,
    marginTop: 32,
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  paymentLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  paymentValue: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
  },
  feeText: {
    color: '#EF4444',
  },
  totalPaymentRow: {
    borderBottomWidth: 0,
    marginTop: 8,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  totalAmount: {
    fontSize: 24,
    fontWeight: '800',
    color: '#10B981',
  },
  successActions: {
    flexDirection: 'row',
    marginTop: 32,
    gap: 12,
  },
  actionButton: {
    flex: 1,
  },
});
