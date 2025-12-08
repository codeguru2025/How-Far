import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Bus, QrCode, Wallet, ArrowRight } from 'lucide-react-native';
import Colors from '@/constants/colors';

const slides = [
  {
    icon: Bus,
    title: 'Smart Transport',
    description: 'Monthly subscriptions for unlimited kombi rides across Harare',
  },
  {
    icon: QrCode,
    title: 'Easy Validation',
    description: 'Just scan your QR code when you board - no cash needed',
  },
  {
    icon: Wallet,
    title: 'Save Money',
    description: 'Fixed monthly price. Ride as much as you need without worrying',
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const [currentSlide, setCurrentSlide] = useState(0);
  const slideAnim = new Animated.Value(0);

  const nextSlide = () => {
    if (currentSlide < slides.length - 1) {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        setCurrentSlide(currentSlide + 1);
      });
    } else {
      router.push('/role-select' as any);
    }
  };

  const slide = slides[currentSlide];
  const Icon = slide.icon;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[Colors.primary, Colors.primaryDark]}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <View style={styles.iconCircle}>
            <Icon size={80} color={Colors.primary} strokeWidth={1.5} />
          </View>
        </View>

        <View style={styles.textContainer}>
          <Text style={styles.title}>{slide.title}</Text>
          <Text style={styles.description}>{slide.description}</Text>
        </View>

        <View style={styles.dotsContainer}>
          {slides.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                currentSlide === index && styles.activeDot,
              ]}
            />
          ))}
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.button,
            pressed && styles.buttonPressed,
          ]}
          onPress={nextSlide}
        >
          <Text style={styles.buttonText}>
            {currentSlide === slides.length - 1 ? 'Get Started' : 'Next'}
          </Text>
          <ArrowRight size={24} color={Colors.primary} />
        </Pressable>

        {currentSlide === 0 && (
          <Pressable
            style={styles.skipButton}
            onPress={() => router.push('/role-select' as any)}
          >
            <Text style={styles.skipText}>Skip</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  iconContainer: {
    marginTop: 40,
  },
  iconCircle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: Colors.textInverse,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  textContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: 36,
    fontWeight: '800' as const,
    color: Colors.textInverse,
    textAlign: 'center',
    marginBottom: 16,
  },
  description: {
    fontSize: 18,
    color: Colors.textInverse,
    textAlign: 'center',
    lineHeight: 26,
    opacity: 0.9,
    paddingHorizontal: 20,
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.textInverse,
    opacity: 0.3,
  },
  activeDot: {
    width: 24,
    opacity: 1,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.textInverse,
    paddingVertical: 18,
    paddingHorizontal: 48,
    borderRadius: 30,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.primary,
  },
  skipButton: {
    position: 'absolute',
    top: 60,
    right: 24,
    padding: 8,
  },
  skipText: {
    fontSize: 16,
    color: Colors.textInverse,
    fontWeight: '600' as const,
    opacity: 0.8,
  },
});
