import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Keyboard,
} from 'react-native';
import { useAuth } from '../context/AuthContext';

export default function LoginScreen() {
  const { sendOtp, verifyOtp } = useAuth();
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [loading, setLoading] = useState(false);
  const [devOtp, setDevOtp] = useState('');

  const handleSendOtp = async () => {
    Keyboard.dismiss();
    if (phone.length < 10) return Alert.alert('Invalid', 'Enter a valid phone number');
    setLoading(true);
    try {
      const res = await sendOtp(phone.startsWith('+') ? phone : `+91${phone}`);
      if (res.debug_otp) {
        setDevOtp(res.debug_otp);
        Alert.alert('Dev Mode — OTP', `${res.debug_otp}`, [{ text: 'OK' }]);
      }
      setStep('otp');
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    Keyboard.dismiss();
    if (otp.length !== 6) return Alert.alert('Invalid', 'Enter 6-digit OTP');
    setLoading(true);
    try {
      await verifyOtp(phone.startsWith('+') ? phone : `+91${phone}`, otp);
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.inner}>
        <Text style={styles.logo}>💸</Text>
        <Text style={styles.title}>SpendWise</Text>
        <Text style={styles.subtitle}>Your privacy-first expense manager</Text>

        {step === 'phone' ? (
          <>
            <Text style={styles.label}>Phone Number</Text>
            <View style={styles.phoneRow}>
              <Text style={styles.prefix}>+91</Text>
              <TextInput
                style={styles.input}
                placeholder="9876543210"
                keyboardType="phone-pad"
                maxLength={10}
                value={phone}
                onChangeText={setPhone}
                autoFocus
              />
            </View>
            <TouchableOpacity style={styles.button} onPress={handleSendOtp} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Send OTP</Text>}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.label}>Enter 6-digit OTP</Text>
            <Text style={styles.hint}>Sent to +91{phone}</Text>
            <TextInput
              style={[styles.input, styles.otpInput]}
              placeholder="• • • • • •"
              keyboardType="number-pad"
              maxLength={6}
              value={otp}
              onChangeText={setOtp}
              autoFocus
            />
            <TouchableOpacity style={styles.button} onPress={handleVerifyOtp} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Verify & Continue</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setStep('phone')}>
              <Text style={styles.back}>← Change number</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  inner: { flex: 1, justifyContent: 'center', padding: 32 },
  logo: { fontSize: 56, textAlign: 'center', marginBottom: 8 },
  title: { fontSize: 32, fontWeight: '700', color: '#F8FAFC', textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#94A3B8', textAlign: 'center', marginBottom: 48 },
  label: { fontSize: 14, color: '#CBD5E1', marginBottom: 8, fontWeight: '500' },
  hint: { fontSize: 12, color: '#64748B', marginBottom: 12 },
  phoneRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  prefix: { color: '#F8FAFC', fontSize: 16, marginRight: 8, fontWeight: '600' },
  input: {
    flex: 1, backgroundColor: '#1E293B', borderRadius: 12,
    padding: 16, color: '#F8FAFC', fontSize: 16, borderWidth: 1, borderColor: '#334155',
  },
  otpInput: { letterSpacing: 8, fontSize: 22, textAlign: 'center', marginBottom: 24 },
  button: {
    backgroundColor: '#6366F1', borderRadius: 14, padding: 16,
    alignItems: 'center', marginTop: 8, marginBottom: 16,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  back: { color: '#6366F1', textAlign: 'center', marginTop: 8 },
});
