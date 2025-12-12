// Language & Announcements Settings Screen
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { COLORS } from '../../theme';
import { Screen } from '../../types';
import { Button } from '../../components';
import { useLanguage } from '../../context/LanguageContext';
import { Language, availableLanguages } from '../../i18n';
import { useAnnouncements, AnnouncementSettings } from '../../services/announcements';

interface Props {
  onNavigate: (screen: Screen) => void;
}

export function LanguageSettingsScreen({ onNavigate }: Props) {
  const { language, setLanguage, t } = useLanguage();
  const { 
    settings: announcementSettings, 
    isAvailable: ttsAvailable,
    updateSettings,
    testAnnouncement,
  } = useAnnouncements();
  
  const [isTestingVoice, setIsTestingVoice] = useState(false);
  const [localSettings, setLocalSettings] = useState<AnnouncementSettings>(announcementSettings);

  useEffect(() => {
    setLocalSettings(announcementSettings);
  }, [announcementSettings]);

  async function handleLanguageChange(lang: Language) {
    await setLanguage(lang);
    await updateSettings({ language: lang });
  }

  async function handleTestVoice() {
    setIsTestingVoice(true);
    try {
      await testAnnouncement();
    } catch (error) {
      Alert.alert('Error', 'Could not play test announcement');
    } finally {
      setTimeout(() => setIsTestingVoice(false), 2000);
    }
  }

  async function handleSaveSettings() {
    await updateSettings(localSettings);
    Alert.alert('✓ Saved', 'Settings have been saved');
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => onNavigate('home')} style={styles.backButton}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('settings')}</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Language Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🌍 {t('language')}</Text>
          <Text style={styles.sectionSubtitle}>
            Choose your preferred language for the app
          </Text>
          
          <View style={styles.languageList}>
            {availableLanguages.map((lang) => (
              <TouchableOpacity
                key={lang.code}
                style={[
                  styles.languageOption,
                  language === lang.code && styles.languageOptionSelected,
                ]}
                onPress={() => handleLanguageChange(lang.code)}
              >
                <Text style={styles.languageFlag}>{lang.flag}</Text>
                <View style={styles.languageInfo}>
                  <Text style={[
                    styles.languageName,
                    language === lang.code && styles.languageNameSelected,
                  ]}>
                    {lang.nativeName}
                  </Text>
                </View>
                {language === lang.code && (
                  <View style={styles.checkmark}>
                    <Text style={styles.checkmarkText}>✓</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Voice Announcements */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🔊 {t('voice_announcements')}</Text>
          <Text style={styles.sectionSubtitle}>
            Auto-announce passenger drop-off points during trips
          </Text>

          {!ttsAvailable && (
            <View style={styles.warningBox}>
              <Text style={styles.warningText}>
                ⚠️ Text-to-speech is not available on this device
              </Text>
            </View>
          )}

          {/* Enable/Disable Toggle */}
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Enable Announcements</Text>
              <Text style={styles.settingDescription}>
                Voice announcements for drop-offs
              </Text>
            </View>
            <Switch
              value={localSettings.enabled}
              onValueChange={(value) => setLocalSettings({ ...localSettings, enabled: value })}
              trackColor={{ false: '#E5E7EB', true: COLORS.primary + '60' }}
              thumbColor={localSettings.enabled ? COLORS.primary : '#F3F4F6'}
              disabled={!ttsAvailable}
            />
          </View>

          {/* Volume Slider */}
          <View style={styles.sliderRow}>
            <Text style={styles.sliderLabel}>Volume</Text>
            <View style={styles.sliderContainer}>
              <Text style={styles.sliderValue}>🔈</Text>
              <Slider
                style={styles.slider}
                minimumValue={0.3}
                maximumValue={1.0}
                value={localSettings.volume}
                onValueChange={(value) => setLocalSettings({ ...localSettings, volume: value })}
                minimumTrackTintColor={COLORS.primary}
                maximumTrackTintColor="#E5E7EB"
                thumbTintColor={COLORS.primary}
                disabled={!localSettings.enabled}
              />
              <Text style={styles.sliderValue}>🔊</Text>
            </View>
          </View>

          {/* Speech Rate Slider */}
          <View style={styles.sliderRow}>
            <Text style={styles.sliderLabel}>Speech Speed</Text>
            <View style={styles.sliderContainer}>
              <Text style={styles.sliderValue}>🐢</Text>
              <Slider
                style={styles.slider}
                minimumValue={0.5}
                maximumValue={1.5}
                value={localSettings.rate}
                onValueChange={(value) => setLocalSettings({ ...localSettings, rate: value })}
                minimumTrackTintColor={COLORS.primary}
                maximumTrackTintColor="#E5E7EB"
                thumbTintColor={COLORS.primary}
                disabled={!localSettings.enabled}
              />
              <Text style={styles.sliderValue}>🐇</Text>
            </View>
          </View>

          {/* Pitch Slider */}
          <View style={styles.sliderRow}>
            <Text style={styles.sliderLabel}>Voice Pitch</Text>
            <View style={styles.sliderContainer}>
              <Text style={styles.sliderValue}>Low</Text>
              <Slider
                style={styles.slider}
                minimumValue={0.7}
                maximumValue={1.3}
                value={localSettings.pitch}
                onValueChange={(value) => setLocalSettings({ ...localSettings, pitch: value })}
                minimumTrackTintColor={COLORS.primary}
                maximumTrackTintColor="#E5E7EB"
                thumbTintColor={COLORS.primary}
                disabled={!localSettings.enabled}
              />
              <Text style={styles.sliderValue}>High</Text>
            </View>
          </View>

          {/* Test Button */}
          <TouchableOpacity
            style={[styles.testButton, (!localSettings.enabled || isTestingVoice) && styles.testButtonDisabled]}
            onPress={handleTestVoice}
            disabled={!localSettings.enabled || isTestingVoice}
          >
            {isTestingVoice ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.testButtonIcon}>🔊</Text>
                <Text style={styles.testButtonText}>Test Announcement</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Announcement Info */}
        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>How Announcements Work</Text>
          <View style={styles.infoItem}>
            <Text style={styles.infoIcon}>🚗</Text>
            <Text style={styles.infoText}>
              When all passengers are onboard, the app announces the trip is starting
            </Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoIcon}>📍</Text>
            <Text style={styles.infoText}>
              500m before each drop-off, the app announces the passenger's name and location
            </Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoIcon}>🏁</Text>
            <Text style={styles.infoText}>
              When arriving at drop-off, the app announces "We have arrived"
            </Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoIcon}>🌍</Text>
            <Text style={styles.infoText}>
              Announcements are in your selected language (Shona, Ndebele, or English)
            </Text>
          </View>
        </View>

        {/* Save Button */}
        <Button
          title="Save Settings"
          onPress={handleSaveSettings}
          size="large"
          style={styles.saveButton}
        />

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
  section: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 6,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 20,
  },
  languageList: {
    gap: 12,
  },
  languageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  languageOptionSelected: {
    backgroundColor: COLORS.primary + '10',
    borderColor: COLORS.primary,
  },
  languageFlag: {
    fontSize: 28,
    marginRight: 14,
  },
  languageInfo: {
    flex: 1,
  },
  languageName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  languageNameSelected: {
    color: COLORS.primary,
  },
  checkmark: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmarkText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  warningBox: {
    backgroundColor: '#FEF3C7',
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
  },
  warningText: {
    fontSize: 14,
    color: '#92400E',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  settingDescription: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  sliderRow: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  sliderLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 12,
  },
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  slider: {
    flex: 1,
    height: 40,
  },
  sliderValue: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginHorizontal: 8,
  },
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
    gap: 10,
  },
  testButtonDisabled: {
    backgroundColor: '#D1D5DB',
  },
  testButtonIcon: {
    fontSize: 20,
  },
  testButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  infoSection: {
    backgroundColor: '#EFF6FF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E40AF',
    marginBottom: 16,
  },
  infoItem: {
    flexDirection: 'row',
    marginBottom: 14,
  },
  infoIcon: {
    fontSize: 18,
    marginRight: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#1E3A5F',
    lineHeight: 20,
  },
  saveButton: {
    marginBottom: 20,
  },
  bottomPadding: {
    height: 40,
  },
});


