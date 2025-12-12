// Driver Withdraw Screen - Self-service payout
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { COLORS } from '../../theme';
import { Screen, PaymentMethod } from '../../types';
import { Button } from '../../components';
import { useAuthStore, useWalletStore } from '../../stores';
import { supabase } from '../../api/supabase';

interface Props {
  onNavigate: (screen: Screen) => void;
}

interface PayoutMethod {
  id: PaymentMethod;
  name: string;
  icon: string;
  minAmount: number;
  fee: number; // Percentage fee
  processingTime: string;
}

const PAYOUT_METHODS: PayoutMethod[] = [
  { id: 'ecocash', name: 'EcoCash', icon: '📱', minAmount: 1, fee: 1.5, processingTime: 'Instant' },
  { id: 'onemoney', name: 'OneMoney', icon: '💚', minAmount: 1, fee: 1.5, processingTime: 'Instant' },
  { id: 'innbucks', name: 'InnBucks', icon: '🏦', minAmount: 1, fee: 1.0, processingTime: 'Instant' },
  { id: 'bank', name: 'Bank Transfer', icon: '🏛️', minAmount: 10, fee: 2.0, processingTime: '1-2 days' },
];

export function WithdrawScreen({ onNavigate }: Props) {
  const { user } = useAuthStore();
  const { wallet, fetchWallet } = useWalletStore();
  
  const [selectedMethod, setSelectedMethod] = useState<PayoutMethod | null>(null);
  const [amount, setAmount] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [earnings, setEarnings] = useState({ available: 0, pending: 0, total: 0 });
  const [recentPayouts, setRecentPayouts] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      if (user?.id) {
        await fetchWallet(user.id);
      }

      // Get driver's earnings from completed bookings
      const { data: driver } = await supabase
        .from('drivers')
        .select('id')
        .eq('user_id', user?.id)
        .single();

      if (driver) {
        // Get completed trips earnings
        const { data: completedBookings } = await supabase
          .from('bookings')
          .select(`
            total_amount,
            base_amount,
            payment_status,
            trips!inner(driver_id, status)
          `)
          .eq('trips.driver_id', driver.id)
          .eq('payment_status', 'paid')
          .in('trips.status', ['completed', 'in_progress']);

        const totalEarned = completedBookings?.reduce((sum, b) => sum + (b.total_amount || b.base_amount || 0), 0) || 0;

        // Get pending payouts
        const { data: pendingPayouts } = await supabase
          .from('payouts')
          .select('amount')
          .eq('user_id', user?.id)
          .eq('status', 'pending');

        const pendingAmount = pendingPayouts?.reduce((sum, p) => sum + p.amount, 0) || 0;

        // Get completed payouts
        const { data: completedPayouts } = await supabase
          .from('payouts')
          .select('amount')
          .eq('user_id', user?.id)
          .eq('status', 'completed');

        const paidOut = completedPayouts?.reduce((sum, p) => sum + p.amount, 0) || 0;

        setEarnings({
          total: totalEarned,
          pending: pendingAmount,
          available: Math.max(0, totalEarned - paidOut - pendingAmount),
        });

        // Get recent payouts for history
        const { data: payouts } = await supabase
          .from('payouts')
          .select('*')
          .eq('user_id', user?.id)
          .order('created_at', { ascending: false })
          .limit(5);

        setRecentPayouts(payouts || []);
      }
    } catch (error) {
      console.error('Load earnings error:', error);
    }
  }

  async function handleWithdraw() {
    if (!selectedMethod) {
      Alert.alert('Select Method', 'Please select a payout method');
      return;
    }

    const withdrawAmount = parseFloat(amount);
    if (isNaN(withdrawAmount) || withdrawAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount');
      return;
    }

    if (withdrawAmount < selectedMethod.minAmount) {
      Alert.alert('Minimum Amount', `Minimum withdrawal is $${selectedMethod.minAmount}`);
      return;
    }

    if (withdrawAmount > earnings.available) {
      Alert.alert('Insufficient Balance', `You only have $${earnings.available.toFixed(2)} available`);
      return;
    }

    if (!accountNumber.trim()) {
      Alert.alert('Account Required', 'Please enter your account number');
      return;
    }

    const fee = (withdrawAmount * selectedMethod.fee) / 100;
    const netAmount = withdrawAmount - fee;

    Alert.alert(
      'Confirm Withdrawal',
      `Amount: $${withdrawAmount.toFixed(2)}\nFee (${selectedMethod.fee}%): $${fee.toFixed(2)}\nYou'll receive: $${netAmount.toFixed(2)}\n\nTo: ${selectedMethod.name}\nAccount: ${accountNumber}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm', onPress: processWithdrawal },
      ]
    );
  }

  async function processWithdrawal() {
    if (!selectedMethod) return;

    setIsLoading(true);
    try {
      const withdrawAmount = parseFloat(amount);
      const fee = (withdrawAmount * selectedMethod.fee) / 100;

      // Create payout record
      const { data: payout, error } = await supabase
        .from('payouts')
        .insert({
          user_id: user?.id,
          amount: withdrawAmount,
          fee: fee,
          net_amount: withdrawAmount - fee,
          method: selectedMethod.id,
          account_number: accountNumber,
          account_name: accountName || user?.first_name,
          status: selectedMethod.processingTime === 'Instant' ? 'processing' : 'pending',
        })
        .select()
        .single();

      if (error) throw error;

      // For instant methods, simulate auto-processing
      if (selectedMethod.processingTime === 'Instant') {
        // In production, this would call actual payment APIs
        setTimeout(async () => {
          await supabase
            .from('payouts')
            .update({ status: 'completed', processed_at: new Date().toISOString() })
            .eq('id', payout.id);
        }, 2000);
      }

      Alert.alert(
        '✅ Withdrawal Submitted',
        `Your withdrawal of $${withdrawAmount.toFixed(2)} has been submitted.\n\n${selectedMethod.processingTime === 'Instant' ? 'Processing now...' : 'Will be processed within ' + selectedMethod.processingTime}`,
        [{ text: 'OK', onPress: () => {
          loadData();
          setAmount('');
          setAccountNumber('');
        }}]
      );

    } catch (error: any) {
      console.error('Withdraw error:', error);
      Alert.alert('Error', error.message || 'Failed to process withdrawal');
    } finally {
      setIsLoading(false);
    }
  }

  const fee = selectedMethod ? (parseFloat(amount || '0') * selectedMethod.fee) / 100 : 0;
  const netAmount = parseFloat(amount || '0') - fee;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => onNavigate('driver-home')} style={styles.backButton}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Withdraw Earnings</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceRow}>
            <View style={styles.balanceItem}>
              <Text style={styles.balanceLabel}>Available</Text>
              <Text style={styles.balanceValue}>${earnings.available.toFixed(2)}</Text>
            </View>
            <View style={styles.balanceDivider} />
            <View style={styles.balanceItem}>
              <Text style={styles.balanceLabel}>Pending</Text>
              <Text style={styles.balancePending}>${earnings.pending.toFixed(2)}</Text>
            </View>
            <View style={styles.balanceDivider} />
            <View style={styles.balanceItem}>
              <Text style={styles.balanceLabel}>Total Earned</Text>
              <Text style={styles.balanceTotal}>${earnings.total.toFixed(2)}</Text>
            </View>
          </View>
        </View>

        {/* Payout Methods */}
        <Text style={styles.sectionTitle}>Select Payout Method</Text>
        <View style={styles.methodsGrid}>
          {PAYOUT_METHODS.map((method) => (
            <TouchableOpacity
              key={method.id}
              style={[
                styles.methodCard,
                selectedMethod?.id === method.id && styles.methodCardSelected,
              ]}
              onPress={() => {
                setSelectedMethod(method);
                // Pre-fill with user's phone for mobile money
                if (method.id !== 'bank' && user?.phone_number) {
                  setAccountNumber(user.phone_number);
                }
              }}
            >
              <Text style={styles.methodIcon}>{method.icon}</Text>
              <Text style={styles.methodName}>{method.name}</Text>
              <Text style={styles.methodFee}>{method.fee}% fee</Text>
              <Text style={styles.methodTime}>{method.processingTime}</Text>
              {selectedMethod?.id === method.id && (
                <View style={styles.checkBadge}>
                  <Text style={styles.checkText}>✓</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Amount Input */}
        {selectedMethod && (
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Withdrawal Details</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Amount (USD)</Text>
              <View style={styles.amountInputContainer}>
                <Text style={styles.currencySymbol}>$</Text>
                <TextInput
                  style={styles.amountInput}
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor="#9CA3AF"
                />
              </View>
              <Text style={styles.inputHint}>
                Min: ${selectedMethod.minAmount} • Available: ${earnings.available.toFixed(2)}
              </Text>
            </View>

            {/* Quick Amount Buttons */}
            <View style={styles.quickAmounts}>
              {[5, 10, 20, 50].map((quickAmount) => (
                <TouchableOpacity
                  key={quickAmount}
                  style={[
                    styles.quickAmountBtn,
                    quickAmount > earnings.available && styles.quickAmountDisabled,
                  ]}
                  onPress={() => setAmount(String(Math.min(quickAmount, earnings.available)))}
                  disabled={quickAmount > earnings.available}
                >
                  <Text style={[
                    styles.quickAmountText,
                    quickAmount > earnings.available && styles.quickAmountTextDisabled,
                  ]}>
                    ${quickAmount}
                  </Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={styles.quickAmountBtn}
                onPress={() => setAmount(String(earnings.available))}
              >
                <Text style={styles.quickAmountText}>All</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                {selectedMethod.id === 'bank' ? 'Bank Account Number' : 'Mobile Number'}
              </Text>
              <TextInput
                style={styles.input}
                value={accountNumber}
                onChangeText={setAccountNumber}
                keyboardType={selectedMethod.id === 'bank' ? 'default' : 'phone-pad'}
                placeholder={selectedMethod.id === 'bank' ? 'Enter account number' : '07XXXXXXXX'}
                placeholderTextColor="#9CA3AF"
              />
            </View>

            {selectedMethod.id === 'bank' && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Account Holder Name</Text>
                <TextInput
                  style={styles.input}
                  value={accountName}
                  onChangeText={setAccountName}
                  placeholder="Full name on account"
                  placeholderTextColor="#9CA3AF"
                />
              </View>
            )}

            {/* Fee Summary */}
            {parseFloat(amount) > 0 && (
              <View style={styles.feeSummary}>
                <View style={styles.feeRow}>
                  <Text style={styles.feeLabel}>Amount</Text>
                  <Text style={styles.feeValue}>${parseFloat(amount).toFixed(2)}</Text>
                </View>
                <View style={styles.feeRow}>
                  <Text style={styles.feeLabel}>Fee ({selectedMethod.fee}%)</Text>
                  <Text style={styles.feeValueRed}>-${fee.toFixed(2)}</Text>
                </View>
                <View style={styles.feeDivider} />
                <View style={styles.feeRow}>
                  <Text style={styles.feeTotal}>You'll Receive</Text>
                  <Text style={styles.feeTotalValue}>${netAmount.toFixed(2)}</Text>
                </View>
              </View>
            )}

            <Button
              title={isLoading ? 'Processing...' : 'Withdraw'}
              onPress={handleWithdraw}
              loading={isLoading}
              disabled={isLoading || !amount || parseFloat(amount) <= 0}
              size="large"
              style={styles.withdrawButton}
            />
          </View>
        )}

        {/* Recent Payouts */}
        {recentPayouts.length > 0 && (
          <View style={styles.historySection}>
            <Text style={styles.sectionTitle}>Recent Withdrawals</Text>
            {recentPayouts.map((payout) => (
              <View key={payout.id} style={styles.payoutItem}>
                <View style={styles.payoutIcon}>
                  <Text>{payout.status === 'completed' ? '✅' : payout.status === 'pending' ? '⏳' : '🔄'}</Text>
                </View>
                <View style={styles.payoutInfo}>
                  <Text style={styles.payoutMethod}>{payout.method?.toUpperCase()}</Text>
                  <Text style={styles.payoutDate}>
                    {new Date(payout.created_at).toLocaleDateString()}
                  </Text>
                </View>
                <View style={styles.payoutAmount}>
                  <Text style={styles.payoutAmountText}>${payout.net_amount?.toFixed(2)}</Text>
                  <Text style={[
                    styles.payoutStatus,
                    payout.status === 'completed' && styles.statusCompleted,
                    payout.status === 'pending' && styles.statusPending,
                  ]}>
                    {payout.status}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

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
    backgroundColor: COLORS.surface,
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
  content: {
    flex: 1,
    padding: 16,
  },
  balanceCard: {
    backgroundColor: '#1E3A5F',
    borderRadius: 20,
    padding: 24,
    marginBottom: 24,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  balanceItem: {
    flex: 1,
    alignItems: 'center',
  },
  balanceDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  balanceLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 6,
  },
  balanceValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#10B981',
  },
  balancePending: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FBBF24',
  },
  balanceTotal: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 14,
  },
  methodsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  methodCard: {
    width: '47%',
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  methodCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '10',
  },
  methodIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  methodName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  methodFee: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  methodTime: {
    fontSize: 11,
    color: '#10B981',
    marginTop: 2,
  },
  checkBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  formSection: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  currencySymbol: {
    fontSize: 24,
    fontWeight: '600',
    color: COLORS.text,
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.text,
    paddingVertical: 16,
  },
  inputHint: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 6,
  },
  quickAmounts: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  quickAmountBtn: {
    flex: 1,
    backgroundColor: '#E5E7EB',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  quickAmountDisabled: {
    opacity: 0.4,
  },
  quickAmountText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  quickAmountTextDisabled: {
    color: COLORS.textSecondary,
  },
  input: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: COLORS.text,
  },
  feeSummary: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  feeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  feeLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  feeValue: {
    fontSize: 14,
    color: COLORS.text,
  },
  feeValueRed: {
    fontSize: 14,
    color: '#EF4444',
  },
  feeDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 8,
  },
  feeTotal: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  feeTotalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#10B981',
  },
  withdrawButton: {
    marginTop: 8,
  },
  historySection: {
    marginTop: 8,
  },
  payoutItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  payoutIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  payoutInfo: {
    flex: 1,
  },
  payoutMethod: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  payoutDate: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  payoutAmount: {
    alignItems: 'flex-end',
  },
  payoutAmountText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  payoutStatus: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
    marginTop: 2,
  },
  statusCompleted: {
    color: '#10B981',
  },
  statusPending: {
    color: '#F59E0B',
  },
  bottomPadding: {
    height: 40,
  },
});

