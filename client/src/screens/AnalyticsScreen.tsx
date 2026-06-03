import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../services/api';

type Period = 'weekly' | 'monthly' | 'yearly';

interface SpendingData {
  income: number;
  expense: number;
  net_savings: number;
  savings_rate: number;
  by_category: { id: string; name: string; icon: string; color: string; total: number; count: number }[];
  daily_spending: { day: string; total: number }[];
}

interface Trend {
  label: string;
  income: number;
  expense: number;
  savings: number;
}

interface HealthScore {
  score: number | null;
  grade: string;
  components: Record<string, { score: number; value: string }>;
  insights: { type: string; message: string }[];
}

export default function AnalyticsScreen() {
  const insets = useSafeAreaInsets();
  const [period, setPeriod] = useState<Period>('monthly');
  const [spending, setSpending] = useState<SpendingData | null>(null);
  const [trends, setTrends] = useState<Trend[]>([]);
  const [health, setHealth] = useState<HealthScore | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [period]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [spendRes, trendRes, healthRes] = await Promise.all([
        api.get(`/analytics/spending?period=${period}`),
        api.get('/analytics/trends'),
        api.get('/analytics/health-score'),
      ]);
      setSpending(spendRes.data);
      setTrends(trendRes.data);
      setHealth(healthRes.data);
    } catch {}
    setLoading(false);
  };

  const fmt = (n: number) => '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });

  if (loading) return <View style={styles.center}><ActivityIndicator color="#6366F1" size="large" /></View>;

  const maxTrend = Math.max(...trends.map(t => t.expense), 1);

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}>
      <Text style={styles.title}>Analytics</Text>

      {/* Period Selector */}
      <View style={styles.toggle}>
        {(['weekly', 'monthly', 'yearly'] as Period[]).map(p => (
          <TouchableOpacity key={p} style={[styles.toggleBtn, period === p && styles.toggleActive]} onPress={() => setPeriod(p)}>
            <Text style={[styles.toggleText, period === p && styles.toggleTextActive]}>{p.charAt(0).toUpperCase() + p.slice(1)}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Income vs Expense */}
      {spending && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Overview</Text>
          <View style={styles.overviewRow}>
            <View style={styles.overviewItem}>
              <Text style={styles.overviewLabel}>Income</Text>
              <Text style={[styles.overviewAmount, { color: '#10B981' }]}>{fmt(spending.income)}</Text>
            </View>
            <View style={styles.overviewItem}>
              <Text style={styles.overviewLabel}>Expenses</Text>
              <Text style={[styles.overviewAmount, { color: '#EF4444' }]}>{fmt(spending.expense)}</Text>
            </View>
            <View style={styles.overviewItem}>
              <Text style={styles.overviewLabel}>Saved</Text>
              <Text style={[styles.overviewAmount, { color: spending.net_savings >= 0 ? '#6366F1' : '#F87171' }]}>
                {spending.net_savings >= 0 ? fmt(spending.net_savings) : `-${fmt(Math.abs(spending.net_savings))}`}
              </Text>
            </View>
          </View>
          <View style={styles.savingsRateRow}>
            <Text style={styles.savingsRateLabel}>Savings Rate</Text>
            <Text style={[styles.savingsRateValue, { color: parseFloat(spending.savings_rate as any) >= 20 ? '#10B981' : '#F59E0B' }]}>
              {spending.savings_rate}%
            </Text>
          </View>
        </View>
      )}

      {/* Category Breakdown */}
      {spending?.by_category && spending.by_category.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>By Category</Text>
          {spending.by_category.slice(0, 8).map(cat => {
            const pct = spending.expense > 0 ? (cat.total / spending.expense) * 100 : 0;
            return (
              <View key={cat.id} style={styles.catRow}>
                <Text style={styles.catIcon}>{cat.icon || '📦'}</Text>
                <View style={styles.catInfo}>
                  <View style={styles.catTopRow}>
                    <Text style={styles.catName}>{cat.name || 'Uncategorized'}</Text>
                    <Text style={styles.catAmount}>{fmt(cat.total)}</Text>
                  </View>
                  <View style={styles.catBar}>
                    <View style={[styles.catBarFill, { width: `${pct}%` as any, backgroundColor: cat.color || '#6366F1' }]} />
                  </View>
                  <Text style={styles.catPct}>{pct.toFixed(1)}% of expenses · {cat.count} txns</Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* 6-Month Trend */}
      {trends.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>6-Month Trend</Text>
          <View style={styles.trendChart}>
            {trends.map((t, i) => (
              <View key={i} style={styles.trendCol}>
                <View style={styles.trendBars}>
                  <View style={[styles.trendBar, { height: (t.income / maxTrend) * 80, backgroundColor: '#10B98144' }]} />
                  <View style={[styles.trendBar, { height: (t.expense / maxTrend) * 80, backgroundColor: '#EF444488' }]} />
                </View>
                <Text style={styles.trendLabel}>{t.label}</Text>
              </View>
            ))}
          </View>
          <View style={styles.trendLegend}>
            <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#10B981' }]} /><Text style={styles.legendText}>Income</Text></View>
            <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} /><Text style={styles.legendText}>Expense</Text></View>
          </View>
        </View>
      )}

      {/* Health Score Detail */}
      {health?.score != null && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Health Score — {health.grade}</Text>
          <Text style={styles.bigScore}>{health.score}/100</Text>
          {health.components && Object.entries(health.components).map(([key, val]) => (
            <View key={key} style={styles.componentRow}>
              <Text style={styles.componentLabel}>{key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</Text>
              <View style={styles.componentBarWrap}>
                <View style={[styles.componentBar, { width: `${val.score}%` as any }]} />
              </View>
              <Text style={styles.componentValue}>{val.value}</Text>
            </View>
          ))}
          {health.insights?.map((ins, i) => (
            <View key={i} style={[styles.insightBadge, ins.type === 'warning' && styles.insightWarning, ins.type === 'success' && styles.insightSuccess]}>
              <Text style={styles.insightText}>{ins.message}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  content: { padding: 20, paddingTop: 16, paddingBottom: 100 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0F172A' },
  title: { fontSize: 26, fontWeight: '700', color: '#F8FAFC', marginBottom: 20 },
  toggle: { flexDirection: 'row', backgroundColor: '#1E293B', borderRadius: 10, padding: 4, marginBottom: 20 },
  toggleBtn: { flex: 1, padding: 8, borderRadius: 6, alignItems: 'center' },
  toggleActive: { backgroundColor: '#6366F1' },
  toggleText: { color: '#64748B', fontWeight: '600', fontSize: 13 },
  toggleTextActive: { color: '#fff' },
  card: { backgroundColor: '#1E293B', borderRadius: 16, padding: 20, marginBottom: 16 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 16 },
  overviewRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  overviewItem: { alignItems: 'center' },
  overviewLabel: { fontSize: 12, color: '#64748B', marginBottom: 4 },
  overviewAmount: { fontSize: 18, fontWeight: '700' },
  savingsRateRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 12, borderTopWidth: 1, borderTopColor: '#334155' },
  savingsRateLabel: { color: '#94A3B8', fontSize: 14 },
  savingsRateValue: { fontWeight: '700', fontSize: 16 },
  catRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 },
  catIcon: { fontSize: 20, marginRight: 12, marginTop: 2 },
  catInfo: { flex: 1 },
  catTopRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  catName: { color: '#F1F5F9', fontSize: 14, fontWeight: '500' },
  catAmount: { color: '#F1F5F9', fontWeight: '600', fontSize: 14 },
  catBar: { height: 4, backgroundColor: '#334155', borderRadius: 2, overflow: 'hidden', marginBottom: 4 },
  catBarFill: { height: '100%', borderRadius: 2 },
  catPct: { color: '#475569', fontSize: 11 },
  trendChart: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 100, marginBottom: 8 },
  trendCol: { alignItems: 'center', flex: 1 },
  trendBars: { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  trendBar: { width: 10, borderRadius: 3, minHeight: 2 },
  trendLabel: { color: '#475569', fontSize: 10, marginTop: 4 },
  trendLegend: { flexDirection: 'row', gap: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { color: '#64748B', fontSize: 12 },
  bigScore: { fontSize: 48, fontWeight: '800', color: '#6366F1', marginBottom: 16 },
  componentRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  componentLabel: { width: 120, color: '#94A3B8', fontSize: 12 },
  componentBarWrap: { flex: 1, height: 6, backgroundColor: '#334155', borderRadius: 3, overflow: 'hidden', marginHorizontal: 8 },
  componentBar: { height: '100%', backgroundColor: '#6366F1', borderRadius: 3 },
  componentValue: { width: 48, color: '#64748B', fontSize: 12, textAlign: 'right' },
  insightBadge: { marginTop: 8, backgroundColor: '#0F172A', borderRadius: 8, padding: 10 },
  insightWarning: { borderLeftWidth: 3, borderLeftColor: '#F59E0B' },
  insightSuccess: { borderLeftWidth: 3, borderLeftColor: '#10B981' },
  insightText: { color: '#94A3B8', fontSize: 12, lineHeight: 18 },
});
