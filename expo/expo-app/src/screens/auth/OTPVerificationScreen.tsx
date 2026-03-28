/**
 * OTP Verification Screen
 * 
 * Used for verifying phone numbers during registration or for sensitive operations.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../theme';
import { Button } from '../../components';
import { sendOTP, verifyOTP, resendOTP } from '../../api/otp';

interface Props {
  phoneNumber: string;
  purpose?: 'registration' | 'login' | 'verification' | 'password_reset';
  onVerified: (phoneNumber: string) => void;
  onCancel: () => void;
}

export function OTPVerificationScreen({ 
  phoneNumber, 
  purpose = 'verification',
  onVerified, 
  onCancel 
}: Props) {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [pinId, setPinId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(true);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [attemptsRemaining, setAttemptsRemaining] = useState(5);
  
  const inputRefs = useRef<(TextInput | null)[]>([]);

  // Send OTP on mount
  useEffect(() => {
    handleSendOTP();
  }, []);

  // Countdown timer for resend
  useEffect(() => {
    if (countdown > 0 && !canResend) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0) {
      setCanResend(true);
    }
  }, [countdown, canResend]);

  async function handleSendOTP() {
    setIsSending(true);
    setError('');
    
    const result = await sendOTP(phoneNumber, purpose);
    
    setIsSending(false);
    
    if (!result.success) {
      if (result.retryAfter) {
        setCountdown(result.retryAfter);
        setError('Please wait before requesting another code');
      } else {
        setError(result.error || 'Failed to send OTP');
      }
      return;
    }
    
    setPinId(result.pinId || null);
    setCountdown(60);
    setCanResend(false);
  }

  async function handleResendOTP() {
    if (!pinId || !canResend) return;
    
    setIsSending(true);
    setError('');
    
    const result = await resendOTP(pinId);
    
    setIsSending(false);
    
    if (!result.success) {
      setError(result.error || 'Failed to resend OTP');
      return;
    }
    
    setPinId(result.pinId || null);
    setCountdown(60);
    setCanResend(false);
    setOtp(['', '', '', '', '', '']);
    inputRefs.current[0]?.focus();
  }

  async function handleVerify() {
    if (!pinId) {
      setError('Please wait for the OTP to be sent');
      return;
    }
    
    const code = otp.join('');
    if (code.length !== 6) {
      setError('Please enter the complete 6-digit code');
      return;
    }
    
    setIsLoading(true);
    setError('');
    
    const result = await verifyOTP(pinId, code);
    
    setIsLoading(false);
    
    if (!result.success) {
      setError(result.error || 'Verification failed');
      return;
    }
    
    if (!result.verified) {
      setAttemptsRemaining(result.attemptsRemaining || attemptsRemaining - 1);
      setError(`Incorrect code. ${result.attemptsRemaining} attempts remaining.`);
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
      return;
    }
    
    // Success!
    onVerified(phoneNumber);
  }

  function handleOtpChange(text: string, index: number) {
    // Only allow digits
    const digit = text.replace(/[^0-9]/g, '').slice(-1);
    
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);
    
    // Auto-focus next input
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
    
    // Auto-verify when all digits entered
    if (digit && index === 5) {
      const code = newOtp.join('');
      if (code.length === 6) {
        // Small delay to show the last digit
        setTimeout(() => handleVerify(), 100);
      }
    }
  }

  function handleKeyPress(key: string, index: number) {
    if (key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.content}>
        {/* Header */}
        <Text style={styles.title}>Verify Your Phone</Text>
        <Text style={styles.subtitle}>
          Enter the 6-digit code sent to{'\n'}
          <Text style={styles.phone}>{phoneNumber}</Text>
        </Text>

        {/* OTP Input */}
        <View style={styles.otpContainer}>
          {otp.map((digit, index) => (
            <TextInput
              key={index}
              ref={(ref) => { inputRefs.current[index] = ref; }}
              style={[
                styles.otpInput,
                digit ? styles.otpInputFilled : null,
                error ? styles.otpInputError : null,
              ]}
              value={digit}
              onChangeText={(text) => handleOtpChange(text, index)}
              onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, index)}
              keyboardType="number-pad"
              maxLength={1}
              selectTextOnFocus
              editable={!isLoading && !isSending}
            />
          ))}
        </View>

        {/* Error Message */}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {/* Sending Indicator */}
        {isSending && (
          <View style={styles.sendingContainer}>
            <ActivityIndicator size="small" color={COLORS.primary} />
            <Text style={styles.sendingText}>Sending code...</Text>
          </View>
        )}

        {/* Verify Button */}
        <Button
          title={isLoading ? 'Verifying...' : 'Verify'}
          onPress={handleVerify}
          disabled={isLoading || isSending || otp.join('').length !== 6}
          style={styles.verifyButton}
        />

        {/* Resend */}
        <View style={styles.resendContainer}>
          {canResend ? (
            <TouchableOpacity onPress={handleResendOTP} disabled={isSending}>
              <Text style={styles.resendLink}>
                Didn't receive the code? <Text style={styles.resendBold}>Resend</Text>
              </Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.resendText}>
              Resend code in <Text style={styles.countdown}>{countdown}s</Text>
            </Text>
          )}
        </View>

        {/* Cancel */}
        <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  title: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.xl,
    lineHeight: 22,
  },
  phone: {
    fontWeight: '600',
    color: COLORS.text,
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  otpInput: {
    width: 50,
    height: 60,
    borderWidth: 2,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    color: COLORS.text,
    backgroundColor: COLORS.surface,
  },
  otpInputFilled: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight + '15',
  },
  otpInputError: {
    borderColor: COLORS.error,
  },
  error: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.error,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  sendingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  sendingText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  verifyButton: {
    width: '100%',
    marginTop: SPACING.md,
  },
  resendContainer: {
    marginTop: SPACING.xl,
  },
  resendText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
  },
  countdown: {
    fontWeight: '600',
    color: COLORS.primary,
  },
  resendLink: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
  },
  resendBold: {
    fontWeight: '600',
    color: COLORS.primary,
  },
  cancelButton: {
    marginTop: SPACING.xl,
    padding: SPACING.md,
  },
  cancelText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
  },
});

export default OTPVerificationScreen;

