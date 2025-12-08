import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Alert,
  Dimensions,
  RefreshControl,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Rect } from 'react-native-svg';
import * as Location from 'expo-location';
import {
  Power,
  MapPin,
  QrCode,
  Wallet,
  Clock,
  Star,
  TrendingUp,
  Navigation,
  RefreshCw,
  Settings,
  Bell,
  AlertTriangle,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useApp } from '@/contexts/AppContext';
import { generateQRMatrix } from '@/utils/qrcode';

const { width } = Dimensions.get('window');
const QR_SIZE = width - 120;
const CELL_SIZE = QR_SIZE / 21;

type DriverStatus = 'OFFLINE' | 'ONLINE' | 'ON_TRIP';

interface DriverStats {
  todayRides: number;
  todayEarnings: number;
  weekEarnings: number;
  rating: number;
  totalTrips: number;
}

export default function DriverHomeScreen() {
  const router = useRouter();
  const { user, driver, wallet, saveDriver, logout } = useApp();
  const [status, setStatus] = useState<DriverStatus>('OFFLINE');
  const [showQR, setShowQR] = useState(false);
  const [qrAmount, setQrAmount] = useState(1.0);
  const [qrCode, setQrCode] = useState('');
  const [qrMatrix, setQrMatrix] = useState<boolean[][]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [locationPermission, setLocationPermission] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  
  const [stats, setStats] = useState<DriverStats>({
    todayRides: 0,
    todayEarnings: 0,
    weekEarnings: 0,
    rating: driver?.rating || 4.8,
    totalTrips: driver?.totalTrips || 0,
  });

  useEffect(() => {
    checkLocationPermission();
    loadDriverStats();
  }, []);

  const checkLocationPermission = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    setLocationPermission(status === 'granted');
    
    if (status === 'granted') {
      const location = await Location.getCurrentPositionAsync({});
      setCurrentLocation({
        lat: location.coords.latitude,
        lng: location.coords.longitude,
      });
    }
  };

  const loadDriverStats = async () => {
    // In production, fetch from API
    // const stats = await driversApi.getStatistics();
    setStats({
      todayRides: 12,
      todayEarnings: 18.50,
      weekEarnings: 87.25,
      rating: driver?.rating || 4.8,
      totalTrips: driver?.totalTrips || 156,
    });
  };

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadDriverStats();
    setIsRefreshing(false);
  }, []);

  const toggleStatus = async () => {
    if (status === 'OFFLINE') {
      if (!locationPermission) {
        Alert.alert(
          'Location Required',
          'Please enable location services to go online.',
          [{ text: 'OK', onPress: checkLocationPermission }]
        );
        return;
      }

      // In production, call API
      // await driversApi.updateStatus('ONLINE');
      setStatus('ONLINE');
      startLocationUpdates();
      Alert.alert('You are now Online! 🟢', 'Passengers can now see your route.');
    } else if (status === 'ONLINE') {
      // In production, call API
      // await driversApi.updateStatus('OFFLINE');
      setStatus('OFFLINE');
      stopLocationUpdates();
      Alert.alert('You are now Offline', 'Take a break!');
    }
  };

  const startLocationUpdates = async () => {
    // In production, start background location tracking
    // and WebSocket connection for real-time updates
    console.log('Starting location updates...');
  };

  const stopLocationUpdates = () => {
    console.log('Stopping location updates...');
  };

  const generatePaymentQR = () => {
    const qrData = JSON.stringify({
      type: 'RIDEPASS_PAYMENT',
      driverId: driver?.id || user?.id,
      driverName: user?.name,
      amount: qrAmount,
      timestamp: Date.now(),
    });
    
    setQrCode(qrData);
    const matrix = generateQRMatrix(qrData);
    setQrMatrix(matrix);
    setShowQR(true);
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: () => {
            logout();
            router.replace('/' as any);
          },
        },
      ]
    );
  };

  const getStatusColor = () => {
    switch (status) {
      case 'ONLINE': return Colors.success;
      case 'ON_TRIP': return Colors.warning;
      default: return Colors.textSecondary;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'ONLINE': return 'Online';
      case 'ON_TRIP': return 'On Trip';
      default: return 'Offline';
    }
  };

  if (showQR) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={[Colors.primary, Colors.primaryDark]}
          style={styles.qrGradient}
        />
        <View style={styles.qrScreen}>
          <Text style={styles.qrTitle}>Payment QR Code</Text>
          <Text style={styles.qrSubtitle}>Passenger scans to pay ${qrAmount.toFixed(2)}</Text>
          
          <View style={styles.qrContainer}>
            <View style={styles.qrBackground}>
              <Svg width={QR_SIZE} height={QR_SIZE}>
                {qrMatrix.map((row, i) =>
                  row.map((cell, j) =>
                    cell ? (
                      <Rect
                        key={`${i}-${j}`}
                        x={j * CELL_SIZE}
                        y={i * CELL_SIZE}
                        width={CELL_SIZE}
                        height={CELL_SIZE}
                        fill={Colors.text}
                      />
                    ) : null
                  )
                )}
              </Svg>
            </View>
          </View>

          <View style={styles.qrAmountButtons}>
            {[0.50, 1.00, 1.50, 2.00].map((amount) => (
              <Pressable
                key={amount}
                style={[
                  styles.amountButton,
                  qrAmount === amount && styles.amountButtonActive,
                ]}
                onPress={() => {
                  setQrAmount(amount);
                  const qrData = JSON.stringify({
                    type: 'RIDEPASS_PAYMENT',
                    driverId: driver?.id || user?.id,
                    amount,
                    timestamp: Date.now(),
                  });
                  setQrCode(qrData);
                  setQrMatrix(generateQRMatrix(qrData));
                }}
              >
                <Text style={[
                  styles.amountButtonText,
                  qrAmount === amount && styles.amountButtonTextActive,
                ]}>
                  ${amount.toFixed(2)}
                </Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            style={styles.refreshQrButton}
            onPress={generatePaymentQR}
          >
            <RefreshCw size={20} color={Colors.textInverse} />
            <Text style={styles.refreshQrText}>Refresh QR</Text>
          </Pressable>

          <Pressable
            style={styles.closeQrButton}
            onPress={() => setShowQR(false)}
          >
            <Text style={styles.closeQrText}>Close</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[Colors.primary, Colors.primaryDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 0.4 }}
        style={styles.gradientHeader}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Hello, {user?.name?.split(' ')[0]}!</Text>
            <View style={styles.statusBadge}>
              <View style={[styles.statusDot, { backgroundColor: getStatusColor() }]} />
              <Text style={styles.statusText}>{getStatusText()}</Text>
            </View>
          </View>
          <View style={styles.headerActions}>
            <Pressable style={styles.headerButton} onPress={() => router.push('/(operator)/notifications' as any)}>
              <Bell size={24} color={Colors.textInverse} />
            </Pressable>
            <Pressable style={styles.headerButton} onPress={handleLogout}>
              <Settings size={24} color={Colors.textInverse} />
            </Pressable>
          </View>
        </View>

        {/* Status Toggle Card */}
        <View style={styles.statusCard}>
          <View style={styles.statusInfo}>
            <Power 
              size={32} 
              color={status === 'ONLINE' ? Colors.success : Colors.textSecondary} 
            />
            <View style={styles.statusTextContainer}>
              <Text style={styles.statusTitle}>
                {status === 'ONLINE' ? 'Broadcasting Route' : 'Go Online'}
              </Text>
              <Text style={styles.statusSubtitle}>
                {status === 'ONLINE' 
                  ? 'Passengers can see your route' 
                  : 'Start accepting rides'}
              </Text>
            </View>
          </View>
          <Pressable
            style={[
              styles.toggleButton,
              status === 'ONLINE' && styles.toggleButtonActive,
            ]}
            onPress={toggleStatus}
            disabled={status === 'ON_TRIP'}
          >
            <Text style={styles.toggleButtonText}>
              {status === 'ONLINE' ? 'Go Offline' : 'Go Online'}
            </Text>
          </Pressable>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: Colors.success + '20' }]}>
              <TrendingUp size={24} color={Colors.success} />
            </View>
            <Text style={styles.statValue}>${stats.todayEarnings.toFixed(2)}</Text>
            <Text style={styles.statLabel}>Today's Earnings</Text>
          </View>

          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: Colors.secondary + '20' }]}>
              <Navigation size={24} color={Colors.secondary} />
            </View>
            <Text style={styles.statValue}>{stats.todayRides}</Text>
            <Text style={styles.statLabel}>Today's Rides</Text>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.actionsContainer}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          
          <View style={styles.actionsGrid}>
            <Pressable
              style={styles.actionCard}
              onPress={generatePaymentQR}
            >
              <View style={[styles.actionIcon, { backgroundColor: Colors.primary + '20' }]}>
                <QrCode size={28} color={Colors.primary} />
              </View>
              <Text style={styles.actionTitle}>Payment QR</Text>
              <Text style={styles.actionSubtitle}>Receive payment</Text>
            </Pressable>

            <Pressable
              style={styles.actionCard}
              onPress={() => router.push('/(operator)/routes' as any)}
            >
              <View style={[styles.actionIcon, { backgroundColor: Colors.secondary + '20' }]}>
                <MapPin size={28} color={Colors.secondary} />
              </View>
              <Text style={styles.actionTitle}>My Routes</Text>
              <Text style={styles.actionSubtitle}>Manage routes</Text>
            </Pressable>

            <Pressable
              style={styles.actionCard}
              onPress={() => router.push('/(operator)/earnings' as any)}
            >
              <View style={[styles.actionIcon, { backgroundColor: Colors.success + '20' }]}>
                <Wallet size={28} color={Colors.success} />
              </View>
              <Text style={styles.actionTitle}>Earnings</Text>
              <Text style={styles.actionSubtitle}>${stats.weekEarnings.toFixed(2)} this week</Text>
            </Pressable>

            <Pressable
              style={styles.actionCard}
              onPress={() => router.push('/(operator)/history' as any)}
            >
              <View style={[styles.actionIcon, { backgroundColor: Colors.warning + '20' }]}>
                <Clock size={28} color={Colors.warning} />
              </View>
              <Text style={styles.actionTitle}>History</Text>
              <Text style={styles.actionSubtitle}>{stats.totalTrips} total trips</Text>
            </Pressable>
          </View>
        </View>

        {/* Rating Card */}
        <View style={styles.ratingCard}>
          <View style={styles.ratingLeft}>
            <Star size={32} color={Colors.accent} fill={Colors.accent} />
            <View>
              <Text style={styles.ratingValue}>{stats.rating.toFixed(1)}</Text>
              <Text style={styles.ratingLabel}>Driver Rating</Text>
            </View>
          </View>
          <Text style={styles.ratingTrips}>{stats.totalTrips} trips completed</Text>
        </View>

        {/* Safety Section */}
        <Pressable 
          style={styles.sosButton}
          onPress={() => {
            Alert.alert(
              '🚨 Emergency SOS',
              'This will alert authorities and your emergency contacts. Continue?',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Send SOS',
                  style: 'destructive',
                  onPress: () => {
                    Alert.alert('SOS Sent', 'Help is on the way.');
                  },
                },
              ]
            );
          }}
        >
          <AlertTriangle size={20} color={Colors.error} />
          <Text style={styles.sosText}>Emergency SOS</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  gradientHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 280,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  greeting: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.textInverse,
    marginBottom: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textInverse,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    padding: 8,
  },
  statusCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  statusInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statusTextContainer: {
    marginLeft: 16,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  statusSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  toggleButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  toggleButtonActive: {
    backgroundColor: Colors.error,
  },
  toggleButtonText: {
    color: Colors.textInverse,
    fontWeight: '700',
    fontSize: 14,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  actionsContainer: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 16,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionCard: {
    width: (width - 60) / 2,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  actionIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
  },
  actionSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  ratingCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  ratingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  ratingValue: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.text,
  },
  ratingLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  ratingTrips: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  sosButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.error + '15',
    padding: 16,
    borderRadius: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.error + '30',
  },
  sosText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.error,
  },
  // QR Screen Styles
  qrGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  qrScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  qrTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.textInverse,
    marginBottom: 8,
  },
  qrSubtitle: {
    fontSize: 16,
    color: Colors.textInverse,
    opacity: 0.9,
    marginBottom: 32,
  },
  qrContainer: {
    marginBottom: 24,
  },
  qrBackground: {
    backgroundColor: Colors.textInverse,
    padding: 20,
    borderRadius: 20,
  },
  qrAmountButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  amountButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  amountButtonActive: {
    backgroundColor: Colors.textInverse,
  },
  amountButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textInverse,
  },
  amountButtonTextActive: {
    color: Colors.primary,
  },
  refreshQrButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    marginBottom: 16,
  },
  refreshQrText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textInverse,
  },
  closeQrButton: {
    paddingVertical: 12,
  },
  closeQrText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textInverse,
    opacity: 0.8,
  },
});
