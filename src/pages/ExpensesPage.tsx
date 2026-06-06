import { useState, useEffect } from 'react';
import { Plus, TrendingDown, TrendingUp, Trash2, X, AlertCircle } from 'lucide-react';
import { loadExpenses, loadIncome, addExpense, addIncome, deleteExpense, deleteIncome, formatCurrency, formatNumber } from '../lib/api';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from 'recharts';
import type { Expense, IncomeRecord, ExpenseCategory, IncomeCategory, PaymentMethod } from '../types';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../types';

type ViewMode = 'expense' | 'income';
type TimeFilter = 'today' | 'week' | 'month' | 'year';

const TIME_FILTERS: { key: TimeFilter; label: string }[] = [
  { key: 'today', label: 'Bugün' },
  { key: 'week', label: 'Bu Hafta' },
  { key: 'month', label: 'Bu Ay' },
  { key: 'year', label: 'Bu Yıl' },
];

const PAYMENT_METHODS: { key: PaymentMethod; label: string }[] = [
  { key: 'cash', label: 'Nakit' },
  { key: 'debit', label: 'Banka Kartı' },
  { key: 'credit', label: 'Kredi Kartı' },
  { key: 'bank', label: 'Havale' },
];

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [incomes, setIncomes] = useState<IncomeRecord[]>([]);
  const [mode, setMode] = useState<ViewMode>('expense');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('month');
  const [showAddModal, setShowAddModal] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [exp, inc] = await Promise.all([loadExpenses(), loadIncome()]);
      setExpenses(exp);
      setIncomes(inc);
    } catch (err) {
      console.error('Load data failed:', err);
      showToast('Veriler yüklenemedi', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Filter by time
  const getDateRange = () => {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    switch (timeFilter) {
      case 'today': return [today, today];
      case 'week': return [new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], today];
      case 'month': return [today.slice(0, 7) + '-01', today];
      case 'year': return [today.slice(0, 4) + '-01-01', today];
    }
  };

  const [startDate] = getDateRange();
  const endDate = new Date().toISOString().split('T')[0];

  const filteredExpenses = expenses.filter(e => e.date >= startDate && e.date <= endDate);
  const filteredIncomes = incomes.filter(i => i.date >= startDate && i.date <= endDate);
  const totalExpenses = filteredExpenses.reduce((s, e) => s + e.amount, 0);
  const totalIncome = filteredIncomes.reduce((s, i) => s + i.amount, 0);
  const netCashFlow = totalIncome - totalExpenses;

  // Category breakdown
  const categoryData = filteredExpenses.reduce((acc, e) => {
    const label = EXPENSE_CATEGORIES.find(c => c.key === e.category)?.label || e.category;
    acc[label] = (acc[label] || 0) + e.amount;
    return acc;
  }, {} as Record<string, number>);

  const chartData = Object.entries(categoryData).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8);

  const handleAddExpense = async (data: { category: ExpenseCategory; amount: number; currency: string; date: string; paymentMethod: PaymentMethod; note: string }) => {
    const result = await addExpense({
      category: data.category,
      amount: data.amount,
      currency: data.currency || 'TRY',
      date: data.date,
      paymentMethod: data.paymentMethod,
      note: data.note,
    });

    if (result.success) {
      showToast('Harcama eklendi', 'success');
      loadData();
      setShowAddModal(false);
    } else {
      showToast('Harcama eklenemedi: ' + (result.error || 'Bilinmeyen hata'), 'error');
    }
  };

  const handleAddIncome = async (data: { category: IncomeCategory; amount: number; currency: string; date: string; note: string }) => {
    const result = await addIncome({
      category: data.category,
      amount: data.amount,
      currency: data.currency || 'TRY',
      date: data.date,
      note: data.note,
    });

    if (result.success) {
      showToast('Gelir eklendi', 'success');
      loadData();
      setShowAddModal(false);
    } else {
      showToast('Gelir eklenemedi: ' + (result.error || 'Bilinmeyen hata'), 'error');
    }
  };

  const handleDeleteExpense = async (id: string) => {
    await deleteExpense(id);
    setExpenses(expenses.filter(e => e.id !== id));
    showToast('Harcama silindi', 'success');
  };

  const handleDeleteIncome = async (id: string) => {
    await deleteIncome(id);
    setIncomes(incomes.filter(i => i.id !== id));
    showToast('Gelir silindi', 'success');
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg ${toast.type === 'success' ? 'bg-kum-success text-black' : 'bg-kum-danger text-white'}`}>
          {toast.message}
        </div>
      )}

      {/* Header Stats */}
      <div className="card-lg">
        <div className="flex items-center justify-between mb-4">
          <div className="min-w-0">
            <p className="text-xs text-kum-textMuted uppercase tracking-wider">Net Nakit Akışı</p>
            <h2 className={`text-2xl sm:text-3xl font-bold font-mono truncate ${netCashFlow >= 0 ? 'text-kum-success' : 'text-kum-danger'}`}>
              {formatCurrency(netCashFlow, 'TRY')}
            </h2>
          </div>
          <button onClick={() => setShowAddModal(true)} className="btn-primary flex items-center gap-2 flex-shrink-0">
            <Plus size={18} />
            <span className="hidden sm:inline">{mode === 'expense' ? 'Harcama' : 'Gelir'} Ekle</span>
          </button>
        </div>

        {/* Mode Toggle */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setMode('expense')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg transition-colors text-sm ${
              mode === 'expense' ? 'bg-kum-danger/20 text-kum-danger' : 'bg-kum-bg text-kum-textMuted'
            }`}
          >
            <TrendingDown size={16} />
            <span className="truncate">Harcamalar ({formatCurrency(totalExpenses, 'TRY')})</span>
          </button>
          <button
            onClick={() => setMode('income')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg transition-colors text-sm ${
              mode === 'income' ? 'bg-kum-success/20 text-kum-success' : 'bg-kum-bg text-kum-textMuted'
            }`}
          >
            <TrendingUp size={16} />
            <span className="truncate">Gelirler ({formatCurrency(totalIncome, 'TRY')})</span>
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-3 rounded-lg bg-kum-bg">
            <p className="text-[10px] text-kum-textMuted">Toplam Harcama</p>
            <p className="text-base font-semibold text-kum-danger font-mono truncate">{formatCurrency(totalExpenses, 'TRY')}</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-kum-bg">
            <p className="text-[10px] text-kum-textMuted">Toplam Gelir</p>
            <p className="text-base font-semibold text-kum-success font-mono truncate">{formatCurrency(totalIncome, 'TRY')}</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-kum-bg">
            <p className="text-[10px] text-kum-textMuted">İşlem Sayısı</p>
            <p className="text-base font-semibold text-kum-text font-mono">{filteredExpenses.length + filteredIncomes.length}</p>
          </div>
        </div>
      </div>

      {/* Time Filter */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {TIME_FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setTimeFilter(f.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              timeFilter === f.key
                ? 'bg-kum-primary text-black'
                : 'bg-kum-card border border-kum-border text-kum-textMuted'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Category Chart */}
      {mode === 'expense' && chartData.length > 0 && (
        <div className="card">
          <h3 className="text-sm font-semibold text-kum-text mb-4">Kategori Dağılımı</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 10, fill: '#888' }} tickFormatter={(v) => formatNumber(v, 0)} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#888' }} width={80} />
                <Tooltip formatter={(value: number) => formatCurrency(value, 'TRY')} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={i === 0 ? '#FF7A00' : i === 1 ? '#F59E0B' : '#666'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Transactions List */}
      <div className="card">
        <h3 className="text-sm font-semibold text-kum-text mb-4">
          {mode === 'expense' ? 'Harcamalar' : 'Gelarlar'}
        </h3>
        {loading ? (
          <div className="text-center py-8 text-kum-textMuted">Yükleniyor...</div>
        ) : mode === 'expense' ? (
          filteredExpenses.length === 0 ? (
            <div className="text-center py-8 text-kum-textMuted">Bu dönemde harcama yok</div>
          ) : (
            <div className="space-y-2">
              {filteredExpenses.map(expense => (
                <div key={expense.id} className="flex items-center justify-between p-3 rounded-lg bg-kum-bg hover:bg-kum-cardHover transition-colors group">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-lg bg-kum-danger/10 flex items-center justify-center flex-shrink-0">
                      <TrendingDown size={18} className="text-kum-danger" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-kum-text truncate">{EXPENSE_CATEGORIES.find(c => c.key === expense.category)?.label || expense.category}</p>
                      <p className="text-xs text-kum-textMuted truncate">{expense.date} • {PAYMENT_METHODS.find(p => p.key === expense.payment_method)?.label}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 flex-shrink-0">
                    <p className="text-sm font-semibold text-kum-danger font-mono">{formatCurrency(expense.amount, 'TRY')}</p>
                    <button onClick={() => handleDeleteExpense(expense.id)} className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-kum-danger/20 text-kum-textMuted hover:text-kum-danger">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          filteredIncomes.length === 0 ? (
            <div className="text-center py-8 text-kum-textMuted">Bu dönemde gelir yok</div>
          ) : (
            <div className="space-y-2">
              {filteredIncomes.map(income => (
                <div key={income.id} className="flex items-center justify-between p-3 rounded-lg bg-kum-bg hover:bg-kum-cardHover transition-colors group">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-lg bg-kum-success/10 flex items-center justify-center flex-shrink-0">
                      <TrendingUp size={18} className="text-kum-success" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-kum-text truncate">{INCOME_CATEGORIES.find(c => c.key === income.category)?.label || income.category}</p>
                      <p className="text-xs text-kum-textMuted truncate">{income.date}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 flex-shrink-0">
                    <p className="text-sm font-semibold text-kum-success font-mono">{formatCurrency(income.amount, 'TRY')}</p>
                    <button onClick={() => handleDeleteIncome(income.id)} className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-kum-danger/20 text-kum-textMuted hover:text-kum-danger">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <AddTransactionModal
          mode={mode}
          onClose={() => setShowAddModal(false)}
          onSubmitExpense={handleAddExpense}
          onSubmitIncome={handleAddIncome}
        />
      )}
    </div>
  );
}

// Add Transaction Modal
function AddTransactionModal({
  mode,
  onClose,
  onSubmitExpense,
  onSubmitIncome,
}: {
  mode: ViewMode;
  onClose: () => void;
  onSubmitExpense: (data: any) => void;
  onSubmitIncome: (data: any) => void;
}) {
  const [expenseForm, setExpenseForm] = useState({
    category: 'groceries' as ExpenseCategory,
    amount: '',
    currency: 'TRY',
    date: new Date().toISOString().split('T')[0],
    paymentMethod: 'cash' as PaymentMethod,
    note: '',
  });

  const [incomeForm, setIncomeForm] = useState({
    category: 'salary' as IncomeCategory,
    amount: '',
    currency: 'TRY',
    date: new Date().toISOString().split('T')[0],
    note: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'expense') {
      if (!expenseForm.amount || parseFloat(expenseForm.amount) <= 0) {
        alert('Geçerli bir tutar girin');
        return;
      }
      onSubmitExpense({ ...expenseForm, amount: parseFloat(expenseForm.amount) });
    } else {
      if (!incomeForm.amount || parseFloat(incomeForm.amount) <= 0) {
        alert('Geçerli bir tutar girin');
        return;
      }
      onSubmitIncome({ ...incomeForm, amount: parseFloat(incomeForm.amount) });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-kum-card border border-kum-border rounded-2xl w-full max-w-md shadow-card-lg" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-kum-border">
          <h2 className="text-lg font-bold text-kum-text">{mode === 'expense' ? 'Yeni Harcama' : 'Yeni Gelir'}</h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-kum-bg text-kum-textMuted">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {mode === 'expense' ? (
            <>
              {/* Category */}
              <div>
                <label className="text-xs text-kum-textMuted mb-1.5 block">Kategori</label>
                <div className="grid grid-cols-3 gap-2 max-h-32 overflow-y-auto p-1">
                  {EXPENSE_CATEGORIES.map(c => (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => setExpenseForm(f => ({ ...f, category: c.key }))}
                      className={`py-2 px-2 rounded-lg text-xs font-medium border-2 transition-all ${
                        expenseForm.category === c.key
                          ? 'border-kum-primary bg-kum-primary/10 text-kum-primary'
                          : 'border-kum-border bg-kum-bg text-kum-textMuted'
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount - REQUIRED */}
              <div>
                <label className="text-xs text-kum-textMuted mb-1.5 block">Tutar (TL) *</label>
                <input
                  type="number"
                  value={expenseForm.amount}
                  onChange={e => setExpenseForm(f => ({ ...f, amount: e.target.value }))}
                  className="input text-lg"
                  placeholder="0.00"
                  required
                  min="0.01"
                  step="0.01"
                />
              </div>

              {/* Date */}
              <div>
                <label className="text-xs text-kum-textMuted mb-1.5 block">Tarih</label>
                <input
                  type="date"
                  value={expenseForm.date}
                  onChange={e => setExpenseForm(f => ({ ...f, date: e.target.value }))}
                  className="input"
                  required
                />
              </div>

              {/* Payment Method */}
              <div>
                <label className="text-xs text-kum-textMuted mb-1.5 block">Ödeme Yöntemi</label>
                <div className="grid grid-cols-4 gap-2">
                  {PAYMENT_METHODS.map(p => (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => setExpenseForm(f => ({ ...f, paymentMethod: p.key }))}
                      className={`py-2 rounded-lg text-xs font-medium border-2 transition-all ${
                        expenseForm.paymentMethod === p.key
                          ? 'border-kum-primary bg-kum-primary/10 text-kum-primary'
                          : 'border-kum-border bg-kum-bg text-kum-textMuted'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Note */}
              <div>
                <label className="text-xs text-kum-textMuted mb-1.5 block">Not (opsiyonel)</label>
                <input
                  type="text"
                  value={expenseForm.note}
                  onChange={e => setExpenseForm(f => ({ ...f, note: e.target.value }))}
                  className="input"
                  placeholder="Not ekleyin..."
                />
              </div>
            </>
          ) : (
            <>
              {/* Income Category */}
              <div>
                <label className="text-xs text-kum-textMuted mb-1.5 block">Kategori</label>
                <div className="grid grid-cols-3 gap-2">
                  {INCOME_CATEGORIES.map(c => (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => setIncomeForm(f => ({ ...f, category: c.key }))}
                      className={`py-2 px-2 rounded-lg text-xs font-medium border-2 transition-all ${
                        incomeForm.category === c.key
                          ? 'border-kum-success bg-kum-success/10 text-kum-success'
                          : 'border-kum-border bg-kum-bg text-kum-textMuted'
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount - REQUIRED */}
              <div>
                <label className="text-xs text-kum-textMuted mb-1.5 block">Tutar (TL) *</label>
                <input
                  type="number"
                  value={incomeForm.amount}
                  onChange={e => setIncomeForm(f => ({ ...f, amount: e.target.value }))}
                  className="input text-lg"
                  placeholder="0.00"
                  required
                  min="0.01"
                  step="0.01"
                />
              </div>

              {/* Date */}
              <div>
                <label className="text-xs text-kum-textMuted mb-1.5 block">Tarih</label>
                <input
                  type="date"
                  value={incomeForm.date}
                  onChange={e => setIncomeForm(f => ({ ...f, date: e.target.value }))}
                  className="input"
                  required
                />
              </div>

              {/* Note */}
              <div>
                <label className="text-xs text-kum-textMuted mb-1.5 block">Not (opsiyonel)</label>
                <input
                  type="text"
                  value={incomeForm.note}
                  onChange={e => setIncomeForm(f => ({ ...f, note: e.target.value }))}
                  className="input"
                  placeholder="Not ekleyin..."
                />
              </div>
            </>
          )}

          <button type="submit" className={`btn-primary w-full ${mode === 'income' ? 'bg-kum-success hover:bg-kum-successDark' : ''}`}>
            Ekle
          </button>
        </form>
      </div>
    </div>
  );
}
