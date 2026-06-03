import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

interface SafeToSpend {
  monthly_salary: number;
  discretionary_budget: number;
  spent_this_month: number;
  safe_to_spend_today: number;
  days_remaining: number;
  warning_level: 'green' | 'orange' | 'red';
  on_track_to_save: boolean;
  mandatory_deductions: { total: number };
}

interface Transaction {
  id: string;
  amount: number;
  type: string;
  merchant: string;
  note: string;
  category_name: string;
  category_icon: string;
  category_color: string;
  transacted_at: string;
}

interface HealthScore {
  score: number | null;
  grade: string;
  insights: { type: string; message: string }[];
}

const WARN_COLORS = { green: '#10B981', orange: '#F59E0B', red: '#EF4444' };

export default function DashboardScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [safe, setSafe] = useState<SafeToSpend | null>(null);
  const [recentTxns, setRecentTxns] = useState<Transaction[]>([]);
  const [health, setHealth] = useState<HealthScore | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const [safeRes, txnRes, healthRes] = await Promise.all([
        api.get('/budgets/safe-to-spend'),
        api.get('/transactions?limit=5'),
        api.get('/analytics/health-score'),
      ]);
      setSafe(safeRes.data);
      setRecentTxns(txnRes.data.transactions);
      setHealth(healthRes.data);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  };

  useFocusEffect(useCallback(() => { loadData(); }, []));

  const onRefresh = () => { setRefreshing(true); loadData(); };

  const formatCurrency = (n: number) =>
    '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });

  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const h = Math.floor(diff / 3600000);
    if (h < 1) return 'Just now';
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  const warnColor = WARN_COLORS[safe?.warning_level || 'green'];
  const spentPct = safe && safe.discretionary_budget > 0
    ? Math.min(100, (safe.spent_this_month / safe.discretionary_budget) * 100)
    : 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366F1" />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Good {getGreeting()}, {user?.display_name?.split(' ')[0]}!</Text>
          <Text style={styles.date}>{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('Profile')}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user?.display_name?.[0]?.toUpperCase()}</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Safe-to-Spend Card */}
      {safe && (
        <View style={[styles.card, styles.mainCard]}>
          <Text style={styles.cardLabel}>Safe to Spend Today</Text>
          <Text style={[styles.mainAmount, { color: warnColor }]}>
            {formatCurrency(safe.safe_to_spend_today)}
          </Text>
          <Text style={styles.cardSub}>{safe.days_remaining} days remaining in cycle</Text>

          {/* Progress bar */}
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${spentPct}%` as any, backgroundColor: warnColor }]} />
          </View>
          <View style={styles.progressLabels}>
            <Text style={styles.progressText}>Spent {formatCurrency(safe.spent_this_month)}</Text>
            <Text style={styles.progressText}>Budget {formatCurrency(safe.discretionary_budget)}</Text>
          </View>

          <View style={styles.deductionRow}>
            <Text style={styles.deductionText}>🔒 Mandatory deductions: {formatCurrency(safe.mandatory_deductions.total)}</Text>
          </View>
        </View>
      )}

      {/* Health Score */}
      {health?.score != null && (
        <View style={styles.card}>
          <View style={styles.healthRow}>
            <View>
              <Text style={styles.cardLabel}>Financial Health</Text>
              <Text style={styles.healthScore}>{health.score}</Text>
              <Text style={styles.healthGrade}>{health.grade}</Text>
            </View>
            <View style={styles.healthRing}>
              <Text style={styles.healthRingText}>{health.grade}</Text>
            </View>
          </View>
          {health.insights?.slice(0, 1).map((ins, i) => (
            <View key={i} style={styles.insightBadge}>
              <Text style={styles.insightText}>{ins.message}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Quick Add Buttons */}
      <View style={styles.quickRow}>
        <TouchableOpacity style={[styles.quickBtn, { backgroundColor: '#EF4444' }]} onPress={() => navigation.navigate('AddTransaction', { type: 'debit' })}>
          <Ionicons name="remove-circle" size={20} color="#fff" />
          <Text style={styles.quickBtnText}>Expense</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.quickBtn, { backgroundColor: '#10B981' }]} onPress={() => navigation.navigate('AddTransaction', { type: 'credit' })}>
          <Ionicons name="add-circle" size={20} color="#fff" />
          <Text style={styles.quickBtnText}>Income</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.quickBtn, { backgroundColor: '#6366F1' }]} onPress={() => navigation.navigate('Analytics')}>
          <Ionicons name="bar-chart" size={20} color="#fff" />
          <Text style={styles.quickBtnText}>Reports</Text>
        </TouchableOpacity>
      </View>

      {/* Recent Transactions */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Transactions</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Transactions')}>
            <Text style={styles.seeAll}>See all</Text>
          </TouchableOpacity>
        </View>
        {recentTxns.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No transactions yet.</Text>
            <Text style={styles.emptyHint}>Tap "Expense" to log your first one!</Text>
          </View>
        ) : (
          recentTxns.map(txn => (
            <View key={txn.id} style={styles.txnRow}>
              <View style={[styles.txnIcon, { backgroundColor: txn.category_color || '#334155' }]}>
                <Text style={styles.txnIconText}>{txn.category_icon || '📦'}</Text>
              </View>
              <View style={styles.txnInfo}>
                <Text style={styles.txnMerchant}>{txn.merchant || txn.note || txn.category_name || 'Transaction'}</Text>
                <Text style={styles.txnMeta}>{txn.category_name} · {timeAgo(txn.transacted_at)}</Text>
              </View>
              <Text style={[styles.txnAmount, { color: txn.type === 'credit' ? '#10B981' : '#F87171' }]}>
                {txn.type === 'credit' ? '+' : '-'}{formatCurrency(txn.amount)}
              </Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  content: { padding: 20, paddingTop: 16, paddingBottom: 100 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  greeting: { fontSize: 22, fontWeight: '700', color: '#F8FAFC' },
  date: { fontSize: 13, color: '#64748B', marginTop: 2 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#6366F1', justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  card: { backgroundColor: '#1E293B', borderRadius: 16, padding: 20, marginBottom: 16 },
  mainCard: { borderWidth: 1, borderColor: '#334155' },
  cardLabel: { fontSize: 12, color: '#64748B', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  mainAmount: { fontSize: 42, fontWeight: '800', marginTop: 4, marginBottom: 2 },
  cardSub: { fontSize: 13, color: '#64748B', marginBottom: 16 },
  progressBar: { height: 6, backgroundColor: '#334155', borderRadius: 3, overflow: 'hidden', marginBottom: 6 },
  progressFill: { height: '100%', borderRadius: 3 },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  progressText: { fontSize: 11, color: '#475569' },
  deductionRow: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#334155' },
  deductionText: { fontSize: 12, color: '#475569' },
  healthRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  healthScore: { fontSize: 36, fontWeight: '800', color: '#F8FAFC', marginTop: 4 },
  healthGrade: { fontSize: 14, color: '#64748B' },
  healthRing: {
    width: 64, height: 64, borderRadius: 32,
    borderWidth: 4, borderColor: '#6366F1',
    justifyContent: 'center', alignItems: 'center',
  },
  healthRingText: { color: '#818CF8', fontWeight: '700', fontSize: 18 },
  insightBadge: { marginTop: 12, backgroundColor: '#0F172A', borderRadius: 8, padding: 10 },
  insightText: { color: '#94A3B8', fontSize: 12, lineHeight: 18 },
  quickRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  quickBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 14, borderRadius: 12 },
  quickBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  section: {},
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#F8FAFC' },
  seeAll: { fontSize: 13, color: '#6366F1' },
  emptyCard: { backgroundColor: '#1E293B', borderRadius: 12, padding: 24, alignItems: 'center' },
  emptyText: { color: '#94A3B8', fontSize: 15, fontWeight: '600' },
  emptyHint: { color: '#475569', fontSize: 13, marginTop: 4 },
  txnRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E293B', borderRadius: 12, padding: 14, marginBottom: 8 },
  txnIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  txnIconText: { fontSize: 18 },
  txnInfo: { flex: 1 },
  txnMerchant: { color: '#F1F5F9', fontWeight: '600', fontSize: 14 },
  txnMeta: { color: '#64748B', fontSize: 12, marginTop: 2 },
  txnAmount: { fontWeight: '700', fontSize: 15 },
});
