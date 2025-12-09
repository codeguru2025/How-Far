import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing, borderRadius, fontSize } from '../../utils/theme';

export default function HomeScreen() {
  const { user } = useAuth();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.greeting}>Hello, {user?.first_name || 'there'}! 👋</Text>
        <Text style={styles.subtitle}>Where would you like to go?</Text>
      </View>

      <View style={styles.mapPlaceholder}>
        <Text style={styles.mapIcon}>🗺️</Text>
        <Text style={styles.mapText}>Map View</Text>
      </View>

      <View style={styles.bottomSheet}>
        <TouchableOpacity style={styles.searchBox}>
          <Text style={styles.searchIcon}>🔍</Text>
          <Text style={styles.searchText}>Enter destination</Text>
        </TouchableOpacity>

        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.quickAction}>
            <Text style={styles.quickIcon}>🏠</Text>
            <Text style={styles.quickLabel}>Home</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickAction}>
            <Text style={styles.quickIcon}>💼</Text>
            <Text style={styles.quickLabel}>Work</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickAction}>
            <Text style={styles.quickIcon}>📷</Text>
            <Text style={styles.quickLabel}>Scan QR</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { padding: spacing.lg },
  greeting: { fontSize: fontSize.xl, fontWeight: 'bold', color: colors.text },
  subtitle: { fontSize: fontSize.md, color: colors.textSecondary },
  mapPlaceholder: { flex: 1, backgroundColor: colors.borderLight, margin: spacing.md, borderRadius: borderRadius.lg, justifyContent: 'center', alignItems: 'center' },
  mapIcon: { fontSize: 64 },
  mapText: { fontSize: fontSize.lg, color: colors.textSecondary },
  bottomSheet: { backgroundColor: colors.surface, borderTopLeftRadius: borderRadius.xl, borderTopRightRadius: borderRadius.xl, padding: spacing.lg },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.borderLight, borderRadius: borderRadius.lg, padding: spacing.md, marginBottom: spacing.lg },
  searchIcon: { fontSize: 20, marginRight: spacing.sm },
  searchText: { color: colors.textSecondary },
  quickActions: { flexDirection: 'row', justifyContent: 'space-around' },
  quickAction: { alignItems: 'center', backgroundColor: colors.primaryLight + '20', padding: spacing.md, borderRadius: borderRadius.lg, minWidth: 90 },
  quickIcon: { fontSize: 24, marginBottom: spacing.xs },
  quickLabel: { fontSize: fontSize.sm, color: colors.primary, fontWeight: '500' },
});
