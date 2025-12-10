// Ride History Screen - View past rides
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { COLORS } from '../../theme';
import { Screen } from '../../types';
import { getRideHistory, RideHistoryItem } from '../../api/rides';

interface Props {
  onNavigate: (screen: Screen) => void;
}

export function HistoryScreen({ onNavigate }: Props) {
  const [rides, setRides] = useState<RideHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    loadHistory();
  }, []);

  async function loadHistory() {
    setIsLoading(true);
    const history = await getRideHistory(20, 0);
    setRides(history);
    setIsLoading(false);
  }

  async function handleRefresh() {
    setIsRefreshing(true);
    const history = await getRideHistory(20, 0);
    setRides(history);
    setIsRefreshing(false);
  }

  function formatDate(dateString: string) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function getStatusColor(status: string) {
    switch (status) {
      case 'completed':
        return COLORS.success;
      case 'cancelled':
        return COLORS.error;
      default:
        return COLORS.warning;
    }
  }

  function renderRideItem({ item }: { item: RideHistoryItem }) {
    return (
      <TouchableOpacity style={styles.rideCard}>
        {/* Header */}
        <View style={styles.rideHeader}>
          <Text style={styles.rideDate}>{formatDate(item.created_at)}</Text>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
            <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
              {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
            </Text>
          </View>
        </View>

        {/* Route */}
        <View style={styles.routeContainer}>
          <View style={styles.routePoint}>
            <View style={styles.pickupDot} />
            <Text style={styles.routeAddress} numberOfLines={1}>{item.pickup_address}</Text>
          </View>
          <View style={styles.routeLine} />
          <View style={styles.routePoint}>
            <View style={styles.dropoffDot} />
            <Text style={styles.routeAddress} numberOfLines={1}>{item.dropoff_address}</Text>
          </View>
        </View>

        {/* Details */}
        <View style={styles.rideDetails}>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Distance</Text>
            <Text style={styles.detailValue}>{item.distance?.toFixed(1) || '—'} km</Text>
          </View>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Duration</Text>
            <Text style={styles.detailValue}>{item.duration || '—'} min</Text>
          </View>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Fare</Text>
            <Text style={styles.detailValue}>${item.final_price?.toFixed(2) || '—'}</Text>
          </View>
        </View>

        {/* Driver */}
        <View style={styles.driverInfo}>
          <View style={styles.driverAvatar}>
            <Text style={styles.driverAvatarText}>🚗</Text>
          </View>
          <View style={styles.driverDetails}>
            <Text style={styles.driverName}>{item.driver_name}</Text>
            <Text style={styles.driverRating}>⭐ {item.driver_rating?.toFixed(1)}</Text>
          </View>
          {item.vehicle_info && (
            <Text style={styles.vehicleInfo}>
              {item.vehicle_info.color} {item.vehicle_info.make}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  }

  function renderEmptyState() {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyIcon}>🚗</Text>
        <Text style={styles.emptyTitle}>No rides yet</Text>
        <Text style={styles.emptySubtitle}>Your ride history will appear here</Text>
        <TouchableOpacity style={styles.bookRideBtn} onPress={() => onNavigate('search')}>
          <Text style={styles.bookRideBtnText}>Book a Ride</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => onNavigate('home')} style={styles.backButton}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ride History</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Content */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading history...</Text>
        </View>
      ) : (
        <FlatList
          data={rides}
          keyExtractor={(item) => item.ride_id}
          renderItem={renderRideItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={renderEmptyState}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              colors={[COLORS.primary]}
            />
          }
        />
      )}
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
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: COLORS.textSecondary,
  },
  listContent: {
    padding: 16,
  },
  rideCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  rideHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  rideDate: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  routeContainer: {
    marginBottom: 12,
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pickupDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.success,
    marginRight: 10,
  },
  dropoffDot: {
    width: 10,
    height: 10,
    backgroundColor: COLORS.primary,
    marginRight: 10,
  },
  routeLine: {
    width: 2,
    height: 16,
    backgroundColor: COLORS.border,
    marginLeft: 4,
    marginVertical: 2,
  },
  routeAddress: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
  },
  rideDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  detailItem: {
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  driverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  driverAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  driverAvatarText: {
    fontSize: 18,
  },
  driverDetails: {
    flex: 1,
  },
  driverName: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
  },
  driverRating: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  vehicleInfo: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 60,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 24,
  },
  bookRideBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  bookRideBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

