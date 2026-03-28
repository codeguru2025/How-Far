// Help & Support Screen
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Linking,
} from 'react-native';
import { COLORS } from '../../theme';
import { Screen } from '../../types';

interface Props {
  onNavigate: (screen: Screen) => void;
}

interface FAQ {
  id: string;
  question: string;
  answer: string;
  isOpen: boolean;
}

export function HelpScreen({ onNavigate }: Props) {
  const [faqs, setFaqs] = useState<FAQ[]>([
    { 
      id: '1', 
      question: 'How do I book a ride?', 
      answer: 'Tap "Find Ride" on the home screen, enter your destination, and browse available trips. Select a trip and confirm your booking.',
      isOpen: false 
    },
    { 
      id: '2', 
      question: 'How do I pay for my ride?', 
      answer: 'You can pay using your HowFar Wallet balance or mobile money (EcoCash, OneMoney). Top up your wallet before booking or pay directly via mobile money.',
      isOpen: false 
    },
    { 
      id: '3', 
      question: 'How do I become a driver?', 
      answer: 'Go to Profile > Become a Driver. Register your vehicle details and start accepting ride requests.',
      isOpen: false 
    },
    { 
      id: '4', 
      question: 'How do I cancel a booking?', 
      answer: 'Go to your active booking and tap "Cancel Booking". Note that cancellation fees may apply depending on timing.',
      isOpen: false 
    },
    { 
      id: '5', 
      question: 'How do I contact my driver?', 
      answer: 'Once your booking is confirmed, you can message your driver directly through the app using the chat feature.',
      isOpen: false 
    },
    { 
      id: '6', 
      question: 'How do I withdraw my earnings as a driver?', 
      answer: 'Go to Withdraw from your driver dashboard. Select your payout method and enter the amount. Funds are processed within 24 hours.',
      isOpen: false 
    },
  ]);

  function toggleFAQ(id: string) {
    setFaqs(faqs.map(f => ({
      ...f,
      isOpen: f.id === id ? !f.isOpen : f.isOpen,
    })));
  }

  function contactSupport() {
    Linking.openURL('mailto:support@howfar.co.zw?subject=Help Request');
  }

  function callSupport() {
    Linking.openURL('tel:+263242123456');
  }

  function openWhatsApp() {
    Linking.openURL('https://wa.me/263712171267?text=Hi, I need help with the HowFar app');
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => onNavigate('profile')} style={styles.backButton}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Help & Support</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Contact Options */}
        <Text style={styles.sectionTitle}>Contact Us</Text>
        <View style={styles.contactGrid}>
          <TouchableOpacity style={styles.contactCard} onPress={openWhatsApp}>
            <Text style={styles.contactIcon}>💬</Text>
            <Text style={styles.contactLabel}>WhatsApp</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.contactCard} onPress={contactSupport}>
            <Text style={styles.contactIcon}>📧</Text>
            <Text style={styles.contactLabel}>Email</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.contactCard} onPress={callSupport}>
            <Text style={styles.contactIcon}>📞</Text>
            <Text style={styles.contactLabel}>Call</Text>
          </TouchableOpacity>
        </View>

        {/* FAQ Section */}
        <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
        <View style={styles.faqList}>
          {faqs.map((faq) => (
            <TouchableOpacity 
              key={faq.id}
              style={styles.faqCard}
              onPress={() => toggleFAQ(faq.id)}
              activeOpacity={0.7}
            >
              <View style={styles.faqHeader}>
                <Text style={styles.faqQuestion}>{faq.question}</Text>
                <Text style={styles.faqToggle}>{faq.isOpen ? '−' : '+'}</Text>
              </View>
              {faq.isOpen && (
                <Text style={styles.faqAnswer}>{faq.answer}</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* App Info */}
        <View style={styles.appInfo}>
          <Text style={styles.appName}>HowFar</Text>
          <Text style={styles.appVersion}>Version 1.0.0</Text>
          <View style={styles.appLinks}>
            <TouchableOpacity>
              <Text style={styles.appLink}>Terms of Service</Text>
            </TouchableOpacity>
            <Text style={styles.linkDivider}>•</Text>
            <TouchableOpacity>
              <Text style={styles.appLink}>Privacy Policy</Text>
            </TouchableOpacity>
          </View>
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
  contactGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  contactCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  contactIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  contactLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
  },
  faqList: {
    gap: 12,
    marginBottom: 24,
  },
  faqCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  faqQuestion: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
    paddingRight: 12,
  },
  faqToggle: {
    fontSize: 24,
    color: COLORS.primary,
    fontWeight: '300',
  },
  faqAnswer: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 22,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  appInfo: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  appName: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
  },
  appVersion: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  appLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
  },
  appLink: {
    fontSize: 14,
    color: COLORS.primary,
  },
  linkDivider: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginHorizontal: 8,
  },
  bottomPadding: {
    height: 40,
  },
});

