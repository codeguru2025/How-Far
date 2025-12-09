// Top Up Screen
import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Linking } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { Button, Input } from '../../components';
import { useAuthStore } from '../../stores';
import { initiatePayment } from '../../api/paynow';
import { createTransaction, updateTransaction } from '../../api/transactions';
import { generateReference } from '../../utils/crypto';
import { formatPhoneForPayNow } from '../../utils/phone';
import { COLORS } from '../../theme';
import { Screen, PaymentMethod } from '../../types';

interface Props {
  onNavigate: (screen: Screen) => void;
}

const PAYMENT_METHODS: { key: PaymentMethod; name: string; icon: string; desc: string }[] = [
  { key: 'ecocash', name: 'EcoCash', icon: '📱', desc: 'Pay via push notification' },
  { key: 'onemoney', name: 'OneMoney', icon: '📲', desc: 'Pay via push notification' },
  { key: 'innbucks', name: 'InnBucks', icon: '🔢', desc: 'Get code to enter in app' },
  { key: 'bank', name: 'Bank Transfer', icon: '🏦', desc: 'Redirect to bank' },
];

const PRESET_AMOUNTS = [5, 10, 20, 50, 100];

export function TopUpScreen({ onNavigate }: Props) {
  const { user } = useAuthStore();
  const [amount, setAmount] = useState('');
  const [phone, setPhone] = useState(user?.phone_number || '');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('ecocash');
  const [loading, setLoading] = useState(false);
  const [innbucksCode, setInnbucksCode] = useState<string | null>(null);

  async function handleTopUp() {
    if (!user) return;
    
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount < 1) {
      Alert.alert('Error', 'Minimum top-up amount is $1.00');
      return;
    }
    if (!phone.trim()) {
      Alert.alert('Error', 'Please enter your phone number');
      return;
    }

    setLoading(true);
    setInnbucksCode(null);

    try {
      const formattedPhone = formatPhoneForPayNow(phone);
      const reference = generateReference('TOPUP');

      // Create pending transaction
      const transaction = await createTransaction({
        userId: user.id,
        type: 'topup',
        amount: numAmount,
        reference,
        description: `Top-up via ${paymentMethod.toUpperCase()}`,
        metadata: { phone: formattedPhone, payment_method: paymentMethod },
      });

      if (!transaction) {
        Alert.alert('Error', 'Failed to create transaction');
        return;
      }

      // Call PayNow
      const data = await initiatePayment({
        amount: numAmount,
        phone: formattedPhone,
        reference,
        paymentMethod,
      });

      if (!data.success) {
        await updateTransaction(transaction.id, { status: 'failed' });
        Alert.alert('Payment Failed', data.error || 'Failed to initiate payment');
        return;
      }

      // Update transaction with PayNow details
      await updateTransaction(transaction.id, { paynow_poll_url: data.pollUrl });

      // Handle based on payment method
      if (paymentMethod === 'ecocash' || paymentMethod === 'onemoney') {
        Alert.alert(
          '📱 Check Your Phone!',
          `PayNow has sent a payment request of $${numAmount.toFixed(2)} to ${formattedPhone}.\n\n` +
          `Open your ${paymentMethod === 'ecocash' ? 'EcoCash' : 'OneMoney'} app and approve the payment.\n\n` +
          `After approving, tap "Fix" in your wallet to credit the balance.`,
          [{ text: 'Go to Wallet', onPress: () => onNavigate('wallet') }]
        );
      } else if (paymentMethod === 'innbucks') {
        if (data.innbucksCode) {
          setInnbucksCode(data.innbucksCode);
          
          const tryOpenInnBucks = async () => {
            if (data.innbucksDeepLink) {
              try {
                await Linking.openURL(data.innbucksDeepLink);
              } catch {
                Alert.alert('InnBucks', `Enter this code: ${data.innbucksCode}`);
              }
            }
          };

          Alert.alert(
            '🔢 InnBucks Payment',
            `Your Code: ${data.innbucksCode}\nAmount: $${numAmount.toFixed(2)}`,
            [
              { text: 'Open InnBucks', onPress: tryOpenInnBucks },
              { text: 'Done', onPress: () => onNavigate('wallet') }
            ]
          );
        }
      } else if (paymentMethod === 'bank' && data.browserUrl) {
        await WebBrowser.openBrowserAsync(data.browserUrl, {
          toolbarColor: COLORS.primary,
          dismissButtonStyle: 'done',
        });
        Alert.alert('🏦 Bank Payment', 'After completing payment, tap "Fix" to credit your wallet.', 
          [{ text: 'Go to Wallet', onPress: () => onNavigate('wallet') }]
        );
      }

    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to process payment');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={() => onNavigate('wallet')} style={styles.backButton}>
        <Text style={styles.back}>← Back</Text>
      </TouchableOpacity>
      <Text style={styles.title}>Top Up Wallet</Text>

      <Input
        label="Amount (USD)"
        placeholder="0.00"
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
        containerStyle={styles.amountInput}
      />

      <Text style={styles.label}>Quick Select</Text>
      <View style={styles.presets}>
        {PRESET_AMOUNTS.map((preset) => (
          <TouchableOpacity
            key={preset}
            style={[styles.preset, amount === String(preset) && styles.presetActive]}
            onPress={() => setAmount(String(preset))}
          >
            <Text style={[styles.presetText, amount === String(preset) && styles.presetTextActive]}>
              ${preset}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Input
        label="Phone Number"
        placeholder="0771234567"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
      />

      <Text style={styles.label}>Payment Method</Text>
      <View style={styles.methods}>
        {PAYMENT_METHODS.map((method) => (
          <TouchableOpacity
            key={method.key}
            style={[styles.method, paymentMethod === method.key && styles.methodSelected]}
            onPress={() => setPaymentMethod(method.key)}
          >
            <Text style={styles.methodIcon}>{method.icon}</Text>
            <View style={styles.methodInfo}>
              <Text style={[styles.methodName, paymentMethod === method.key && { color: COLORS.primary }]}>
                {method.name}
              </Text>
              <Text style={styles.methodDesc}>{method.desc}</Text>
            </View>
            {paymentMethod === method.key && <Text style={styles.checkMark}>✓</Text>}
          </TouchableOpacity>
        ))}
      </View>

      {innbucksCode && (
        <View style={styles.codeBox}>
          <Text style={styles.codeLabel}>Your InnBucks Code:</Text>
          <Text style={styles.codeValue}>{innbucksCode}</Text>
        </View>
      )}

      <Button
        title={amount ? `Pay $${parseFloat(amount || '0').toFixed(2)}` : 'Enter Amount'}
        onPress={handleTopUp}
        loading={loading}
        disabled={!amount}
        size="large"
        style={styles.payButton}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  backButton: {
    marginBottom: 16,
  },
  back: {
    color: COLORS.primary,
    fontWeight: '500',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 24,
  },
  amountInput: {
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
    marginBottom: 8,
    marginTop: 16,
  },
  presets: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  preset: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  presetActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  presetText: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.text,
  },
  presetTextActive: {
    color: '#FFFFFF',
  },
  methods: {
    marginTop: 8,
  },
  method: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 10,
  },
  methodSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '10',
  },
  methodIcon: {
    fontSize: 28,
    marginRight: 14,
  },
  methodInfo: {
    flex: 1,
  },
  methodName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  methodDesc: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  checkMark: {
    fontSize: 20,
    color: COLORS.primary,
    fontWeight: 'bold',
  },
  codeBox: {
    backgroundColor: COLORS.primary + '15',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginTop: 16,
  },
  codeLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  codeValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginVertical: 8,
    letterSpacing: 4,
  },
  payButton: {
    marginTop: 24,
  },
});

