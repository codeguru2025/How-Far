// Wallet Screen
import React, { useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl, Alert, ActivityIndicator } from 'react-native';
import { BottomNav } from '../../components';
import { useAuthStore, useWalletStore } from '../../stores';
import { COLORS } from '../../theme';
import { Screen } from '../../types';

interface Props {
  onNavigate: (screen: Screen) => void;
}

export function WalletScreen({ onNavigate }: Props) {
  const { user } = useAuthStore();
  const { wallet, transactions, isLoading, isRefreshing, refresh, reconcilePendingPayments } = useWalletStore();

  useEffect(() => {
    if (user) {
      refresh(user.id);
    }
  }, [user]);

  async function handleFix() {
    if (!user) return;
    const result = await reconcilePendingPayments(user.id);
    if (result.credited > 0) {
      Alert.alert('💰 Payments Recovered!', `Credited $${result.amount.toFixed(2)} from ${result.credited} payment(s).`);
      refresh(user.id);
    } else {
      Alert.alert('ℹ️ No Updates', 'No completed payments found to credit.');
    }
  }

  function getStatusColor(status: string) {
    switch (status) {
      case 'completed': return COLORS.success;
      case 'pending': return COLORS.warning;
      case 'failed': return COLORS.error;
      default: return COLORS.textMuted;
    }
  }

  function getTypeIcon(type: string) {
    switch (type) {
      case 'topup': return '💰';
      case 'payment': return '💸';
      case 'ride': return '🚗';
      default: return '💳';
    }
  }

  function formatDate(dateStr: string) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Wallet</Text>

      <ScrollView
        refreshControl={
          <RefreshControl 
            refreshing={isRefreshing} 
            onRefresh={() => user && refresh(user.id)} 
            colors={[COLORS.primary]} 
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Available Balance</Text>
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" size="large" />
          ) : (
            <Text style={styles.balanceAmount}>${wallet?.balance.toFixed(2) || '0.00'}</Text>
          )}
          <Text style={styles.balanceCurrency}>{wallet?.currency || 'USD'}</Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.action} onPress={() => onNavigate('topup')}>
            <Text style={styles.actionIcon}>➕</Text>
            <Text style={styles.actionLabel}>Top Up</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.action} onPress={handleFix}>
            <Text style={styles.actionIcon}>🔧</Text>
            <Text style={styles.actionLabel}>Fix</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.action} onPress={() => user && refresh(user.id)}>
            <Text style={styles.actionIcon}>🔄</Text>
            <Text style={styles.actionLabel}>Refresh</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.transactionsSection}>
          <Text style={styles.sectionTitle}>Recent Transactions</Text>
          {transactions.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📭</Text>
              <Text style={styles.emptyText}>No transactions yet</Text>
              <Text style={styles.emptySubtext}>Top up your wallet to get started</Text>
            </View>
          ) : (
            transactions.map((txn) => (
              <View key={txn.id} style={styles.transactionItem}>
                <Text style={styles.txnIcon}>{getTypeIcon(txn.type)}</Text>
                <View style={styles.txnDetails}>
                  <Text style={styles.txnTitle}>{txn.description || txn.type}</Text>
                  <Text style={styles.txnDate}>{formatDate(txn.created_at)}</Text>
                </View>
                <View style={styles.txnRight}>
                  <Text style={[styles.txnAmount, txn.type === 'topup' && { color: COLORS.success }]}>
                    {txn.type === 'topup' ? '+' : '-'}${txn.amount.toFixed(2)}
                  </Text>
                  <Text style={[styles.txnStatus, { color: getStatusColor(txn.status) }]}>
                    {txn.status}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <BottomNav current="wallet" onNavigate={onNavigate} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: 60,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 24,
  },
  balanceCard: {
    backgroundColor: COLORS.primary,
    margin: 16,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },
  balanceLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
  },
  balanceAmount: {
    color: '#FFFFFF',
    fontSize: 48,
    fontWeight: 'bold',
    marginVertical: 8,
  },
  balanceCurrency: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
  },
  action: {
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: 16,
    borderRadius: 12,
    minWidth: 100,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  actionIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  transactionsSection: {
    backgroundColor: COLORS.surface,
    marginTop: 24,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    minHeight: 300,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  emptyText: {
    color: COLORS.textMuted,
    fontSize: 16,
  },
  emptySubtext: {
    color: COLORS.textMuted,
    fontSize: 13,
    marginTop: 4,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  txnIcon: {
    fontSize: 28,
    marginRight: 14,
  },
  txnDetails: {
    flex: 1,
  },
  txnTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.text,
  },
  txnDate: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  txnRight: {
    alignItems: 'flex-end',
  },
  txnAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  txnStatus: {
    fontSize: 11,
    marginTop: 2,
    textTransform: 'capitalize',
  },
});
