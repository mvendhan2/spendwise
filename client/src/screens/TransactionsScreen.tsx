import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  TextInput, ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../services/api';

interface Transaction {
  id: string;
  amount: number;
  type: string;
  merchant: string;
  note: string;
  category_name: string;
  category_icon: string;
  category_color: string;
  account_name: string;
  transacted_at: string;
}

export default function TransactionsScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const loadTransactions = async (reset = false) => {
    const currentPage = reset ? 1 : page;
    try {
      const res = await api.get(`/transactions?page=${currentPage}&limit=30${search ? `&search=${encodeURIComponent(search)}` : ''}`);
      const data = res.data;
      setTotal(data.total);
      setTransactions(prev => reset ? data.transactions : [...prev, ...data.transactions]);
      if (reset) setPage(2);
      else setPage(p => p + 1);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  };

  useFocusEffect(useCallback(() => {
    setPage(1);
    setLoading(true);
    loadTransactions(true);
  }, [search]));

  const onRefresh = () => { setRefreshing(true); loadTransactions(true); };

  const deleteTransaction = async (id: string) => {
    Alert.alert('Delete', 'Remove this transaction?', [
      { text: 'Cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await api.delete(`/transactions/${id}`);
          setTransactions(prev => prev.filter(t => t.id !== id));
        },
      },
    ]);
  };

  const fmt = (n: number) => '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' });
  };

  const renderItem = ({ item }: { item: Transaction }) => (
    <TouchableOpacity
      style={styles.txnRow}
      onLongPress={() => deleteTransaction(item.id)}
    >
      <View style={[styles.txnIcon, { backgroundColor: item.category_color ? item.category_color + '33' : '#33415533' }]}>
        <Text style={styles.txnIconText}>{item.category_icon || '📦'}</Text>
      </View>
      <View style={styles.txnInfo}>
        <Text style={styles.txnMerchant} numberOfLines={1}>
          {item.merchant || item.note || item.category_name || 'Transaction'}
        </Text>
        <Text style={styles.txnMeta}>
          {item.category_name || 'Uncategorized'}  ·  {formatDate(item.transacted_at)}
        </Text>
      </View>
      <Text style={[styles.txnAmount, { color: item.type === 'credit' ? '#34D399' : '#F87171' }]}>
        {item.type === 'credit' ? '+' : '-'}{fmt(item.amount)}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={[styles.headerRow, { paddingTop: insets.top + 16 }]}>
        <Text style={styles.title}>Transactions</Text>
        <Text style={styles.count}>{total} total</Text>
      </View>

      {/* Search */}
      <View style={styles.searchRow}>
        <Ionicons name="search" size={18} color="#475569" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search merchants, notes..."
          placeholderTextColor="#475569"
          value={search}
          onChangeText={setSearch}
          clearButtonMode="while-editing"
        />
      </View>

      {loading && !refreshing ? (
        <View style={styles.center}><ActivityIndicator color="#6366F1" size="large" /></View>
      ) : (
        <FlatList
          data={transactions}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366F1" />}
          onEndReached={() => { if (transactions.length < total) loadTransactions(); }}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No transactions found</Text>
            </View>
          }
        />
      )}

      <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('AddTransaction')}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  title: { fontSize: 26, fontWeight: '700', color: '#F8FAFC' },
  count: { color: '#475569', fontSize: 14 },
  searchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E293B', borderRadius: 12, marginHorizontal: 20, marginBottom: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: '#334155' },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, padding: 12, color: '#F8FAFC', fontSize: 15 },
  list: { paddingHorizontal: 20, paddingBottom: 100 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  txnRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E293B', borderRadius: 12, padding: 14, marginBottom: 8 },
  txnIcon: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  txnIconText: { fontSize: 20 },
  txnInfo: { flex: 1, marginRight: 8 },
  txnMerchant: { color: '#F1F5F9', fontWeight: '600', fontSize: 14 },
  txnMeta: { color: '#64748B', fontSize: 12, marginTop: 2 },
  txnAmount: { fontWeight: '700', fontSize: 15 },
  empty: { paddingTop: 48, alignItems: 'center' },
  emptyText: { color: '#475569', fontSize: 16 },
  fab: {
    position: 'absolute', bottom: 90, right: 24,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#6366F1', justifyContent: 'center', alignItems: 'center',
    shadowColor: '#6366F1', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 8,
  },
});
