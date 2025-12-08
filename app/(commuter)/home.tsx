import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Dimensions,
  Animated,
  Platform,
  Alert,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Rect } from 'react-native-svg';
import * as Location from 'expo-location';
import {
  Wallet,
  MapPin,
  Clock,
  History,
  LogOut,
  RefreshCw,
  Navigation,
  QrCode,
  Shield,
  AlertTriangle,
  Bus,
  Star,
  ChevronRight,
  Plus,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useApp } from '@/contexts/AppContext';
import { generateQRMatrix, generateQRToken } from '@/utils/qrcode';

const { width } = Dimensions.get('window');
const QR_SIZE = width - 80;
const CELL_SIZE = QR_SIZE / 21;

interface NearbyDriver {
  id: string;
  name: string;
  rating: number;
  vehicle: string;
  route: string;
  distance: number;
  fare: number;
}

export default function PassengerHomeScreen() {
  const router = useRouter();
  const { user, subscription, wallet, logout } = useApp();
  const [qrToken, setQrToken] = useState(generateQRToken());
  const [qrMatrix, setQrMatrix] = useState<boolean[][]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showQRMode, setShowQRMode] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [nearbyDrivers, setNearbyDrivers] = useState<NearbyDriver[]>([]);
  const fadeAnim = useMemo(() => new Animated.Value(1), []);

  // Mock wallet balance - in production, fetch from API
  const walletBalance = wallet?.balance || 25.50;

  useEffect(() => {
    loadLocation();
    loadNearbyDrivers();
  }, []);

  useEffect(() => {
    if (showQRMode && subscription) {
      const matrix = generateQRMatrix(qrToken);
      setQrMatrix(matrix);
    }
  }, [qrToken, subscription, showQRMode]);

  useEffect(() => {
    if (showQRMode) {
      const interval = setInterval(() => {
        Animated.sequence([
          Animated.timing(fadeAnim, {
            toValue: 0.3,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start();
        setQrToken(generateQRToken());
      }, 30000);

      return () => clearInterval(interval);
    }
  }, [fadeAnim, showQRMode]);

  const loadLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') {
      const location = await Location.getCurrentPositionAsync({});
      setCurrentLocation({
        lat: location.coords.latitude,
        lng: location.coords.longitude,
      });
    }
  };

  const loadNearbyDrivers = async () => {
    // In production, fetch from API
    // const drivers = await routesApi.getNearbyRoutes(lat, lng);
    setNearbyDrivers([
      {
        id: '1',
        name: 'John M.',
        rating: 4.9,
        vehicle: 'White Toyota Hiace - ABC 1234',
        route: 'CBD → Chitungwiza',
        distance: 0.5,
        fare: 1.50,
      },
      {
        id: '2',
        name: 'Peter K.',
        rating: 4.7,
        vehicle: 'Blue Nissan Caravan - XYZ 5678',
        route: 'CBD → Warren Park',
        distance: 0.8,
        fare: 1.00,
      },
      {
        id: '3',
        name: 'David T.',
        rating: 4.8,
        vehicle: 'White Toyota Quantum - DEF 9012',
        route: 'CBD → Glen View',
        distance: 1.2,
        fare: 1.20,
      },
    ]);
  };

  const onRefresh = async () => {
    setIsRefreshing(true);
    await loadNearbyDrivers();
    setIsRefreshing(false);
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

  const triggerSOS = () => {
    Alert.alert(
      '🚨 Emergency SOS',
      'This will alert authorities and your emergency contacts. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send SOS',
          style: 'destructive',
          onPress: () => {
            Alert.alert('SOS Sent', 'Help is on the way. Stay calm.');
          },
        },
      ]
    );
  };

  // Show QR Code mode for subscription pass (legacy support)
  if (showQRMode && subscription) {
    const daysRemaining = Math.ceil(
      (new Date(subscription.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );

    return (
      <View style={styles.container}>
        <LinearGradient
          colors={[Colors.primary, Colors.primaryDark]}
          style={StyleSheet.absoluteFill}
        />

        <View style={styles.qrModeContent}>
          <Pressable style={styles.backButton} onPress={() => setShowQRMode(false)}>
            <Text style={styles.backButtonText}>← Back</Text>
          </Pressable>

          <View style={styles.qrCard}>
            <View style={styles.qrCardHeader}>
              <View>
                <Text style={styles.qrCardTitle}>{subscription.plan.name}</Text>
                <Text style={styles.qrCardSubtitle}>Show this to the operator</Text>
              </View>
              <Pressable
                onPress={() => {
                  Animated.sequence([
                    Animated.timing(fadeAnim, {
                      toValue: 0.3,
                      duration: 150,
                      useNativeDriver: true,
                    }),
                    Animated.timing(fadeAnim, {
                      toValue: 1,
                      duration: 150,
                      useNativeDriver: true,
                    }),
                  ]).start();
                  setQrToken(generateQRToken());
                }}
                style={styles.refreshButton}
              >
                <RefreshCw size={20} color={Colors.primary} />
              </Pressable>
            </View>

            <Animated.View style={[styles.qrContainer, { opacity: fadeAnim }]}>
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
            </Animated.View>

            <View style={styles.qrStats}>
              <View style={styles.qrStat}>
                <Text style={styles.qrStatValue}>{subscription.ridesRemaining}</Text>
                <Text style={styles.qrStatLabel}>Rides Left</Text>
              </View>
              <View style={styles.qrStatDivider} />
              <View style={styles.qrStat}>
                <Text style={styles.qrStatValue}>{daysRemaining}</Text>
                <Text style={styles.qrStatLabel}>Days Left</Text>
              </View>
            </View>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[Colors.primary, Colors.primaryDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 0.35 }}
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
            <Text style={styles.greeting}>Hello, {user?.name?.split(' ')[0]}! 👋</Text>
            <Text style={styles.subGreeting}>Where to today?</Text>
          </View>
          <Pressable onPress={handleLogout} style={styles.logoutButton}>
            <LogOut size={24} color={Colors.textInverse} />
          </Pressable>
        </View>

        {/* Wallet Card */}
        <Pressable 
          style={styles.walletCard}
          onPress={() => router.push('/(commuter)/wallet' as any)}
        >
          <LinearGradient
            colors={[Colors.secondary, '#1a5cd6']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.walletGradient}
          >
            <View style={styles.walletContent}>
              <View style={styles.walletLeft}>
                <Wallet size={24} color={Colors.textInverse} />
                <View style={styles.walletInfo}>
                  <Text style={styles.walletLabel}>Wallet Balance</Text>
                  <Text style={styles.walletBalance}>${walletBalance.toFixed(2)}</Text>
                </View>
              </View>
              <Pressable 
                style={styles.topUpButton}
                onPress={() => router.push('/(commuter)/topup' as any)}
              >
                <Plus size={16} color={Colors.secondary} />
                <Text style={styles.topUpText}>Top Up</Text>
              </Pressable>
            </View>
          </LinearGradient>
        </Pressable>

        {/* Subscription Pass Button (if has subscription) */}
        {subscription && (
          <Pressable 
            style={styles.passCard}
            onPress={() => setShowQRMode(true)}
          >
            <View style={styles.passLeft}>
              <QrCode size={24} color={Colors.primary} />
              <View>
                <Text style={styles.passTitle}>Show Pass</Text>
                <Text style={styles.passSubtitle}>
                  {subscription.ridesRemaining} rides remaining
                </Text>
              </View>
            </View>
            <ChevronRight size={24} color={Colors.textSecondary} />
          </Pressable>
        )}

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <Pressable 
            style={styles.quickAction}
            onPress={() => router.push('/(commuter)/map' as any)}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: Colors.primary + '20' }]}>
              <MapPin size={24} color={Colors.primary} />
            </View>
            <Text style={styles.quickActionText}>Find Ride</Text>
          </Pressable>

          <Pressable 
            style={styles.quickAction}
            onPress={() => router.push('/(commuter)/scan' as any)}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: Colors.secondary + '20' }]}>
              <QrCode size={24} color={Colors.secondary} />
            </View>
            <Text style={styles.quickActionText}>Scan to Pay</Text>
          </Pressable>

          <Pressable 
            style={styles.quickAction}
            onPress={() => router.push('/(commuter)/history' as any)}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: Colors.success + '20' }]}>
              <History size={24} color={Colors.success} />
            </View>
            <Text style={styles.quickActionText}>History</Text>
          </Pressable>

          <Pressable 
            style={styles.quickAction}
            onPress={() => router.push('/(commuter)/plans' as any)}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: Colors.warning + '20' }]}>
              <Clock size={24} color={Colors.warning} />
            </View>
            <Text style={styles.quickActionText}>Buy Pass</Text>
          </Pressable>
        </View>

        {/* Nearby Drivers */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Nearby Vehicles</Text>
            <Pressable onPress={() => router.push('/(commuter)/map' as any)}>
              <Text style={styles.seeAllText}>See Map →</Text>
            </Pressable>
          </View>

          {nearbyDrivers.length === 0 ? (
            <View style={styles.emptyState}>
              <Bus size={48} color={Colors.textSecondary} strokeWidth={1.5} />
              <Text style={styles.emptyTitle}>No Vehicles Nearby</Text>
              <Text style={styles.emptyText}>Pull to refresh or try again later</Text>
            </View>
          ) : (
            nearbyDrivers.map((driver) => (
              <Pressable
                key={driver.id}
                style={styles.driverCard}
                onPress={() => router.push(`/(commuter)/driver/${driver.id}` as any)}
              >
                <View style={styles.driverInfo}>
                  <View style={styles.driverAvatar}>
                    <Bus size={24} color={Colors.primary} />
                  </View>
                  <View style={styles.driverDetails}>
                    <View style={styles.driverHeader}>
                      <Text style={styles.driverName}>{driver.name}</Text>
                      <View style={styles.ratingBadge}>
                        <Star size={12} color={Colors.accent} fill={Colors.accent} />
                        <Text style={styles.ratingText}>{driver.rating}</Text>
                      </View>
                    </View>
                    <Text style={styles.driverVehicle}>{driver.vehicle}</Text>
                    <Text style={styles.driverRoute}>{driver.route}</Text>
                  </View>
                </View>
                <View style={styles.driverRight}>
                  <Text style={styles.driverFare}>${driver.fare.toFixed(2)}</Text>
                  <Text style={styles.driverDistance}>{driver.distance} km away</Text>
                </View>
              </Pressable>
            ))
          )}
        </View>

        {/* Safety Section */}
        <Pressable style={styles.sosButton} onPress={triggerSOS}>
          <AlertTriangle size={20} color={Colors.error} />
          <Text style={styles.sosText}>Emergency SOS</Text>
        </Pressable>

        {/* Info Card */}
        <View style={styles.infoCard}>
          <Shield size={20} color={Colors.secondary} />
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>Safety First</Text>
            <Text style={styles.infoText}>
              Share your trip with family, use the SOS button in emergencies, and always verify driver details.
            </Text>
          </View>
        </View>
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
    marginBottom: 4,
  },
  subGreeting: {
    fontSize: 16,
    color: Colors.textInverse,
    opacity: 0.9,
  },
  logoutButton: {
    padding: 8,
  },
  walletCard: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  walletGradient: {
    padding: 20,
  },
  walletContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  walletLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  walletInfo: {
    marginLeft: 12,
  },
  walletLabel: {
    fontSize: 13,
    color: Colors.textInverse,
    opacity: 0.9,
  },
  walletBalance: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.textInverse,
  },
  topUpButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.textInverse,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 4,
  },
  topUpText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.secondary,
  },
  passCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  passLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  passTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  passSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  quickAction: {
    alignItems: 'center',
    width: (width - 72) / 4,
  },
  quickActionIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  quickActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'center',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  emptyState: {
    alignItems: 'center',
    padding: 32,
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  driverCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  driverInfo: {
    flexDirection: 'row',
    flex: 1,
  },
  driverAvatar: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverDetails: {
    marginLeft: 12,
    flex: 1,
  },
  driverHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  driverName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text,
  },
  driverVehicle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  driverRoute: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
    marginTop: 4,
  },
  driverRight: {
    alignItems: 'flex-end',
  },
  driverFare: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.success,
  },
  driverDistance: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  sosButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.error + '15',
    padding: 16,
    borderRadius: 12,
    gap: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.error + '30',
  },
  sosText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.error,
  },
  infoCard: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    borderLeftWidth: 4,
    borderLeftColor: Colors.secondary,
  },
  infoContent: {
    marginLeft: 12,
    flex: 1,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
  },
  infoText: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  // QR Mode Styles
  qrModeContent: {
    flex: 1,
    padding: 24,
    paddingTop: 60,
  },
  backButton: {
    marginBottom: 24,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textInverse,
  },
  qrCard: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  qrCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  qrCardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
  },
  qrCardSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  qrBackground: {
    backgroundColor: Colors.textInverse,
    padding: 20,
    borderRadius: 20,
  },
  qrStats: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  qrStat: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  qrStatValue: {
    fontSize: 32,
    fontWeight: '800',
    color: Colors.text,
  },
  qrStatLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  qrStatDivider: {
    width: 1,
    height: 40,
    backgroundColor: Colors.borderLight,
  },
});
