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
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Rect } from 'react-native-svg';
import {
  Ticket,
  Calendar,
  History,
  LogOut,
  RefreshCw,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useApp } from '@/contexts/AppContext';
import { generateQRMatrix, generateQRToken } from '@/utils/qrcode';

const { width } = Dimensions.get('window');
const QR_SIZE = width - 80;
const CELL_SIZE = QR_SIZE / 21;

export default function CommuterHomeScreen() {
  const router = useRouter();
  const { user, subscription, logout } = useApp();
  const [qrToken, setQrToken] = useState(generateQRToken());
  const [qrMatrix, setQrMatrix] = useState<boolean[][]>([]);
  const fadeAnim = useMemo(() => new Animated.Value(1), []);

  useEffect(() => {
    if (subscription) {
      const matrix = generateQRMatrix(qrToken);
      setQrMatrix(matrix);
    }
  }, [qrToken, subscription]);

  useEffect(() => {
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
  }, [fadeAnim]);

  if (!subscription || !user) {
    return (
      <View style={styles.emptyContainer}>
        <LinearGradient
          colors={[Colors.primary, Colors.primaryDark]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.emptyContent}>
          <Ticket size={64} color={Colors.textInverse} strokeWidth={1.5} />
          <Text style={styles.emptyTitle}>No Active Pass</Text>
          <Text style={styles.emptyText}>
            Purchase a pass to start riding
          </Text>
          <Pressable
            style={styles.emptyButton}
            onPress={() => router.push('/(commuter)/plans' as any)}
          >
            <Text style={styles.emptyButtonText}>Browse Plans</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const daysRemaining = Math.ceil(
    (new Date(subscription.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  const handleLogout = () => {
    logout();
    router.replace('/' as any);
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[Colors.primary, Colors.primaryDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 0.3 }}
        style={styles.gradientHeader}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Hello, {user.name}! 👋</Text>
            <Text style={styles.subGreeting}>Ready for your ride?</Text>
          </View>
          <Pressable onPress={handleLogout} style={styles.logoutButton}>
            <LogOut size={24} color={Colors.textInverse} />
          </Pressable>
        </View>

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

          <View style={styles.tokenText}>
            <Text style={styles.tokenLabel}>Token</Text>
            <Text style={styles.tokenValue}>{qrToken.substring(0, 20)}...</Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <View style={styles.statIcon}>
              <Ticket size={24} color={Colors.primary} />
            </View>
            <Text style={styles.statValue}>{subscription.ridesRemaining}</Text>
            <Text style={styles.statLabel}>Rides Left</Text>
          </View>

          <View style={styles.statCard}>
            <View style={styles.statIcon}>
              <Calendar size={24} color={Colors.secondary} />
            </View>
            <Text style={styles.statValue}>{daysRemaining}</Text>
            <Text style={styles.statLabel}>Days Left</Text>
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.historyButton,
            pressed && styles.historyButtonPressed,
          ]}
          onPress={() => router.push('/(commuter)/history' as any)}
        >
          <History size={24} color={Colors.primary} />
          <Text style={styles.historyButtonText}>View Ride History</Text>
        </Pressable>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>How it works</Text>
          <Text style={styles.infoText}>
            1. Show this QR code to the operator when boarding{'\n'}
            2. Operator scans your code{'\n'}
            3. One ride is deducted from your balance{'\n'}
            4. QR refreshes every 30 seconds for security
          </Text>
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
    height: 300,
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
    fontWeight: '800' as const,
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
  qrCard: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    padding: 24,
    marginBottom: 20,
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
    fontWeight: '700' as const,
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
  tokenText: {
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  tokenLabel: {
    fontSize: 12,
    color: Colors.textTertiary,
    marginBottom: 4,
  },
  tokenValue: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
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
    backgroundColor: Colors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 32,
    fontWeight: '800' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  historyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    paddingVertical: 18,
    borderRadius: 16,
    gap: 12,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  historyButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  historyButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  infoCard: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 16,
    padding: 20,
    borderLeftWidth: 4,
    borderLeftColor: Colors.secondary,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  emptyContainer: {
    flex: 1,
  },
  emptyContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 28,
    fontWeight: '800' as const,
    color: Colors.textInverse,
    marginTop: 24,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.textInverse,
    opacity: 0.9,
    textAlign: 'center',
    marginBottom: 32,
  },
  emptyButton: {
    backgroundColor: Colors.textInverse,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 16,
  },
  emptyButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.primary,
  },
});
