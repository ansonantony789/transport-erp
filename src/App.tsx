import React, { useState, useEffect } from 'react';
import { Lock, Unlock, AlertTriangle, CheckCircle, Clock, FileText, TrendingUp, Users, Package, DollarSign, Calendar, Search, Filter, Eye, Edit2, Trash2, Plus, X, Check, Menu, LucideIcon } from 'lucide-react';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface User {
  id: number;
  username: string;
  password: string;
  role: 'CLERK' | 'SUPERVISOR' | 'ACCOUNTS' | 'ADMIN';
  name: string;
}

interface Permissions {
  createLR: boolean;
  confirmLR: boolean;
  enterPOD: boolean;
  generateInvoice: boolean;
  recordPayment: boolean;
  approveEdits: boolean;
}

interface LR {
  id: number;
  lrNumber: string;
  date: string;
  consignor: string;
  consignee: string;
  origin: string;
  destination: string;
  weight: number;
  freight: number;
  status: 'DRAFT' | 'CONFIRMED' | 'POD_RECEIVED' | 'INVOICED' | 'PAID';
  createdBy?: number;
  createdAt?: string;
  confirmedBy?: number;
  confirmedAt?: string;
  podDate?: string;
  podReceiver?: string;
  podRemarks?: string;
  podEnteredBy?: number;
  podEnteredAt?: string;
}

interface Challan {
  id: number;
  number: string;
  date: string;
  vehicle: string;
  driver: string;
  route: string;
  lrIds: number[];
  createdBy: number;
  createdAt: string;
  locked: boolean;
}

interface Invoice {
  id: number;
  number: string;
  date: string;
  customer: string;
  lrIds: number[];
  freightTotal: number;
  gst: number;
  grandTotal: number;
  status: 'UNPAID' | 'PARTIAL' | 'PAID';
  createdBy: number;
  createdAt: string;
}

interface Payment {
  id: number;
  invoiceId: number;
  date: string;
  amount: number;
  mode: string;
  reference: string;
  recordedBy: number;
  recordedAt: string;
}

interface AuditLog {
  id: number;
  userId: number;
  userName: string;
  action: string;
  recordType: string;
  recordId: number;
  details: string;
  timestamp: string;
  oldValue?: string;
  newValue?: string;
}

interface LoginScreenProps {
  onLogin: (user: User) => void;
}

interface NavTabProps {
  active: boolean;
  onClick: () => void;
  icon: LucideIcon;
  children: React.ReactNode;
}

interface DashboardProps {
  currentUser: User;
}

interface StatCardProps {
  title: string;
  value: number;
  subtitle: string;
  icon: LucideIcon;
  color: 'blue' | 'green' | 'purple' | 'red';
}

interface LRManagementProps {
  currentUser: User;
  permissions: Permissions;
}

interface LRFormProps {
  lr: LR | null;
  onSave: (lrData: Partial<LR>) => Promise<void>;
  onCancel: () => void;
}

interface StatusBadgeProps {
  status: string;
}

interface ChallanManagementProps {
  currentUser: User;
  permissions: Permissions;
}

interface ChallanFormProps {
  onSave: (challanData: Partial<Challan>) => Promise<void>;
  onCancel: () => void;
}

interface PODManagementProps {
  currentUser: User;
  permissions: Permissions;
}

interface PODFormProps {
  lr: LR;
  onSave: (podData: { podDate: string; receiver: string; remarks: string }) => Promise<void>;
  onCancel: () => void;
}

interface InvoiceManagementProps {
  currentUser: User;
  permissions: Permissions;
}

interface InvoiceFormProps {
  onSave: (invoiceData: Partial<Invoice>) => Promise<void>;
  onCancel: () => void;
}

interface PaymentManagementProps {
  currentUser: User;
  permissions: Permissions;
}

interface PaymentFormProps {
  invoices: Invoice[];
  onSave: (paymentData: Partial<Payment>) => Promise<void>;
  onCancel: () => void;
  getInvoiceDetails: (invoiceId: number) => { invoice: Invoice; paid: number; outstanding: number; days: number } | null;
}

interface ApprovalManagementProps {
  currentUser: User;
}

interface AuditLogProps {
  currentUser: User;
}

// ============================================================================
// PERSISTENT STORAGE LAYER
// ============================================================================

const DB = {
  async init() {
    const defaults = {
      users: [
        { id: 1, username: 'clerk1', password: 'clerk123', role: 'CLERK', name: 'Rajesh Kumar' },
        { id: 2, username: 'super1', password: 'super123', role: 'SUPERVISOR', name: 'Priya Sharma' },
        { id: 3, username: 'accounts1', password: 'acc123', role: 'ACCOUNTS', name: 'Amit Patel' },
        { id: 4, username: 'admin', password: 'admin123', role: 'ADMIN', name: 'Sunita Verma' }
      ],
      lrs: [],
      challans: [],
      pods: [],
      invoices: [],
      payments: [],
      auditLogs: [],
      editRequests: []
    };

    for (const [key, value] of Object.entries(defaults)) {
      if (!localStorage.getItem(key)) {
        localStorage.setItem(key, JSON.stringify(value));
      }
    }
  },

  async get(key: string) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  async set(key: string, value: any) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error('Storage error:', error);
      return false;
    }
  },

  async addAuditLog(log: any) {
    const logs = await this.get('auditLogs') || [];
    logs.push({ ...log, id: Date.now(), timestamp: new Date().toISOString() });
    await this.set('auditLogs', logs);
  }
};

// ============================================================================
// AUTHENTICATION & AUTHORIZATION
// ============================================================================

const PERMISSIONS: Record<string, Permissions> = {
  CLERK: { createLR: true, confirmLR: false, enterPOD: true, generateInvoice: false, recordPayment: false, approveEdits: false },
  SUPERVISOR: { createLR: true, confirmLR: true, enterPOD: true, generateInvoice: false, recordPayment: false, approveEdits: false },
  ACCOUNTS: { createLR: false, confirmLR: false, enterPOD: false, generateInvoice: true, recordPayment: true, approveEdits: false },
  ADMIN: { createLR: true, confirmLR: true, enterPOD: true, generateInvoice: true, recordPayment: true, approveEdits: true }
};

function LoginScreen({ onLogin }: LoginScreenProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async () => {
    const users = await DB.get('users');
    const user = users.find(u => u.username === username && u.password === password);
    
    if (user) {
      onLogin(user);
    } else {
      setError('Invalid credentials');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <Package className="w-16 h-16 text-indigo-600 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-gray-800">Transport ERP</h1>
          <p className="text-gray-600 mt-2">Enterprise Logistics System</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Enter username"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Enter password"
            />
          </div>

          {error && (
            <div className="bg-red-50 text-red-700 px-4 py-2 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            onClick={handleLogin}
            className="w-full bg-indigo-600 text-white py-2 rounded-lg font-medium hover:bg-indigo-700 transition"
          >
            Login
          </button>
        </div>

        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <p className="text-xs font-medium text-gray-700 mb-2">Demo Credentials:</p>
          <div className="text-xs text-gray-600 space-y-1">
            <div>Clerk: clerk1 / clerk123</div>
            <div>Supervisor: super1 / super123</div>
            <div>Accounts: accounts1 / acc123</div>
            <div>Admin: admin / admin123</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN APPLICATION
// ============================================================================

export default function TransportERP() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    DB.init().then(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Package className="w-16 h-16 text-indigo-600 mx-auto mb-4 animate-pulse" />
          <p className="text-gray-600">Initializing system...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginScreen onLogin={setCurrentUser} />;
  }

  const permissions = PERMISSIONS[currentUser.role];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <Package className="w-8 h-8 text-indigo-600" />
              <div className="hidden sm:block">
                <h1 className="text-xl font-bold text-gray-900">Transport ERP</h1>
                <p className="text-xs text-gray-500">Logistics Management System</p>
              </div>
              <div className="sm:hidden">
                <h1 className="text-lg font-bold text-gray-900">Transport ERP</h1>
              </div>
            </div>
            <div className="flex items-center space-x-2 sm:space-x-4">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-gray-900">{currentUser.name}</p>
                <p className="text-xs text-gray-500">{currentUser.role}</p>
              </div>
              <div className="text-right sm:hidden">
                <p className="text-xs font-medium text-gray-900">{currentUser.name}</p>
              </div>
              <button
                onClick={() => setCurrentUser(null)}
                className="px-3 sm:px-4 py-2 text-xs sm:text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Mobile Menu Button */}
          <div className="lg:hidden py-3">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="flex items-center space-x-2 w-full justify-between px-2 py-2 text-gray-700 hover:bg-gray-50 rounded-lg transition"
            >
              <div className="flex items-center space-x-2">
                <Menu className="w-5 h-5" />
                <span className="font-medium">Menu</span>
              </div>
              {mobileMenuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex space-x-1 overflow-x-auto">
            <NavTab active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={TrendingUp}>
              Dashboard
            </NavTab>
            <NavTab active={activeTab === 'lr'} onClick={() => setActiveTab('lr')} icon={FileText}>
              LR Management
            </NavTab>
            <NavTab active={activeTab === 'challan'} onClick={() => setActiveTab('challan')} icon={Package}>
              Challans
            </NavTab>
            <NavTab active={activeTab === 'pod'} onClick={() => setActiveTab('pod')} icon={CheckCircle}>
              POD Entry
            </NavTab>
            <NavTab active={activeTab === 'invoice'} onClick={() => setActiveTab('invoice')} icon={FileText}>
              Invoices
            </NavTab>
            <NavTab active={activeTab === 'payment'} onClick={() => setActiveTab('payment')} icon={DollarSign}>
              Payments
            </NavTab>
            {permissions.approveEdits && (
              <NavTab active={activeTab === 'approvals'} onClick={() => setActiveTab('approvals')} icon={Lock}>
                Approvals
              </NavTab>
            )}
            <NavTab active={activeTab === 'audit'} onClick={() => setActiveTab('audit')} icon={Eye}>
              Audit Log
            </NavTab>
          </nav>

          {/* Mobile Navigation */}
          {mobileMenuOpen && (
            <nav className="lg:hidden pb-3 space-y-1">
              <MobileNavTab active={activeTab === 'dashboard'} onClick={() => { setActiveTab('dashboard'); setMobileMenuOpen(false); }} icon={TrendingUp}>
                Dashboard
              </MobileNavTab>
              <MobileNavTab active={activeTab === 'lr'} onClick={() => { setActiveTab('lr'); setMobileMenuOpen(false); }} icon={FileText}>
                LR Management
              </MobileNavTab>
              <MobileNavTab active={activeTab === 'challan'} onClick={() => { setActiveTab('challan'); setMobileMenuOpen(false); }} icon={Package}>
                Challans
              </MobileNavTab>
              <MobileNavTab active={activeTab === 'pod'} onClick={() => { setActiveTab('pod'); setMobileMenuOpen(false); }} icon={CheckCircle}>
                POD Entry
              </MobileNavTab>
              <MobileNavTab active={activeTab === 'invoice'} onClick={() => { setActiveTab('invoice'); setMobileMenuOpen(false); }} icon={FileText}>
                Invoices
              </MobileNavTab>
              <MobileNavTab active={activeTab === 'payment'} onClick={() => { setActiveTab('payment'); setMobileMenuOpen(false); }} icon={DollarSign}>
                Payments
              </MobileNavTab>
              {permissions.approveEdits && (
                <MobileNavTab active={activeTab === 'approvals'} onClick={() => { setActiveTab('approvals'); setMobileMenuOpen(false); }} icon={Lock}>
                  Approvals
                </MobileNavTab>
              )}
              <MobileNavTab active={activeTab === 'audit'} onClick={() => { setActiveTab('audit'); setMobileMenuOpen(false); }} icon={Eye}>
                Audit Log
              </MobileNavTab>
            </nav>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-4 sm:py-6">
        {activeTab === 'dashboard' && <Dashboard currentUser={currentUser} />}
        {activeTab === 'lr' && <LRManagement currentUser={currentUser} permissions={permissions} />}
        {activeTab === 'challan' && <ChallanManagement currentUser={currentUser} permissions={permissions} />}
        {activeTab === 'pod' && <PODManagement currentUser={currentUser} permissions={permissions} />}
        {activeTab === 'invoice' && <InvoiceManagement currentUser={currentUser} permissions={permissions} />}
        {activeTab === 'payment' && <PaymentManagement currentUser={currentUser} permissions={permissions} />}
        {activeTab === 'approvals' && <ApprovalManagement currentUser={currentUser} />}
        {activeTab === 'audit' && <AuditLog currentUser={currentUser} />}
      </div>
    </div>
  );
}

function NavTab({ active, onClick, icon: Icon, children }: NavTabProps) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center space-x-2 px-4 py-3 text-sm font-medium border-b-2 transition whitespace-nowrap ${
        active
          ? 'border-indigo-600 text-indigo-600'
          : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
      }`}
    >
      <Icon className="w-4 h-4" />
      <span>{children}</span>
    </button>
  );
}

function MobileNavTab({ active, onClick, icon: Icon, children }: NavTabProps) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center space-x-3 px-4 py-3 text-sm font-medium rounded-lg transition w-full text-left ${
        active
          ? 'bg-indigo-50 text-indigo-600 border-l-4 border-indigo-600'
          : 'text-gray-700 hover:bg-gray-50'
      }`}
    >
      <Icon className="w-5 h-5" />
      <span>{children}</span>
    </button>
  );
}

// ============================================================================
// DASHBOARD
// ============================================================================

function Dashboard({ currentUser }: DashboardProps) {
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    const lrs = await DB.get('lrs') || [];
    const invoices = await DB.get('invoices') || [];
    const payments = await DB.get('payments') || [];

    const today = new Date().toISOString().split('T')[0];
    const todayLRs = lrs.filter(lr => lr.date === today);

    const podPending = lrs.filter(lr => {
      if (lr.status !== 'CONFIRMED') return false;
      const daysDiff = Math.floor((Date.now() - new Date(lr.date).getTime()) / (1000 * 60 * 60 * 24));
      return daysDiff > 10;
    });

    const calculateAgeing = (invoiceDate: string) => {
      const days = Math.floor((Date.now() - new Date(invoiceDate).getTime()) / (1000 * 60 * 60 * 24));
      if (days <= 30) return '0-30';
      if (days <= 60) return '31-60';
      if (days <= 90) return '61-90';
      return '90+';
    };

    const unpaidInvoices = invoices.filter(inv => inv.status !== 'PAID');
    const ageingBuckets = { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
    
    unpaidInvoices.forEach(inv => {
      const paidAmount = payments
        .filter(p => p.invoiceId === inv.id)
        .reduce((sum, p) => sum + p.amount, 0);
      const outstanding = inv.grandTotal - paidAmount;
      if (outstanding > 0) {
        const bucket = calculateAgeing(inv.date);
        ageingBuckets[bucket] += outstanding;
      }
    });

    const last30Days = Array.from({ length: 30 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (29 - i));
      return date.toISOString().split('T')[0];
    });

    const revenueData = last30Days.map(date => {
      const dayPayments = payments.filter(p => p.date === date);
      return {
        date: new Date(date).getDate(),
        amount: dayPayments.reduce((sum, p) => sum + p.amount, 0)
      };
    });

    setStats({
      todayLRs: {
        draft: todayLRs.filter(lr => lr.status === 'DRAFT').length,
        confirmed: todayLRs.filter(lr => lr.status === 'CONFIRMED').length,
        podReceived: todayLRs.filter(lr => lr.status === 'POD_RECEIVED').length
      },
      podPending: {
        count: podPending.length,
        amount: podPending.reduce((sum, lr) => sum + lr.freight, 0)
      },
      ageingBuckets,
      revenueData
    });
  };

  if (!stats) {
    return <div className="text-center py-12">Loading dashboard...</div>;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Dashboard</h2>
        <div className="text-xs sm:text-sm text-gray-500">
          Logged in as: <span className="font-medium text-gray-900">{currentUser.name}</span>
        </div>
      </div>

      {/* Today's LR Count */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          title="Draft LRs"
          value={stats.todayLRs.draft}
          subtitle="Today"
          icon={FileText}
          color="blue"
        />
        <StatCard
          title="Confirmed LRs"
          value={stats.todayLRs.confirmed}
          subtitle="Today"
          icon={CheckCircle}
          color="green"
        />
        <StatCard
          title="POD Received"
          value={stats.todayLRs.podReceived}
          subtitle="Today"
          icon={Package}
          color="purple"
        />
      </div>

      {/* POD Pending Alert */}
      {stats.podPending.count > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-yellow-900">POD Pending Alert</h3>
              <p className="text-sm text-yellow-800 mt-1">
                {stats.podPending.count} LRs pending POD for more than 10 days
                <span className="font-medium ml-2">
                  (₹{stats.podPending.amount.toLocaleString('en-IN')})
                </span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Outstanding by Ageing */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Outstanding by Ageing</h3>
        <div className="space-y-3">
          {Object.entries(stats.ageingBuckets).map(([bucket, amount]) => (
            <div key={bucket} className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className={`w-3 h-3 rounded-full ${
                  bucket === '0-30' ? 'bg-green-500' :
                  bucket === '31-60' ? 'bg-yellow-500' :
                  bucket === '61-90' ? 'bg-orange-500' : 'bg-red-500'
                }`} />
                <span className="text-sm font-medium text-gray-700">{bucket} days</span>
              </div>
              <span className="text-lg font-semibold text-gray-900">
                ₹{(amount as number).toLocaleString('en-IN')}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Revenue Trend */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Daily Revenue Trend (Last 30 Days)</h3>
        <div className="h-48 flex items-end justify-between space-x-1">
          {stats.revenueData.map((data, idx) => {
            const maxAmount = Math.max(...stats.revenueData.map(d => d.amount));
            const height = maxAmount > 0 ? (data.amount / maxAmount) * 100 : 0;
            return (
              <div key={idx} className="flex-1 flex flex-col items-center">
                <div
                  className="w-full bg-indigo-500 rounded-t transition-all hover:bg-indigo-600"
                  style={{ height: `${height}%` }}
                  title={`Day ${data.date}: ₹${data.amount.toLocaleString('en-IN')}`}
                />
                {idx % 5 === 0 && (
                  <span className="text-xs text-gray-500 mt-2">{data.date}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, subtitle, icon: Icon, color }: StatCardProps) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    red: 'bg-red-50 text-red-600'
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
          <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
        </div>
        <div className={`p-3 rounded-lg ${colors[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// LR MANAGEMENT
// ============================================================================

function LRManagement({ currentUser, permissions }: LRManagementProps) {
  const [lrs, setLRs] = useState<LR[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingLR, setEditingLR] = useState<LR | null>(null);
  const [filter, setFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadLRs();
  }, []);

  const loadLRs = async () => {
    const data = await DB.get('lrs') || [];
    setLRs(data);
  };

  const filteredLRs = lrs.filter(lr => {
    const matchesFilter = filter === 'ALL' || lr.status === filter;
    const matchesSearch = searchTerm === '' || 
      lr.lrNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lr.consignor.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lr.consignee.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const handleSaveLR = async (lrData) => {
    try {
      console.log('Saving LR:', lrData);
      const allLRs = await DB.get('lrs') || [];
      console.log('Current LRs:', allLRs.length);
      
      // Check for duplicate LR number
      const duplicate = allLRs.find(lr => 
        lr.lrNumber === lrData.lrNumber && (!editingLR || lr.id !== editingLR.id)
      );
      
      if (duplicate) {
        alert(`LR Number ${lrData.lrNumber} already exists!`);
        return;
      }
      
      if (editingLR) {
        // Edit existing
        if (editingLR.status !== 'DRAFT') {
          alert('Cannot edit confirmed LR. Use Edit Request feature.');
          return;
        }
        
        const index = allLRs.findIndex(lr => lr.id === editingLR.id);
        allLRs[index] = { ...lrData, id: editingLR.id, status: 'DRAFT' };
        
        await DB.addAuditLog({
          userId: currentUser.id,
          userName: currentUser.name,
          action: 'EDIT_LR',
          recordType: 'LR',
          recordId: editingLR.id,
          details: `Edited LR ${lrData.lrNumber}`,
          oldValue: JSON.stringify(editingLR),
          newValue: JSON.stringify(lrData)
        });
      } else {
        // Create new
        const newLR = {
          ...lrData,
          id: Date.now(),
          status: 'DRAFT',
          createdBy: currentUser.id,
          createdAt: new Date().toISOString()
        };
        console.log('New LR:', newLR);
        allLRs.push(newLR);
        
        await DB.addAuditLog({
          userId: currentUser.id,
          userName: currentUser.name,
          action: 'CREATE_LR',
          recordType: 'LR',
          recordId: newLR.id,
          details: `Created LR ${lrData.lrNumber}`
        });
      }
      
      console.log('Saving to storage...');
      const saved = await DB.set('lrs', allLRs);
      console.log('Save result:', saved);
      
      if (saved) {
        alert(editingLR ? 'LR updated successfully!' : 'LR created successfully!');
        await loadLRs();
        setShowForm(false);
        setEditingLR(null);
      } else {
        alert('Failed to save LR. Please try again.');
      }
    } catch (error) {
      console.error('Error saving LR:', error);
      alert('Error saving LR: ' + error.message);
    }
  };

  const handleConfirmLR = async (lr) => {
    if (!permissions.confirmLR) {
      alert('You do not have permission to confirm LRs');
      return;
    }

    if (!confirm(`Confirm LR ${lr.lrNumber}? This will LOCK the record permanently.`)) {
      return;
    }

    const allLRs = await DB.get('lrs') || [];
    const index = allLRs.findIndex(l => l.id === lr.id);
    allLRs[index] = { ...lr, status: 'CONFIRMED', confirmedBy: currentUser.id, confirmedAt: new Date().toISOString() };
    
    await DB.set('lrs', allLRs);
    
    await DB.addAuditLog({
      userId: currentUser.id,
      userName: currentUser.name,
      action: 'CONFIRM_LR',
      recordType: 'LR',
      recordId: lr.id,
      details: `Confirmed LR ${lr.lrNumber} - Record LOCKED`
    });
    
    loadLRs();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900">LR Management</h2>
        {permissions.createLR && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center space-x-2 px-3 sm:px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition text-sm w-full sm:w-auto justify-center"
          >
            <Plus className="w-4 h-4" />
            <span>New LR</span>
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-3 sm:p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="LR number, consignor, consignee..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status Filter</label>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            >
              <option value="ALL">All Status</option>
              <option value="DRAFT">Draft</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="POD_RECEIVED">POD Received</option>
              <option value="INVOICED">Invoiced</option>
            </select>
          </div>
        </div>
      </div>

      {/* LR List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">LR Number</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Consignor</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Consignee</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Route</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Freight</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredLRs.map(lr => (
                <tr key={lr.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{lr.lrNumber}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{lr.date}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{lr.consignor}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{lr.consignee}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{lr.origin} → {lr.destination}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">₹{lr.freight.toLocaleString('en-IN')}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={lr.status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center space-x-2">
                      {lr.status === 'DRAFT' && permissions.createLR && (
                        <button
                          onClick={() => { setEditingLR(lr); setShowForm(true); }}
                          className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                      {lr.status === 'DRAFT' && permissions.confirmLR && (
                        <button
                          onClick={() => handleConfirmLR(lr)}
                          className="p-1 text-green-600 hover:bg-green-50 rounded"
                          title="Confirm & Lock"
                        >
                          <Lock className="w-4 h-4" />
                        </button>
                      )}
                      {lr.status !== 'DRAFT' && (
                        <span title="Locked"><Lock className="w-4 h-4 text-gray-400" /></span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredLRs.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              No LRs found
            </div>
          )}
        </div>
      </div>

      {/* LR Form Modal */}
      {showForm && (
        <LRForm
          lr={editingLR}
          onSave={handleSaveLR}
          onCancel={() => { setShowForm(false); setEditingLR(null); }}
        />
      )}
    </div>
  );
}

function LRForm({ lr, onSave, onCancel }: LRFormProps) {
  const [formData, setFormData] = useState<{
    lrNumber: string;
    date: string;
    consignor: string;
    consignee: string;
    origin: string;
    destination: string;
    weight: string;
    freight: string;
    status: string;
  }>(lr ? {
    lrNumber: lr.lrNumber,
    date: lr.date,
    consignor: lr.consignor,
    consignee: lr.consignee,
    origin: lr.origin,
    destination: lr.destination,
    weight: lr.weight.toString(),
    freight: lr.freight.toString(),
    status: lr.status
  } : {
    lrNumber: '',
    date: new Date().toISOString().split('T')[0],
    consignor: '',
    consignee: '',
    origin: '',
    destination: '',
    weight: '',
    freight: '',
    status: 'DRAFT'
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (submitting) return;
    
    console.log('Form submitted with data:', formData);
    
    if (!formData.lrNumber.trim()) {
      alert('LR Number is required');
      return;
    }
    
    if (!formData.consignor.trim()) {
      alert('Consignor is required');
      return;
    }
    
    if (!formData.consignee.trim()) {
      alert('Consignee is required');
      return;
    }
    
    setSubmitting(true);
    
    try {
      await onSave({
        lrNumber: formData.lrNumber.trim(),
        consignor: formData.consignor.trim(),
        consignee: formData.consignee.trim(),
        origin: formData.origin.trim(),
        destination: formData.destination.trim(),
        weight: parseFloat(formData.weight) || 0,
        freight: parseFloat(formData.freight) || 0,
        date: formData.date,
        status: formData.status as LR['status']
      });
    } catch (error) {
      console.error('Submit error:', error);
      alert('Error submitting form');
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto m-2">
        <div className="p-4 sm:p-6 border-b border-gray-200">
          <h3 className="text-lg sm:text-xl font-bold text-gray-900">
            {lr ? 'Edit LR' : 'New LR Entry'}
          </h3>
        </div>
        
        <div className="p-4 sm:p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                LR Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.lrNumber}
                onChange={(e) => setFormData({ ...formData, lrNumber: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                placeholder="Enter pre-printed LR number"
                disabled={submitting}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                disabled={submitting}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Consignor <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.consignor}
              onChange={(e) => setFormData({ ...formData, consignor: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              disabled={submitting}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Consignee <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.consignee}
              onChange={(e) => setFormData({ ...formData, consignee: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              disabled={submitting}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Origin</label>
              <input
                type="text"
                value={formData.origin}
                onChange={(e) => setFormData({ ...formData, origin: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                disabled={submitting}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Destination</label>
              <input
                type="text"
                value={formData.destination}
                onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                disabled={submitting}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Weight (kg)</label>
              <input
                type="number"
                step="0.01"
                value={formData.weight}
                onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                disabled={submitting}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Freight Amount (₹)</label>
              <input
                type="number"
                step="0.01"
                value={formData.freight}
                onChange={(e) => setFormData({ ...formData, freight: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                disabled={submitting}
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onCancel}
              disabled={submitting}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 w-full sm:w-auto"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 w-full sm:w-auto"
            >
              {submitting ? 'Saving...' : (lr ? 'Update LR' : 'Create LR')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: StatusBadgeProps) {
  const styles = {
    DRAFT: 'bg-gray-100 text-gray-800',
    CONFIRMED: 'bg-blue-100 text-blue-800',
    POD_RECEIVED: 'bg-green-100 text-green-800',
    INVOICED: 'bg-purple-100 text-purple-800',
    PAID: 'bg-emerald-100 text-emerald-800'
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status]}`}>
      {status === 'DRAFT' && <Unlock className="w-3 h-3 mr-1" />}
      {status !== 'DRAFT' && <Lock className="w-3 h-3 mr-1" />}
      {status.replace('_', ' ')}
    </span>
  );
}

// ============================================================================
// CHALLAN MANAGEMENT
// ============================================================================

function ChallanManagement({ currentUser, permissions }: ChallanManagementProps) {
  const [challans, setChallans] = useState<Challan[]>([]);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    loadChallans();
  }, []);

  const loadChallans = async () => {
    const data = await DB.get('challans') || [];
    setChallans(data);
  };

  const handleCreateChallan = async (challanData) => {
    const allChallans = await DB.get('challans') || [];
    
    const newChallan = {
      ...challanData,
      id: Date.now(),
      number: `CH${Date.now()}`,
      createdBy: currentUser.id,
      createdAt: new Date().toISOString(),
      locked: true
    };
    
    allChallans.push(newChallan);
    await DB.set('challans', allChallans);
    
    await DB.addAuditLog({
      userId: currentUser.id,
      userName: currentUser.name,
      action: 'CREATE_CHALLAN',
      recordType: 'CHALLAN',
      recordId: newChallan.id,
      details: `Created Challan ${newChallan.number} - Auto-locked`
    });
    
    loadChallans();
    setShowForm(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Challan Management</h2>
        {permissions.confirmLR && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            <Plus className="w-4 h-4" />
            <span>Generate Challan</span>
          </button>
        )}
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Challan No</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vehicle</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Driver</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Route</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">LR Count</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {challans.map(challan => (
              <tr key={challan.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium">{challan.number}</td>
                <td className="px-4 py-3 text-sm">{challan.date}</td>
                <td className="px-4 py-3 text-sm">{challan.vehicle}</td>
                <td className="px-4 py-3 text-sm">{challan.driver}</td>
                <td className="px-4 py-3 text-sm">{challan.route}</td>
                <td className="px-4 py-3 text-sm">{challan.lrIds.length}</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    <Lock className="w-3 h-3 mr-1" />
                    LOCKED
                  </span>
                </td>
              </tr>
            ))}
            </tbody>
          </table>
        </div>
        {challans.length === 0 && (
          <div className="text-center py-12 text-gray-500">No challans generated</div>
        )}
      </div>

      {showForm && (
        <ChallanForm
          onSave={handleCreateChallan}
          onCancel={() => setShowForm(false)}
        />
      )}
    </div>
  );
}

function ChallanForm({ onSave, onCancel }: ChallanFormProps) {
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    vehicle: '',
    driver: '',
    route: '',
    lrIds: [] as number[]
  });
  const [availableLRs, setAvailableLRs] = useState<LR[]>([]);

  useEffect(() => {
    loadAvailableLRs();
  }, []);

  const loadAvailableLRs = async () => {
    const lrs = await DB.get('lrs') || [];
    const confirmed = lrs.filter((lr: LR) => lr.status === 'CONFIRMED');
    setAvailableLRs(confirmed);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.lrIds.length === 0) {
      alert('Please select at least one LR');
      return;
    }
    onSave(formData);
  };

  const toggleLR = (lrId: number) => {
    setFormData(prev => ({
      ...prev,
      lrIds: prev.lrIds.includes(lrId)
        ? prev.lrIds.filter(id => id !== lrId)
        : [...prev.lrIds, lrId]
    }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto m-2">
        <div className="p-4 sm:p-6 border-b">
          <h3 className="text-lg sm:text-xl font-bold text-gray-900">Generate Challan</h3>
        </div>
        
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Date</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Vehicle Number</label>
              <input
                type="text"
                value={formData.vehicle}
                onChange={(e) => setFormData({ ...formData, vehicle: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Driver Name</label>
              <input
                type="text"
                value={formData.driver}
                onChange={(e) => setFormData({ ...formData, driver: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Route</label>
              <input
                type="text"
                value={formData.route}
                onChange={(e) => setFormData({ ...formData, route: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Select LRs (Confirmed Only)</label>
            <div className="border rounded-lg max-h-64 overflow-y-auto">
              {availableLRs.map(lr => (
                <label key={lr.id} className="flex items-center px-4 py-2 hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.lrIds.includes(lr.id)}
                    onChange={() => toggleLR(lr.id)}
                    className="mr-3"
                  />
                  <span className="text-sm">
                    {lr.lrNumber} - {lr.consignor} to {lr.consignee} - ₹{lr.freight}
                  </span>
                </label>
              ))}
              {availableLRs.length === 0 && (
                <div className="text-center py-8 text-gray-500">No confirmed LRs available</div>
              )}
            </div>
            <p className="text-sm text-gray-600 mt-2">Selected: {formData.lrIds.length} LRs</p>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button type="button" onClick={onCancel} className="px-4 py-2 border rounded-lg">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg">
              Generate Challan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================================
// POD MANAGEMENT
// ============================================================================

function PODManagement({ currentUser, permissions }: PODManagementProps) {
  const [lrs, setLRs] = useState<LR[]>([]);
  const [selectedLR, setSelectedLR] = useState<LR | null>(null);

  useEffect(() => {
    loadLRs();
  }, []);

  const loadLRs = async () => {
    const data = await DB.get('lrs') || [];
    const eligible = data.filter(lr => lr.status === 'CONFIRMED' || lr.status === 'POD_RECEIVED');
    setLRs(eligible);
  };

  const handlePODEntry = async (podData) => {
    const allLRs = await DB.get('lrs') || [];
    const index = allLRs.findIndex(lr => lr.id === selectedLR.id);
    
    allLRs[index] = {
      ...allLRs[index],
      status: 'POD_RECEIVED',
      podDate: podData.podDate,
      podReceiver: podData.receiver,
      podRemarks: podData.remarks,
      podEnteredBy: currentUser.id,
      podEnteredAt: new Date().toISOString()
    };
    
    await DB.set('lrs', allLRs);
    
    await DB.addAuditLog({
      userId: currentUser.id,
      userName: currentUser.name,
      action: 'POD_ENTRY',
      recordType: 'LR',
      recordId: selectedLR.id,
      details: `POD entered for LR ${selectedLR.lrNumber} - Status changed to POD_RECEIVED (LOCKED)`
    });
    
    loadLRs();
    setSelectedLR(null);
  };

  const pendingPOD = lrs.filter(lr => {
    if (lr.status !== 'CONFIRMED') return false;
    const daysDiff = Math.floor((Date.now() - new Date(lr.date).getTime()) / (1000 * 60 * 60 * 24));
    return daysDiff > 10;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900">POD Entry & Tracking</h2>
      </div>

      {pendingPOD.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
            <div>
              <h3 className="font-semibold text-yellow-900">POD Pending Alert</h3>
              <p className="text-sm text-yellow-800 mt-1">
                {pendingPOD.length} LRs pending POD for more than 10 days
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">LR Number</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Consignee</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Days Pending</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
            {lrs.map(lr => {
              const days = Math.floor((Date.now() - new Date(lr.date).getTime()) / (1000 * 60 * 60 * 24));
              return (
                <tr key={lr.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium">{lr.lrNumber}</td>
                  <td className="px-4 py-3 text-sm">{lr.date}</td>
                  <td className="px-4 py-3 text-sm">{lr.consignee}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className={days > 10 ? 'text-red-600 font-semibold' : ''}>
                      {days} days
                    </span>
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={lr.status} /></td>
                  <td className="px-4 py-3">
                    {lr.status === 'CONFIRMED' && permissions.enterPOD && (
                      <button
                        onClick={() => setSelectedLR(lr)}
                        className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                      >
                        Enter POD
                      </button>
                    )}
                    {lr.status === 'POD_RECEIVED' && (
                      <span className="text-xs text-green-600 flex items-center">
                        <CheckCircle className="w-4 h-4 mr-1" />
                        POD Received
                      </span>
                    )}
                  </td>
                </tr>
              );
            }            )}
            </tbody>
          </table>
        </div>
        {lrs.length === 0 && (
          <div className="text-center py-12 text-gray-500">No LRs available for POD entry</div>
        )}
      </div>

      {selectedLR && (
        <PODForm
          lr={selectedLR}
          onSave={handlePODEntry}
          onCancel={() => setSelectedLR(null)}
        />
      )}
    </div>
  );
}

function PODForm({ lr, onSave, onCancel }: PODFormProps) {
  const [formData, setFormData] = useState({
    podDate: new Date().toISOString().split('T')[0],
    receiver: '',
    remarks: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.receiver) {
      alert('Receiver name is required');
      return;
    }
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto m-2">
        <div className="p-4 sm:p-6 border-b">
          <h3 className="text-lg sm:text-xl font-bold text-gray-900">POD Entry</h3>
          <p className="text-sm text-gray-600 mt-1">LR: {lr.lrNumber}</p>
        </div>
        
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">POD Date</label>
            <input
              type="date"
              value={formData.podDate}
              onChange={(e) => setFormData({ ...formData, podDate: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Receiver Name</label>
            <input
              type="text"
              value={formData.receiver}
              onChange={(e) => setFormData({ ...formData, receiver: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Remarks</label>
            <textarea
              value={formData.remarks}
              onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
              rows={3}
            />
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
            <p className="text-sm text-yellow-800 flex items-center">
              <Lock className="w-4 h-4 mr-2" />
              This will change LR status to POD_RECEIVED and lock the record permanently.
            </p>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button type="button" onClick={onCancel} className="px-4 py-2 border rounded-lg">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded-lg">
              Submit POD
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================================
// INVOICE MANAGEMENT
// ============================================================================

function InvoiceManagement({ currentUser, permissions }: InvoiceManagementProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    loadInvoices();
  }, []);

  const loadInvoices = async () => {
    const data = await DB.get('invoices') || [];
    setInvoices(data);
  };

  const handleCreateInvoice = async (invoiceData) => {
    const allInvoices = await DB.get('invoices') || [];
    const allLRs = await DB.get('lrs') || [];
    
    const newInvoice = {
      ...invoiceData,
      id: Date.now(),
      number: `INV${Date.now()}`,
      createdBy: currentUser.id,
      createdAt: new Date().toISOString(),
      status: 'UNPAID'
    };
    
    allInvoices.push(newInvoice);
    await DB.set('invoices', allInvoices);
    
    // Update LR status to INVOICED
    invoiceData.lrIds.forEach(lrId => {
      const index = allLRs.findIndex(lr => lr.id === lrId);
      if (index !== -1) {
        allLRs[index].status = 'INVOICED';
      }
    });
    await DB.set('lrs', allLRs);
    
    await DB.addAuditLog({
      userId: currentUser.id,
      userName: currentUser.name,
      action: 'CREATE_INVOICE',
      recordType: 'INVOICE',
      recordId: newInvoice.id,
      details: `Created Invoice ${newInvoice.number} with ${invoiceData.lrIds.length} LRs - All LRs locked`
    });
    
    loadInvoices();
    setShowForm(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Invoice Management</h2>
        {permissions.generateInvoice && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center space-x-2 px-3 sm:px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm w-full sm:w-auto justify-center"
          >
            <Plus className="w-4 h-4" />
            <span>Generate Invoice</span>
          </button>
        )}
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice No</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">LR Count</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">GST</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {invoices.map(inv => (
              <tr key={inv.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium">{inv.number}</td>
                <td className="px-4 py-3 text-sm">{inv.date}</td>
                <td className="px-4 py-3 text-sm">{inv.customer}</td>
                <td className="px-4 py-3 text-sm">{inv.lrIds.length}</td>
                <td className="px-4 py-3 text-sm">₹{inv.freightTotal.toLocaleString('en-IN')}</td>
                <td className="px-4 py-3 text-sm">₹{inv.gst.toLocaleString('en-IN')}</td>
                <td className="px-4 py-3 text-sm font-semibold">₹{inv.grandTotal.toLocaleString('en-IN')}</td>
                <td className="px-4 py-3"><StatusBadge status={inv.status} /></td>
              </tr>
            ))}
            </tbody>
          </table>
        </div>
        {invoices.length === 0 && (
          <div className="text-center py-12 text-gray-500">No invoices generated</div>
        )}
      </div>

      {showForm && (
        <InvoiceForm
          onSave={handleCreateInvoice}
          onCancel={() => setShowForm(false)}
        />
      )}
    </div>
  );
}

function InvoiceForm({ onSave, onCancel }: InvoiceFormProps) {
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    customer: '',
    gstRate: 5,
    lrIds: [] as number[]
  });
  const [availableLRs, setAvailableLRs] = useState<LR[]>([]);

  useEffect(() => {
    loadAvailableLRs();
  }, []);

  const loadAvailableLRs = async () => {
    const lrs = await DB.get('lrs') || [];
    const eligible = lrs.filter((lr: LR) => lr.status === 'POD_RECEIVED');
    setAvailableLRs(eligible);
  };

  const selectedLRs = availableLRs.filter(lr => formData.lrIds.includes(lr.id));
  const freightTotal = selectedLRs.reduce((sum, lr) => sum + lr.freight, 0);
  const gst = (freightTotal * formData.gstRate) / 100;
  const grandTotal = freightTotal + gst;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.lrIds.length === 0) {
      alert('Please select at least one LR');
      return;
    }
    
    // Validate all selected LRs have POD
    const invalidLRs = selectedLRs.filter(lr => lr.status !== 'POD_RECEIVED');
    if (invalidLRs.length > 0) {
      alert('HARD BLOCK: Cannot generate invoice. All selected LRs must have POD received.');
      return;
    }
    
    onSave({
      ...formData,
      freightTotal,
      gst,
      grandTotal
    });
  };

  const toggleLR = (lrId: number) => {
    setFormData(prev => ({
      ...prev,
      lrIds: prev.lrIds.includes(lrId)
        ? prev.lrIds.filter(id => id !== lrId)
        : [...prev.lrIds, lrId]
    }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto m-2">
        <div className="p-4 sm:p-6 border-b">
          <h3 className="text-lg sm:text-xl font-bold text-gray-900">Generate Invoice</h3>
        </div>
        
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Date</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Customer Name</label>
              <input
                type="text"
                value={formData.customer}
                onChange={(e) => setFormData({ ...formData, customer: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">GST Rate (%)</label>
            <select
              value={formData.gstRate}
              onChange={(e) => setFormData({ ...formData, gstRate: parseFloat(e.target.value) })}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value={5}>5%</option>
              <option value={12}>12%</option>
              <option value={18}>18%</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Select LRs (POD Received Only)</label>
            <div className="border rounded-lg max-h-64 overflow-y-auto">
              {availableLRs.map(lr => (
                <label key={lr.id} className="flex items-center px-4 py-2 hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.lrIds.includes(lr.id)}
                    onChange={() => toggleLR(lr.id)}
                    className="mr-3"
                  />
                  <span className="text-sm flex-1">
                    {lr.lrNumber} - {lr.consignor} - POD: {lr.podDate}
                  </span>
                  <span className="text-sm font-semibold">₹{lr.freight.toLocaleString('en-IN')}</span>
                </label>
              ))}
              {availableLRs.length === 0 && (
                <div className="text-center py-8 text-gray-500">No LRs with POD received</div>
              )}
            </div>
          </div>

          {formData.lrIds.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span>Freight Total:</span>
                <span className="font-semibold">₹{freightTotal.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>GST ({formData.gstRate}%):</span>
                <span className="font-semibold">₹{gst.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-lg font-bold border-t pt-2">
                <span>Grand Total:</span>
                <span>₹{grandTotal.toLocaleString('en-IN')}</span>
              </div>
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button type="button" onClick={onCancel} className="px-4 py-2 border rounded-lg">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg">
              Generate Invoice
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================================
// PAYMENT MANAGEMENT
// ============================================================================

function PaymentManagement({ currentUser, permissions }: PaymentManagementProps) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const pmts = await DB.get('payments') || [];
    const invs = await DB.get('invoices') || [];
    setPayments(pmts);
    setInvoices(invs);
  };

  const handleRecordPayment = async (paymentData) => {
    const allPayments = await DB.get('payments') || [];
    const allInvoices = await DB.get('invoices') || [];
    
    const newPayment = {
      ...paymentData,
      id: Date.now(),
      recordedBy: currentUser.id,
      recordedAt: new Date().toISOString()
    };
    
    allPayments.push(newPayment);
    await DB.set('payments', allPayments);
    
    // Update invoice status
    const invoice = allInvoices.find(inv => inv.id === paymentData.invoiceId);
    if (invoice) {
      const totalPaid = allPayments
        .filter(p => p.invoiceId === paymentData.invoiceId)
        .reduce((sum, p) => sum + p.amount, 0);
      
      const invIndex = allInvoices.findIndex(inv => inv.id === paymentData.invoiceId);
      if (totalPaid >= invoice.grandTotal) {
        allInvoices[invIndex].status = 'PAID';
      } else {
        allInvoices[invIndex].status = 'PARTIAL';
      }
      await DB.set('invoices', allInvoices);
    }
    
    await DB.addAuditLog({
      userId: currentUser.id,
      userName: currentUser.name,
      action: 'RECORD_PAYMENT',
      recordType: 'PAYMENT',
      recordId: newPayment.id,
      details: `Recorded payment of ₹${paymentData.amount} for Invoice ${invoice.number}`
    });
    
    loadData();
    setShowForm(false);
  };

  const getInvoiceDetails = (invoiceId) => {
    const invoice = invoices.find(inv => inv.id === invoiceId);
    if (!invoice) return null;
    
    const paid = payments
      .filter(p => p.invoiceId === invoiceId)
      .reduce((sum, p) => sum + p.amount, 0);
    
    const outstanding = invoice.grandTotal - paid;
    const days = Math.floor((Date.now() - new Date(invoice.date).getTime()) / (1000 * 60 * 60 * 24));
    
    return { invoice, paid, outstanding, days };
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Payment Management</h2>
        {permissions.recordPayment && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center space-x-2 px-3 sm:px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm w-full sm:w-auto justify-center"
          >
            <Plus className="w-4 h-4" />
            <span>Record Payment</span>
          </button>
        )}
      </div>

      {/* Outstanding Summary */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Outstanding Summary</h3>
        <div className="grid grid-cols-4 gap-4">
          {['0-30', '31-60', '61-90', '90+'].map(bucket => {
            const outstanding = invoices.reduce((sum, inv) => {
              const details = getInvoiceDetails(inv.id);
              if (!details || details.outstanding <= 0) return sum;
              
              const days = details.days;
              const inBucket = 
                (bucket === '0-30' && days <= 30) ||
                (bucket === '31-60' && days > 30 && days <= 60) ||
                (bucket === '61-90' && days > 60 && days <= 90) ||
                (bucket === '90+' && days > 90);
              
              return inBucket ? sum + details.outstanding : sum;
            }, 0);
            
            return (
              <div key={bucket} className="text-center">
                <p className="text-sm text-gray-600">{bucket} days</p>
                <p className="text-2xl font-bold text-gray-900">₹{outstanding.toLocaleString('en-IN')}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Payment History */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payment Date</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice No</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mode</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reference</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {payments.map(pmt => {
              const invoice = invoices.find(inv => inv.id === pmt.invoiceId);
              return (
                <tr key={pmt.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm">{pmt.date}</td>
                  <td className="px-4 py-3 text-sm font-medium">{invoice?.number}</td>
                  <td className="px-4 py-3 text-sm font-semibold">₹{pmt.amount.toLocaleString('en-IN')}</td>
                  <td className="px-4 py-3 text-sm">{pmt.mode}</td>
                  <td className="px-4 py-3 text-sm">{pmt.reference}</td>
                </tr>
              );
            })}
            </tbody>
          </table>
        </div>
        {payments.length === 0 && (
          <div className="text-center py-12 text-gray-500">No payments recorded</div>
        )}
      </div>

      {showForm && (
        <PaymentForm
          invoices={invoices}
          onSave={handleRecordPayment}
          onCancel={() => setShowForm(false)}
          getInvoiceDetails={getInvoiceDetails}
        />
      )}
    </div>
  );
}

function PaymentForm({ invoices, onSave, onCancel, getInvoiceDetails }: PaymentFormProps) {
  const [formData, setFormData] = useState({
    invoiceId: '',
    date: new Date().toISOString().split('T')[0],
    amount: '',
    mode: 'NEFT',
    reference: ''
  });

  const selectedInvoice = formData.invoiceId ? getInvoiceDetails(parseInt(formData.invoiceId)) : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const amount = parseFloat(formData.amount);
    if (amount <= 0) {
      alert('Amount must be greater than 0');
      return;
    }
    
    if (selectedInvoice && amount > selectedInvoice.outstanding) {
      alert(`Amount cannot exceed outstanding balance of ₹${selectedInvoice.outstanding.toLocaleString('en-IN')}`);
      return;
    }
    
    onSave({
      ...formData,
      invoiceId: parseInt(formData.invoiceId),
      amount
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto m-2">
        <div className="p-4 sm:p-6 border-b">
          <h3 className="text-lg sm:text-xl font-bold text-gray-900">Record Payment</h3>
        </div>
        
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Select Invoice</label>
            <select
              value={formData.invoiceId}
              onChange={(e) => setFormData({ ...formData, invoiceId: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
              required
            >
              <option value="">-- Select Invoice --</option>
              {invoices.filter(inv => inv.status !== 'PAID').map(inv => {
                const details = getInvoiceDetails(inv.id);
                return (
                  <option key={inv.id} value={inv.id}>
                    {inv.number} - {inv.customer} - Outstanding: ₹{details.outstanding.toLocaleString('en-IN')}
                  </option>
                );
              })}
            </select>
          </div>

          {selectedInvoice && (
            <div className="bg-gray-50 border rounded p-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Invoice Total:</span>
                <span className="font-semibold">₹{selectedInvoice.invoice.grandTotal.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between">
                <span>Paid:</span>
                <span className="font-semibold">₹{selectedInvoice.paid.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-red-600">
                <span>Outstanding:</span>
                <span className="font-bold">₹{selectedInvoice.outstanding.toLocaleString('en-IN')}</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Payment Date</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Amount (₹)</label>
              <input
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Payment Mode</label>
            <select
              value={formData.mode}
              onChange={(e) => setFormData({ ...formData, mode: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="CASH">Cash</option>
              <option value="CHEQUE">Cheque</option>
              <option value="NEFT">NEFT</option>
              <option value="RTGS">RTGS</option>
              <option value="UPI">UPI</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Reference/Cheque No</label>
            <input
              type="text"
              value={formData.reference}
              onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button type="button" onClick={onCancel} className="px-4 py-2 border rounded-lg">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg">
              Record Payment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================================
// APPROVAL MANAGEMENT
// ============================================================================

function ApprovalManagement({ currentUser }: ApprovalManagementProps) {
  const [editRequests, setEditRequests] = useState<any[]>([]);

  useEffect(() => {
    loadEditRequests();
  }, []);

  const loadEditRequests = async () => {
    const data = await DB.get('editRequests') || [];
    setEditRequests(data.filter(req => req.status === 'PENDING'));
  };

  const handleApprove = async (request) => {
    // Implementation for approval workflow
    alert('Edit approval feature - to be implemented with full audit trail');
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Edit Approvals</h2>
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-gray-600">
          Edit request approval workflow will appear here. All changes to locked records require admin approval with mandatory reason.
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// AUDIT LOG
// ============================================================================

function AuditLog({ currentUser }: AuditLogProps) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [filter, setFilter] = useState('ALL');

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    const data = await DB.get('auditLogs') || [];
    setLogs(data.sort((a, b) => b.id - a.id));
  };

  const filteredLogs = filter === 'ALL' ? logs : logs.filter(log => log.action === filter);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Audit Log</h2>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="px-4 py-2 border rounded-lg"
        >
          <option value="ALL">All Actions</option>
          <option value="CREATE_LR">Create LR</option>
          <option value="CONFIRM_LR">Confirm LR</option>
          <option value="POD_ENTRY">POD Entry</option>
          <option value="CREATE_INVOICE">Create Invoice</option>
          <option value="RECORD_PAYMENT">Record Payment</option>
        </select>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Timestamp</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Record Type</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredLogs.map(log => (
              <tr key={log.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm">{new Date(log.timestamp).toLocaleString()}</td>
                <td className="px-4 py-3 text-sm">{log.userName}</td>
                <td className="px-4 py-3 text-sm">
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                    {log.action.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm">{log.recordType}</td>
                <td className="px-4 py-3 text-sm">{log.details}</td>
              </tr>
            ))}
            </tbody>
          </table>
        </div>
        {filteredLogs.length === 0 && (
          <div className="text-center py-12 text-gray-500">No audit logs</div>
        )}
      </div>
    </div>
  );
}