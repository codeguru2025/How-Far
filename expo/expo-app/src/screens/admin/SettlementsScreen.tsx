// Admin Settlements Screen - Process driver payouts via EcoCash
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, Alert, Modal, TextInput, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../theme';
import { 
  getSettlements, processSettlement, 
  Settlement, SettlementSummary 
} from '../../api/admin';

export function SettlementsScreen() {
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [summary, setSummary] = useState<SettlementSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'pending' | 'completed' | 'all'>('pending');
  
  // PIN Modal
  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [selectedSettlement, setSelectedSettlement] = useState<Settlement | null>(null);
  const [pin, setPin] = useState('');
  const [processing, setProcessing] = useState(false);

  const loadSettlements = useCallback(async () => {
    const data = await getSettlements(filter);
    if (data) {
      setSettlements(data.settlements);
      setSummary(data.summary);
    }
    setLoading(false);
    setRefreshing(false);
  }, [filter]);

  useEffect(() => { loadSettlements(); }, [loadSettlements]);

  const onRefresh = () => { setRefreshing(true); loadSettlements(); };

  const handlePayPress = (settlement: Settlement) => {
    setSelectedSettlement(settlement);
    setPin('');
    setPinModalVisible(true);
  };

  const handleProcessPayment = async () => {
    if (!selectedSettlement || pin.length !== 6) {
      Alert.alert('Error', 'Please enter your 6-digit PIN');
      return;
    }

    setProcessing(true);
    const result = await processSettlement(selectedSettlement.id, pin);
    setProcessing(false);

    if (result.success) {
      Alert.alert('Success', result.message || 'Payment sent successfully', [
        { text: 'OK', onPress: () => { setPinModalVisible(false); loadSettlements(); } }
      ]);
    } else {
      Alert.alert('Payment Failed', result.error || 'Could not process payment');
    }
  };

  const renderSettlement = ({ item }: { item: Settlement }) => {
    const isPending = item.status === 'pending';
    const statusColors: Record<string, string> = {
      pending: '#FFA000', completed: '#4CAF50', failed: '#F44336',
      processing: '#2196F3', approved: '#00BCD4', cancelled: '#9E9E9E'
    };

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.driverName}>{item.driver_name}</Text>
            <Text style={styles.driverPhone}>{item.driver_phone}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColors[item.status] }]}>
            <Text style={styles.statusText}>{item.status.toUpperCase()}</Text>
          </View>
        </View>
        
        <View style={styles.amountRow}>
          <View>
            <Text style={styles.label}>Gross Earnings</Text>
            <Text style={styles.amount}>${item.gross_earnings.toFixed(2)}</Text>
          </View>
          <View>
            <Text style={styles.label}>Platform Fee</Text>
            <Text style={styles.fee}>-${item.platform_fee.toFixed(2)}</Text>
          </View>
          <View>
            <Text style={styles.label}>Payout</Text>
            <Text style={styles.payout}>${item.payout_amount.toFixed(2)}</Text>
          </View>
        </View>

        <View style={styles.metaRow}>
          <Text style={styles.meta}>
            <Ionicons name="calendar" size={12} /> {item.settlement_date}
          </Text>
          <Text style={styles.meta}>
            <Ionicons name="car" size={12} /> {item.booking_count} rides
          </Text>
        </View>

        {isPending && (
          <TouchableOpacity 
            style={styles.payButton} 
            onPress={() => handlePayPress(item)}
          >
            <Ionicons name="send" size={20} color="#fff" />
            <Text style={styles.payButtonText}>
              Pay ${item.payout_amount.toFixed(2)} via EcoCash
            </Text>
          </TouchableOpacity>
        )}

        {item.status === 'completed' && item.payment_reference && (
          <View style={styles.refRow}>
            <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
            <Text style={styles.refText}>Ref: {item.payment_reference}</Text>
          </View>
        )}

        {item.status === 'failed' && item.payment_error && (
          <View style={styles.errorRow}>
            <Ionicons name="alert-circle" size={16} color="#F44336" />
            <Text style={styles.errorText}>{item.payment_error}</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Driver Settlements</Text>
        <TouchableOpacity onPress={onRefresh}>
          <Ionicons name="refresh" size={24} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {summary && (
        <View style={styles.summaryCard}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{summary.pending_count}</Text>
            <Text style={styles.summaryLabel}>Pending</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>${summary.pending_total.toFixed(2)}</Text>
            <Text style={styles.summaryLabel}>To Pay</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>${summary.completed_today.toFixed(2)}</Text>
            <Text style={styles.summaryLabel}>Paid Today</Text>
          </View>
        </View>
      )}

      <View style={styles.filterRow}>
        {(['pending', 'completed', 'all'] as const).map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={settlements}
          renderItem={renderSettlement}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="checkmark-done-circle" size={64} color="#ccc" />
              <Text style={styles.emptyText}>No {filter} settlements</Text>
            </View>
          }
        />
      )}

      {/* PIN Entry Modal */}
      <Modal visible={pinModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Confirm Payment</Text>
            {selectedSettlement && (
              <View style={styles.modalInfo}>
                <Text style={styles.modalDriver}>{selectedSettlement.driver_name}</Text>
                <Text style={styles.modalAmount}>${selectedSettlement.payout_amount.toFixed(2)}</Text>
                <Text style={styles.modalPhone}>to {selectedSettlement.ecocash_number}</Text>
              </View>
            )}
            <Text style={styles.pinLabel}>Enter your 6-digit PIN</Text>
            <TextInput
              style={styles.pinInput}
              value={pin}
              onChangeText={setPin}
              keyboardType="number-pad"
              maxLength={6}
              secureTextEntry
              placeholder="••••••"
              placeholderTextColor="#999"
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.cancelBtn} 
                onPress={() => setPinModalVisible(false)}
                disabled={processing}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.confirmBtn, processing && { opacity: 0.6 }]} 
                onPress={handleProcessPayment}
                disabled={processing || pin.length !== 6}
              >
                {processing ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Ionicons name="send" size={18} color="#fff" />
                    <Text style={styles.confirmBtnText}>Send Payment</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#333' },
  summaryCard: { flexDirection: 'row', backgroundColor: '#fff', margin: 16, marginTop: 0, borderRadius: 12, padding: 16, elevation: 2 },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryValue: { fontSize: 20, fontWeight: 'bold', color: COLORS.primary },
  summaryLabel: { fontSize: 12, color: '#666', marginTop: 4 },
  filterRow: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 8 },
  filterBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#e0e0e0', marginRight: 8 },
  filterBtnActive: { backgroundColor: COLORS.primary },
  filterText: { color: '#666', fontWeight: '500' },
  filterTextActive: { color: '#fff' },
  list: { padding: 16, paddingTop: 8 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  driverName: { fontSize: 16, fontWeight: '600', color: '#333' },
  driverPhone: { fontSize: 13, color: '#666', marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  statusText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  amountRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#eee' },
  label: { fontSize: 11, color: '#999', marginBottom: 4 },
  amount: { fontSize: 16, fontWeight: '600', color: '#333' },
  fee: { fontSize: 16, fontWeight: '600', color: '#F44336' },
  payout: { fontSize: 18, fontWeight: 'bold', color: '#4CAF50' },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  meta: { fontSize: 12, color: '#999' },
  payButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#4CAF50', borderRadius: 8, padding: 14, marginTop: 12 },
  payButtonText: { color: '#fff', fontWeight: '600', marginLeft: 8, fontSize: 15 },
  refRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  refText: { color: '#4CAF50', marginLeft: 6, fontSize: 12 },
  errorRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  errorText: { color: '#F44336', marginLeft: 6, fontSize: 12 },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyText: { color: '#999', marginTop: 12, fontSize: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#fff', borderRadius: 16, padding: 24, width: '85%', maxWidth: 340 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 16 },
  modalInfo: { alignItems: 'center', marginBottom: 20 },
  modalDriver: { fontSize: 16, fontWeight: '600' },
  modalAmount: { fontSize: 32, fontWeight: 'bold', color: '#4CAF50', marginVertical: 8 },
  modalPhone: { fontSize: 14, color: '#666' },
  pinLabel: { fontSize: 14, color: '#666', marginBottom: 8, textAlign: 'center' },
  pinInput: { backgroundColor: '#f5f5f5', borderRadius: 8, padding: 16, fontSize: 24, textAlign: 'center', letterSpacing: 8, fontWeight: 'bold' },
  modalButtons: { flexDirection: 'row', marginTop: 20 },
  cancelBtn: { flex: 1, padding: 14, alignItems: 'center', marginRight: 8, borderRadius: 8, backgroundColor: '#e0e0e0' },
  cancelBtnText: { color: '#666', fontWeight: '600' },
  confirmBtn: { flex: 2, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 14, borderRadius: 8, backgroundColor: '#4CAF50' },
  confirmBtnText: { color: '#fff', fontWeight: '600', marginLeft: 6 },
});

export default SettlementsScreen;

