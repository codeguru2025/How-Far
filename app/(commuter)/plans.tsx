import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Check, Clock, Calendar, Ticket } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { SUBSCRIPTION_PLANS } from '@/constants/subscriptions';
import { SubscriptionPlan } from '@/types';

export default function PlansScreen() {
  const router = useRouter();
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);

  const handleContinue = () => {
    if (selectedPlan) {
      router.push({
        pathname: '/(commuter)/payment' as any,
        params: { planId: selectedPlan.id },
      });
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Choose Your Plan</Text>
          <Text style={styles.subtitle}>
            Select a subscription that fits your travel needs
          </Text>
        </View>

        <View style={styles.plansContainer}>
          {SUBSCRIPTION_PLANS.map((plan) => {
            const isSelected = selectedPlan?.id === plan.id;
            const isPopular = plan.id === 'monthly';

            let icon = <Ticket size={24} color={isSelected ? Colors.textInverse : Colors.primary} />;
            if (plan.duration === 'daily') icon = <Clock size={24} color={isSelected ? Colors.textInverse : Colors.primary} />;
            if (plan.duration === 'weekly') icon = <Calendar size={24} color={isSelected ? Colors.textInverse : Colors.primary} />;

            return (
              <Pressable
                key={plan.id}
                style={({ pressed }) => [
                  styles.planCard,
                  isSelected && styles.planCardSelected,
                  pressed && styles.planCardPressed,
                ]}
                onPress={() => setSelectedPlan(plan)}
              >
                {isPopular && (
                  <View style={styles.popularBadge}>
                    <Text style={styles.popularText}>Most Popular</Text>
                  </View>
                )}

                <View style={styles.planHeader}>
                  <View style={[
                    styles.planIcon,
                    isSelected && styles.planIconSelected,
                  ]}>
                    {icon}
                  </View>
                  <View style={styles.planInfo}>
                    <Text style={[
                      styles.planName,
                      isSelected && styles.planNameSelected,
                    ]}>
                      {plan.name}
                    </Text>
                    <Text style={[
                      styles.planDescription,
                      isSelected && styles.planDescriptionSelected,
                    ]}>
                      {plan.description}
                    </Text>
                  </View>
                  {isSelected && (
                    <View style={styles.checkmark}>
                      <Check size={20} color={Colors.textInverse} strokeWidth={3} />
                    </View>
                  )}
                </View>

                <View style={styles.planPricing}>
                  <Text style={[
                    styles.planPrice,
                    isSelected && styles.planPriceSelected,
                  ]}>
                    ${plan.price}
                  </Text>
                  <Text style={[
                    styles.planPer,
                    isSelected && styles.planPerSelected,
                  ]}>
                    / {plan.duration}
                  </Text>
                </View>

                <View style={styles.planFeatures}>
                  <View style={styles.feature}>
                    <Check
                      size={16}
                      color={isSelected ? Colors.textInverse : Colors.success}
                      strokeWidth={2.5}
                    />
                    <Text style={[
                      styles.featureText,
                      isSelected && styles.featureTextSelected,
                    ]}>
                      {plan.ridesIncluded} rides included
                    </Text>
                  </View>
                  <View style={styles.feature}>
                    <Check
                      size={16}
                      color={isSelected ? Colors.textInverse : Colors.success}
                      strokeWidth={2.5}
                    />
                    <Text style={[
                      styles.featureText,
                      isSelected && styles.featureTextSelected,
                    ]}>
                      Valid for {plan.duration === 'daily' ? '1 day' : plan.duration === 'weekly' ? '7 days' : '30 days'}
                    </Text>
                  </View>
                  <View style={styles.feature}>
                    <Check
                      size={16}
                      color={isSelected ? Colors.textInverse : Colors.success}
                      strokeWidth={2.5}
                    />
                    <Text style={[
                      styles.featureText,
                      isSelected && styles.featureTextSelected,
                    ]}>
                      All routes included
                    </Text>
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {selectedPlan && (
        <View style={styles.footer}>
          <Pressable
            style={({ pressed }) => [
              styles.continueButton,
              pressed && styles.continueButtonPressed,
            ]}
            onPress={handleContinue}
          >
            <Text style={styles.continueButtonText}>
              Continue with {selectedPlan.name}
            </Text>
          </Pressable>
        </View>
      )}
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
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '800' as const,
    color: Colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  plansContainer: {
    gap: 16,
  },
  planCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 24,
    borderWidth: 2,
    borderColor: Colors.borderLight,
    position: 'relative',
  },
  planCardSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  planCardPressed: {
    opacity: 0.9,
  },
  popularBadge: {
    position: 'absolute',
    top: -10,
    right: 20,
    backgroundColor: Colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  popularText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  planIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planIconSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  planInfo: {
    flex: 1,
    marginLeft: 12,
  },
  planName: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 2,
  },
  planNameSelected: {
    color: Colors.textInverse,
  },
  planDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  planDescriptionSelected: {
    color: Colors.textInverse,
    opacity: 0.9,
  },
  checkmark: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  planPricing: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 16,
  },
  planPrice: {
    fontSize: 36,
    fontWeight: '800' as const,
    color: Colors.text,
  },
  planPriceSelected: {
    color: Colors.textInverse,
  },
  planPer: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginLeft: 4,
  },
  planPerSelected: {
    color: Colors.textInverse,
    opacity: 0.8,
  },
  planFeatures: {
    gap: 12,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featureText: {
    fontSize: 14,
    color: Colors.text,
  },
  featureTextSelected: {
    color: Colors.textInverse,
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
  continueButton: {
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
  continueButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  continueButtonText: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.textInverse,
  },
});
