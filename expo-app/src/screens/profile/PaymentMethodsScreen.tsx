// Payment Methods Screen
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { COLORS } from '../../theme';
import { Screen } from '../../types';

interface Props {
  onNavigate: (screen: Screen) => void;
}

interface PaymentMethod {
  id: string;
  type: 'ecocash' | 'onemoney' | 'innbucks' | 'wallet';
  name: string;
  icon: string;
  details: string;
  isDefault: boolean;
}

export function PaymentMethodsScreen({ onNavigate }: Props) {
  const [methods, setMethods] = useState<PaymentMethod[]>([
    { id: 'wallet', type: 'wallet', name: 'HowFar Wallet', icon: '💰', details: 'Pay with wallet balance', isDefault: true },
    { id: 'ecocash', type: 'ecocash', name: 'EcoCash', icon: '📱', details: 'Mobile money payment', isDefault: false },
    { id: 'onemoney', type: 'onemoney', name: 'OneMoney', icon: '📲', details: 'Mobile money payment', isDefault: false },
    { id: 'innbucks', type: 'innbucks', name: 'InnBucks', icon: '💳', details: 'Digital wallet', isDefault: false },
  ]);

  function setDefaultMethod(id: string) {
    setMethods(methods.map(m => ({
      ...m,
      isDefault: m.id === id,
    })));
    Alert.alert('Default Updated', 'Payment method set as default');
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => onNavigate('profile')} style={styles.backButton}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payment Methods</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>Available Methods</Text>
        
        <View style={styles.methodsList}>
          {methods.map((method) => (
            <TouchableOpacity 
              key={method.id}
              style={[
                styles.methodCard,
                method.isDefault && styles.methodCardDefault
              ]}
              onPress={() => setDefaultMethod(method.id)}
            >
              <View style={styles.methodIcon}>
                <Text style={styles.methodIconText}>{method.icon}</Text>
              </View>
              <View style={styles.methodInfo}>
                <Text style={styles.methodName}>{method.name}</Text>
                <Text style={styles.methodDetails}>{method.details}</Text>
              </View>
              {method.isDefault ? (
                <View style={styles.defaultBadge}>
                  <Text style={styles.defaultBadgeText}>Default</Text>
                </View>
              ) : (
                <View style={styles.selectCircle} />
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Wallet Section */}
        <Text style={styles.sectionTitle}>Wallet</Text>
        <View style={styles.walletCard}>
          <View style={styles.walletBalance}>
            <Text style={styles.walletLabel}>Available Balance</Text>
            <Text style={styles.walletAmount}>$4.87</Text>
          </View>
          <TouchableOpacity 
            style={styles.topUpButton}
            onPress={() => onNavigate('topup')}
          >
            <Text style={styles.topUpText}>Top Up</Text>
          </TouchableOpacity>
        </View>

        {/* Info Section */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>ℹ️ How it works</Text>
          <Text style={styles.infoText}>
            Your default payment method will be used for all bookings. You can pay using your HowFar Wallet balance or mobile money.
          </Text>
          <Text style={styles.infoText}>
            When paying with EcoCash or OneMoney, you'll receive a prompt on your phone to approve the payment.
          </Text>
        </View>

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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: '#1E3A5F',
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
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  headerPlaceholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 12,
    marginTop: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  methodsList: {
    gap: 12,
    marginBottom: 24,
  },
  methodCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  methodCardDefault: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '10',
  },
  methodIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  methodIconText: {
    fontSize: 24,
  },
  methodInfo: {
    flex: 1,
  },
  methodName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  methodDetails: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  defaultBadge: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  defaultBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  selectCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  walletCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  walletBalance: {
    flex: 1,
  },
  walletLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  walletAmount: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 4,
  },
  topUpButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  topUpText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  infoCard: {
    backgroundColor: '#FEF3C7',
    borderRadius: 16,
    padding: 16,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400E',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 13,
    color: '#92400E',
    lineHeight: 20,
    marginBottom: 8,
  },
  bottomPadding: {
    height: 40,
  },
});

