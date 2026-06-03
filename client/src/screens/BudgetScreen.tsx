import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Modal, TextInput, Alert, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../services/api';

interface Budget {
  id: string;
  name: string;
  amount: number;
  spent: number;
  usage_pct: number;
  category_name: string;
  category_icon: string;
  category_color: string;
  period: string;
  alert_threshold: number;
}

interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  type: string;
}

export default function BudgetScreen() {
  const insets = useSafeAreaInsets();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [safeToSpend, setSafeToSpend] = useState<any>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [newAmount, setNewAmount] = useState('');
  const [newCategory, setNewCategory] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const [bRes, sRes, cRes] = await Promise.all([
        api.get('/budgets'),
        api.get('/budgets/safe-to-spend'),
        api.get('/analytics/categories'),
      ]);
      setBudgets(bRes.data);
      setSafeToSpend(sRes.data);
      setCategories(cRes.data.filter((c: Category) => c.type === 'expense'));
    } catch {}
    setLoading(false);
    setRefreshing(false);
  };

  useFocusEffect(useCallback(() => { loadData(); }, []));

  const handleAddBudget = async () => {
    if (!newAmount || parseFloat(newAmount) <= 0) return Alert.alert('Error', 'Enter a valid amount');
    try {
      await api.post('/budgets', {
        category_id: newCategory,
        amount: parseFloat(newAmount),
        period: 'monthly',
      });
      setShowModal(false);
      setNewAmount('');
      setNewCategory(null);
      loadData();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error || 'Failed to create budget');
    }
  };

  const deleteBudget = async (id: string) => {
    Alert.alert('Delete Budget', 'Remove this budget?', [
      { text: 'Cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await api.delete(`/budgets/${id}`); loadData(); } },
    ]);
  };

  const fmt = (n: number) => '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });

  if (loading) return <View style={styles.center}><ActivityIndicator color="#6366F1" size="large" /></View>;

  return (
    <View style={{ flex: 1, backgroundColor: '#0F172A' }}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor="#6366F1" />}
      >
        <Text style={styles.title}>Budgets</Text>

        {/* Safe to Spend Summary */}
        {safeToSpend && (
          <View style={[styles.card, { borderColor: safeToSpend.warning_level === 'green' ? '#10B981' : safeToSpend.warning_level === 'orange' ? '#F59E0B' : '#EF4444', borderWidth: 1.5 }]}>
            <Text style={styles.cardTitle}>Monthly Breakdown</Text>
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Monthly Salary</Text>
              <Text style={styles.breakdownValue}>{fmt(safeToSpend.monthly_salary || 0)}</Text>
            </View>
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Mandatory (EMI, Rent, SIP)</Text>
              <Text style={[styles.breakdownValue, { color: '#F87171' }]}>-{fmt(safeToSpend.mandatory_deductions.total || 0)}</Text>
            </View>
            <View style={[styles.breakdownRow, styles.breakdownTotal]}>
              <Text style={styles.breakdownLabel}>Discretionary Budget</Text>
              <Text style={[styles.breakdownValue, { color: '#818CF8' }]}>{fmt(safeToSpend.discretionary_budget || 0)}</Text>
            </View>
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Spent so far</Text>
              <Text style={[styles.breakdownValue, { color: '#F59E0B' }]}>{fmt(safeToSpend.spent_this_month || 0)}</Text>
            </View>
          </View>
        )}

        {/* Budget Cards */}
        {budgets.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No budgets set</Text>
            <Text style={styles.emptyHint}>Set category limits to track your spending</Text>
          </View>
        ) : (
          budgets.map(b => {
            const color = b.usage_pct < 80 ? '#10B981' : b.usage_pct < 100 ? '#F59E0B' : '#EF4444';
            return (
              <View key={b.id} style={styles.card}>
                <View style={styles.budgetHeader}>
                  <Text style={styles.budgetIcon}>{b.category_icon || '📦'}</Text>
                  <View style={styles.budgetInfo}>
                    <Text style={styles.budgetName}>{b.category_name || b.name || 'Overall Budget'}</Text>
                    <Text style={styles.budgetPeriod}>{b.period}</Text>
                  </View>
                  <TouchableOpacity onPress={() => deleteBudget(b.id)}>
                    <Ionicons name="trash-outline" size={18} color="#475569" />
                  </TouchableOpacity>
                </View>
                <View style={styles.budgetBarBg}>
                  <View style={[styles.budgetBarFill, { width: `${Math.min(b.usage_pct, 100)}%` as any, backgroundColor: color }]} />
                </View>
                <View style={styles.budgetAmounts}>
                  <Text style={[styles.budgetSpent, { color }]}>{fmt(b.spent)} spent</Text>
                  <Text style={styles.budgetLimit}>of {fmt(b.amount)}</Text>
                </View>
                {b.usage_pct >= b.alert_threshold && (
                  <View style={styles.alertBadge}>
                    <Text style={styles.alertText}>⚠️ {b.usage_pct}% of budget used</Text>
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={() => setShowModal(true)}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Add Budget Modal */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New Budget</Text>
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <Ionicons name="close" size={24} color="#94A3B8" />
            </TouchableOpacity>
          </View>
          <ScrollView>
            <Text style={styles.modalLabel}>Category (optional)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll}>
              {categories.map(c => (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.catChip, newCategory === c.id && { borderColor: c.color || '#6366F1', backgroundColor: '#1E293B' }]}
                  onPress={() => setNewCategory(c.id === newCategory ? null : c.id)}
                >
                  <Text>{c.icon} {c.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={styles.modalLabel}>Monthly Limit (₹)</Text>
            <TextInput style={styles.modalInput} placeholder="e.g. 5000" keyboardType="numeric" value={newAmount} onChangeText={setNewAmount} placeholderTextColor="#475569" autoFocus />
            <TouchableOpacity style={styles.modalBtn} onPress={handleAddBudget}>
              <Text style={styles.modalBtnText}>Create Budget</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingTop: 16, paddingBottom: 120 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0F172A' },
  title: { fontSize: 26, fontWeight: '700', color: '#F8FAFC', marginBottom: 20 },
  card: { backgroundColor: '#1E293B', borderRadius: 16, padding: 18, marginBottom: 14 },
  cardTitle: { fontSize: 12, color: '#64748B', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  breakdownTotal: { borderTopWidth: 1, borderTopColor: '#334155', marginTop: 4, paddingTop: 10 },
  breakdownLabel: { color: '#94A3B8', fontSize: 14 },
  breakdownValue: { color: '#F1F5F9', fontWeight: '600', fontSize: 14 },
  emptyCard: { backgroundColor: '#1E293B', borderRadius: 12, padding: 32, alignItems: 'center' },
  emptyText: { color: '#94A3B8', fontSize: 16, fontWeight: '600' },
  emptyHint: { color: '#475569', fontSize: 13, marginTop: 4, textAlign: 'center' },
  budgetHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  budgetIcon: { fontSize: 24, marginRight: 12 },
  budgetInfo: { flex: 1 },
  budgetName: { color: '#F1F5F9', fontWeight: '600', fontSize: 15 },
  budgetPeriod: { color: '#64748B', fontSize: 12, marginTop: 2, textTransform: 'capitalize' },
  budgetBarBg: { height: 6, backgroundColor: '#334155', borderRadius: 3, overflow: 'hidden', marginBottom: 8 },
  budgetBarFill: { height: '100%', borderRadius: 3 },
  budgetAmounts: { flexDirection: 'row', justifyContent: 'space-between' },
  budgetSpent: { fontSize: 14, fontWeight: '600' },
  budgetLimit: { color: '#64748B', fontSize: 14 },
  alertBadge: { marginTop: 8, backgroundColor: '#431407', borderRadius: 6, padding: 8 },
  alertText: { color: '#FCA5A5', fontSize: 12 },
  fab: {
    position: 'absolute', bottom: 90, right: 24,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#6366F1', justifyContent: 'center', alignItems: 'center',
    shadowColor: '#6366F1', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 8,
  },
  modal: { flex: 1, backgroundColor: '#0F172A', padding: 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, paddingTop: 16 },
  modalTitle: { fontSize: 22, fontWeight: '700', color: '#F8FAFC' },
  modalLabel: { fontSize: 12, color: '#64748B', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginTop: 16 },
  catScroll: { marginBottom: 8 },
  catChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E293B', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8, borderWidth: 1, borderColor: '#334155' },
  modalInput: { backgroundColor: '#1E293B', borderRadius: 12, padding: 16, color: '#F8FAFC', fontSize: 18, borderWidth: 1, borderColor: '#334155', marginBottom: 24 },
  modalBtn: { backgroundColor: '#6366F1', borderRadius: 14, padding: 16, alignItems: 'center' },
  modalBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
