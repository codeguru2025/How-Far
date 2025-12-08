import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  Alert,
  TextInput,
  Modal,
  Animated,
} from 'react-native';
import { CameraView, Camera, BarcodeScanningResult } from 'expo-camera';
import { useRouter } from 'expo-router';
import { CheckCircle, XCircle, LogOut, ScanLine, Hash } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useApp } from '@/contexts/AppContext';
import { Ride } from '@/types';

export default function OperatorHomeScreen() {
  const router = useRouter();
  const { user, addRide, logout } = useApp();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [scanResult, setScanResult] = useState<'success' | 'error' | null>(null);
  const [manualToken, setManualToken] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const successAnim = new Animated.Value(0);

  useEffect(() => {
    const getCameraPermissions = async () => {
      if (Platform.OS === 'web') {
        setHasPermission(true);
        return;
      }
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    };

    getCameraPermissions();
  }, []);

  const handleBarCodeScanned = ({ data }: BarcodeScanningResult) => {
    if (scanned) return;

    setScanned(true);
    processQRCode(data);
  };

  const processQRCode = async (qrToken: string) => {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    setScanResult('success');

    Animated.sequence([
      Animated.timing(successAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.delay(1500),
      Animated.timing(successAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();

    const ride: Ride = {
      id: Date.now().toString(),
      subscriptionId: 'sub-' + Date.now(),
      operatorId: user?.id || '',
      operatorName: user?.name || 'Unknown',
      route: 'CBD - Chitungwiza',
      timestamp: new Date().toISOString(),
      qrToken,
    };

    await addRide(ride);

    Alert.alert(
      'Ride Validated! ✅',
      'The commuter can now board the vehicle.',
      [
        {
          text: 'OK',
          onPress: () => {
            setScanned(false);
            setScanResult(null);
          },
        },
      ]
    );
  };

  const handleManualSubmit = () => {
    if (manualToken.trim().length < 5) {
      Alert.alert('Invalid Token', 'Please enter a valid QR token');
      return;
    }
    
    setShowManualInput(false);
    processQRCode(manualToken);
    setManualToken('');
  };

  const handleLogout = () => {
    logout();
    router.replace('/' as any);
  };

  if (hasPermission === null) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Requesting camera permission...</Text>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={styles.loadingContainer}>
        <XCircle size={64} color={Colors.error} />
        <Text style={styles.errorTitle}>No Camera Access</Text>
        <Text style={styles.errorText}>
          Please enable camera permissions to scan QR codes
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {Platform.OS === 'web' ? (
        <View style={styles.webPlaceholder}>
          <ScanLine size={80} color={Colors.primary} strokeWidth={1.5} />
          <Text style={styles.webText}>
            Camera is not available on web. Use manual input below.
          </Text>
        </View>
      ) : (
        <CameraView
          style={styles.camera}
          facing="back"
          onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
          barcodeScannerSettings={{
            barcodeTypes: ['qr'],
          }}
        >
          <View style={styles.overlay}>
            <View style={styles.scanFrame}>
              <View style={[styles.corner, styles.cornerTopLeft]} />
              <View style={[styles.corner, styles.cornerTopRight]} />
              <View style={[styles.corner, styles.cornerBottomLeft]} />
              <View style={[styles.corner, styles.cornerBottomRight]} />
            </View>
          </View>
        </CameraView>
      )}

      <View style={styles.footer}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.operatorName}>{user?.name}</Text>
            <Text style={styles.operatorSubtext}>Ready to scan</Text>
          </View>
          <Pressable onPress={handleLogout} style={styles.logoutButton}>
            <LogOut size={20} color={Colors.textSecondary} />
          </Pressable>
        </View>

        <View style={styles.instructions}>
          <Text style={styles.instructionTitle}>📱 How to scan</Text>
          <Text style={styles.instructionText}>
            Point the camera at the commuter&apos;s QR code. The ride will be validated automatically.
          </Text>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.manualButton,
            pressed && styles.manualButtonPressed,
          ]}
          onPress={() => setShowManualInput(true)}
        >
          <Hash size={20} color={Colors.primary} />
          <Text style={styles.manualButtonText}>Enter Token Manually</Text>
        </Pressable>
      </View>

      {scanResult === 'success' && (
        <Animated.View
          style={[
            styles.resultOverlay,
            {
              opacity: successAnim,
              transform: [
                {
                  scale: successAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.8, 1],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={[styles.resultCard, styles.resultSuccess]}>
            <CheckCircle size={64} color={Colors.success} strokeWidth={2} />
            <Text style={styles.resultTitle}>Validated!</Text>
            <Text style={styles.resultText}>Ride confirmed successfully</Text>
          </View>
        </Animated.View>
      )}

      <Modal
        visible={showManualInput}
        animationType="slide"
        transparent
        onRequestClose={() => setShowManualInput(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Enter QR Token</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Paste or type the token"
              placeholderTextColor={Colors.textSecondary}
              value={manualToken}
              onChangeText={setManualToken}
              autoFocus
              multiline
            />
            <View style={styles.modalButtons}>
              <Pressable
                style={[styles.modalButton, styles.modalButtonSecondary]}
                onPress={() => {
                  setShowManualInput(false);
                  setManualToken('');
                }}
              >
                <Text style={styles.modalButtonTextSecondary}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={handleManualSubmit}
              >
                <Text style={styles.modalButtonText}>Validate</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  camera: {
    flex: 1,
  },
  webPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.backgroundSecondary,
    padding: 40,
  },
  webText: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 24,
    lineHeight: 24,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanFrame: {
    width: 280,
    height: 280,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: Colors.textInverse,
    borderWidth: 4,
  },
  cornerTopLeft: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderTopLeftRadius: 12,
  },
  cornerTopRight: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
    borderTopRightRadius: 12,
  },
  cornerBottomLeft: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
    borderBottomLeftRadius: 12,
  },
  cornerBottomRight: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderBottomRightRadius: 12,
  },
  footer: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  operatorName: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  operatorSubtext: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  logoutButton: {
    padding: 8,
  },
  instructions: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  instructionTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 6,
  },
  instructionText: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  manualButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.backgroundSecondary,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  manualButtonPressed: {
    opacity: 0.8,
  },
  manualButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    backgroundColor: Colors.background,
  },
  loadingText: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '800' as const,
    color: Colors.text,
    marginTop: 24,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  resultOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  resultCard: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    padding: 40,
    alignItems: 'center',
    minWidth: 280,
  },
  resultSuccess: {
    borderWidth: 4,
    borderColor: Colors.success,
  },
  resultTitle: {
    fontSize: 28,
    fontWeight: '800' as const,
    color: Colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  resultText: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '800' as const,
    color: Colors.text,
    marginBottom: 20,
  },
  modalInput: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: Colors.text,
    marginBottom: 20,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalButtonPrimary: {
    backgroundColor: Colors.primary,
  },
  modalButtonSecondary: {
    backgroundColor: Colors.backgroundSecondary,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.textInverse,
  },
  modalButtonTextSecondary: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
  },
});
