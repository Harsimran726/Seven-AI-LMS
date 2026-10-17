import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, onSnapshot, doc, updateDoc, deleteDoc, setDoc } from 'firebase/firestore';
import { Staff } from '../types';
import { format } from 'date-fns';
import { ShieldAlert, ShieldCheck, UserPlus, Trash2, Shield, User, X, Search, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const StaffManagement = () => {
  const { user, isAdmin } = useAuth();
  const [allStaff, setAllStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'admin' | 'staff'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'approved' | 'pending'>('ALL');

  // Modal for adding new Admin / Staff
  const [showAddModal, setShowAddModal] = useState(false);
  const [newUserForm, setNewUserForm] = useState({
    name: '',
    email: '',
    role: 'staff' as 'admin' | 'staff',
    autoApprove: true
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'staff'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const staffList = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Staff));
      setAllStaff(staffList.sort((a, b) => b.createdAt - a.createdAt));
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'staff');
      setLoading(false);
    });
    
    return () => unsubscribe();
  }, []);

  // Add / Invite New Admin or Staff
  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserForm.email.trim() || !newUserForm.name.trim()) return;

    setSubmitting(true);
    try {
      const formattedEmail = newUserForm.email.trim().toLowerCase();
      // Generate doc id or query existing
      const docId = 'pre_' + formattedEmail.replace(/[^a-zA-Z0-9]/g, '_');

      await setDoc(doc(db, 'staff', docId), {
        name: newUserForm.name.trim(),
        email: formattedEmail,
        role: newUserForm.role,
        status: newUserForm.autoApprove ? 'approved' : 'pending',
        createdAt: Date.now()
      });

      setShowAddModal(false);
      setNewUserForm({ name: '', email: '', role: 'staff', autoApprove: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'staff');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (staffId: string, currentStatus: string | undefined) => {
    setProcessingId(staffId);
    try {
      const newStatus = (currentStatus || 'pending') === 'approved' ? 'pending' : 'approved';
      await updateDoc(doc(db, 'staff', staffId), {
        status: newStatus
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'staff');
    } finally {
      setProcessingId(null);
    }
  };

  const handleUpdateRole = async (staffId: string, currentRole: string | undefined) => {
    setProcessingId(staffId);
    try {
      const newRole = (currentRole || 'staff') === 'admin' ? 'staff' : 'admin';
      await updateDoc(doc(db, 'staff', staffId), {
        role: newRole
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'staff');
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeleteStaff = async (staffId: string, staffName: string) => {
    if (!confirm(`Are you sure you want to remove ${staffName} from the system?`)) return;
    setProcessingId(staffId);
    try {
      await deleteDoc(doc(db, 'staff', staffId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'staff');
    } finally {
      setProcessingId(null);
    }
  };

  // Filtered staff list
  const filteredStaff = allStaff.filter(staff => {
    const q = searchTerm.toLowerCase();
    const matchesSearch = !searchTerm || 
      (staff.name && staff.name.toLowerCase().includes(q)) ||
      (staff.email && staff.email.toLowerCase().includes(q));

    const matchesRole = roleFilter === 'ALL' || (staff.role || 'staff') === roleFilter;
    const matchesStatus = statusFilter === 'ALL' || (staff.status || 'pending') === statusFilter;

    return matchesSearch && matchesRole && matchesStatus;
  });

  if (loading) {
     return <div className="p-8 text-sm text-slate-500 uppercase tracking-widest font-bold animate-pulse">Loading Staff Directory...</div>;
  }

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Admin & Staff Directory</h2>
          <p className="text-slate-500 text-sm mt-1">
            Manage system access, create new Administrators or Staff members, and configure module permissions
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-indigo-600 text-white font-bold text-xs uppercase tracking-wider px-4 py-3 rounded-lg shadow hover:bg-indigo-700 transition flex items-center justify-center gap-2"
          >
            <UserPlus size={16} /> ADD NEW ADMIN / STAFF
          </button>
        )}
      </div>

      {/* Stats Summary Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Users</span>
            <p className="text-2xl font-black text-slate-900 mt-1">{allStaff.length}</p>
          </div>
          <div className="p-3 bg-slate-100 rounded-lg text-slate-600">
            <User size={20} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-indigo-100 shadow-sm flex items-center justify-between bg-gradient-to-br from-indigo-50/50 to-white">
          <div>
            <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">Administrators (Full Access)</span>
            <p className="text-2xl font-black text-indigo-700 mt-1">
              {allStaff.filter(s => s.role === 'admin').length}
            </p>
          </div>
          <div className="p-3 bg-indigo-100 text-indigo-700 rounded-lg">
            <Shield size={20} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-emerald-100 shadow-sm flex items-center justify-between bg-gradient-to-br from-emerald-50/50 to-white">
          <div>
            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Staff Members (Limited Access)</span>
            <p className="text-2xl font-black text-emerald-700 mt-1">
              {allStaff.filter(s => (s.role || 'staff') === 'staff').length}
            </p>
          </div>
          <div className="p-3 bg-emerald-100 text-emerald-700 rounded-lg">
            <ShieldCheck size={20} />
          </div>
        </div>
      </div>

      {/* Toolbar & Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Search name or email..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <select
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value as any)}
            className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="ALL">All Roles</option>
            <option value="admin">Admin Only</option>
            <option value="staff">Staff Only</option>
          </select>

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as any)}
            className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="approved">Approved Active</option>
            <option value="pending">Pending Approval</option>
          </select>
        </div>
      </div>

      {/* Staff Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          {filteredStaff.length > 0 ? (
            <table className="w-full text-left border-collapse whitespace-nowrap text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] font-bold tracking-wider">
                  <th className="p-4">User Identity</th>
                  <th className="p-4">Assigned Role</th>
                  <th className="p-4">Module Access Level</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Added On</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStaff.map(staff => {
                  const isSelf = staff.email?.toLowerCase() === user?.email?.toLowerCase();
                  const isSystemAdmin = ['harsimransingh27448@gmail.com', 'harsimransd726@gmail.com'].includes(staff.email?.toLowerCase() || '');
                  const status = staff.status || 'pending';
                  const isPending = status === 'pending';
                  const role = staff.role || 'staff';
                  const isAdminUser = role === 'admin';
                  
                  return (
                    <tr key={staff.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          {staff.photoURL ? (
                            <img src={staff.photoURL} alt={staff.name} className="w-9 h-9 rounded-full object-cover border border-indigo-300 shadow-sm" />
                          ) : (
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold ${
                              isAdminUser ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-700'
                            }`}>
                              {staff.name?.[0]?.toUpperCase() || staff.email?.[0]?.toUpperCase() || 'U'}
                            </div>
                          )}
                          <div>
                            <p className="font-bold text-slate-900 text-sm">{staff.name || 'Unnamed User'}</p>
                            <p className="text-slate-500 font-medium">{staff.email}</p>
                            {isSystemAdmin && (
                              <span className="inline-block mt-0.5 text-[9px] uppercase tracking-widest font-extrabold bg-indigo-100 text-indigo-700 px-1.5 py-0.2 rounded">
                                Primary Admin
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Assigned Role */}
                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-md border ${
                          isAdminUser 
                            ? 'bg-indigo-50 border-indigo-200 text-indigo-700' 
                            : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                        }`}>
                          {isAdminUser ? <Shield size={12} /> : <User size={12} />}
                          {isAdminUser ? 'ADMINISTRATOR' : 'STAFF MEMBER'}
                        </span>
                      </td>

                      {/* Access Level description */}
                      <td className="p-4">
                        {isAdminUser ? (
                          <span className="text-slate-700 font-bold text-[11px] bg-slate-100 px-2 py-1 rounded">
                            ✨ All Modules (Full System Access)
                          </span>
                        ) : (
                          <span className="text-slate-600 font-medium text-[11px]">
                            📌 Leads, AI Attendance, Communications Only
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md ${
                          isPending 
                            ? 'bg-amber-100 text-amber-800 border border-amber-200' 
                            : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        }`}>
                          {isPending ? <ShieldAlert size={12} /> : <ShieldCheck size={12} />}
                          {isPending ? 'Pending Approval' : 'Approved Active'}
                        </span>
                      </td>

                      {/* Added On */}
                      <td className="p-4 text-slate-500 font-medium">
                        {staff.createdAt ? format(new Date(staff.createdAt), 'dd MMM yyyy') : 'N/A'}
                      </td>

                      {/* Actions */}
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {!isSelf && !isSystemAdmin && isAdmin && (
                            <>
                              {/* Approve / Revoke */}
                              <button
                                disabled={processingId === staff.id}
                                onClick={() => handleUpdateStatus(staff.id, staff.status)}
                                className={`px-2.5 py-1.5 rounded-md font-bold text-[10px] uppercase tracking-wider transition ${
                                  isPending 
                                    ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm' 
                                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                }`}
                              >
                                {isPending ? 'Approve' : 'Revoke Access'}
                              </button>

                              {/* Toggle Role Admin <-> Staff */}
                              <button
                                disabled={processingId === staff.id}
                                onClick={() => handleUpdateRole(staff.id, staff.role)}
                                className={`px-2.5 py-1.5 rounded-md font-bold text-[10px] uppercase tracking-wider transition ${
                                  isAdminUser 
                                    ? 'bg-slate-100 text-slate-700 hover:bg-slate-200' 
                                    : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm'
                                }`}
                              >
                                {isAdminUser ? 'Make Staff' : 'Make Admin'}
                              </button>

                              {/* Delete */}
                              <button
                                disabled={processingId === staff.id}
                                onClick={() => handleDeleteStaff(staff.id, staff.name || staff.email)}
                                title="Remove User"
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition"
                              >
                                <Trash2 size={16} />
                              </button>
                            </>
                          )}
                          {isSelf && (
                            <span className="text-[10px] font-bold text-slate-400 uppercase italic">Your Account</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="p-12 text-center text-slate-400 font-medium">
              No users found matching your filters.
            </div>
          )}
        </div>
      </div>

      {/* ADD / INVITE NEW ADMIN OR STAFF MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-scaleUp">
            <div className="p-5 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex justify-between items-center">
              <div className="flex items-center gap-2">
                <UserPlus size={20} className="text-indigo-400" />
                <h3 className="font-bold text-base">Add New Admin or Staff</h3>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white transition">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddUser} className="p-6 space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">Full Name *</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Nishant Mittal"
                  value={newUserForm.name}
                  onChange={e => setNewUserForm({ ...newUserForm, name: e.target.value })}
                  className="w-full border border-slate-200 bg-slate-50 rounded-lg p-2.5 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">Google Email Address *</label>
                <input
                  required
                  type="email"
                  placeholder="e.g. nishant@gmail.com"
                  value={newUserForm.email}
                  onChange={e => setNewUserForm({ ...newUserForm, email: e.target.value })}
                  className="w-full border border-slate-200 bg-slate-50 rounded-lg p-2.5 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition"
                />
                <p className="text-[10px] text-slate-400 mt-1">When this email signs in via Google Auth, their role will automatically apply.</p>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">Select Role *</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setNewUserForm({ ...newUserForm, role: 'staff' })}
                    className={`p-3 rounded-xl border text-left flex flex-col justify-between transition ${
                      newUserForm.role === 'staff' 
                        ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-500 text-emerald-900' 
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span className="font-bold text-xs uppercase flex items-center gap-1">
                      <User size={14} /> Staff Member
                    </span>
                    <span className="text-[10px] text-slate-500 mt-1">Access to Leads, Attendance & Communications only</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewUserForm({ ...newUserForm, role: 'admin' })}
                    className={`p-3 rounded-xl border text-left flex flex-col justify-between transition ${
                      newUserForm.role === 'admin' 
                        ? 'bg-indigo-50 border-indigo-300 ring-2 ring-indigo-500 text-indigo-900' 
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span className="font-bold text-xs uppercase flex items-center gap-1">
                      <Shield size={14} /> Administrator
                    </span>
                    <span className="text-[10px] text-slate-500 mt-1">Full system access (Dashboard, Billing, Students, etc.)</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="autoApprove"
                  checked={newUserForm.autoApprove}
                  onChange={e => setNewUserForm({ ...newUserForm, autoApprove: e.target.checked })}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                />
                <label htmlFor="autoApprove" className="text-xs text-slate-700 font-semibold cursor-pointer">
                  Pre-approve immediately (No manual approval needed on login)
                </label>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 font-bold text-xs uppercase tracking-wider hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  disabled={submitting}
                  type="submit"
                  className="bg-indigo-600 text-white font-bold text-xs uppercase tracking-wider py-2.5 px-6 rounded-lg shadow hover:bg-indigo-700 disabled:opacity-50 transition"
                >
                  {submitting ? 'ADDING...' : 'ADD USER'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffManagement;
