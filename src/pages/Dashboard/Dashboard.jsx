import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, ComposedChart, Area
} from 'recharts';
import {
  Wallet, Users, BookOpen, TrendingUp, TrendingDown, Target, Building,
  ListTodo, Calendar, AlertCircle, CheckCircle2, Clock, ChevronDown, Briefcase, ClipboardCheck, FileText
} from 'lucide-react';

import { useAuth } from '../../context/AuthContext';
import { DateRange } from 'react-date-range';
import { format } from 'date-fns';
import 'react-date-range/dist/styles.css';
import 'react-date-range/dist/theme/default.css';
import { useAppData } from '../../context/AppDataContext';

const SafeChart = ({ children, height = 300 }) => {
  const [dimensions, setDimensions] = React.useState({ width: 0, height: 0 });
  const containerRef = React.useRef(null);

  React.useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const { width, height } = entries[0].contentRect;
      setDimensions({ width, height });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} style={{ width: '100%', height: `${height}px`, position: 'relative' }}>
      {dimensions.width > 0 && dimensions.height > 0 && (
        <ResponsiveContainer width={dimensions.width} height={dimensions.height}>
          {children}
        </ResponsiveContainer>
      )}
    </div>
  );
};

const Dashboard = () => {
  const { currentUser, userProfile } = useAuth();
  const { clients, leads, projects, events, calendarEvents, loading } = useAppData();
  const navigate = useNavigate();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [isMounted, setIsMounted] = useState(false);

  React.useEffect(() => {
    setIsMounted(true);
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [dateFilterOpen, setDateFilterOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [activeDateLabel, setActiveDateLabel] = useState('Bulan Ini');

  const [dateRange, setDateRange] = useState([
    {
      startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
      endDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0),
      key: 'selection'
    }
  ]);

  const handleQuickFilter = (type) => {
    const today = new Date();
    let start, end, label;

    if (type === 'today') {
      start = end = today;
      label = 'Hari Ini';
    } else if (type === 'this_month') {
      start = new Date(today.getFullYear(), today.getMonth(), 1);
      end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      label = 'Bulan Ini';
    } else if (type === 'last_month') {
      start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      end = new Date(today.getFullYear(), today.getMonth(), 0);
      label = 'Bulan Lalu';
    } else if (type === 'this_year') {
      start = new Date(today.getFullYear(), 0, 1);
      end = new Date(today.getFullYear(), 11, 31);
      label = 'Tahun Ini';
    }

    setDateRange([{ startDate: start, endDate: end, key: 'selection' }]);
    setActiveDateLabel(label);
    setDateFilterOpen(false);
  };

  const handleCustomDateChange = (item) => {
    const { selection } = item;
    setDateRange([selection]);
    
    // Only close if it's a range (start and end are different)
    if (selection.startDate.getTime() !== selection.endDate.getTime()) {
      setActiveDateLabel(`${format(selection.startDate, 'dd MMM yyyy')} - ${format(selection.endDate, 'dd MMM yyyy')}`);
      setTimeout(() => setDateFilterOpen(false), 300);
    } else {
      setActiveDateLabel(`${format(selection.startDate, 'dd MMM yyyy')} - ${format(selection.endDate, 'dd MMM yyyy')}`);
    }
  };

  const formattedDisplayDate = activeDateLabel;
  const filterRef = React.useRef(null);
  const createRef = React.useRef(null);

  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (filterRef.current && !filterRef.current.contains(event.target)) setDateFilterOpen(false);
      if (createRef.current && !createRef.current.contains(event.target)) setCreateOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const greetingName = userProfile?.nickname || (userProfile?.nickname?.trim() || userProfile?.name)
    ? (userProfile.nickname?.trim() || userProfile.name).split(' ')[0]
    : currentUser?.displayName?.split(' ')[0] || 'User';

  // --- CALCULATE REAL DATA FOR CHARTS --- //

  // Helper to parse price string to number (e.g. "Rp 45.000.000" -> 45000000)
  const parsePrice = (priceStr) => {
    if (!priceStr) return 0;
    if (typeof priceStr === 'number') return priceStr;
    return parseInt(priceStr.replace(/[^0-9]/g, '')) || 0;
  };

  const formatPrice = (val) => {
    return 'Rp' + new Intl.NumberFormat('id-ID').format(val) + ',-';
  };

  const COLORS = ['#FF4B4B', '#FF8A8A', '#2ED47A', '#FFBA08', '#9C27B0'];

  if (loading) {
    return (
      <div style={{
        height: '60vh', width: '100%', display: 'flex', alignItems: 'center',
        justifyContent: 'center', flexDirection: 'column', gap: '16px'
      }}>
        <div className="animate-spin" style={{ width: '36px', height: '36px', border: '3px solid #E5EFFF', borderTopColor: '#4680FF', borderRadius: '50%' }}></div>
        <p style={{ color: '#7A849C', fontSize: '14px', fontWeight: 600 }}>Memuat data dashboard...</p>
      </div>
    );
  }

  // 1. Leads Pipeline Funnel
  const pipelineData = [
    { stage: 'Suspect', count: leads?.suspect?.items?.length || 0 },
    { stage: 'Prospek', count: leads?.prospek?.items?.length || 0 },
    { stage: 'Negotiation', count: leads?.confirm?.items?.length || 0 },
    { stage: 'Deal', count: leads?.deal?.items?.length || 0 },
    { stage: 'Closed Won', count: leads?.buyer?.items?.length || 0 },
  ];

  // 2. KPIS
  const totalActiveClients = (clients || []).filter(c => c.status === 'Active' || c.status === 'COLD' || c.status === 'WARM' || c.status === 'HOT').length;
  const totalLeads = leads ? Object.values(leads).reduce((acc, col) => acc + (col?.items?.length || 0), 0) : 0;
  const totalProjects = (projects || []).filter(p => p.status !== 'Completed').length;
  const dealCount = (leads?.deal?.items?.length || 0) + (leads?.buyer?.items?.length || 0);
  const conversionRate = totalLeads > 0 ? Math.round((dealCount / totalLeads) * 100) : 0;

  // 3. Real Income vs Estimasi
  const realIncomeVal = (leads?.buyer?.items || []).reduce((acc, lead) => acc + parsePrice(lead.price), 0);
  const estimasiPipelineVal = leads ? Object.values(leads).reduce((acc, col) => acc + (col?.items || []).reduce((sum, l) => sum + parsePrice(l.price), 0), 0) : 0;

  // 4. Pie Chart: Revenue per Program (Top 4)
  const programCounts = {};
  [...(leads?.deal?.items || []), ...(leads?.buyer?.items || [])].forEach(item => {
    const prog = item.program || 'Other';
    programCounts[prog] = (programCounts[prog] || 0) + parsePrice(item.price);
  });
  const programData = Object.entries(programCounts).map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value).slice(0, 4);

  // 5. Bar Chart: Revenue per PIC
  const picRevenue = {};
  [...(leads?.deal?.items || []), ...(leads?.buyer?.items || [])].forEach(item => {
    const pic = item.pic || 'Unassigned';
    picRevenue[pic] = (picRevenue[pic] || 0) + parsePrice(item.price) / 1000000;
  });
  const picData = Object.entries(picRevenue).map(([name, revenue]) => ({ name, revenue }))
    .sort((a, b) => b.revenue - a.revenue).slice(0, 5);

  // Mock Trend for display if no historical data yet
  const leadsPerMonth = [
    { month: 'Jan', leads: 0 }, { month: 'Feb', leads: 0 }, { month: 'Mar', leads: 0 },
    { month: 'Apr', leads: totalLeads },
  ];

  const incomeData = [
    { month: 'Mar', estimasi: 0, real: 0 },
    { month: 'Apr', estimasi: estimasiPipelineVal / 1000000, real: realIncomeVal / 1000000 },
  ];

  return (
    <div style={{ width: '100%', overflowX: 'hidden' }}>
      {/* Header Area */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isMobile ? '16px' : '24px', flexWrap: 'wrap', gap: '12px' }}>
        <h1 style={{ fontSize: isMobile ? '24px' : '30px', fontWeight: 700, margin: 0 }}>Dashboard</h1>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', width: isMobile ? '100%' : 'auto', justifyContent: isMobile ? 'flex-end' : 'flex-start' }}>

          {/* Single Date Filter Button */}
          <div style={{ position: 'relative' }} ref={filterRef}>
            <button
              onClick={() => setDateFilterOpen(!dateFilterOpen)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 18px',
                borderRadius: '12px',
                border: '1px solid var(--border)',
                backgroundColor: 'white',
                fontWeight: 600,
                fontSize: '14px',
                color: 'var(--text-primary)',
                boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                cursor: 'pointer'
              }}
              className="hover:border-gray-400"
            >
              <Calendar size={16} color="var(--primary)" />
              <span>{formattedDisplayDate}</span>
              <ChevronDown size={14} style={{ opacity: 0.5 }} />
            </button>

            {dateFilterOpen && (
              <div style={isMobile ? {
                position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                width: 'calc(100vw - 32px)', backgroundColor: 'white', borderRadius: '16px',
                boxShadow: '0 20px 60px rgba(0,0,0,0.25)', zIndex: 1000, overflow: 'hidden',
                maxHeight: '80vh', overflowY: 'auto', border: '1px solid var(--border)'
              } : {
                position: 'absolute', top: '100%', right: 0, marginTop: '8px', backgroundColor: 'white',
                borderRadius: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', border: '1px solid var(--border)',
                zIndex: 100, width: '320px', overflow: 'hidden'
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', padding: '8px' }}>
                  <button onClick={() => handleQuickFilter('today')} className="hover:bg-gray-50" style={{ textAlign: 'left', padding: '10px 16px', borderRadius: '8px', fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>Hari Ini</button>
                  <button onClick={() => handleQuickFilter('this_month')} className="hover:bg-gray-50" style={{ textAlign: 'left', padding: '10px 16px', borderRadius: '8px', fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>Bulan Ini</button>
                  <button onClick={() => handleQuickFilter('last_month')} className="hover:bg-gray-50" style={{ textAlign: 'left', padding: '10px 16px', borderRadius: '8px', fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>Bulan Lalu</button>
                  <button onClick={() => handleQuickFilter('this_year')} className="hover:bg-gray-50" style={{ textAlign: 'left', padding: '10px 16px', borderRadius: '8px', fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>Tahun Ini</button>
                  
                  <div style={{ height: '1px', backgroundColor: 'var(--border)', margin: '8px 0' }}></div>
                  
                  <div style={{ padding: '8px', display: 'flex', justifyContent: 'center' }}>
                    <div style={{ transform: 'scale(0.9)', transformOrigin: 'top center' }}>
                      <DateRange
                        ranges={dateRange}
                        onChange={handleCustomDateChange}
                        months={1}
                        direction="horizontal"
                        rangeColors={['var(--primary)']}
                        showSelectionPreview={true}
                        moveRangeOnFirstSelection={false}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Create New Dropdown */}
          <div style={{ position: 'relative' }} ref={createRef}>
            <button
              onClick={() => setCreateOpen(!createOpen)}
              className="btn btn-primary" style={{ padding: '8px 20px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              + Create New <ChevronDown size={14} />
            </button>
            {createOpen && (
              <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '8px', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', border: '1px solid var(--border)', zIndex: 10, minWidth: '180px', overflow: 'hidden' }}>
                <div onClick={() => navigate('/clients')} style={{ padding: '12px 16px', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 500 }} className="hover:bg-gray-50">
                  <Building size={16} color="var(--primary)" /> New Client
                </div>
                <div onClick={() => navigate('/leads')} style={{ padding: '12px 16px', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 500 }} className="hover:bg-gray-50">
                  <Target size={16} color="#FFBA08" /> New Leads
                </div>
                <div onClick={() => navigate('/projects')} style={{ padding: '12px 16px', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 500 }} className="hover:bg-gray-50">
                  <Briefcase size={16} color="#2ED47A" /> New Project
                </div>
              </div>
            )}
          </div>

        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '24px' }}>

        {/* ROW 1: Greeting & Quick Actions */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.8fr 1fr', gap: '24px' }}>
          <div className="card" style={{ padding: isMobile ? '20px' : '32px', position: 'relative', overflow: 'hidden', minHeight: isMobile ? 'auto' : '260px' }}>
            <h2 style={{ fontSize: isMobile ? '24px' : '32px', fontWeight: 800, marginBottom: '8px', color: 'var(--text-primary)' }}>Hi, {greetingName}!</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: isMobile ? '13px' : '16px' }}>Akses cepat fungsional CRM Anda hari ini.</p>

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)', gap: '12px', maxWidth: '600px' }}>
              <button onClick={() => navigate('/leads')} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', borderRadius: '12px', border: '1px solid var(--border)', backgroundColor: 'white', cursor: 'pointer', fontWeight: 600, color: 'var(--primary)' }} className="hover:bg-red-50">
                <Target size={18} /> Pipeline Leads
              </button>
              <button onClick={() => navigate('/clients')} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', borderRadius: '12px', border: '1px solid var(--border)', backgroundColor: 'white', cursor: 'pointer', fontWeight: 600, color: '#4680FF' }} className="hover:bg-blue-50">
                <Users size={18} /> Data Client
              </button>
              <button onClick={() => navigate('/projects')} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', borderRadius: '12px', border: '1px solid var(--border)', backgroundColor: 'white', cursor: 'pointer', fontWeight: 600, color: '#2ED47A' }} className="hover:bg-green-50">
                <Briefcase size={18} /> Project Tracker
              </button>
              <button onClick={() => navigate('/calendar')} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', borderRadius: '12px', border: '1px solid var(--border)', backgroundColor: 'white', cursor: 'pointer', fontWeight: 600, color: '#FFBA08' }} className="hover:bg-yellow-50">
                <Calendar size={18} /> Kalender Tim
              </button>
              <button onClick={() => navigate('/documents')} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', borderRadius: '12px', border: '1px solid var(--border)', backgroundColor: 'white', cursor: 'pointer', fontWeight: 600, color: '#9C27B0' }} className="hover:bg-purple-50">
                <FileText size={18} /> Sales Docs
              </button>
              <button onClick={() => navigate('/reports/event')} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', borderRadius: '12px', border: '1px solid var(--border)', backgroundColor: 'white', cursor: 'pointer', fontWeight: 600, color: '#FF5252' }} className="hover:bg-red-50">
                <ClipboardCheck size={18} /> Laporan Event
              </button>
            </div>


            {!isMobile && (
              <div style={{ position: 'absolute', right: '40px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                {userProfile?.photo_url || currentUser?.photoURL ? (
                  <div style={{ width: '200px', height: '200px', borderRadius: '50%', backgroundColor: 'white', border: '8px solid white', overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }}>
                    <img src={userProfile?.photo_url || currentUser?.photoURL} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Avatar" />
                  </div>
                ) : (
                  <div style={{
                    width: '200px', height: '200px', borderRadius: '50%', backgroundColor: 'var(--primary-soft)',
                    border: '8px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 20px 40px rgba(0,0,0,0.1)', color: 'var(--primary)', fontSize: '80px', fontWeight: 700
                  }}>
                    {((userProfile?.nickname?.trim() || userProfile?.name)?.charAt(0) || currentUser?.displayName?.charAt(0) || currentUser?.email?.charAt(0) || 'U').toUpperCase()}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Quick Stats side */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="card" style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', background: 'linear-gradient(135deg, var(--primary) 0%, #800000 100%)', color: 'white' }}>
              <p style={{ fontSize: '14px', opacity: 0.8, marginBottom: '8px' }}>Real Income (Lunas)</p>
              <h3 style={{ fontSize: '24px', fontWeight: 700, color: 'white' }}>{formatPrice(realIncomeVal)}</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', marginTop: '8px', color: '#2ED47A' }}>
                <TrendingUp size={14} /> Sinkron Otomatis
              </div>
            </div>
            <div className="card" style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Potensi Pipeline Income</p>
              <h3 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)' }}>{formatPrice(estimasiPipelineVal)}</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', marginTop: '8px', color: '#FFBA08' }}>
                <Target size={14} /> Total Est. Nilai Project
              </div>
            </div>
          </div>
        </div>

        {/* ROW 2: KPI CARDS (Points 7 & 14) */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(5, 1fr)', gap: '16px' }}>
          {[
            { title: 'Total Client Aktif', value: totalActiveClients, icon: <Users size={18} color="var(--primary)" />, bg: 'var(--primary-soft)' },
            { title: 'Total Leads Aktif', value: totalLeads, icon: <Target size={18} color="#FFBA08" />, bg: '#FFF8E1' },
            { title: 'Project Operasional', value: totalProjects, icon: <Briefcase size={18} color="#2ED47A" />, bg: '#E8F5E9' },
            { title: 'Leads Conversion Rate', value: `${conversionRate}%`, icon: <TrendingUp size={18} color="#2196F3" />, bg: '#E3F2FD' },
            { title: 'Task Live', value: projects.reduce((acc, p) => acc + (p.tasks?.length || 0), 0), icon: <AlertCircle size={18} color="#FF5252" />, bg: '#FFEBEE' },
          ].map((kpi, i) => (
            <div key={i} className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: kpi.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{kpi.icon}</div>
              </div>
              <div>
                <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)', fontWeight: 500 }}>{kpi.title}</p>
                <h3 style={{ margin: '4px 0 0', fontSize: '22px', fontWeight: 700 }}>{kpi.value}</h3>
              </div>
            </div>
          ))}
        </div>

        {/* ROW 3: CHARTS & EVENTS */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.5fr 1fr', gap: '24px' }}>

          <div className="card" style={{ padding: '24px', minWidth: 0 }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '20px' }}>Estimasi vs Real Income (Juta Rp)</h3>
            <SafeChart height={300}>
              <ComposedChart data={incomeData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EEE" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 14, fill: '#888' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 14, fill: '#888' }} />
                <RechartsTooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '14px' }} />
                <Area type="monotone" dataKey="estimasi" name="Estimasi" fill="var(--primary-soft)" stroke="none" />
                <Line type="monotone" dataKey="real" name="Real Income" stroke="#2ED47A" strokeWidth={3} dot={{ r: 4 }} />
              </ComposedChart>
            </SafeChart>
          </div>

          <div className="card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>Events & Tasks</h3>
              <span className="text-secondary text-sm">{new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {(() => {
                const todayStr = new Date().toISOString().split('T')[0];
                
                // 1. Get Project Tasks
                const tasks = projects.flatMap(p => 
                  (p.tasks || [])
                    .filter(t => !t.completed)
                    .map(t => ({ 
                      ...t, 
                      school: p.schoolName || p.school, 
                      type: 'task', 
                      assignee: t.assignee,
                      sortDate: p.dueDate || '9999-12-31' 
                    }))
                );

                // 2. Get Calendar Events
                const calItems = calendarEvents
                  .filter(e => {
                    const eventDate = e.start?.split('T')[0];
                    return eventDate >= todayStr; 
                  })
                  .map(e => ({ 
                    ...e, 
                    type: 'calendar', 
                    typeCategory: e.extendedProps?.type,
                    author: e.author || e.extendedProps?.author || 'System',
                    school: e.schoolName || e.location || 'Calendar',
                    sortDate: e.start?.split('T')[0] || '9999-12-31',
                    pic: e.extendedProps?.pic
                  }));
                
                const allItems = [...tasks, ...calItems]
                  .sort((a,b) => a.sortDate.localeCompare(b.sortDate))
                  .slice(0, 5);

                if (allItems.length === 0) return <p style={{ fontSize: '14px', color: 'var(--text-secondary)', textAlign: 'center', padding: '20px' }}>No upcoming items.</p>;

                return allItems.map((item, i) => {
                  const isToday = item.sortDate === todayStr;
                  return (
                    <div key={i} style={{ 
                      display: 'flex', alignItems: 'flex-start', gap: '16px',
                      padding: isToday ? '12px' : '0',
                      backgroundColor: isToday ? '#F8F9FB' : 'transparent',
                      borderRadius: '12px',
                      border: isToday ? '1px solid var(--border)' : 'none'
                    }}>
                      <div style={{ 
                        marginTop: '2px', 
                        backgroundColor: item.type === 'task' ? '#FFF8E1' : (isToday ? 'var(--primary-soft)' : '#E3F2FD'), 
                        padding: '10px', borderRadius: '10px' 
                      }}>
                        {item.type === 'task' ? <ListTodo size={16} color="#FFBA08" /> : <Calendar size={16} color={isToday ? 'var(--primary)' : '#2196F3'} />}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <p style={{ margin: 0, fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)' }}>{item.title}</p>
                            <p style={{ margin: '4px 0 0', fontSize: '14px', color: 'var(--text-secondary)' }}>
                              {item.school} 
                              {item.type === 'calendar' ? (
                                <span style={{ marginLeft: '8px', opacity: 0.7 }}>
                                  • By: {item.author} {item.pic && `| PIC: ${item.pic}`}
                                </span>
                              ) : (
                                item.assignee && <span style={{ marginLeft: '8px', opacity: 0.7 }}>• PIC: {item.assignee}</span>
                              )}
                            </p>
                          </div>
                          <span style={{ fontSize: '14px', color: isToday ? 'var(--primary)' : 'var(--text-secondary)', fontWeight: 700 }}>
                            {isToday ? 'HARI INI' : new Date(item.sortDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}
                          </span>
                        </div>
                        {isToday && item.type === 'calendar' && item.typeCategory === 'event' && (
                          <button 
                            onClick={() => navigate('/reports/event', { 
                              state: { 
                                eventData: { 
                                  schoolName: item.school, 
                                  program: item.title, 
                                  date: item.sortDate,
                                  pic: item.extendedProps?.pic 
                                } 
                              } 
                            })}
                            style={{ 
                              marginTop: '10px', padding: '6px 12px', borderRadius: '6px', 
                              backgroundColor: 'white', border: '1px solid var(--border)',
                              fontSize: '14px', fontWeight: 700, color: 'var(--primary)',
                              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
                            }}
                          >
                            <ClipboardCheck size={14} /> Buat Laporan
                          </button>
                        )}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>

        </div>

        {/* ROW 4: FUNNEL & CHARTS */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '24px' }}>

          <div className="card" style={{ padding: '24px', minWidth: 0 }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '20px' }}>Leads Pipeline (Funnel)</h3>
            <SafeChart height={250}>
              <BarChart layout="vertical" data={pipelineData} margin={{ top: 0, right: 0, left: 10, bottom: 0 }}>
                <XAxis type="number" hide />
                <YAxis dataKey="stage" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 14, fill: '#555' }} width={80} />
                <RechartsTooltip cursor={{ fill: '#F8F9FB' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                <Bar dataKey="count" fill="var(--primary)" barSize={20} radius={[0, 4, 4, 0]}>
                  {pipelineData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </SafeChart>
          </div>

          <div className="card" style={{ padding: '24px', minWidth: 0 }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '20px' }}>Revenue per Program (%)</h3>
            <SafeChart height={250}>
              <PieChart>
                <Pie data={programData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                  {programData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '14px', paddingTop: '10px' }} />
              </PieChart>
            </SafeChart>
          </div>

          <div className="card" style={{ padding: '24px', minWidth: 0 }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '20px' }}>Revenue per Tim (Juta Rp)</h3>
            <SafeChart height={250}>
              <BarChart data={picData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EEE" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 14, fill: '#888' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 14, fill: '#888' }} />
                <RechartsTooltip cursor={{ fill: '#F8F9FB' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                <Bar dataKey="revenue" fill="#2ED47A" barSize={30} radius={[4, 4, 0, 0]} />
              </BarChart>
            </SafeChart>
          </div>

        </div>

        {/* ROW 5: LIST DATA WIDGETS */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '24px', paddingBottom: '40px' }}>

          <div className="card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Top Client / Sekolah aktif</h3>
              <span onClick={() => navigate('/clients')} style={{ fontSize: '14px', color: 'var(--primary)', cursor: 'pointer', fontWeight: 500 }}>Lihat Semua</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {clients.slice(0, 3).map((c, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '12px', borderBottom: i !== clients.slice(0, 3).length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '8px', backgroundColor: '#F8F9FB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Building size={16} color="var(--primary)" />
                    </div>
                    <div>
                      <p style={{ margin: 0, fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>{c.sekolah || c.school || c.nama || c.name}</p>
                      <p style={{ margin: '2px 0 0', fontSize: '14px', color: 'var(--text-secondary)' }}>Posisi: {c.posisi || c.position}</p>
                    </div>
                  </div>
                  <div style={{ fontWeight: 600, fontSize: '14px', color: '#2ED47A' }}>{c.status}</div>
                </div>
              ))}
              {clients.length === 0 && <p style={{ fontSize: '14px', color: 'var(--text-secondary)', textAlign: 'center' }}>No client data.</p>}
            </div>
          </div>

          <div className="card" style={{ padding: '24px', minWidth: 0 }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '20px' }}>Tren Leads Baru per Bulan</h3>
            <SafeChart height={230}>
              <LineChart data={leadsPerMonth} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EEE" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 14, fill: '#888' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 14, fill: '#888' }} />
                <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                <Line type="monotone" dataKey="leads" name="Total Leads" stroke="var(--primary)" strokeWidth={3} dot={{ r: 4, fill: 'var(--primary)', strokeWidth: 2, stroke: 'white' }} activeDot={{ r: 6 }} />
              </LineChart>
            </SafeChart>
          </div>

          <div className="card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '20px' }}>Activity Timeline (Recent Updates)</h3>
            <div style={{ position: 'relative', paddingLeft: '16px', marginTop: '10px' }}>
              <div style={{ position: 'absolute', left: '4px', top: '4px', bottom: 0, width: '2px', backgroundColor: '#F0F2F5' }}></div>
              {(() => {
                const allItems = [
                  ...Object.values(leads).flatMap(col => col.items.map(i => ({ ...i, type: 'Lead' }))),
                  ...projects.map(p => ({ ...p, type: 'Project' }))
                ].sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0)).slice(0, 3);

                return allItems.map((act, i) => (
                  <div key={i} style={{ position: 'relative', marginBottom: '20px' }}>
                    <div style={{ position: 'absolute', left: '-17px', top: '2px', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: act.type === 'Lead' ? 'var(--primary)' : '#2ED47A', border: '2px solid white' }}></div>
                    <p style={{ margin: 0, fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>
                      {act.type}: {act.schoolName || act.school} - {act.status}
                    </p>
                    <p style={{ margin: '6px 0 0', fontSize: '14px', color: 'var(--text-secondary)' }}>
                      {act.updatedAt ? new Date(act.updatedAt.seconds * 1000).toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' }) : 'Recently'}
                    </p>
                  </div>
                ));
              })()}
              {Object.values(leads).every(c => c.items.length === 0) && projects.length === 0 && (
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', textAlign: 'center' }}>No recent activity.</p>
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};

export default Dashboard;
