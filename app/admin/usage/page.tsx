'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { isAdminEmail, isAdminFromEmails } from '@/lib/admin';
import { db } from '@/lib/firebase';
import { collection, getDocs, getCountFromServer, query, where, Timestamp, orderBy } from 'firebase/firestore';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  AreaChart,
  Area,
} from 'recharts';
import { useAuthStore } from '@/lib/store';

interface DailySignupPoint {
  date: string; // YYYY-MM-DD
  count: number;
}

interface AdminUserRow {
  id: string;
  username?: string;
  name?: string;
  phoneNumber?: string;
  email?: string;
  createdAt?: Timestamp;
  lastActiveAt?: Timestamp;
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

export default function UsageDashboardPage() {
  const { user, isLoaded } = useUser();
  const { userProfile } = useAuthStore();
  const clerkPrimary = user?.primaryEmailAddress?.emailAddress || null;
  const clerkAll = user?.emailAddresses?.map(e => e.emailAddress) || [];
  const profileEmail = userProfile?.email || null;
  const isAdmin = isAdminEmail(clerkPrimary) || isAdminFromEmails([...clerkAll, profileEmail]);

  // Avoid SSR/client hydration mismatch by rendering a stable loading state
  const [hasMounted, setHasMounted] = useState(false);
  useEffect(() => { setHasMounted(true); }, []);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [totalUsers, setTotalUsers] = useState<number>(0);
  const [dau, setDau] = useState<number>(0);
  const [wau, setWau] = useState<number>(0);
  const [signups, setSignups] = useState<DailySignupPoint[]>([]);
  const [dauSeries, setDauSeries] = useState<DailySignupPoint[]>([]);
  const [weeklyActive, setWeeklyActive] = useState<Array<{ week: string; count: number }>>([]);
  const [usersList, setUsersList] = useState<AdminUserRow[]>([]);
  const [sortBy, setSortBy] = useState<keyof AdminUserRow | 'createdAt' | 'lastActiveAt'>('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    const load = async () => {
      if (!isAdmin) return;
      setLoading(true);
      setError(null);
      try {
        // Total users (count aggregation)
        const usersRef = collection(db, 'users');
        const totalSnap = await getCountFromServer(usersRef as unknown as ReturnType<typeof query>);
        setTotalUsers(totalSnap.data().count);

        // DAU: users with lastActiveAt >= start of today
        const today = startOfDay(new Date());
        const dauQ = query(usersRef, where('lastActiveAt', '>=', Timestamp.fromDate(today)));
        const dauCount = await getCountFromServer(dauQ);
        setDau(dauCount.data().count);

        // WAU: users with lastActiveAt >= 7 days ago
        const weekAgo = daysAgo(7);
        const wauQ = query(usersRef, where('lastActiveAt', '>=', Timestamp.fromDate(weekAgo)));
        const wauCount = await getCountFromServer(wauQ);
        setWau(wauCount.data().count);

        // Signups over last 30 days
        const since = daysAgo(30);
        const signupsQ = query(usersRef, where('createdAt', '>=', Timestamp.fromDate(since)), orderBy('createdAt', 'asc'));
        const signupsSnap = await getDocs(signupsQ);
        const byDay = new Map<string, number>();
        signupsSnap.forEach((doc) => {
          const createdAt = (doc.data().createdAt as Timestamp).toDate();
          const key = createdAt.toISOString().slice(0, 10);
          byDay.set(key, (byDay.get(key) || 0) + 1);
        });
        // Fill missing days with 0
        const points: DailySignupPoint[] = [];
        for (let i = 30; i >= 0; i--) {
          const d = daysAgo(i);
          const key = d.toISOString().slice(0, 10);
          points.push({ date: key, count: byDay.get(key) || 0 });
        }
        setSignups(points);

        // DAU series over last 30 days (group users by lastActiveAt day)
        const activeQ = query(usersRef, where('lastActiveAt', '>=', Timestamp.fromDate(since)), orderBy('lastActiveAt', 'asc'));
        const activeSnap = await getDocs(activeQ);
        const byActiveDay = new Map<string, Set<string>>();
        activeSnap.forEach((doc) => {
          const la = doc.data().lastActiveAt as Timestamp | undefined;
          if (!la) return;
          const key = la.toDate().toISOString().slice(0, 10);
          if (!byActiveDay.has(key)) byActiveDay.set(key, new Set());
          byActiveDay.get(key)!.add(doc.id); // unique users
        });
        const dauPts: DailySignupPoint[] = [];
        for (let i = 30; i >= 0; i--) {
          const d = daysAgo(i).toISOString().slice(0, 10);
          dauPts.push({ date: d, count: (byActiveDay.get(d)?.size) || 0 });
        }
        setDauSeries(dauPts);

        // Weekly active (group by ISO week)
        const weekMap = new Map<string, Set<string>>();
        activeSnap.forEach((doc) => {
          const la = doc.data().lastActiveAt as Timestamp | undefined;
          if (!la) return;
          const d = la.toDate();
          // ISO week key: YYYY-Www
          const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
          // Thursday in current week determines the year
          t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
          const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
          const weekNo = Math.ceil((((t.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
          const key = `${t.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
          if (!weekMap.has(key)) weekMap.set(key, new Set());
          weekMap.get(key)!.add(doc.id);
        });
        const weekKeys = Array.from(weekMap.keys()).sort();
        const weekly = weekKeys.map((k) => ({ week: k, count: weekMap.get(k)!.size }));
        setWeeklyActive(weekly.slice(-4));

        // Load users list for table
        const usersSnap = await getDocs(usersRef);
        const rows: AdminUserRow[] = [];
        usersSnap.forEach((doc) => {
          const data = doc.data() as Record<string, unknown>;
          rows.push({
            id: doc.id,
            username: (data.username as string) || undefined,
            name: (data.name as string) || undefined,
            phoneNumber: (data.phoneNumber as string) || undefined,
            email: (data.email as string) || undefined,
            createdAt: data.createdAt as Timestamp | undefined,
            lastActiveAt: data.lastActiveAt as Timestamp | undefined,
          });
        });
        setUsersList(rows);
      } catch (e) {
        console.error('Admin metrics load failed:', e);
        setError('Failed to load metrics');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [isAdmin]);

  const sortedUsers = (() => {
    const arr = [...usersList];
    const dir = sortDir === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      const getVal = (u: AdminUserRow) => {
        if (sortBy === 'createdAt' || sortBy === 'lastActiveAt') {
          const ts = u[sortBy] as Timestamp | undefined;
          return ts ? ts.toMillis() : 0;
        }
        const v = (u[sortBy] as string | undefined) || '';
        return v.toLowerCase();
      };
      const va = getVal(a);
      const vb = getVal(b);
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
      return String(va).localeCompare(String(vb)) * dir;
    });
    return arr;
  })();

  const toggleSort = (field: keyof AdminUserRow | 'createdAt' | 'lastActiveAt') => {
    if (sortBy === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDir('desc');
    }
  };

  const formatTs = (ts?: Timestamp) => {
    if (!ts) return '-';
    try {
      return ts.toDate().toLocaleString();
    } catch {
      return '-';
    }
  };

  if (!hasMounted || !isLoaded) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold text-gray-900">Loading…</h1>
        <p className="text-gray-600">Preparing dashboard…</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold text-gray-900">Not Found</h1>
        <p className="text-gray-600">This page does not exist.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Usage Dashboard</h1>
      {loading ? (
        <div className="text-gray-600">Loading metrics…</div>
      ) : error ? (
        <div className="text-red-600">{error}</div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 border rounded-lg">
              <div className="text-sm text-gray-500">Total Users</div>
              <div className="text-2xl font-semibold">{totalUsers}</div>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="text-sm text-gray-500">DAU (Today)</div>
              <div className="text-2xl font-semibold">{dau}</div>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="text-sm text-gray-500">WAU (7 days)</div>
              <div className="text-2xl font-semibold">{wau}</div>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="text-sm text-gray-500">Signups (30 days)</div>
              <div className="text-2xl font-semibold">{signups.reduce((a, b) => a + b.count, 0)}</div>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="p-4 border rounded-lg">
              <div className="text-sm font-medium text-gray-900 mb-2">Signups (last 30 days)</div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={signups} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                    <defs>
                      <linearGradient id="colorSignups" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={4} />
                    <YAxis allowDecimals={false} width={36} />
                    <Tooltip />
                    <Area type="monotone" dataKey="count" stroke="#3b82f6" fillOpacity={1} fill="url(#colorSignups)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="p-4 border rounded-lg">
              <div className="text-sm font-medium text-gray-900 mb-2">Daily Active Users (last 30 days)</div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dauSeries} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={4} />
                    <YAxis allowDecimals={false} width={36} />
                    <Tooltip />
                    <Line type="monotone" dataKey="count" stroke="#10b981" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="p-4 border rounded-lg lg:col-span-2">
              <div className="text-sm font-medium text-gray-900 mb-2">Weekly Active Users</div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weeklyActive} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                    <XAxis dataKey="week" tick={{ fontSize: 10 }} interval={0} angle={-45} textAnchor="end" height={60} />
                    <YAxis allowDecimals={false} width={36} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#8b5cf6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Users Table */}
          <div className="p-4 border rounded-lg">
            <div className="text-sm font-medium text-gray-900 mb-3">All Users</div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-600">
                    <th className="py-2 px-2 cursor-pointer" onClick={() => toggleSort('username')}>Username {sortBy==='username' ? (sortDir==='asc'?'▲':'▼') : ''}</th>
                    <th className="py-2 px-2 cursor-pointer" onClick={() => toggleSort('name')}>Name {sortBy==='name' ? (sortDir==='asc'?'▲':'▼') : ''}</th>
                    <th className="py-2 px-2 cursor-pointer" onClick={() => toggleSort('phoneNumber')}>Phone {sortBy==='phoneNumber' ? (sortDir==='asc'?'▲':'▼') : ''}</th>
                    <th className="py-2 px-2 cursor-pointer" onClick={() => toggleSort('email')}>Email {sortBy==='email' ? (sortDir==='asc'?'▲':'▼') : ''}</th>
                    <th className="py-2 px-2 cursor-pointer" onClick={() => toggleSort('createdAt')}>Signup Date {sortBy==='createdAt' ? (sortDir==='asc'?'▲':'▼') : ''}</th>
                    <th className="py-2 px-2 cursor-pointer" onClick={() => toggleSort('lastActiveAt')}>Last Active {sortBy==='lastActiveAt' ? (sortDir==='asc'?'▲':'▼') : ''}</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedUsers.map((u) => (
                    <tr key={u.id} className="border-t">
                      <td className="py-2 px-2 text-gray-900">{u.username || '-'}</td>
                      <td className="py-2 px-2">{u.name || '-'}</td>
                      <td className="py-2 px-2">{u.phoneNumber || '-'}</td>
                      <td className="py-2 px-2">{u.email || '-'}</td>
                      <td className="py-2 px-2">{formatTs(u.createdAt)}</td>
                      <td className="py-2 px-2">{formatTs(u.lastActiveAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}


