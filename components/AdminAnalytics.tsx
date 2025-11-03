'use client';

import { useEffect, useState, useMemo } from 'react';
import { useUser } from '@clerk/nextjs';
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

export default function AdminAnalytics() {
  const { isLoaded } = useUser();
  
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
      if (!hasMounted) return;
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
        const weeks = Array.from(weekMap.entries())
          .map(([week, userSet]) => ({ week, count: userSet.size }))
          .sort((a, b) => a.week.localeCompare(b.week))
          .slice(-4); // Last 4 weeks
        setWeeklyActive(weeks);

        // All users list
        const allUsersSnap = await getDocs(query(usersRef, orderBy('createdAt', 'desc')));
        const users: AdminUserRow[] = [];
        allUsersSnap.forEach((doc) => {
          const data = doc.data();
          users.push({
            id: doc.id,
            username: data.username,
            name: data.name,
            phoneNumber: data.phoneNumber,
            email: data.email,
            createdAt: data.createdAt,
            lastActiveAt: data.lastActiveAt,
          });
        });
        setUsersList(users);
      } catch (err) {
        console.error('Error loading admin data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load analytics');
      } finally {
        setLoading(false);
      }
    };

    if (isLoaded && hasMounted) {
      load();
    }
  }, [isLoaded, hasMounted]);

  const sortedUsers = useMemo(() => {
    const sorted = [...usersList];
    sorted.sort((a, b) => {
      let aVal: number | string;
      let bVal: number | string;
      
      if (sortBy === 'createdAt' || sortBy === 'lastActiveAt') {
        aVal = a[sortBy]?.toMillis() || 0;
        bVal = b[sortBy]?.toMillis() || 0;
      } else {
        aVal = a[sortBy] || '';
        bVal = b[sortBy] || '';
      }
      
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [usersList, sortBy, sortDir]);

  const handleSort = (column: keyof AdminUserRow | 'createdAt' | 'lastActiveAt') => {
    if (sortBy === column) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortDir('desc');
    }
  };

  if (!hasMounted) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Loading analytics...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">Error: {error}</p>
      </div>
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const signupsToday = signups.find(s => s.date === today)?.count || 0;

  return (
    <div className="space-y-8">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500 mb-1">Total Users</div>
          <div className="text-2xl font-semibold text-gray-900">{totalUsers.toLocaleString()}</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500 mb-1">Daily Active</div>
          <div className="text-2xl font-semibold text-gray-900">{dau.toLocaleString()}</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500 mb-1">Weekly Active</div>
          <div className="text-2xl font-semibold text-gray-900">{wau.toLocaleString()}</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500 mb-1">Signups Today</div>
          <div className="text-2xl font-semibold text-gray-900">{signupsToday}</div>
        </div>
      </div>

      {/* Charts */}
      <div className="space-y-6">
        {/* Signups Over Time */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Signups Over Time (Last 30 Days)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={signups}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} />
              <YAxis />
              <Tooltip labelFormatter={(value) => new Date(value).toLocaleDateString()} />
              <Area type="monotone" dataKey="count" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Daily Active Users */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Daily Active Users (Last 30 Days)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={dauSeries}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} />
              <YAxis />
              <Tooltip labelFormatter={(value) => new Date(value).toLocaleDateString()} />
              <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Weekly Active Users */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Weekly Active Users (Last 4 Weeks)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={weeklyActive}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="week" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">All Users</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th 
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('username')}
                >
                  Username {sortBy === 'username' && (sortDir === 'asc' ? '↑' : '↓')}
                </th>
                <th 
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('name')}
                >
                  Name {sortBy === 'name' && (sortDir === 'asc' ? '↑' : '↓')}
                </th>
                <th 
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('phoneNumber')}
                >
                  Phone {sortBy === 'phoneNumber' && (sortDir === 'asc' ? '↑' : '↓')}
                </th>
                <th 
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('email')}
                >
                  Email {sortBy === 'email' && (sortDir === 'asc' ? '↑' : '↓')}
                </th>
                <th 
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('createdAt')}
                >
                  Signup Date {sortBy === 'createdAt' && (sortDir === 'asc' ? '↑' : '↓')}
                </th>
                <th 
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('lastActiveAt')}
                >
                  Last Active {sortBy === 'lastActiveAt' && (sortDir === 'asc' ? '↑' : '↓')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {sortedUsers.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-900">{user.username || '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">{user.name || '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">{user.phoneNumber || '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">{user.email || '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {user.createdAt ? new Date(user.createdAt.toMillis()).toLocaleDateString() : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {user.lastActiveAt ? new Date(user.lastActiveAt.toMillis()).toLocaleDateString() : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

