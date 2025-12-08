import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
} from 'react-native';
import { MapPin, Clock, CheckCircle } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useApp } from '@/contexts/AppContext';

export default function RideHistoryScreen() {
  const { rides } = useApp();

  if (rides.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <CheckCircle size={64} color={Colors.textSecondary} strokeWidth={1.5} />
        <Text style={styles.emptyTitle}>No Rides Yet</Text>
        <Text style={styles.emptyText}>
          Your ride history will appear here after your first trip
        </Text>
      </View>
    );
  }

  const renderRide = ({ item }: { item: typeof rides[0] }) => {
    const date = new Date(item.timestamp);
    const formattedDate = date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
    });
    const formattedTime = date.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    });

    return (
      <View style={styles.rideCard}>
        <View style={styles.rideIcon}>
          <MapPin size={24} color={Colors.primary} />
        </View>
        <View style={styles.rideInfo}>
          <Text style={styles.rideRoute}>{item.route}</Text>
          <Text style={styles.rideOperator}>{item.operatorName}</Text>
          <View style={styles.rideTimeContainer}>
            <Clock size={14} color={Colors.textTertiary} />
            <Text style={styles.rideTime}>
              {formattedDate} at {formattedTime}
            </Text>
          </View>
        </View>
        <View style={styles.rideStatus}>
          <CheckCircle size={20} color={Colors.success} strokeWidth={2.5} />
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={rides}
        renderItem={renderRide}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  list: {
    padding: 24,
  },
  rideCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  rideIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rideInfo: {
    flex: 1,
    marginLeft: 16,
  },
  rideRoute: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  rideOperator: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  rideTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rideTime: {
    fontSize: 12,
    color: Colors.textTertiary,
  },
  rideStatus: {
    marginLeft: 12,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    backgroundColor: Colors.background,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '800' as const,
    color: Colors.text,
    marginTop: 24,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});
