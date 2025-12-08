import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { CreditCard, Smartphone, Check } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { SUBSCRIPTION_PLANS } from '@/constants/subscriptions';
import { useApp } from '@/contexts/AppContext';
import { Subscription } from '@/types';

type PaymentMethod = 'ecocash' | 'onemoney' | 'card';

export default function PaymentScreen() {
  const router = useRouter();
  const { planId } = useLocalSearchParams<{ planId: string }>();
  const { user, saveSubscription } = useApp();
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('ecocash');
  const [isProcessing, setIsProcessing] = useState(false);

  const plan = SUBSCRIPTION_PLANS.find(p => p.id === planId);

  if (!plan || !user) {
    return null;
  }

  const handlePayment = async () => {
    setIsProcessing(true);

    setTimeout(async () => {
      const startDate = new Date();
      const endDate = new Date();
      
      if (plan.duration === 'daily') {
        endDate.setDate(endDate.getDate() + 1);
      } else if (plan.duration === 'weekly') {
        endDate.setDate(endDate.getDate() + 7);
      } else {
        endDate.setDate(endDate.getDate() + 30);
      }

      const subscription: Subscription = {
        id: Date.now().toString(),
        userId: user.id,
        planId: plan.id,
        plan,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        ridesRemaining: plan.ridesIncluded,
        status: 'active',
      };

      await saveSubscription(subscription);
      setIsProcessing(false);

      Alert.alert(
        'Payment Successful! 🎉',
        `Your ${plan.name} is now active. You have ${plan.ridesIncluded} rides available.`,
        [
          {
            text: 'Start Riding',
            onPress: () => router.replace('/(commuter)' as any),
          },
        ]
      );
    }, 2000);
  };

  const paymentMethods = [
    { id: 'ecocash' as const, name: 'EcoCash', icon: Smartphone },
    { id: 'onemoney' as const, name: 'OneMoney', icon: Smartphone },
    { id: 'card' as const, name: 'Debit/Credit Card', icon: CreditCard },
  ];

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Order Summary</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{plan.name}</Text>
            <Text style={styles.summaryValue}>${plan.price}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Rides included</Text>
            <Text style={styles.summaryValue}>{plan.ridesIncluded}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.summaryRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>${plan.price}</Text>
          </View>
        </View>

        <View style={styles.methodsContainer}>
          <Text style={styles.methodsTitle}>Payment Method</Text>
          {paymentMethods.map((method) => {
            const isSelected = selectedMethod === method.id;
            const Icon = method.icon;

            return (
              <Pressable
                key={method.id}
                style={({ pressed }) => [
                  styles.methodCard,
                  isSelected && styles.methodCardSelected,
                  pressed && styles.methodCardPressed,
                ]}
                onPress={() => setSelectedMethod(method.id)}
              >
                <View style={[
                  styles.methodIcon,
                  isSelected && styles.methodIconSelected,
                ]}>
                  <Icon
                    size={24}
                    color={isSelected ? Colors.textInverse : Colors.primary}
                  />
                </View>
                <Text style={[
                  styles.methodName,
                  isSelected && styles.methodNameSelected,
                ]}>
                  {method.name}
                </Text>
                {isSelected && (
                  <View style={styles.selectedCheck}>
                    <Check size={20} color={Colors.textInverse} strokeWidth={3} />
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>

        <View style={styles.noteCard}>
          <Text style={styles.noteTitle}>📱 Mobile Money</Text>
          <Text style={styles.noteText}>
            You will receive a prompt on your phone to complete the payment.
            Please enter your PIN to confirm.
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={({ pressed }) => [
            styles.payButton,
            (isProcessing) && styles.payButtonDisabled,
            pressed && !isProcessing && styles.payButtonPressed,
          ]}
          onPress={handlePayment}
          disabled={isProcessing}
        >
          <Text style={styles.payButtonText}>
            {isProcessing ? 'Processing...' : `Pay $${plan.price}`}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 24,
    paddingBottom: 120,
  },
  summaryCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 24,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 16,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  totalValue: {
    fontSize: 24,
    fontWeight: '800' as const,
    color: Colors.primary,
  },
  methodsContainer: {
    marginBottom: 24,
  },
  methodsTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 16,
  },
  methodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: Colors.borderLight,
  },
  methodCardSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  methodCardPressed: {
    opacity: 0.9,
  },
  methodIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodIconSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  methodName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    marginLeft: 16,
  },
  methodNameSelected: {
    color: Colors.textInverse,
  },
  selectedCheck: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteCard: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 16,
    padding: 20,
    borderLeftWidth: 4,
    borderLeftColor: Colors.secondary,
  },
  noteTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 8,
  },
  noteText: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 24,
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  payButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  payButtonDisabled: {
    opacity: 0.6,
  },
  payButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  payButtonText: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.textInverse,
  },
});
