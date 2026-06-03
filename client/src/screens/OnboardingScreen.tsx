import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const STEPS = ['Income', 'Fixed Expenses', 'First Goal'];

export default function OnboardingScreen() {
  const { user, updateUser } = useAuth();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  // Step 0: Income
  const [salary, setSalary] = useState('');
  const [salaryDay, setSalaryDay] = useState('1');

  // Step 1: Fixed expenses
  const [expenses, setExpenses] = useState([
    { name: 'Rent', type: 'rent', amount: '' },
    { name: 'Home Loan EMI', type: 'emi', amount: '' },
    { name: 'SIP Investment', type: 'sip', amount: '' },
    { name: 'Insurance', type: 'insurance', amount: '' },
  ]);

  // Step 2: Goal
  const [goalName, setGoalName] = useState('Emergency Fund');
  const [goalAmount, setGoalAmount] = useState('');
  const [goalDeadline, setGoalDeadline] = useState('');

  const handleNext = async () => {
    if (step < STEPS.length - 1) {
      if (step === 0) await saveIncome();
      if (step === 1) await saveExpenses();
      setStep(s => s + 1);
    } else {
      await finishOnboarding();
    }
  };

  const saveIncome = async () => {
    if (!salary) return;
    await updateUser({
      monthly_salary: parseFloat(salary),
      salary_day: parseInt(salaryDay) || 1,
    });
  };

  const saveExpenses = async () => {
    const filled = expenses.filter(e => e.amount && parseFloat(e.amount) > 0);
    if (filled.length === 0) return;
    try {
      await Promise.all(filled.map(e =>
        api.post('/mandatory', { name: e.name, type: e.type, amount: parseFloat(e.amount) })
      ));
    } catch {}
  };

  const finishOnboarding = async () => {
    setLoading(true);
    try {
      if (goalAmount && parseFloat(goalAmount) > 0) {
        await api.post('/goals', {
          name: goalName,
          target_amount: parseFloat(goalAmount),
          deadline: goalDeadline || undefined,
          icon: '🏆',
        });
      }
      await updateUser({ onboarding_done: true });
      await api.patch('/auth/me', { onboarding_done: true });
    } catch (e) {
      Alert.alert('Error', 'Could not save goal, but setup is complete.');
      await updateUser({ onboarding_done: true });
    } finally {
      setLoading(false);
    }
  };

  const updateExpenseAmount = (index: number, value: string) => {
    const updated = [...expenses];
    updated[index] = { ...updated[index], amount: value };
    setExpenses(updated);
  };

  return (
    <View style={styles.container}>
      {/* Progress */}
      <View style={styles.progress}>
        {STEPS.map((s, i) => (
          <View key={i} style={[styles.dot, i <= step && styles.dotActive]} />
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.stepLabel}>Step {step + 1} of {STEPS.length}</Text>
        <Text style={styles.title}>{STEPS[step]}</Text>

        {step === 0 && (
          <View>
            <Text style={styles.subtitle}>Helps us calculate your safe-to-spend amount</Text>
            <Text style={styles.label}>Monthly Salary (₹)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 85000"
              keyboardType="numeric"
              value={salary}
              onChangeText={setSalary}
              autoFocus
            />
            <Text style={styles.label}>Salary credited on day</Text>
            <TextInput
              style={styles.input}
              placeholder="1"
              keyboardType="numeric"
              maxLength={2}
              value={salaryDay}
              onChangeText={setSalaryDay}
            />
          </View>
        )}

        {step === 1 && (
          <View>
            <Text style={styles.subtitle}>These are deducted before calculating discretionary spend</Text>
            {expenses.map((e, i) => (
              <View key={i} style={styles.expenseRow}>
                <Text style={styles.expenseName}>{e.name}</Text>
                <TextInput
                  style={[styles.input, styles.expenseInput]}
                  placeholder="₹ 0"
                  keyboardType="numeric"
                  value={e.amount}
                  onChangeText={(v) => updateExpenseAmount(i, v)}
                />
              </View>
            ))}
          </View>
        )}

        {step === 2 && (
          <View>
            <Text style={styles.subtitle}>What are you saving towards?</Text>
            {['Emergency Fund', 'Vacation', 'New Phone', 'Car Down Payment', 'Custom'].map(preset => (
              <TouchableOpacity
                key={preset}
                style={[styles.preset, goalName === preset && styles.presetActive]}
                onPress={() => setGoalName(preset === 'Custom' ? '' : preset)}
              >
                <Text style={[styles.presetText, goalName === preset && styles.presetTextActive]}>{preset}</Text>
              </TouchableOpacity>
            ))}
            <Text style={styles.label}>Goal Name</Text>
            <TextInput style={styles.input} placeholder="My Goal" value={goalName} onChangeText={setGoalName} />
            <Text style={styles.label}>Target Amount (₹)</Text>
            <TextInput style={styles.input} placeholder="e.g. 100000" keyboardType="numeric" value={goalAmount} onChangeText={setGoalAmount} />
            <Text style={styles.label}>Target Date (optional)</Text>
            <TextInput style={styles.input} placeholder="YYYY-MM-DD" value={goalDeadline} onChangeText={setGoalDeadline} />
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.button}
          onPress={handleNext}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>
              {step < STEPS.length - 1 ? 'Continue →' : "Let's Go! 🚀"}
            </Text>
          )}
        </TouchableOpacity>
        {step < STEPS.length - 1 && (
          <TouchableOpacity onPress={() => setStep(s => s + 1)}>
            <Text style={styles.skip}>Skip for now</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A', paddingTop: 60 },
  progress: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 32 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#334155' },
  dotActive: { backgroundColor: '#6366F1', width: 24 },
  content: { paddingHorizontal: 24, paddingBottom: 24 },
  stepLabel: { fontSize: 12, color: '#6366F1', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  title: { fontSize: 28, fontWeight: '700', color: '#F8FAFC', marginTop: 4, marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#64748B', marginBottom: 24 },
  label: { fontSize: 13, color: '#CBD5E1', marginBottom: 6, marginTop: 16, fontWeight: '500' },
  input: {
    backgroundColor: '#1E293B', borderRadius: 12, padding: 14,
    color: '#F8FAFC', fontSize: 16, borderWidth: 1, borderColor: '#334155',
  },
  expenseRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 12 },
  expenseName: { flex: 1, color: '#CBD5E1', fontSize: 14 },
  expenseInput: { flex: 1 },
  preset: {
    backgroundColor: '#1E293B', borderRadius: 8, padding: 12,
    marginBottom: 8, borderWidth: 1, borderColor: '#334155',
  },
  presetActive: { borderColor: '#6366F1', backgroundColor: '#312E81' },
  presetText: { color: '#94A3B8', fontSize: 14 },
  presetTextActive: { color: '#818CF8', fontWeight: '600' },
  footer: { padding: 24, paddingBottom: 40 },
  button: {
    backgroundColor: '#6366F1', borderRadius: 14, padding: 16,
    alignItems: 'center', marginBottom: 12,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  skip: { color: '#475569', textAlign: 'center' },
});
