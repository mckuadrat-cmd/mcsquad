import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, Filter, Plus, CheckCircle, Clock, Users, PlayCircle, MoreHorizontal, X, Trash2, Edit2, Building2 } from 'lucide-react';
import { invokeApi } from '../../lib/supabase';
import { useAppData } from '../../context/AppDataContext';
import { useNotification } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';
import { logActivity } from '../../utils/activityLogger';

const Projects = () => {
  const { projects, clients, users, uniqueSchools } = useAppData();
  const { currentUser, userProfile } = useAuth();
  const { showAlert } = useNotification();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  // Autocomplete State
  const [showSchoolDropdown, setShowSchoolDropdown] = useState(false);
  const autocompleteRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (autocompleteRef.current && !autocompleteRef.current.contains(event.target)) {
        setShowSchoolDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // form add new project
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [newProject, setNewProject] = useState({ schoolName: '', program: '', dueDate: '' });

  const handleOpenEditProject = (e, project) => {
    e.stopPropagation();
    setEditingProject(project);
    setNewProject({
      schoolName: project.schoolName,
      program: project.program,
      dueDate: project.dueDate || ''
    });
    setIsAddOpen(true);
  };


  const [activeProject, setActiveProject] = useState(null);
  const [newTaskInput, setNewTaskInput] = useState('');
  const [newTaskAssignee, setNewTaskAssignee] = useState('');

  const filteredSchoolSuggestions = uniqueSchools.filter(s =>
    s.name.toLowerCase().includes((newProject.schoolName || '').toLowerCase())
  );

  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      const matchesSearch = (p.schoolName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.program || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'All' || p.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [projects, searchQuery, statusFilter]);


  // Derived progress calculator
  const calculateProgress = (tasks) => {
    if (!tasks || tasks.length === 0) return 0;
    const completed = tasks.filter(t => t.completed).length;
    return Math.round((completed / tasks.length) * 100);
  };

  const getStatusStyle = (status) => {
    switch (status) {
      case 'Preparation': return { bg: '#E5EFFF', color: '#4680FF', icon: <Clock size={14} /> };
      case 'Ongoing': return { bg: '#FFF4E5', color: '#FFB020', icon: <PlayCircle size={14} /> };
      case 'Completed': return { bg: '#E5F6EB', color: '#2ED47A', icon: <CheckCircle size={14} /> };
      default: return { bg: '#F4F6F9', color: '#7A849C', icon: <Clock size={14} /> };
    }
  };

  const handleTaskToggle = async (projectId, taskId) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    const updatedTasks = project.tasks.map(t => t.id === taskId ? { ...t, completed: !t.completed } : t);
    const prog = calculateProgress(updatedTasks);

    let newStatus = project.status;
    if (prog === 100) newStatus = 'Completed';
    else if (prog > 0 && prog < 100) newStatus = 'Ongoing';
    else newStatus = 'Preparation';

    try {
      await invokeApi(`/projects?id=eq.${projectId}`, {
        method: 'PUT',
        body: {
          tasks: updatedTasks,
          status: newStatus,
          updatedAt: new Date().toISOString()
        }
      });

      // Auto Log Progress
      logActivity(currentUser, `Update progres project ${project.program || project.title} (${calculateProgress(updatedTasks)}%)`, projectId, 'Project', 'Project');

      if (activeProject && activeProject.id === projectId) {
        setActiveProject({ ...project, tasks: updatedTasks, status: newStatus });
      }
    } catch (err) {
      console.error("Task toggle error:", err);
      showAlert("Kesalahan", "Gagal update task: " + err.message, "error");
    }
  };

  const handleAddTask = async (e) => {
    e.preventDefault();
    if (!newTaskInput.trim() || !activeProject) return;

    const t = {
      id: `t-${Date.now()}`,
      title: newTaskInput,
      completed: false,
      assignee: newTaskAssignee || 'Unassigned'
    };

    const updatedTasks = [...activeProject.tasks, t];
    const newStatus = calculateProgress(updatedTasks) === 100 ? 'Completed' : 'Ongoing';

    try {
      await invokeApi(`/projects?id=eq.${activeProject.id}`, {
        method: 'PUT',
        body: {
          tasks: updatedTasks,
          status: newStatus,
          updatedAt: new Date().toISOString()
        }
      });

      const updatedProject = { ...activeProject, tasks: updatedTasks, status: newStatus };
      setActiveProject(updatedProject);
      setNewTaskInput('');
      setNewTaskAssignee('');
    } catch (err) {
      console.error("Add task error:", err);
      showAlert("Kesalahan", "Gagal menambah task: " + err.message, "error");
    }
  };

  const handleAddProject = async (e) => {
    e.preventDefault();
    const matched = uniqueSchools.find(s => s.name.toLowerCase() === newProject.schoolName.trim().toLowerCase());
    const finalSchoolId = matched ? matched.id : `S-${Math.floor(Math.random() * 9000) + 1000}`;

    if (editingProject) {
      try {
        await invokeApi(`/projects?id=eq.${editingProject.id}`, {
          method: 'PUT',
          body: {
            schoolName: newProject.schoolName,
            schoolId: finalSchoolId,
            program: newProject.program,
            dueDate: newProject.dueDate,
            updatedAt: new Date().toISOString()
          }
        });
        setIsAddOpen(false);
        setEditingProject(null);
        setNewProject({ schoolName: '', program: '', dueDate: '' });
        showAlert("Berhasil", "Project telah diperbarui.", "success");
        return;
      } catch (err) {
        console.error("Update project error:", err);
        return showAlert("Kesalahan", "Gagal memperbarui project: " + err.message, "error");
      }
    }

    const newId = `PRJ-${Math.floor(Math.random() * 9000) + 1000}`;


    const np = {
      id: newId,
      schoolId: finalSchoolId,
      schoolName: newProject.schoolName,
      program: newProject.program,
      status: 'Preparation',
      startDate: new Date().toISOString().split('T')[0],
      dueDate: newProject.dueDate,
      team: [],
      tasks: [],
      createdBy: currentUser.uid,
      creatorName: (userProfile?.nickname?.trim() || userProfile?.name) || currentUser.displayName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    try {
      await invokeApi('/projects', { method: 'PUT', body: np });

      // Auto Log Add Project
      logActivity(currentUser, `Menambah Project Baru: ${np.schoolName} - ${np.program}`, newId, 'Project', 'Project');

      setIsAddOpen(false);
      setNewProject({ schoolName: '', program: '', dueDate: '' });
      showAlert("Berhasil", "Project baru telah dibuat.", "success");
    } catch (err) {
      console.error("Add project error:", err);
      showAlert("Kesalahan", "Gagal membuat project: " + err.message, "error");
    }
  };

  const handleDeleteProject = async (e, projectId, schoolName) => {
    e.stopPropagation(); // Prevents opening the drawer
    if (!window.confirm(`Yakin ingin menghapus project ${schoolName}? Data task akan ikut terhapus.`)) return;

    try {
      await invokeApi(`/projects?id=eq.${projectId}`, { method: 'DELETE' });

      // Auto Log Delete Project
      logActivity(currentUser, `Menghapus Project: ${schoolName}`, projectId, 'Project', 'Project');

      showAlert("Berhasil", "Project telah dihapus.", "success");
      if (activeProject && activeProject.id === projectId) setActiveProject(null);
    } catch (err) {
      console.error("Delete project error:", err);
      showAlert("Kesalahan", "Gagal menghapus project: " + err.message, "error");
    }
  };

  return (
    <div style={{ position: 'relative', height: '100%', paddingBottom: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', marginBottom: '24px', flexDirection: isMobile ? 'column' : 'row', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: isMobile ? '24px' : '30px', fontWeight: 700, margin: '0 0 4px' }}>Project Operation Tracker</h1>
          <p className="text-secondary text-sm">Mengatur project yang sedang dikerjakan</p>
        </div>
        <button onClick={() => setIsAddOpen(true)} className="btn btn-primary" style={{ borderRadius: '12px', width: isMobile ? '100%' : 'auto', justifyContent: 'center' }}>
          <Plus size={18} /> New Project
        </button>
      </div>

      {/* Utilities */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexDirection: isMobile ? 'column' : 'row' }}>
        <div style={{ position: 'relative', width: isMobile ? '100%' : '320px' }}>
          <Search size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
          <input
            type="text"
            placeholder="Search by client or program..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ borderRadius: '12px', padding: '12px 16px 12px 44px', backgroundColor: 'var(--surface)', border: '1px solid var(--border)', width: '100%' }}
          />
        </div>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: isMobile ? '100%' : 'auto' }}>
          <Filter size={18} style={{ position: 'absolute', left: '12px', color: 'var(--text-secondary)', pointerEvents: 'none' }} />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="btn btn-outline"
            style={{ borderRadius: '12px', padding: '12px 16px 12px 40px', borderColor: 'var(--border)', backgroundColor: 'var(--surface)', cursor: 'pointer', outline: 'none', width: '100%', appearance: 'none' }}
          >
            <option value="All">Semua Status</option>
            <option value="Preparation">Preparation</option>
            <option value="Ongoing">Ongoing</option>
            <option value="Completed">Completed</option>
          </select>
        </div>
      </div>

      {/* Projects Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
        {filteredProjects.map(proj => {
          const progress = calculateProgress(proj.tasks);
          const statStyle = getStatusStyle(proj.status);

          return (
            <div
              key={proj.id}
              className="card"
              style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', transition: 'all 0.2s', border: '1px solid transparent' }}
              onClick={() => setActiveProject(proj)}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--primary-soft)'; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.08)' }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.02)' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', gap: '8px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={{ fontSize: isMobile ? '16px' : '18px', fontWeight: 700, color: 'var(--primary)', lineHeight: '1.4' }} className="text-truncate" title={proj.program}>
                    {proj.program}
                  </h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                    <Building2 size={13} style={{ color: 'var(--text-secondary)' }} />
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }} className="text-truncate">
                      {proj.schoolName || 'Internal Project'}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    backgroundColor: statStyle.bg, color: statStyle.color,
                    padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 700,
                    whiteSpace: 'nowrap'
                  }}>
                    {statStyle.icon}
                    {proj.status}
                  </div>
                  {(currentUser.uid === proj.createdBy || userProfile?.role === 'owner' || userProfile?.role === 'admin') && (
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        onClick={(e) => handleOpenEditProject(e, proj)}
                        style={{ border: 'none', backgroundColor: 'transparent', color: '#FFB020', padding: '8px', display: 'flex', cursor: 'pointer', opacity: 0.9 }}
                        className="hover:opacity-100"
                        title="Edit Project"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={(e) => handleDeleteProject(e, proj.id, proj.schoolName)}
                        style={{ border: 'none', backgroundColor: 'transparent', color: '#FF5252', padding: '8px', display: 'flex', cursor: 'pointer', opacity: 0.9 }}
                        className="hover:opacity-100"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </div>
              </div>



              {/* Progress Milestones */}
              <div style={{ marginBottom: '16px', marginTop: 'auto' }}>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Fulfillment Progress</span>
                  <span style={{ color: progress === 100 ? '#2ED47A' : 'var(--text-primary)' }}>{progress}%</span>
                </div>
                <div style={{ width: '100%', height: '6px', backgroundColor: '#F4F6F9', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: `${progress}%`, height: '100%', backgroundColor: progress === 100 ? '#2ED47A' : 'var(--primary)', transition: 'width 0.4s ease' }} />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', color: 'var(--text-secondary)' }}>
                  <Clock size={14} />
                  Deadline: <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{new Date(proj.dueDate).toLocaleDateString('en-GB')}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  {proj.team.length > 0 ? proj.team.slice(0, 3).map((member, i) => (
                    <div key={i} style={{
                      width: '24px', height: '24px', borderRadius: '50%', backgroundColor: `hsl(${i * 60 + 200}, 70%, 90%)`,
                      color: `hsl(${i * 60 + 200}, 70%, 30%)`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '14px', fontWeight: 'bold', marginLeft: i > 0 ? '-8px' : '0', border: '2px solid white'
                    }}>
                      {member.charAt(0)}
                    </div>
                  )) : (
                    <div style={{
                      padding: '2px 10px', backgroundColor: 'var(--primary-soft)',
                      color: 'var(--primary)', borderRadius: '12px',
                      fontSize: '12px', fontWeight: 600,
                      maxWidth: '80px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                    }} title={proj.creatorName || 'Account'}>
                      {proj.creatorName || 'Account'}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
        {filteredProjects.length === 0 && (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
            No operational projects match your search.
          </div>
        )}
      </div>

      {/* Task Drawer / Detail Project */}
      {activeProject && (
        <>
          <div
            onClick={() => setActiveProject(null)}
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 100 }}
          />
          <div style={{
            position: 'fixed', top: 0, right: 0, width: isMobile ? '100%' : '500px', height: '100vh',
            backgroundColor: 'var(--surface)', boxShadow: '-12px 0 32px rgba(0,0,0,0.1)', zIndex: 101,
            display: 'flex', flexDirection: 'column'
          }}>
            {/* Header Drawer */}
            <div style={{ padding: '24px', borderBottom: '1px solid var(--border)', backgroundColor: 'var(--bg)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--primary)', letterSpacing: '1px' }}>{activeProject.id}</span>
                  <h2 style={{ fontSize: '22px', fontWeight: 600, marginTop: '4px', lineHeight: '1.3' }}>{activeProject.schoolName}</h2>
                  <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '4px' }}>{activeProject.program}</p>
                </div>
                <button onClick={() => setActiveProject(null)} style={{ color: 'var(--text-secondary)', padding: '4px' }} className="hover:bg-gray-100 rounded-full transition-colors"><X size={24} /></button>
              </div>

              <div style={{ marginTop: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Overall Progress</span>
                  <span style={{ color: calculateProgress(activeProject.tasks) === 100 ? '#2ED47A' : 'var(--text-primary)' }}>{calculateProgress(activeProject.tasks)}%</span>
                </div>
                <div style={{ width: '100%', height: '8px', backgroundColor: '#E9ECEF', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${calculateProgress(activeProject.tasks)}%`, height: '100%', backgroundColor: calculateProgress(activeProject.tasks) === 100 ? '#2ED47A' : 'var(--primary)', transition: 'width 0.4s ease' }} />
                </div>
              </div>
            </div>

            {/* Body Checklist */}
            <div style={{ flex: 1, padding: '24px', overflowY: 'auto', backgroundColor: '#F8F9FB' }}>
              <h4 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                To-Do Assignments ({activeProject.tasks.length})
              </h4>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {activeProject.tasks.map(task => (
                  <label key={task.id} style={{
                    display: 'flex', alignItems: 'center', gap: '16px', padding: '16px',
                    backgroundColor: 'white', borderRadius: '12px', cursor: 'pointer',
                    border: task.completed ? '1px solid #E5F6EB' : '1px solid var(--border)',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.02)', transition: 'all 0.2s',
                    opacity: task.completed ? 0.7 : 1
                  }} className="hover:border-primary">
                    <input
                      type="checkbox"
                      checked={task.completed}
                      onChange={() => handleTaskToggle(activeProject.id, task.id)}
                      style={{ width: '20px', height: '20px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                    />
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontSize: '14px', fontWeight: 500, color: task.completed ? 'var(--text-secondary)' : 'var(--text-primary)', textDecoration: task.completed ? 'line-through' : 'none' }}>
                        {task.title}
                      </p>
                      <p style={{ margin: '4px 0 0', fontSize: '14px', color: 'var(--text-secondary)' }}>Assignee: <strong>{task.assignee}</strong></p>
                    </div>
                  </label>
                ))}

                {activeProject.tasks.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)', border: '1px dashed var(--border)', borderRadius: '12px' }}>Belum ada task. Tambahkan delegasi di bawah.</div>
                )}
              </div>
            </div>

            {/* Footer Add Task Form */}
            <div style={{ padding: '24px', borderTop: '1px solid var(--border)', backgroundColor: 'white' }}>
              <form onSubmit={handleAddTask} style={{ display: 'flex', gap: '12px', flexDirection: 'column' }}>
                <div style={{ display: 'flex', gap: '12px', flexDirection: isMobile ? 'column' : 'row' }}>
                  <input
                    type="text"
                    placeholder="New Task Title (e.g. Cetak Banner)"
                    required
                    value={newTaskInput}
                    onChange={e => setNewTaskInput(e.target.value)}
                    style={{ flex: 2, padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border)', outline: 'none' }}
                  />
                  <select
                    value={newTaskAssignee}
                    onChange={e => setNewTaskAssignee(e.target.value)}
                    style={{ flex: 1, padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border)', outline: 'none', backgroundColor: 'white', fontSize: '14px' }}
                  >
                    <option value="">-- Assign To --</option>
                    {users.map(u => (
                      <option key={u.id} value={u.name || u.displayName}>{u.name || u.displayName}</option>
                    ))}
                  </select>
                </div>
                <button type="submit" className="btn btn-primary" style={{ width: '100%', borderRadius: '8px', display: 'flex', justifyContent: 'center' }}>
                  <Plus size={16} style={{ marginRight: '8px' }} /> Delegasikan Task Ini
                </button>
              </form>
            </div>
          </div>
        </>
      )}

      {/* Add Project Drawer */}
      {isAddOpen && (
        <>
          <div onClick={() => setIsAddOpen(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.3)', zIndex: 100 }} />
          <div style={{
            position: 'fixed', top: 0, right: 0, width: isMobile ? '100%' : '400px', height: '100vh',
            backgroundColor: 'var(--surface)', boxShadow: '-8px 0 24px rgba(0,0,0,0.05)', zIndex: 101,
            display: 'flex', flexDirection: 'column'
          }}>
            <div style={{ padding: '24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 className="text-xl font-semibold">{editingProject ? 'Edit Project' : 'Tambah Project Baru'}</h2>
              <button onClick={() => { setIsAddOpen(false); setEditingProject(null); }} style={{ color: 'var(--text-secondary)' }}><X size={24} /></button>

            </div>
            <div style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>
              <form id="add-proj-form" onSubmit={handleAddProject} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                  <label className="text-sm font-bold mb-2 block">Nama Project <span style={{ color: 'red' }}>*</span></label>
                  <input required type="text" value={newProject.program} placeholder="Misal: Psikotes Luring Batch 2" onChange={e => setNewProject({ ...newProject, program: e.target.value })} className="form-input" />
                </div>

                <div style={{ position: 'relative' }} ref={autocompleteRef}>
                  <label className="text-sm font-bold mb-2 block">Cari Sekolah [Optional]</label>
                  <input
                    type="text"
                    value={newProject.schoolName}
                    onChange={e => {
                      setNewProject({ ...newProject, schoolName: e.target.value });
                      setShowSchoolDropdown(true);
                    }}
                    onFocus={() => setShowSchoolDropdown(true)}
                    placeholder="Ketik nama sekolah..."
                    className="form-input"
                  />
                  {showSchoolDropdown && newProject.schoolName.length > 0 && (
                    <div style={{
                      position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: 'var(--surface)',
                      border: '1px solid var(--border)', borderRadius: '12px', marginTop: '4px', zIndex: 10,
                      maxHeight: '200px', overflowY: 'auto', boxShadow: '0 8px 16px rgba(0,0,0,0.08)'
                    }}>
                      {filteredSchoolSuggestions.length > 0 ? (
                        <>
                          {filteredSchoolSuggestions.map(s => (
                            <div
                              key={s.id}
                              onClick={() => {
                                setNewProject({ ...newProject, schoolName: s.name });
                                setShowSchoolDropdown(false);
                              }}
                              style={{ padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
                              className="hover:bg-primary-soft transition-colors"
                            >
                              <p style={{ margin: 0, fontWeight: 500, fontSize: '14px' }}>
                                {s.name}
                              </p>
                            </div>
                          ))}
                        </>
                      ) : (
                        <div style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontSize: '14px' }}>
                          Sekolah baru akan dibuat otomatis.
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-sm font-bold mb-2 block">Project Deadline <span style={{ color: 'red' }}>*</span></label>
                  <input required type="date" value={newProject.dueDate} onChange={e => setNewProject({ ...newProject, dueDate: e.target.value })} className="form-input" />
                </div>

              </form>
            </div>
            <div style={{ padding: '24px', borderTop: '1px solid var(--border)', display: 'flex', gap: '12px' }}>
              <button onClick={() => { setIsAddOpen(false); setEditingProject(null); }} className="btn btn-outline" style={{ flex: 1 }}>Batal</button>
              <button type="submit" form="add-proj-form" className="btn btn-primary" style={{ flex: 1 }}>{editingProject ? 'Simpan Perubahan' : 'Tambah Project'}</button>

            </div>
          </div>
        </>
      )}

    </div>
  );
};

export default Projects;
