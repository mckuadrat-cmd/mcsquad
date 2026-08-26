import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ChevronLeft, Building2, Users, FileText, Calendar, 
  Activity, MessageSquare, Plus, ExternalLink, 
  Clock, MapPin, Phone, Mail, CheckCircle2, AlertCircle, BookOpen
} from 'lucide-react';
import { useAppData } from '../../context/AppDataContext';
import { supabase, parseDates } from '../../lib/supabase';

const ClientDashboard = () => {
  const { schoolName } = useParams();
  const navigate = useNavigate();
  const { clients, leads } = useAppData();
  const [documents, setDocuments] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Filter PICs for this school
  const schoolPics = useMemo(() => {
    return clients.filter(c => c.school?.toLowerCase() === schoolName?.toLowerCase());
  }, [clients, schoolName]);

  // Filter Leads for this school
  const schoolLeads = useMemo(() => {
    const allLeads = Object.values(leads).flatMap(col => col.items);
    return allLeads.filter(l => (l.schoolName || l.school)?.toLowerCase() === schoolName?.toLowerCase());
  }, [leads, schoolName]);

  // Sync Documents and Reports for this school
  useEffect(() => {
    if (!schoolName) return;

    let docsChannel;
    let reportsChannel;

    const fetchData = async () => {
      try {
        // Query generated_documents
        const { data: docsData, error: docsError } = await supabase
          .from('generated_documents')
          .select('*')
          .eq('client', schoolName);
        if (docsError) throw docsError;

        const parsedDocs = parseDates(docsData || []);
        parsedDocs.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        setDocuments(parsedDocs);
        setLoading(false);

        // Query event_reports
        const { data: repsData, error: repsError } = await supabase
          .from('event_reports')
          .select('*')
          .eq('schoolName', schoolName);
        if (repsError) throw repsError;

        const parsedReps = parseDates(repsData || []);
        parsedReps.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        setReports(parsedReps);

        // Subscribe to generated_documents
        docsChannel = supabase.channel(`public:generated_documents:${schoolName}`)
          .on('postgres_changes', { 
            event: '*', 
            schema: 'public', 
            table: 'generated_documents', 
            filter: `client=eq.${schoolName}` 
          }, (payload) => {
            const parsedNew = parseDates(payload.new);
            if (payload.eventType === 'INSERT') {
              setDocuments(prev => {
                const next = [parsedNew, ...prev];
                return next.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
              });
            } else if (payload.eventType === 'UPDATE') {
              setDocuments(prev => prev.map(item => item.id === parsedNew.id ? parsedNew : item));
            } else if (payload.eventType === 'DELETE') {
              setDocuments(prev => prev.filter(item => item.id !== payload.old.id));
            }
          }).subscribe();

        // Subscribe to event_reports
        reportsChannel = supabase.channel(`public:event_reports:${schoolName}`)
          .on('postgres_changes', { 
            event: '*', 
            schema: 'public', 
            table: 'event_reports', 
            filter: `schoolName=eq.${schoolName}` 
          }, (payload) => {
            const parsedNew = parseDates(payload.new);
            if (payload.eventType === 'INSERT') {
              setReports(prev => {
                const next = [parsedNew, ...prev];
                return next.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
              });
            } else if (payload.eventType === 'UPDATE') {
              setReports(prev => prev.map(item => item.id === parsedNew.id ? parsedNew : item));
            } else if (payload.eventType === 'DELETE') {
              setReports(prev => prev.filter(item => item.id !== payload.old.id));
            }
          }).subscribe();

      } catch (err) {
        console.error("Error fetching client dashboard data in ClientDashboard.jsx:", err);
        setLoading(false);
      }
    };

    fetchData();

    return () => {
      if (docsChannel) docsChannel.unsubscribe();
      if (reportsChannel) reportsChannel.unsubscribe();
    };
  }, [schoolName]);

  const stats = useMemo(() => {
    const totalValue = documents.reduce((sum, doc) => {
      const val = typeof doc.rawValue === 'number' ? doc.rawValue : 0;
      return sum + val;
    }, 0);

    return {
      totalDocs: documents.length,
      totalValue: totalValue,
      totalReports: reports.length,
      activeLead: schoolLeads.find(l => l.status !== 'cancel' && l.status !== 'buyer')?.status || 'None'
    };
  }, [documents, reports, schoolLeads]);

  const schoolId = schoolPics.length > 0 ? schoolPics[0].schoolId : '';

  if (!schoolName) return <div>School not found</div>;

  return (
    <div style={{ paddingBottom: '40px' }}>
      {/* Header & Back Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: isMobile ? 'wrap' : 'nowrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button 
            onClick={() => navigate(-1)}
            style={{ 
              width: '40px', height: '40px', borderRadius: '12px', border: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', backgroundColor: 'white'
            }}
          >
            <ChevronLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold" style={{ margin: 0, fontSize: isMobile ? '20px' : '24px' }}>Client Dashboard</h1>
            <p className="text-sm text-secondary">Overview & riwayat aktivitas client</p>
          </div>
        </div>
        
        {/* School ID & Name at Top Right */}
        <div style={{ textAlign: isMobile ? 'left' : 'right', width: isMobile ? '100%' : 'auto', paddingLeft: isMobile ? '56px' : '0' }}>
          <p style={{ margin: 0, fontSize: isMobile ? '16px' : '18px', fontWeight: 'bold', color: 'var(--text-primary)' }}>
            <span style={{ color: 'var(--primary)', marginRight: '8px' }}>{schoolId}</span>
            {schoolName}
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr', gap: '24px' }}>
        
        {/* Left Column: Stats & Timeline */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Quick Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: '16px' }}>
            {[
              { label: 'Total Kerjasama', value: `Rp ${stats.totalValue.toLocaleString('id-ID')}`, icon: <Building2 size={20} />, color: 'var(--primary)' },
              { label: 'Total Dokumen', value: stats.totalDocs, icon: <FileText size={20} />, color: '#4680FF' },
              { label: 'Laporan Event', value: stats.totalReports, icon: <Activity size={20} />, color: '#2ED47A' },
              { label: 'Status CRM', value: stats.activeLead.toUpperCase(), icon: <Activity size={20} />, color: '#FFB020' }
            ].map((stat, i) => (
              <div key={i} className="card" style={{ padding: '20px' }}>
                <div style={{ color: stat.color, marginBottom: '12px', opacity: 0.8 }}>{stat.icon}</div>
                <p className="text-sm text-secondary font-semibold uppercase tracking-wider" style={{ marginBottom: '4px', fontSize: isMobile ? '10px' : '12px' }}>{stat.label}</p>
                <p className="text-lg font-bold" style={{ margin: 0, fontSize: isMobile ? '14px' : '18px' }}>{stat.value}</p>
              </div>
            ))}
          </div>

          {/* Activity Timeline */}
          <div className="card" style={{ padding: '24px' }}>
            <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
              <Clock size={20} /> Riwayat Aktivitas & Event
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {documents.length === 0 && reports.length === 0 ? (
                <p className="text-center text-secondary py-10">Belum ada riwayat aktivitas untuk sekolah ini.</p>
              ) : (
                [...documents.map(d => ({ ...d, timelineType: 'doc' })), ...reports.map(r => ({ ...r, timelineType: 'report' }))]
                  .sort((a, b) => new Date(b.date || b.createdAt?.toDate()) - new Date(a.date || a.createdAt?.toDate()))
                  .map((item, i) => (
                    <div key={i} style={{ display: 'flex', gap: '16px' }}>
                      <div style={{ 
                        flexShrink: 0, width: '40px', height: '40px', borderRadius: '10px', 
                        backgroundColor: item.timelineType === 'doc' ? 'var(--primary-soft)' : '#E5F6EB',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: item.timelineType === 'doc' ? 'var(--primary)' : '#2ED47A'
                      }}>
                        {item.timelineType === 'doc' ? <FileText size={18} /> : <CheckCircle2 size={18} />}
                      </div>
                      <div style={{ flex: 1, borderBottom: '1px solid var(--border)', paddingBottom: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center' }}>
                          <p style={{ fontWeight: 700, margin: 0, fontSize: isMobile ? '14px' : '16px' }}>
                            {item.timelineType === 'doc' ? `${item.type}: ${item.title}` : `Laporan: ${item.programName}`}
                          </p>
                          <span style={{ fontSize: isMobile ? '12px' : '14px', color: 'var(--text-secondary)' }}>
                            {new Date(item.date || item.createdAt?.toDate()).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                          </span>
                        </div>
                        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 0 }}>
                          {item.timelineType === 'doc' ? `Generated by ${item.author || 'System'}` : `Materi: ${item.materials?.join(', ') || '-'}`}
                        </p>
                        {item.timelineType === 'report' && (
                          <div style={{ marginTop: '10px', padding: '12px', backgroundColor: '#F8F9FB', borderRadius: '8px', fontSize: '14px' }}>
                            <strong>Catatan Lapangan:</strong> {item.facts || '-'}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column: PICs & Info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* PIC Directory */}
          <div className="card" style={{ padding: '24px' }}>
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Users size={20} /> Kontak PIC Sekolah
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {schoolPics.length === 0 ? (
                <p className="text-sm text-secondary">Belum ada data PIC.</p>
              ) : (
                schoolPics.map((pic, i) => (
                  <div key={i} style={{ padding: '12px', border: '1px solid var(--border)', borderRadius: '12px' }}>
                    <p style={{ fontWeight: 700, margin: 0, fontSize: '14px' }}>{pic.name}</p>
                    <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '8px' }}>{pic.position}</p>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <a href={`tel:${pic.phone}`} style={{ padding: '4px', color: 'var(--primary)', backgroundColor: 'var(--primary-soft)', borderRadius: '6px' }}><Phone size={14} /></a>
                      <a href={`mailto:${pic.email}`} style={{ padding: '4px', color: 'var(--primary)', backgroundColor: 'var(--primary-soft)', borderRadius: '6px' }}><Mail size={14} /></a>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Delivered Materials Catalog */}
          <div className="card" style={{ padding: '24px' }}>
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <BookOpen size={20} color="var(--primary)" /> Katalog Materi Terlaksana
            </h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {(() => {
                const allMaterials = Array.from(new Set(reports.flatMap(r => r.materials || [])));
                if (allMaterials.length === 0) return <p className="text-sm text-secondary">Belum ada materi tercatat.</p>;
                return allMaterials.map((m, i) => (
                  <span key={i} style={{ 
                    padding: '6px 12px', backgroundColor: 'var(--primary-soft)', 
                    color: 'var(--primary)', borderRadius: '20px', fontSize: '14px', fontWeight: 600
                  }}>
                    {m}
                  </span>
                ));
              })()}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};

export default ClientDashboard;
