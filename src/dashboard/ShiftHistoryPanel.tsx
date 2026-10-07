import React, { useState } from 'react';
import type { UberDashboard, UberShift } from '../uber/types.js';

export function ShiftHistoryPanel({ dashboard, darkMode, onClose, onUpdateShift, onDeleteShift }: { dashboard: UberDashboard; darkMode?: boolean; onClose: () => void; onUpdateShift?: (shiftId: string, updates: any) => Promise<any>; onDeleteShift?: (shiftId: string) => Promise<any> }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [startPence, setStartPence] = useState<string>('');
  const [endPence, setEndPence] = useState<string>('');
  const [saving, setSaving] = useState(false);

  // Sort shifts by startTimestamp descending
  const allShifts = (dashboard.shifts ?? []).slice().sort((a, b) => new Date(b.startTimestamp).getTime() - new Date(a.startTimestamp).getTime());
  
  const textPrimary = darkMode ? '#f8fafc' : '#0f172a';
  const textSecondary = darkMode ? '#94a3b8' : '#64748b';
  const bgPanel = darkMode ? '#1e293b' : '#ffffff';
  const borderCol = darkMode ? '#334155' : '#e2e8f0';
  
  const formatTime = (ts: string | null) => ts ? new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : 'Ongoing';
  const formatDuration = (start: string, end: string | null) => {
    const s = new Date(start).getTime();
    const e = end ? new Date(end).getTime() : Date.now();
    const mins = Math.floor((e - s) / 60000);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h${m}m`;
  };

  const handleEditClick = (shift: UberShift) => {
    setEditingId(shift.id);
    setStartPence((shift.startEarningsPence / 100).toFixed(2));
    setEndPence(shift.endEarningsPence ? (shift.endEarningsPence / 100).toFixed(2) : '');
  };

  const handleSave = async (shift: UberShift) => {
    if (!onUpdateShift) return;
    setSaving(true);
    try {
      const updates: any = {};
      const s = Math.round(parseFloat(startPence) * 100);
      if (!isNaN(s)) updates.startEarningsPence = s;
      
      if (endPence.trim() !== '') {
        const e = Math.round(parseFloat(endPence) * 100);
        if (!isNaN(e)) updates.endEarningsPence = e;
      }
      
      await onUpdateShift(shift.id, updates);
      setEditingId(null);
    } catch (e) {
      console.error(e);
      alert("Failed to update shift");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (shiftId: string) => {
    if (!onDeleteShift) return;
    if (!confirm("Are you sure you want to delete this shift?")) return;
    setSaving(true);
    try {
      await onDeleteShift(shiftId);
    } catch (e) {
      console.error(e);
      alert("Failed to delete shift");
    } finally {
      setSaving(false);
    }
  };
  
  return (
    <div style={{ padding: '24px', background: bgPanel, borderRadius: '16px', color: textPrimary, maxWidth: '500px', width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px', maxHeight: '80vh', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 900 }}>Shift History</h2>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: textSecondary, fontSize: '24px', cursor: 'pointer' }}>×</button>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {allShifts.length === 0 ? (
          <div style={{ color: textSecondary, textAlign: 'center', padding: '32px 0' }}>No shifts recorded yet.</div>
        ) : (
          allShifts.map(shift => {
            const shiftEarnings = (shift.endEarningsPence ?? dashboard.todayEarningsPence) - shift.startEarningsPence;
            const ms = (shift.endTimestamp ? new Date(shift.endTimestamp).getTime() : Date.now()) - new Date(shift.startTimestamp).getTime();
            const pph = ms > 0 ? (shiftEarnings / (ms / 3600000)) : 0;
            
            const isEditing = editingId === shift.id;

            return (
              <div key={shift.id} style={{ padding: '16px', borderRadius: '12px', border: \`1px solid \${borderCol}\`, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '18px' }}>
                  <span>{formatTime(shift.startTimestamp)} - {formatTime(shift.endTimestamp)}</span>
                  <span style={{ color: '#10b981' }}>£{(shiftEarnings / 100).toFixed(2)}</span>
                </div>
                
                {isEditing ? (
                  <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '12px', color: textSecondary }}>Start Earnings (£)</label>
                        <input type="number" step="0.01" value={startPence} onChange={e => setStartPence(e.target.value)} style={{ width: '100%', padding: '6px', borderRadius: '4px', border: \`1px solid \${borderCol}\`, background: 'transparent', color: textPrimary }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '12px', color: textSecondary }}>End Earnings (£)</label>
                        <input type="number" step="0.01" value={endPence} onChange={e => setEndPence(e.target.value)} disabled={!shift.endTimestamp} style={{ width: '100%', padding: '6px', borderRadius: '4px', border: \`1px solid \${borderCol}\`, background: 'transparent', color: textPrimary, opacity: shift.endTimestamp ? 1 : 0.5 }} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
                      <button onClick={() => setEditingId(null)} disabled={saving} style={{ padding: '4px 8px', background: 'transparent', border: \`1px solid \${borderCol}\`, color: textPrimary, borderRadius: '4px', cursor: 'pointer' }}>Cancel</button>
                      <button onClick={() => handleSave(shift)} disabled={saving} style={{ padding: '4px 8px', background: '#3b82f6', border: 'none', color: '#fff', borderRadius: '4px', cursor: 'pointer' }}>Save</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: textSecondary, fontSize: '14px', fontWeight: 600 }}>
                    <span>{shift.date} • {formatDuration(shift.startTimestamp, shift.endTimestamp)}</span>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <span>£{(pph / 100).toFixed(2)}/hr</span>
                      <button onClick={() => handleEditClick(shift)} style={{ background: 'transparent', border: 'none', color: '#3b82f6', cursor: 'pointer', padding: 0, fontSize: '14px', fontWeight: 600 }}>Edit</button>
                      <button onClick={() => handleDelete(shift.id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0, fontSize: '14px', fontWeight: 600 }}>Delete</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
