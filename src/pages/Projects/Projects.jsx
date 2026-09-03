import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Search, Filter, Plus, CheckCircle, Clock, Users, PlayCircle, X, Trash2, Edit2,
  Building2, AlertTriangle, Calendar, UserCheck, LayoutGrid, List, CheckSquare, Square
} from 'lucide-react';
import { invokeApi } from '../../lib/supabase';
import { useAppData } from '../../context/AppDataContext';
import { useNotification } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';
import { logActivity } from '../../utils/activityLogger';

const Projects = () => {
  const { projects = [], clients = [], flatLeads = [], users = [], uniqueSchools = [] } = useAppData();
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
  const [myTasksOnly, setMyTasksOnly] = useState(false);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'timeline'

  // Drawer / Add & Edit Project state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);

  // Form State for Project Creation / Editing
  const [projectType, setProjectType] = useState('client'); // 'client' | 'internal'
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedLeadId, setSelectedLeadId] = useState('');
  const [newProject, setNewProject] = useState({
    program: '',
    schoolName: '',
    schoolId: '',
    startDate: new Date().toISOString().split('T')[0],
    dueDate: '',
    status: 'Preparation'
  });
  const [selectedAoId, setSelectedAoId] = useState('');
  const [selectedAoName, setSelectedAoName] = useState('');

  // Default AO to logged-in user when opening Add Project drawer
  useEffect(() => {
    if (isAddOpen && !editingProject && !selectedAoId) {
      const matchUser = users.find(u => u.id === currentUser?.uid || u.uid === currentUser?.uid);
      const aoId = matchUser?.id || matchUser?.uid || currentUser?.uid || '';
      const aoName = matchUser
        ? (matchUser.name || matchUser.displayName || matchUser.nickname)
        : ((userProfile?.nickname?.trim() || userProfile?.name) || currentUser?.displayName || 'AO');
      if (aoId) setSelectedAoId(aoId);
      if (aoName) setSelectedAoName(aoName);
    }
  }, [isAddOpen, editingProject, selectedAoId, users, currentUser, userProfile]);

  // Active Project (Task Drawer) State
  const [activeProject, setActiveProject] = useState(null);

  // Add Task State
  const [newTaskInput, setNewTaskInput] = useState('');
  const [newTaskAssigneeId, setNewTaskAssigneeId] = useState('');
  const [newTaskAssigneeName, setNewTaskAssigneeName] = useState('');
  const [newTaskStartDate, setNewTaskStartDate] = useState('');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');

  // Edit Task State inside Drawer
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editingTaskInput, setEditingTaskInput] = useState('');
  const [editingTaskAssigneeId, setEditingTaskAssigneeId] = useState('');
  const [editingTaskAssigneeName, setEditingTaskAssigneeName] = useState('');
  const [editingTaskStartDate, setEditingTaskStartDate] = useState('');
  const [editingTaskDueDate, setEditingTaskDueDate] = useState('');

  // Autocomplete State for School (fallback if needed)
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

  // Helper: Overdue checker
  const checkIsOverdue = (dueDate, completed) => {
    if (completed || !dueDate) return false;
    const todayStr = new Date().toISOString().split('T')[0];
    const dueStr = typeof dueDate === 'string' ? dueDate.split('T')[0] : '';
    return dueStr ? dueStr < todayStr : false;
  };

  // Helper: Derived progress calculator
  const calculateProgress = (tasks) => {
    if (!tasks || !Array.isArray(tasks) || tasks.length === 0) return 0;
    const completed = tasks.filter(t => t.completed).length;
    return Math.round((completed / tasks.length) * 100);
  };

  // Helper: Auto team computation from AO + Task assignees
  const getProjectTeam = (proj) => {
    const teamSet = new Set();
    const aoName = proj.aoName || proj.ao || proj.creatorName;
    if (aoName) teamSet.add(aoName);

    if (Array.isArray(proj.tasks)) {
      proj.tasks.forEach(t => {
        if (t.assignee && t.assignee !== 'Unassigned') {
          teamSet.add(t.assignee);
        }
      });
    }
    return Array.from(teamSet);
  };

  const getStatusStyle = (status, isOverdue) => {
    if (isOverdue) return { bg: '#FFE5E5', color: '#FF5252', icon: <AlertTriangle size={14} />, label: 'Overdue' };
    switch (status) {
      case 'Preparation': return { bg: '#E5EFFF', color: '#4680FF', icon: <Clock size={14} />, label: 'Preparation' };
      case 'Ongoing': return { bg: '#FFF4E5', color: '#FFB020', icon: <PlayCircle size={14} />, label: 'Ongoing' };
      case 'Completed': return { bg: '#E5F6EB', color: '#2ED47A', icon: <CheckCircle size={14} />, label: 'Completed' };
      default: return { bg: '#F4F6F9', color: '#7A849C', icon: <Clock size={14} />, label: status || 'Preparation' };
    }
  };

  // Available leads filtered by selected client
  const availableLeadsForClient = useMemo(() => {
    if (!selectedClientId) return [];
    const clientObj = clients.find(c => c.id === selectedClientId || c.schoolId === selectedClientId);
    const clientSchoolId = clientObj?.schoolId || selectedClientId;
    const clientSchoolName = (clientObj?.sekolah || clientObj?.school || '').toLowerCase();

    return flatLeads.filter(l => {
      if (l.schoolId && l.schoolId === clientSchoolId) return true;
      if (l.schoolName && clientSchoolName && l.schoolName.toLowerCase() === clientSchoolName) return true;
      return false;
    });
  }, [selectedClientId, flatLeads, clients]);

  // Handle Client selection in Form
  const handleSelectClient = (clientId) => {
    setSelectedClientId(clientId);
    setSelectedLeadId('');

    if (!clientId) {
      setNewProject(prev => ({ ...prev, schoolName: '', schoolId: '' }));
      return;
    }

    const clientObj = clients.find(c => c.id === clientId || c.schoolId === clientId);
    if (clientObj) {
      const schName = clientObj.sekolah || clientObj.school || '';
      const schId = clientObj.schoolId || clientObj.id || '';
      setNewProject(prev => ({ ...prev, schoolName: schName, schoolId: schId }));

      // Auto-set default AO from Client if available
      const clientAo = clientObj.ao || clientObj.pic || '';
      if (clientAo) {
        const matchUser = users.find(u =>
          (u.name && u.name.toLowerCase() === clientAo.toLowerCase()) ||
          (u.displayName && u.displayName.toLowerCase() === clientAo.toLowerCase()) ||
          (u.nickname && u.nickname.toLowerCase() === clientAo.toLowerCase())
        );
        if (matchUser) {
          setSelectedAoId(matchUser.id || matchUser.uid);
          setSelectedAoName(matchUser.name || matchUser.displayName || matchUser.nickname);
        } else {
          setSelectedAoName(clientAo);
        }
      }
    }
  };

  // Handle Lead selection in Form
  const handleSelectLead = (leadId) => {
    setSelectedLeadId(leadId);
    if (!leadId) return;

    const foundLead = flatLeads.find(l => l.id === leadId);
    if (foundLead) {
      const progName = foundLead.program || foundLead.title || foundLead.programName || '';
      setNewProject(prev => ({ ...prev, program: progName }));

      // Auto-fill AO from Lead (picId or pic)
      if (foundLead.picId) {
        const matchUser = users.find(u => u.id === foundLead.picId || u.uid === foundLead.picId);
        if (matchUser) {
          setSelectedAoId(matchUser.id || matchUser.uid);
          setSelectedAoName(matchUser.name || matchUser.displayName || matchUser.nickname);
        } else {
          setSelectedAoId(foundLead.picId);
          setSelectedAoName(foundLead.pic || 'AO');
        }
      } else if (foundLead.pic) {
        const matchUser = users.find(u =>
          (u.name && u.name.toLowerCase() === foundLead.pic.toLowerCase()) ||
          (u.displayName && u.displayName.toLowerCase() === foundLead.pic.toLowerCase()) ||
          (u.nickname && u.nickname.toLowerCase() === foundLead.pic.toLowerCase())
        );
        if (matchUser) {
          setSelectedAoId(matchUser.id || matchUser.uid);
          setSelectedAoName(matchUser.name || matchUser.displayName || matchUser.nickname);
        } else {
          setSelectedAoName(foundLead.pic);
        }
      }
    }
  };

  // Helper: Get logged-in user AO info
  const getCurrentUserAo = () => {
    const matchUser = users.find(u => u.id === currentUser?.uid || u.uid === currentUser?.uid);
    const aoId = matchUser?.id || matchUser?.uid || currentUser?.uid || '';
    const aoName = matchUser
      ? (matchUser.name || matchUser.displayName || matchUser.nickname)
      : ((userProfile?.nickname?.trim() || userProfile?.name) || currentUser?.displayName || 'AO');
    return { aoId, aoName };
  };

  // Open Add Project Modal with default logged-in user as AO
  const handleOpenAddProject = () => {
    setEditingProject(null);
    setProjectType('client');
    setSelectedClientId('');
    setSelectedLeadId('');
    setNewProject({
      program: '',
      schoolName: '',
      schoolId: '',
      startDate: new Date().toISOString().split('T')[0],
      dueDate: '',
      status: 'Preparation'
    });
    const { aoId, aoName } = getCurrentUserAo();
    setSelectedAoId(aoId);
    setSelectedAoName(aoName);
    setIsAddOpen(true);
  };

  // Open Edit Project Modal
  const handleOpenEditProject = (e, project) => {
    e.stopPropagation();
    setEditingProject(project);
    const isInternal = !project.schoolId && (!project.schoolName || project.schoolName === 'Internal Project');
    setProjectType(isInternal ? 'internal' : 'client');
    setSelectedClientId(project.schoolId || project.clientId || '');
    setSelectedLeadId(project.leadId || '');
    setNewProject({
      program: project.program || '',
      schoolName: project.schoolName || '',
      schoolId: project.schoolId || '',
      startDate: project.startDate ? new Date(project.startDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      dueDate: project.dueDate ? new Date(project.dueDate).toISOString().split('T')[0] : '',
      status: project.status || 'Preparation'
    });
    setSelectedAoId(project.aoId || '');
    setSelectedAoName(project.aoName || project.ao || project.creatorName || '');
    setIsAddOpen(true);
  };

  // Reset Add/Edit Form
  const handleCloseProjectDrawer = () => {
    setIsAddOpen(false);
    setEditingProject(null);
    setProjectType('client');
    setSelectedClientId('');
    setSelectedLeadId('');
    setNewProject({
      program: '',
      schoolName: '',
      schoolId: '',
      startDate: new Date().toISOString().split('T')[0],
      dueDate: '',
      status: 'Preparation'
    });
    const { aoId, aoName } = getCurrentUserAo();
    setSelectedAoId(aoId);
    setSelectedAoName(aoName);
  };

  // Save Project (Add / Update)
  const handleSaveProject = async (e) => {
    e.preventDefault();

    let finalSchoolName = newProject.schoolName;
    let finalSchoolId = newProject.schoolId;

    if (projectType === 'internal') {
      finalSchoolName = 'Internal Project';
      finalSchoolId = null;
    }

    const currentAoUser = users.find(u => u.id === selectedAoId || u.uid === selectedAoId);
    const finalAoName = currentAoUser
      ? (currentAoUser.name || currentAoUser.displayName || currentAoUser.nickname)
      : (selectedAoName || userProfile?.nickname || userProfile?.name || currentUser.displayName || 'AO');

    if (editingProject) {
      const updatedProjectPayload = {
        schoolName: finalSchoolName,
        schoolId: finalSchoolId,
        clientId: projectType === 'client' ? (selectedClientId || finalSchoolId) : null,
        leadId: projectType === 'client' ? (selectedLeadId || null) : null,
        program: newProject.program,
        aoId: selectedAoId || null,
        aoName: finalAoName,
        ao: finalAoName,
        startDate: newProject.startDate,
        dueDate: newProject.dueDate,
        status: newProject.status || editingProject.status || 'Preparation',
        team: getProjectTeam({ ...editingProject, aoName: finalAoName }),
        updatedAt: new Date().toISOString()
      };

      try {
        await invokeApi(`/projects?id=eq.${editingProject.id}`, {
          method: 'PUT',
          body: updatedProjectPayload
        });
        handleCloseProjectDrawer();
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
      schoolName: finalSchoolName,
      clientId: projectType === 'client' ? (selectedClientId || finalSchoolId) : null,
      leadId: projectType === 'client' ? (selectedLeadId || null) : null,
      program: newProject.program,
      aoId: selectedAoId || currentUser?.uid || null,
      aoName: finalAoName,
      ao: finalAoName,
      status: 'Preparation',
      startDate: newProject.startDate || new Date().toISOString().split('T')[0],
      dueDate: newProject.dueDate,
      team: [finalAoName],
      tasks: [],
      createdBy: currentUser.uid,
      creatorName: (userProfile?.nickname?.trim() || userProfile?.name) || currentUser.displayName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    try {
      await invokeApi('/projects', { method: 'PUT', body: np });
      logActivity(currentUser, `Menambah Project Baru: ${np.schoolName} - ${np.program}`, newId, 'Project', 'Project');
      handleCloseProjectDrawer();
      showAlert("Berhasil", "Project baru telah dibuat.", "success");
    } catch (err) {
      console.error("Add project error:", err);
      showAlert("Kesalahan", "Gagal membuat project: " + err.message, "error");
    }
  };

  // Delete Project
  const handleDeleteProject = async (e, projectId, schoolName) => {
    e.stopPropagation();
    if (!window.confirm(`Yakin ingin menghapus project ${schoolName}? Data task akan ikut terhapus.`)) return;

    try {
      await invokeApi(`/projects?id=eq.${projectId}`, { method: 'DELETE' });
      logActivity(currentUser, `Menghapus Project: ${schoolName}`, projectId, 'Project', 'Project');
      showAlert("Berhasil", "Project telah dihapus.", "success");
      if (activeProject && activeProject.id === projectId) setActiveProject(null);
    } catch (err) {
      console.error("Delete project error:", err);
      showAlert("Kesalahan", "Gagal menghapus project: " + err.message, "error");
    }
  };

  // Task Toggle
  const handleTaskToggle = async (projectId, taskId) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    const updatedTasks = (project.tasks || []).map(t => t.id === taskId ? { ...t, completed: !t.completed } : t);
    const prog = calculateProgress(updatedTasks);

    let newStatus = project.status;
    if (prog === 100) newStatus = 'Completed';
    else if (prog > 0 && prog < 100) newStatus = 'Ongoing';
    else newStatus = 'Preparation';

    const newTeam = getProjectTeam({ ...project, tasks: updatedTasks });

    try {
      await invokeApi(`/projects?id=eq.${projectId}`, {
        method: 'PUT',
        body: {
          tasks: updatedTasks,
          status: newStatus,
          team: newTeam,
          updatedAt: new Date().toISOString()
        }
      });

      logActivity(currentUser, `Update progres project ${project.program || project.title} (${prog}%)`, projectId, 'Project', 'Project');

      if (activeProject && activeProject.id === projectId) {
        setActiveProject({ ...project, tasks: updatedTasks, status: newStatus, team: newTeam });
      }
    } catch (err) {
      console.error("Task toggle error:", err);
      showAlert("Kesalahan", "Gagal update task: " + err.message, "error");
    }
  };

  // Add Task
  const handleAddTask = async (e) => {
    e.preventDefault();
    if (!newTaskInput.trim() || !activeProject) return;

    const assignedUser = users.find(u => u.id === newTaskAssigneeId || u.uid === newTaskAssigneeId);
    const assigneeName = assignedUser
      ? (assignedUser.name || assignedUser.displayName || assignedUser.nickname)
      : (newTaskAssigneeName || 'Unassigned');

    const newTaskObj = {
      id: `t-${Date.now()}`,
      title: newTaskInput.trim(),
      assigneeId: newTaskAssigneeId || '',
      assignee: assigneeName,
      startDate: newTaskStartDate || activeProject.startDate || new Date().toISOString().split('T')[0],
      dueDate: newTaskDueDate || activeProject.dueDate || '',
      completed: false
    };

    const updatedTasks = [...(activeProject.tasks || []), newTaskObj];
    const prog = calculateProgress(updatedTasks);
    const newStatus = prog === 100 ? 'Completed' : (prog > 0 ? 'Ongoing' : 'Preparation');
    const newTeam = getProjectTeam({ ...activeProject, tasks: updatedTasks });

    try {
      await invokeApi(`/projects?id=eq.${activeProject.id}`, {
        method: 'PUT',
        body: {
          tasks: updatedTasks,
          status: newStatus,
          team: newTeam,
          updatedAt: new Date().toISOString()
        }
      });

      const updatedProject = { ...activeProject, tasks: updatedTasks, status: newStatus, team: newTeam };
      setActiveProject(updatedProject);
      setNewTaskInput('');
      setNewTaskAssigneeId('');
      setNewTaskAssigneeName('');
      setNewTaskStartDate('');
      setNewTaskDueDate('');
    } catch (err) {
      console.error("Add task error:", err);
      showAlert("Kesalahan", "Gagal menambah task: " + err.message, "error");
    }
  };

  // Start Edit Task Mode
  const handleStartEditTask = (task) => {
    setEditingTaskId(task.id);
    setEditingTaskInput(task.title || '');
    setEditingTaskAssigneeId(task.assigneeId || '');
    setEditingTaskAssigneeName(task.assignee || '');
    setEditingTaskStartDate(task.startDate ? new Date(task.startDate).toISOString().split('T')[0] : '');
    setEditingTaskDueDate(task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '');
  };

  // Save Edit Task
  const handleSaveEditTask = async (taskId) => {
    if (!editingTaskInput.trim() || !activeProject) return;

    const assignedUser = users.find(u => u.id === editingTaskAssigneeId || u.uid === editingTaskAssigneeId);
    const assigneeName = assignedUser
      ? (assignedUser.name || assignedUser.displayName || assignedUser.nickname)
      : (editingTaskAssigneeName || 'Unassigned');

    const updatedTasks = (activeProject.tasks || []).map(t => {
      if (t.id === taskId) {
        return {
          ...t,
          title: editingTaskInput.trim(),
          assigneeId: editingTaskAssigneeId || '',
          assignee: assigneeName,
          startDate: editingTaskStartDate || t.startDate || '',
          dueDate: editingTaskDueDate || t.dueDate || ''
        };
      }
      return t;
    });

    const prog = calculateProgress(updatedTasks);
    const newStatus = prog === 100 ? 'Completed' : (prog > 0 ? 'Ongoing' : 'Preparation');
    const newTeam = getProjectTeam({ ...activeProject, tasks: updatedTasks });

    try {
      await invokeApi(`/projects?id=eq.${activeProject.id}`, {
        method: 'PUT',
        body: {
          tasks: updatedTasks,
          status: newStatus,
          team: newTeam,
          updatedAt: new Date().toISOString()
        }
      });

      setActiveProject({ ...activeProject, tasks: updatedTasks, status: newStatus, team: newTeam });
      setEditingTaskId(null);
    } catch (err) {
      console.error("Edit task error:", err);
      showAlert("Kesalahan", "Gagal memperbarui task: " + err.message, "error");
    }
  };

  // Delete Task
  const handleDeleteTask = async (taskId) => {
    if (!activeProject) return;
    if (!window.confirm("Yakin ingin menghapus task ini?")) return;

    const updatedTasks = (activeProject.tasks || []).filter(t => t.id !== taskId);
    const prog = calculateProgress(updatedTasks);
    const newStatus = prog === 100 ? 'Completed' : (prog > 0 ? 'Ongoing' : 'Preparation');
    const newTeam = getProjectTeam({ ...activeProject, tasks: updatedTasks });

    try {
      await invokeApi(`/projects?id=eq.${activeProject.id}`, {
        method: 'PUT',
        body: {
          tasks: updatedTasks,
          status: newStatus,
          team: newTeam,
          updatedAt: new Date().toISOString()
        }
      });

      setActiveProject({ ...activeProject, tasks: updatedTasks, status: newStatus, team: newTeam });
    } catch (err) {
      console.error("Delete task error:", err);
      showAlert("Kesalahan", "Gagal menghapus task: " + err.message, "error");
    }
  };

  // Filtered Projects List
  const filteredProjects = useMemo(() => {
    const myUid = currentUser?.uid;
    const myName = (userProfile?.nickname || userProfile?.name || currentUser?.displayName || '').toLowerCase();

    return projects.filter(p => {
      const isProjectOverdue = checkIsOverdue(p.dueDate, p.status === 'Completed');
      const matchesSearch =
        (p.schoolName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.program || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.aoName || p.ao || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.tasks || []).some(t => (t.title || '').toLowerCase().includes(searchQuery.toLowerCase()));

      let matchesStatus = true;
      if (statusFilter === 'Overdue') {
        matchesStatus = isProjectOverdue;
      } else if (statusFilter !== 'All') {
        matchesStatus = p.status === statusFilter;
      }

      let matchesMyTasks = true;
      if (myTasksOnly) {
        const isAo = p.aoId === myUid || (p.aoName || p.ao || '').toLowerCase() === myName;
        const isTaskAssignee = (p.tasks || []).some(t => t.assigneeId === myUid || (t.assignee || '').toLowerCase() === myName);
        matchesMyTasks = isAo || isTaskAssignee;
      }

      return matchesSearch && matchesStatus && matchesMyTasks;
    });
  }, [projects, searchQuery, statusFilter, myTasksOnly, currentUser, userProfile]);

  return (
    <div style={{ position: 'relative', height: '100%', paddingBottom: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', marginBottom: '24px', flexDirection: isMobile ? 'column' : 'row', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: isMobile ? '24px' : '30px', fontWeight: 700, margin: '0 0 4px' }}>Project Operation Tracker</h1>
          <p className="text-secondary text-sm">Mengatur project, timeline, pembagian tugas, dan monitoring progress</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', width: isMobile ? '100%' : 'auto' }}>
          <button
            onClick={handleOpenAddProject}
            className="btn btn-primary"
            style={{ borderRadius: '12px', width: isMobile ? '100%' : 'auto', justifyContent: 'center' }}
          >
            <Plus size={18} /> New Project
          </button>
        </div>
      </div>

      {/* Utilities & Filters */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexDirection: isMobile ? 'column' : 'row', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', width: isMobile ? '100%' : '280px' }}>
          <Search size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
          <input
            type="text"
            placeholder="Search by client, program, AO, task..."
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
            <option value="Overdue">Overdue / Terlambat</option>
          </select>
        </div>

        {/* My Tasks Toggle */}
        <button
          onClick={() => setMyTasksOnly(!myTasksOnly)}
          className={`btn ${myTasksOnly ? 'btn-primary' : 'btn-outline'}`}
          style={{ borderRadius: '12px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <UserCheck size={16} />
          {myTasksOnly ? 'Proyek/Task Saya' : 'Semua Proyek'}
        </button>

        {/* View Mode Switcher (Grid vs Timeline) */}
        <div style={{ display: 'flex', backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '4px', marginLeft: isMobile ? '0' : 'auto' }}>
          <button
            onClick={() => setViewMode('grid')}
            style={{
              padding: '8px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer',
              backgroundColor: viewMode === 'grid' ? 'var(--primary)' : 'transparent',
              color: viewMode === 'grid' ? 'white' : 'var(--text-secondary)',
              display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600
            }}
          >
            <LayoutGrid size={16} /> Grid View
          </button>
          <button
            onClick={() => setViewMode('timeline')}
            style={{
              padding: '8px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer',
              backgroundColor: viewMode === 'timeline' ? 'var(--primary)' : 'transparent',
              color: viewMode === 'timeline' ? 'white' : 'var(--text-secondary)',
              display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600
            }}
          >
            <List size={16} /> Timeline View
          </button>
        </div>
      </div>

      {/* Grid View */}
      {viewMode === 'grid' && (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
          {filteredProjects.map(proj => {
            const tasksList = proj.tasks || [];
            const progress = calculateProgress(tasksList);
            const isProjectOverdue = checkIsOverdue(proj.dueDate, proj.status === 'Completed');
            const statStyle = getStatusStyle(proj.status, isProjectOverdue);
            const projectTeam = getProjectTeam(proj);
            const aoDisplay = proj.aoName || proj.ao || proj.creatorName || 'Internal';

            return (
              <div
                key={proj.id}
                className="card"
                style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', transition: 'all 0.2s', border: '1px solid transparent' }}
                onClick={() => setActiveProject(proj)}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--primary-soft)'; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.08)' }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.02)' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px', gap: '8px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ fontSize: isMobile ? '16px' : '18px', fontWeight: 700, color: 'var(--primary)', lineHeight: '1.4' }} className="text-truncate" title={proj.program}>
                      {proj.program || 'Tanpa Nama Project'}
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
                      {statStyle.label}
                    </div>

                    {(currentUser.uid === proj.createdBy || userProfile?.role === 'owner' || userProfile?.role === 'admin') && (
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          onClick={(e) => handleOpenEditProject(e, proj)}
                          style={{ border: 'none', backgroundColor: 'transparent', color: '#FFB020', padding: '4px', display: 'flex', cursor: 'pointer', opacity: 0.9 }}
                          className="hover:opacity-100"
                          title="Edit Project"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={(e) => handleDeleteProject(e, proj.id, proj.schoolName || proj.program)}
                          style={{ border: 'none', backgroundColor: 'transparent', color: '#FF5252', padding: '4px', display: 'flex', cursor: 'pointer', opacity: 0.9 }}
                          className="hover:opacity-100"
                          title="Hapus Project"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* AO & Task Count info */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                  <div>AO: <strong style={{ color: 'var(--text-primary)' }}>{aoDisplay}</strong></div>
                  <div>Tasks: <strong style={{ color: 'var(--text-primary)' }}>{tasksList.filter(t => t.completed).length}/{tasksList.length}</strong></div>
                </div>

                {/* Progress Bar */}
                <div style={{ marginBottom: '16px', marginTop: 'auto' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Fulfillment Progress</span>
                    <span style={{ color: progress === 100 ? '#2ED47A' : 'var(--text-primary)' }}>{progress}%</span>
                  </div>
                  <div style={{ width: '100%', height: '6px', backgroundColor: '#F4F6F9', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: `${progress}%`, height: '100%', backgroundColor: progress === 100 ? '#2ED47A' : 'var(--primary)', transition: 'width 0.4s ease' }} />
                  </div>
                </div>

                {/* Footer: Timeline dates & Team */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    <Calendar size={13} />
                    <span>{proj.startDate ? new Date(proj.startDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : '-'}</span>
                    <span>&rarr;</span>
                    <span style={{ fontWeight: 600, color: isProjectOverdue ? '#FF5252' : 'var(--text-primary)' }}>
                      {proj.dueDate ? new Date(proj.dueDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                    </span>
                  </div>

                  {/* Team Avatars */}
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    {projectTeam.length > 0 ? projectTeam.slice(0, 3).map((member, i) => (
                      <div key={i} style={{
                        width: '24px', height: '24px', borderRadius: '50%', backgroundColor: `hsl(${i * 60 + 200}, 70%, 90%)`,
                        color: `hsl(${i * 60 + 200}, 70%, 30%)`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '11px', fontWeight: 'bold', marginLeft: i > 0 ? '-6px' : '0', border: '2px solid white'
                      }} title={member}>
                        {member.charAt(0).toUpperCase()}
                      </div>
                    )) : (
                      <div style={{
                        padding: '2px 8px', backgroundColor: 'var(--primary-soft)',
                        color: 'var(--primary)', borderRadius: '12px',
                        fontSize: '11px', fontWeight: 600
                      }}>
                        {aoDisplay}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {filteredProjects.length === 0 && (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px', color: 'var(--text-secondary)', border: '1px dashed var(--border)', borderRadius: '12px' }}>
              Tidak ada project operasional yang sesuai dengan pencarian/filter.
            </div>
          )}
        </div>
      )}

      {/* Timeline View */}
      {viewMode === 'timeline' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {filteredProjects.map(proj => {
            const tasksList = proj.tasks || [];
            const progress = calculateProgress(tasksList);
            const isProjectOverdue = checkIsOverdue(proj.dueDate, proj.status === 'Completed');
            const statStyle = getStatusStyle(proj.status, isProjectOverdue);
            const aoDisplay = proj.aoName || proj.ao || proj.creatorName || 'Internal';

            return (
              <div
                key={proj.id}
                className="card"
                style={{ padding: '20px', cursor: 'pointer', border: '1px solid var(--border)', transition: 'all 0.2s' }}
                onClick={() => setActiveProject(proj)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '12px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--primary)', backgroundColor: 'var(--primary-soft)', padding: '2px 8px', borderRadius: '6px' }}>{proj.id}</span>
                      <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>{proj.program}</h3>
                    </div>
                    <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Building2 size={13} /> {proj.schoolName || 'Internal Project'} &bull; AO: <strong>{aoDisplay}</strong>
                    </p>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      backgroundColor: statStyle.bg, color: statStyle.color,
                      padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 700
                    }}>
                      {statStyle.icon}
                      {statStyle.label}
                    </div>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: progress === 100 ? '#2ED47A' : 'var(--primary)' }}>{progress}%</span>
                  </div>
                </div>

                {/* Timeline Schedule Bar */}
                <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    <span>Start: <strong>{proj.startDate ? new Date(proj.startDate).toLocaleDateString('id-ID') : '-'}</strong></span>
                    <span>Deadline: <strong style={{ color: isProjectOverdue ? '#FF5252' : 'var(--text-primary)' }}>{proj.dueDate ? new Date(proj.dueDate).toLocaleDateString('id-ID') : '-'}</strong></span>
                  </div>
                  <div style={{ width: '100%', height: '10px', backgroundColor: '#F4F6F9', borderRadius: '5px', overflow: 'hidden' }}>
                    <div style={{ width: `${progress}%`, height: '100%', backgroundColor: isProjectOverdue ? '#FF5252' : (progress === 100 ? '#2ED47A' : 'var(--primary)'), transition: 'width 0.4s ease' }} />
                  </div>
                </div>

                {/* Task Breakdown list inside timeline view */}
                {tasksList.length > 0 && (
                  <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Sub-Tasks ({tasksList.length})</span>
                    {tasksList.map(task => {
                      const isTaskOverdue = checkIsOverdue(task.dueDate, task.completed);
                      return (
                        <div key={task.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '13px', padding: '6px 12px', backgroundColor: '#F8F9FB', borderRadius: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {task.completed ? <CheckSquare size={14} color="#2ED47A" /> : <Square size={14} color="var(--text-secondary)" />}
                            <span style={{ textDecoration: task.completed ? 'line-through' : 'none', color: task.completed ? 'var(--text-secondary)' : 'var(--text-primary)' }}>
                              {task.title}
                            </span>
                            <span style={{ fontSize: '11px', color: 'var(--primary)', backgroundColor: 'var(--surface)', padding: '1px 6px', borderRadius: '4px', border: '1px solid var(--border)' }}>
                              {task.assignee || 'Unassigned'}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                            {task.dueDate && (
                              <span style={{ color: isTaskOverdue ? '#FF5252' : 'var(--text-secondary)', fontWeight: isTaskOverdue ? 700 : 400 }}>
                                {isTaskOverdue ? 'Overdue: ' : 'Deadline: '}{new Date(task.dueDate).toLocaleDateString('id-ID')}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {filteredProjects.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)', border: '1px dashed var(--border)', borderRadius: '12px' }}>
              Tidak ada project operasional yang sesuai dengan pencarian/filter.
            </div>
          )}
        </div>
      )}

      {/* Task Drawer / Project Detail */}
      {activeProject && (
        <>
          <div
            onClick={() => { setActiveProject(null); setEditingTaskId(null); }}
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 100 }}
          />
          <div style={{
            position: 'fixed', top: 0, right: 0, width: isMobile ? '100%' : '520px', height: '100vh',
            backgroundColor: 'var(--surface)', boxShadow: '-12px 0 32px rgba(0,0,0,0.1)', zIndex: 101,
            display: 'flex', flexDirection: 'column'
          }}>
            {/* Drawer Header */}
            <div style={{ padding: '24px', borderBottom: '1px solid var(--border)', backgroundColor: 'var(--bg)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--primary)', letterSpacing: '0.5px' }}>{activeProject.id}</span>
                  <h2 style={{ fontSize: '20px', fontWeight: 700, marginTop: '4px', lineHeight: '1.3' }}>{activeProject.program}</h2>
                  <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Building2 size={14} /> {activeProject.schoolName || 'Internal Project'}
                  </p>
                </div>
                <button onClick={() => { setActiveProject(null); setEditingTaskId(null); }} style={{ color: 'var(--text-secondary)', padding: '4px', cursor: 'pointer' }} className="hover:bg-gray-100 rounded-full transition-colors">
                  <X size={22} />
                </button>
              </div>

              {/* Info Meta */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '16px', backgroundColor: 'var(--surface)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border)' }}>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block' }}>AO Project</span>
                  <strong style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{activeProject.aoName || activeProject.ao || activeProject.creatorName || '-'}</strong>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block' }}>Tanggal Operations</span>
                  <strong style={{ fontSize: '12px', color: 'var(--text-primary)' }}>
                    {activeProject.startDate ? new Date(activeProject.startDate).toLocaleDateString('id-ID') : '-'} &rarr; {activeProject.dueDate ? new Date(activeProject.dueDate).toLocaleDateString('id-ID') : '-'}
                  </strong>
                </div>
              </div>

              {/* Progress Bar */}
              <div style={{ marginTop: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Overall Progress</span>
                  <span style={{ color: calculateProgress(activeProject.tasks) === 100 ? '#2ED47A' : 'var(--text-primary)' }}>
                    {calculateProgress(activeProject.tasks)}%
                  </span>
                </div>
                <div style={{ width: '100%', height: '8px', backgroundColor: '#E9ECEF', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${calculateProgress(activeProject.tasks)}%`, height: '100%', backgroundColor: calculateProgress(activeProject.tasks) === 100 ? '#2ED47A' : 'var(--primary)', transition: 'width 0.4s ease' }} />
                </div>
              </div>
            </div>

            {/* Drawer Body - Task Checklist */}
            <div style={{ flex: 1, padding: '20px', overflowY: 'auto', backgroundColor: '#F8F9FB' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h4 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>
                  Daftar Tugas Operasional ({(activeProject.tasks || []).length})
                </h4>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {(activeProject.tasks || []).map(task => {
                  const isTaskOverdue = checkIsOverdue(task.dueDate, task.completed);
                  const isEditingThisTask = editingTaskId === task.id;

                  if (isEditingThisTask) {
                    return (
                      <div key={task.id} style={{ padding: '16px', backgroundColor: 'white', borderRadius: '12px', border: '1px solid var(--primary)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          <input
                            type="text"
                            value={editingTaskInput}
                            onChange={e => setEditingTaskInput(e.target.value)}
                            placeholder="Judul task..."
                            style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)', outline: 'none' }}
                          />
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <select
                              value={editingTaskAssigneeId}
                              onChange={e => {
                                setEditingTaskAssigneeId(e.target.value);
                                const u = users.find(usr => usr.id === e.target.value || usr.uid === e.target.value);
                                if (u) setEditingTaskAssigneeName(u.name || u.displayName || u.nickname);
                              }}
                              style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '13px' }}
                            >
                              <option value="">-- Assignee --</option>
                              {users.map(u => (
                                <option key={u.id || u.uid} value={u.id || u.uid}>{u.name || u.displayName || u.nickname}</option>
                              ))}
                            </select>
                            <input
                              type="date"
                              value={editingTaskDueDate}
                              onChange={e => setEditingTaskDueDate(e.target.value)}
                              style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '13px' }}
                            />
                          </div>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                            <button onClick={() => setEditingTaskId(null)} className="btn btn-outline" style={{ padding: '6px 12px', fontSize: '12px' }}>Batal</button>
                            <button onClick={() => handleSaveEditTask(task.id)} className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '12px' }}>Simpan</button>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={task.id}
                      style={{
                        padding: '14px 16px', backgroundColor: 'white', borderRadius: '12px',
                        border: isTaskOverdue ? '1px solid #FFE5E5' : (task.completed ? '1px solid #E5F6EB' : '1px solid var(--border)'),
                        boxShadow: '0 2px 8px rgba(0,0,0,0.02)', transition: 'all 0.2s',
                        display: 'flex', alignItems: 'flex-start', gap: '12px'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={!!task.completed}
                        onChange={() => handleTaskToggle(activeProject.id, task.id)}
                        style={{ width: '18px', height: '18px', accentColor: 'var(--primary)', cursor: 'pointer', marginTop: '3px' }}
                      />

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                          <p style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: task.completed ? 'var(--text-secondary)' : 'var(--text-primary)', textDecoration: task.completed ? 'line-through' : 'none' }}>
                            {task.title}
                          </p>
                          {isTaskOverdue && (
                            <span style={{ fontSize: '11px', fontWeight: 700, backgroundColor: '#FFE5E5', color: '#FF5252', padding: '2px 8px', borderRadius: '10px' }}>
                              Terlambat
                            </span>
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '6px', fontSize: '12px', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
                          <span>Assignee: <strong style={{ color: 'var(--text-primary)' }}>{task.assignee || 'Unassigned'}</strong></span>
                          {task.dueDate && (
                            <span>Deadline: <strong style={{ color: isTaskOverdue ? '#FF5252' : 'var(--text-primary)' }}>{new Date(task.dueDate).toLocaleDateString('id-ID')}</strong></span>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button onClick={() => handleStartEditTask(task)} style={{ border: 'none', backgroundColor: 'transparent', color: '#FFB020', cursor: 'pointer', padding: '4px' }} title="Edit Task">
                          <Edit2 size={15} />
                        </button>
                        <button onClick={() => handleDeleteTask(task.id)} style={{ border: 'none', backgroundColor: 'transparent', color: '#FF5252', cursor: 'pointer', padding: '4px' }} title="Hapus Task">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  );
                })}

                {(activeProject.tasks || []).length === 0 && (
                  <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)', border: '1px dashed var(--border)', borderRadius: '12px' }}>
                    Belum ada task operasional. Tambahkan delegasi task di bawah.
                  </div>
                )}
              </div>
            </div>

            {/* Drawer Footer - Add Task Form */}
            <div style={{ padding: '20px', borderTop: '1px solid var(--border)', backgroundColor: 'white' }}>
              <form onSubmit={handleAddTask} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>Tambah Task Baru</span>
                <input
                  type="text"
                  placeholder="Judul Task (misal: Cetak Banner & Sertifikat)"
                  required
                  value={newTaskInput}
                  onChange={e => setNewTaskInput(e.target.value)}
                  style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border)', outline: 'none', fontSize: '14px' }}
                />

                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '10px' }}>
                  <select
                    value={newTaskAssigneeId}
                    onChange={e => {
                      setNewTaskAssigneeId(e.target.value);
                      const u = users.find(usr => usr.id === e.target.value || usr.uid === e.target.value);
                      if (u) setNewTaskAssigneeName(u.name || u.displayName || u.nickname);
                    }}
                    style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', outline: 'none', backgroundColor: 'white', fontSize: '13px' }}
                  >
                    <option value="">-- Assignee (User DB) --</option>
                    {users.map(u => (
                      <option key={u.id || u.uid} value={u.id || u.uid}>{u.name || u.displayName || u.nickname}</option>
                    ))}
                  </select>

                  <input
                    type="date"
                    value={newTaskDueDate}
                    onChange={e => setNewTaskDueDate(e.target.value)}
                    style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', outline: 'none', fontSize: '13px' }}
                    placeholder="Deadline Task"
                  />
                </div>

                <button type="submit" className="btn btn-primary" style={{ width: '100%', borderRadius: '8px', justifyContent: 'center', marginTop: '4px' }}>
                  <Plus size={16} /> Delegasikan Task Ini
                </button>
              </form>
            </div>
          </div>
        </>
      )}

      {/* Add / Edit Project Drawer */}
      {isAddOpen && (
        <>
          <div onClick={handleCloseProjectDrawer} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.3)', zIndex: 100 }} />
          <div style={{
            position: 'fixed', top: 0, right: 0, width: isMobile ? '100%' : '440px', height: '100vh',
            backgroundColor: 'var(--surface)', boxShadow: '-8px 0 24px rgba(0,0,0,0.05)', zIndex: 101,
            display: 'flex', flexDirection: 'column'
          }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 className="text-xl font-semibold">{editingProject ? 'Edit Project' : 'Tambah Project Baru'}</h2>
              <button onClick={handleCloseProjectDrawer} style={{ color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={24} /></button>
            </div>

            <div style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>
              <form id="add-proj-form" onSubmit={handleSaveProject} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                {/* Project Type Toggle */}
                <div>
                  <label className="text-sm font-bold mb-2 block">Jenis Project</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setProjectType('client');
                        setNewProject(prev => ({ ...prev, schoolName: '' }));
                      }}
                      className={`btn ${projectType === 'client' ? 'btn-primary' : 'btn-outline'}`}
                      style={{ flex: 1, borderRadius: '8px', fontSize: '13px', justifyContent: 'center' }}
                    >
                      Client Project
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setProjectType('internal');
                        setSelectedClientId('');
                        setSelectedLeadId('');
                        setNewProject(prev => ({ ...prev, schoolName: 'Internal Project', schoolId: '' }));
                      }}
                      className={`btn ${projectType === 'internal' ? 'btn-primary' : 'btn-outline'}`}
                      style={{ flex: 1, borderRadius: '8px', fontSize: '13px', justifyContent: 'center' }}
                    >
                      Internal Project
                    </button>
                  </div>
                </div>

                {/* Client Selection (If Client Project) */}
                {projectType === 'client' && (
                  <div>
                    <label className="text-sm font-bold mb-2 block">Pilih Client CRM <span style={{ color: 'red' }}>*</span></label>
                    <select
                      required
                      value={selectedClientId}
                      onChange={e => handleSelectClient(e.target.value)}
                      className="form-input"
                      style={{ backgroundColor: 'white' }}
                    >
                      <option value="">-- Pilih Client dari Database --</option>
                      {clients.map(c => (
                        <option key={c.id || c.schoolId} value={c.id || c.schoolId}>
                          {c.sekolah || c.school} {c.nama ? `(${c.nama})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Lead Selection (If Client Project & Client selected) */}
                {projectType === 'client' && selectedClientId && (
                  <div>
                    <label className="text-sm font-bold mb-2 block">Pilih Lead / Program Client</label>
                    <select
                      value={selectedLeadId}
                      onChange={e => handleSelectLead(e.target.value)}
                      className="form-input"
                      style={{ backgroundColor: 'white' }}
                    >
                      <option value="">-- Pilih Lead / Program (Auto-Fill) --</option>
                      {availableLeadsForClient.map(l => (
                        <option key={l.id} value={l.id}>
                          {l.program || l.title || l.programName || 'Lead tanpa nama'} ({l.status?.toUpperCase()})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Project / Program Name */}
                <div>
                  <label className="text-sm font-bold mb-2 block">Nama Project / Program <span style={{ color: 'red' }}>*</span></label>
                  <input
                    required
                    type="text"
                    value={newProject.program}
                    placeholder="Misal: Psikotes Luring Batch 2"
                    onChange={e => setNewProject({ ...newProject, program: e.target.value })}
                    className="form-input"
                  />
                </div>

                {/* AO (Account Officer) Selection */}
                <div>
                  <label className="text-sm font-bold mb-2 block">AO (Account Officer) <span style={{ color: 'red' }}>*</span></label>
                  <select
                    required
                    value={selectedAoId}
                    onChange={e => {
                      setSelectedAoId(e.target.value);
                      const u = users.find(usr => usr.id === e.target.value || usr.uid === e.target.value);
                      if (u) setSelectedAoName(u.name || u.displayName || u.nickname);
                    }}
                    className="form-input"
                    style={{ backgroundColor: 'white' }}
                  >
                    <option value="">-- Pilih AO Internal --</option>
                    {users.map(u => (
                      <option key={u.id || u.uid} value={u.id || u.uid}>{u.name || u.displayName || u.nickname} ({u.role || 'Staff'})</option>
                    ))}
                  </select>
                </div>

                {/* Operation Dates (Start Date & Deadline) */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label className="text-sm font-bold mb-2 block">Tanggal Mulai <span style={{ color: 'red' }}>*</span></label>
                    <input
                      required
                      type="date"
                      value={newProject.startDate}
                      onChange={e => setNewProject({ ...newProject, startDate: e.target.value })}
                      className="form-input"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-bold mb-2 block">Deadline <span style={{ color: 'red' }}>*</span></label>
                    <input
                      required
                      type="date"
                      value={newProject.dueDate}
                      onChange={e => setNewProject({ ...newProject, dueDate: e.target.value })}
                      className="form-input"
                    />
                  </div>
                </div>

                {/* Status Selection (Edit Mode or Manual Override) */}
                {editingProject && (
                  <div>
                    <label className="text-sm font-bold mb-2 block">Status Project</label>
                    <select
                      value={newProject.status}
                      onChange={e => setNewProject({ ...newProject, status: e.target.value })}
                      className="form-input"
                      style={{ backgroundColor: 'white' }}
                    >
                      <option value="Preparation">Preparation</option>
                      <option value="Ongoing">Ongoing</option>
                      <option value="Completed">Completed</option>
                    </select>
                  </div>
                )}
              </form>
            </div>

            <div style={{ padding: '20px 24px', borderTop: '1px solid var(--border)', display: 'flex', gap: '12px' }}>
              <button onClick={handleCloseProjectDrawer} className="btn btn-outline" style={{ flex: 1 }}>Batal</button>
              <button type="submit" form="add-proj-form" className="btn btn-primary" style={{ flex: 1 }}>
                {editingProject ? 'Simpan Perubahan' : 'Tambah Project'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Projects;
