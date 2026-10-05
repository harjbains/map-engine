import React from 'react';
import type { UberDashboard, UberShift } from '../uber/types.js';

export function ShiftHistoryPanel({ dashboard, darkMode, onClose }: { dashboard: UberDashboard; darkMode?: boolean; onClose: () => void }) {
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
            return (
              <div key={shift.id} style={{ padding: '16px', borderRadius: '12px', border: `1px solid ${borderCol}`, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '18px' }}>
                  <span>{formatTime(shift.startTimestamp)} – {formatTime(shift.endTimestamp)}</span>
                  <span style={{ color: '#10b981' }}>£{(shiftEarnings / 100).toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: textSecondary, fontSize: '14px', fontWeight: 600 }}>
                  <span>{shift.date} • {formatDuration(shift.startTimestamp, shift.endTimestamp)}</span>
                  <span>£{(pph / 100).toFixed(2)}/hr</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
