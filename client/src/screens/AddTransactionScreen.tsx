import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';

interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  type: string;
}

interface Account {
  id: string;
  name: string;
  type: string;
  color: string;
  balance: number;
}

export default function AddTransactionScreen({ navigation, route }: any) {
  const initialType = route.params?.type || 'debit';
  const [type, setType] = useState<'debit' | 'credit'>(initialType);
  const [amount, setAmount] = useState('');
  const [merchant, setMerchant] = useState('');
  const [note, setNote] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.all([api.get('/analytics/categories'), api.get('/accounts')]).then(([catRes, accRes]) => {
      setCategories(catRes.data);
      setAccounts(accRes.data);
      const primary = accRes.data.find((a: Account) => a.is_primary);
      if (primary) setSelectedAccount(primary.id);
    }).catch(() => {});
  }, []);

  const filteredCats = categories.filter(c => c.type === type || (type === 'debit' && c.type === 'expense') || (type === 'credit' && c.type === 'income'));

  const handleSave = async () => {
    if (!amount || parseFloat(amount) <= 0) return Alert.alert('Invalid amount', 'Enter a valid amount');
    setLoading(true);
    try {
      await api.post('/transactions', {
        amount: parseFloat(amount),
        type,
        merchant: merchant || undefined,
        note: note || undefined,
        category_id: selectedCategory || undefined,
        account_id: selectedAccount || undefined,
        transacted_at: new Date().toISOString(),
      });
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error || 'Failed to save transaction');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={24} color="#94A3B8" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Transaction</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Type Toggle */}
      <View style={styles.typeToggle}>
        <TouchableOpacity
          style={[styles.typeBtn, type === 'debit' && styles.typeBtnActive]}
          onPress={() => { setType('debit'); setSelectedCategory(null); }}
        >
          <Text style={[styles.typeBtnText, type === 'debit' && styles.typeBtnTextActive]}>Expense</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.typeBtn, type === 'credit' && styles.typeBtnActiveGreen]}
          onPress={() => { setType('credit'); setSelectedCategory(null); }}
        >
          <Text style={[styles.typeBtnText, type === 'credit' && styles.typeBtnTextActive]}>Income</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Amount — the most prominent field */}
        <View style={styles.amountContainer}>
          <Text style={styles.currencySymbol}>₹</Text>
          <TextInput
            style={styles.amountInput}
            placeholder="0"
            placeholderTextColor="#334155"
            keyboardType="numeric"
            value={amount}
            onChangeText={setAmount}
            autoFocus
          />
        </View>

        {/* Category Selector */}
        <Text style={styles.label}>Category</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll}>
          {filteredCats.map(cat => (
            <TouchableOpacity
              key={cat.id}
              style={[styles.catChip, selectedCategory === cat.id && { borderColor: cat.color || '#6366F1', backgroundColor: '#1E293B' }]}
              onPress={() => setSelectedCategory(cat.id === selectedCategory ? null : cat.id)}
            >
              <Text style={styles.catIcon}>{cat.icon}</Text>
              <Text style={[styles.catName, selectedCategory === cat.id && { color: '#F1F5F9' }]}>{cat.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Merchant */}
        <Text style={styles.label}>Merchant / Description</Text>
        <TextInput
          style={styles.input}
          placeholder="Swiggy, DMart, Salary..."
          placeholderTextColor="#475569"
          value={merchant}
          onChangeText={setMerchant}
        />

        {/* Note */}
        <Text style={styles.label}>Note (optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="Add a note..."
          placeholderTextColor="#475569"
          value={note}
          onChangeText={setNote}
        />

        {/* Account */}
        {accounts.length > 0 && (
          <>
            <Text style={styles.label}>Account</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll}>
              {accounts.map(acc => (
                <TouchableOpacity
                  key={acc.id}
                  style={[styles.catChip, selectedAccount === acc.id && { borderColor: acc.color || '#6366F1', backgroundColor: '#1E293B' }]}
                  onPress={() => setSelectedAccount(acc.id)}
                >
                  <Text style={styles.catIcon}>{acc.type === 'cash' ? '💵' : acc.type === 'credit_card' ? '💳' : '🏦'}</Text>
                  <Text style={[styles.catName, selectedAccount === acc.id && { color: '#F1F5F9' }]}>{acc.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: type === 'debit' ? '#EF4444' : '#10B981' }]}
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Transaction</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, paddingTop: 56 },
  headerTitle: { fontSize: 16, fontWeight: '600', color: '#F8FAFC' },
  typeToggle: { flexDirection: 'row', marginHorizontal: 20, backgroundColor: '#1E293B', borderRadius: 12, padding: 4, marginBottom: 8 },
  typeBtn: { flex: 1, padding: 10, borderRadius: 8, alignItems: 'center' },
  typeBtnActive: { backgroundColor: '#EF4444' },
  typeBtnActiveGreen: { backgroundColor: '#10B981' },
  typeBtnText: { color: '#64748B', fontWeight: '600' },
  typeBtnTextActive: { color: '#fff' },
  content: { paddingHorizontal: 20, paddingBottom: 24 },
  amountContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 24 },
  currencySymbol: { fontSize: 40, color: '#94A3B8', fontWeight: '300', marginRight: 4 },
  amountInput: { fontSize: 64, fontWeight: '800', color: '#F8FAFC', minWidth: 120 },
  label: { fontSize: 12, color: '#64748B', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginTop: 16 },
  catScroll: { marginBottom: 4 },
  catChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#0F172A', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8,
    marginRight: 8, borderWidth: 1, borderColor: '#334155',
  },
  catIcon: { fontSize: 16 },
  catName: { color: '#64748B', fontSize: 13 },
  input: {
    backgroundColor: '#1E293B', borderRadius: 12, padding: 14,
    color: '#F8FAFC', fontSize: 15, borderWidth: 1, borderColor: '#334155',
  },
  footer: { padding: 20, paddingBottom: 40 },
  saveBtn: { borderRadius: 14, padding: 16, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
