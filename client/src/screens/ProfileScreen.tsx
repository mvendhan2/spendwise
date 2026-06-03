import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, updateUser, logout } = useAuth();
  const [salary, setSalary] = useState(user?.monthly_salary?.toString() || '');
  const [salaryDay, setSalaryDay] = useState(user?.salary_day?.toString() || '1');
  const [name, setName] = useState(user?.display_name || '');
  const [saving, setSaving] = useState(false);

  const [mandatoryItems, setMandatoryItems] = useState<any[]>([]);
  const [goals, setGoals] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    Promise.all([api.get('/mandatory'), api.get('/goals')]).then(([mRes, gRes]) => {
      setMandatoryItems(mRes.data.items || []);
      setGoals(gRes.data || []);
    }).finally(() => setLoadingData(false));
  }, []);

  const saveProfile = async () => {
    setSaving(true);
    try {
      await updateUser({
        display_name: name,
        monthly_salary: salary ? parseFloat(salary) : undefined,
        salary_day: salaryDay ? parseInt(salaryDay) : undefined,
      });
      Alert.alert('Saved!', 'Profile updated successfully.');
    } catch {
      Alert.alert('Error', 'Failed to save profile.');
    }
    setSaving(false);
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel' },
      { text: 'Logout', style: 'destructive', onPress: logout },
    ]);
  };

  const deleteMandatory = async (id: string) => {
    await api.delete(`/mandatory/${id}`);
    setMandatoryItems(prev => prev.filter(m => m.id !== id));
  };

  const fmt = (n: number) => '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}>
      <Text style={styles.title}>Profile & Settings</Text>

      {/* Profile Section */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Personal Info</Text>
        <Text style={styles.label}>Name</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholderTextColor="#475569" />
        <Text style={styles.label}>Monthly Salary (₹)</Text>
        <TextInput style={styles.input} keyboardType="numeric" value={salary} onChangeText={setSalary} placeholder="e.g. 85000" placeholderTextColor="#475569" />
        <Text style={styles.label}>Salary Day (of month)</Text>
        <TextInput style={styles.input} keyboardType="numeric" maxLength={2} value={salaryDay} onChangeText={setSalaryDay} placeholder="1" placeholderTextColor="#475569" />
        <TouchableOpacity style={styles.saveBtn} onPress={saveProfile} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Changes</Text>}
        </TouchableOpacity>
      </View>

      {/* Mandatory Expenses */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Fixed Monthly Expenses</Text>
        {loadingData ? <ActivityIndicator color="#6366F1" /> : (
          mandatoryItems.length === 0 ? (
            <Text style={styles.emptyText}>No fixed expenses set. Add them from onboarding or use the API.</Text>
          ) : (
            mandatoryItems.map(item => (
              <View key={item.id} style={styles.mandatoryRow}>
                <View>
                  <Text style={styles.mandatoryName}>{item.name}</Text>
                  <Text style={styles.mandatoryType}>{item.type} · Due day {item.due_day || '—'}</Text>
                </View>
                <View style={styles.mandatoryRight}>
                  <Text style={styles.mandatoryAmount}>{fmt(item.amount)}</Text>
                  <TouchableOpacity onPress={() => deleteMandatory(item.id)}>
                    <Ionicons name="trash-outline" size={18} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )
        )}
      </View>

      {/* Goals */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Savings Goals</Text>
        {loadingData ? <ActivityIndicator color="#6366F1" /> : (
          goals.length === 0 ? (
            <Text style={styles.emptyText}>No goals set.</Text>
          ) : (
            goals.map(g => (
              <View key={g.id} style={styles.goalRow}>
                <Text style={styles.goalIcon}>{g.icon}</Text>
                <View style={styles.goalInfo}>
                  <Text style={styles.goalName}>{g.name}</Text>
                  <View style={styles.goalBar}>
                    <View style={[styles.goalBarFill, { width: `${g.progress_pct}%` as any }]} />
                  </View>
                  <Text style={styles.goalMeta}>{fmt(g.current_amount)} of {fmt(g.target_amount)} ({g.progress_pct}%)</Text>
                </View>
              </View>
            ))
          )
        )}
      </View>

      {/* Plan Info */}
      <View style={[styles.card, styles.planCard]}>
        <View>
          <Text style={styles.planLabel}>Current Plan</Text>
          <Text style={styles.planName}>{user?.plan === 'free' ? 'Free' : 'Premium'} ✨</Text>
        </View>
        {user?.plan === 'free' && (
          <TouchableOpacity style={styles.upgradeBtn}>
            <Text style={styles.upgradeBtnText}>Upgrade to Premium</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={20} color="#EF4444" />
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>

      <Text style={styles.version}>SpendWise v1.0.0-mvp</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  content: { padding: 20, paddingTop: 16, paddingBottom: 100 },
  title: { fontSize: 26, fontWeight: '700', color: '#F8FAFC', marginBottom: 20 },
  card: { backgroundColor: '#1E293B', borderRadius: 16, padding: 18, marginBottom: 16 },
  cardTitle: { fontSize: 12, color: '#64748B', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 14 },
  label: { fontSize: 13, color: '#94A3B8', marginBottom: 6, marginTop: 12, fontWeight: '500' },
  input: { backgroundColor: '#0F172A', borderRadius: 10, padding: 12, color: '#F8FAFC', fontSize: 15, borderWidth: 1, borderColor: '#334155', marginBottom: 4 },
  saveBtn: { backgroundColor: '#6366F1', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 16 },
  saveBtnText: { color: '#fff', fontWeight: '700' },
  emptyText: { color: '#475569', fontSize: 13 },
  mandatoryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#334155' },
  mandatoryName: { color: '#F1F5F9', fontWeight: '500' },
  mandatoryType: { color: '#64748B', fontSize: 12, marginTop: 2, textTransform: 'capitalize' },
  mandatoryRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  mandatoryAmount: { color: '#F87171', fontWeight: '600' },
  goalRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  goalIcon: { fontSize: 24, marginRight: 12 },
  goalInfo: { flex: 1 },
  goalName: { color: '#F1F5F9', fontWeight: '500', marginBottom: 6 },
  goalBar: { height: 4, backgroundColor: '#334155', borderRadius: 2, overflow: 'hidden', marginBottom: 4 },
  goalBarFill: { height: '100%', backgroundColor: '#6366F1', borderRadius: 2 },
  goalMeta: { color: '#64748B', fontSize: 12 },
  planCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  planLabel: { color: '#64748B', fontSize: 12 },
  planName: { color: '#F8FAFC', fontWeight: '700', fontSize: 18, marginTop: 2 },
  upgradeBtn: { backgroundColor: '#312E81', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: '#6366F1' },
  upgradeBtnText: { color: '#818CF8', fontWeight: '600', fontSize: 13 },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16, backgroundColor: '#1E293B', borderRadius: 12, marginBottom: 12 },
  logoutText: { color: '#EF4444', fontWeight: '600', fontSize: 16 },
  version: { color: '#334155', textAlign: 'center', fontSize: 12 },
});
