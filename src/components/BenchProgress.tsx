import { useState, useEffect, useMemo, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import './BenchProgress.css';

export interface BenchSession {
  id: string;
  date: string;
  weight: number;
  reps: number;
  sets: number;
}

interface BenchProgressProps {
  currentUser: string | null;
  onBack: () => void;
}

function calculate1RM(weight: number, reps: number): number {
  if (reps <= 1) return weight;
  if (reps >= 37) return weight;
  return Math.round(weight * (36 / (37 - reps)) * 10) / 10;
}

function calculateNextWeight(
  lastSession: BenchSession | null,
  _personalRecord: number
): { working: number } {
  if (!lastSession) {
    return { working: 0 };
  }

  const currentWeight = lastSession.weight;
  const currentReps = lastSession.reps;

  if (currentReps > 4) {
    const nextWeight = currentWeight + 2.5;
    return {
      working: nextWeight
    };
  }

  return {
    working: currentWeight
  };
}

export function BenchProgress({ currentUser, onBack }: BenchProgressProps) {
  const [benchSessions, setBenchSessions] = useState<BenchSession[]>(() => {
    if (!currentUser) return [];
    const saved = localStorage.getItem(`mygymtracker_bench_${currentUser}`);
    return saved ? JSON.parse(saved) : [];
  });

  const [personalRecord, setPersonalRecord] = useState<number>(() => {
    if (!currentUser) return 0;
    const saved = localStorage.getItem(`mygymtracker_bench_pr_${currentUser}`);
    return saved ? parseFloat(saved) : 0;
  });

  const [showForm, setShowForm] = useState(false);
  const [editingField, setEditingField] = useState<{ id: string; field: 'weight' | 'reps' | 'sets' } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
  const [newWeight, setNewWeight] = useState('');
  const [newReps, setNewReps] = useState('');
  const [newSets, setNewSets] = useState('3');
  const historyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(`mygymtracker_bench_${currentUser}`, JSON.stringify(benchSessions));
    }
  }, [benchSessions, currentUser]);

  useEffect(() => {
    if (currentUser && personalRecord > 0) {
      localStorage.setItem(`mygymtracker_bench_pr_${currentUser}`, personalRecord.toString());
    }
  }, [personalRecord, currentUser]);

  const resetForm = (scrollToHistory = false) => {
    setNewDate(new Date().toISOString().split('T')[0]);
    setNewWeight('');
    setNewReps('');
    setNewSets('3');
    setShowForm(false);
    if (scrollToHistory && historyRef.current) {
      historyRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleAddSession = (e: React.FormEvent) => {
    e.preventDefault();
    const weight = parseFloat(newWeight);
    const reps = parseInt(newReps);
    const sets = parseInt(newSets);
    
    if (isNaN(weight) || isNaN(reps) || isNaN(sets) || weight <= 0 || reps <= 0 || sets <= 0) return;

    const session1RM = calculate1RM(weight, reps);
    const currentPR = personalRecord > 0 ? personalRecord : Math.max(...benchSessions.map(s => calculate1RM(s.weight, s.reps)), 0);
    
    if (session1RM > currentPR) {
      setPersonalRecord(session1RM);
    }

    const session: BenchSession = {
      id: Date.now().toString(),
      date: newDate,
      weight,
      reps,
      sets
    };

    setBenchSessions(prev => [...prev, session].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
    resetForm(true);
  };

  const handleDeleteSession = (id: string) => {
    if (confirm('Supprimer cette séance ?')) {
      setBenchSessions(prev => prev.filter(s => s.id !== id));
    }
  };

  const handlePRChange = (value: string) => {
    const pr = parseFloat(value);
    if (!isNaN(pr) && pr >= 0) {
      setPersonalRecord(pr);
    }
  };

  const handleFieldClick = (id: string, field: 'weight' | 'reps' | 'sets', currentValue: number) => {
    setEditingField({ id, field });
    setEditValue(currentValue.toString());
  };

  const handleFieldBlur = () => {
    if (!editingField) return;
    
    const value = parseFloat(editValue);
    if (isNaN(value) || value < 0) {
      setEditingField(null);
      return;
    }

    setBenchSessions(prev => prev.map(s => {
      if (s.id !== editingField.id) return s;
      if (editingField.field === 'weight') return { ...s, weight: value };
      if (editingField.field === 'reps') return { ...s, reps: Math.round(value) };
      if (editingField.field === 'sets') return { ...s, sets: Math.round(value) };
      return s;
    }));
    
    setEditingField(null);
  };

  const chartData = useMemo(() => {
    return benchSessions
      .filter(session => session.reps >= 3)
      .map(session => ({
        date: new Date(session.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
        weight: session.weight,
        reps: session.reps,
        sets: session.sets,
        estimated1RM: calculate1RM(session.weight, session.reps)
      }));
  }, [benchSessions]);

  const currentStats = useMemo(() => {
    if (benchSessions.length === 0) return null;
    
    const sessionsWith3Reps = benchSessions.filter(s => s.reps >= 3);
    const lastSession = benchSessions[benchSessions.length - 1];
    
    const current1RM = sessionsWith3Reps.length > 0 
      ? Math.max(...sessionsWith3Reps.map(s => calculate1RM(s.weight, s.reps)), 0)
      : (lastSession.reps > 1 ? calculate1RM(lastSession.weight, lastSession.reps) : 0);
    
    const pr = personalRecord;
    
    return {
      lastSession,
      current1RM: current1RM,
      personalRecord: pr,
      next: calculateNextWeight(lastSession, pr)
    };
  }, [benchSessions, personalRecord]);

  const displayPR = personalRecord > 0 
    ? personalRecord 
    : currentStats?.personalRecord || 0;

  return (
    <div className="bench-progress">
      <div className="bench-header">
        <button className="btn btn-secondary" onClick={onBack}>
          ← Retour
        </button>
        <h2>📊 Progression Bench Press</h2>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? '✕ Annuler' : '➕ Ajouter séance'}
        </button>
      </div>

      {showForm && (
        <form className="bench-form" onSubmit={handleAddSession}>
          <div className="form-group">
            <label>Date</label>
            <input
              type="date"
              value={newDate}
              onChange={e => setNewDate(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>Poids (kg)</label>
            <input
              type="number"
              step="0.5"
              min="0"
              value={newWeight}
              onChange={e => setNewWeight(e.target.value)}
              placeholder="ex: 80"
              required
            />
          </div>
          <div className="form-group">
            <label>Reps</label>
            <input
              type="number"
              min="1"
              value={newReps}
              onChange={e => setNewReps(e.target.value)}
              placeholder="ex: 8"
              required
            />
          </div>
          <div className="form-group">
            <label>Séries</label>
            <input
              type="number"
              min="1"
              value={newSets}
              onChange={e => setNewSets(e.target.value)}
              placeholder="ex: 3"
              required
            />
          </div>
          <button type="submit" className="btn btn-primary">
            Enregistrer
          </button>
        </form>
      )}

      {benchSessions.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🏋️</div>
          <p>Aucune séance de bench enregistrée</p>
          <p className="hint">Ajoutez votre première séance pour suivre votre progression</p>
        </div>
      ) : (
        <>
          <div className="bench-stats">
            <div className="stat-card">
              <div className="stat-label">1RM Théorique</div>
              <div className="stat-value stat-highlight">{currentStats?.current1RM} kg</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Record Personnel</div>
              <input
                type="number"
                step="0.5"
                className="pr-input"
                value={personalRecord}
                onChange={e => handlePRChange(e.target.value)}
                placeholder="PR"
              />
              <span className="pr-unit">kg</span>
            </div>
            <div className="stat-card stat-card-highlight">
              <div className="stat-label">Prochaine Séance (3 × 3)</div>
              <div className="stat-value">
                {currentStats?.next.working} kg
              </div>
            </div>
          </div>

          <div className="bench-chart">
            <h3>Progression du poids (≥ 3 reps)</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                <XAxis dataKey="date" stroke="#888" />
                <YAxis stroke="#888" domain={['dataMin - 10', 'dataMax + 10']} />
                <Tooltip 
                  contentStyle={{ background: '#333', border: 'none', borderRadius: '8px' }}
                  labelStyle={{ color: '#fff' }}
                />
                {displayPR > 0 && (
                  <ReferenceLine 
                    y={displayPR} 
                    stroke="#f59e0b" 
                    strokeDasharray="5 5"
                    label={{ value: `PR: ${displayPR}kg`, fill: '#f59e0b', fontSize: 12 }}
                  />
                )}
                <Line 
                  type="monotone" 
                  dataKey="weight" 
                  name="weight"
                  stroke="#4ade80" 
                  strokeWidth={2}
                  dot={{ fill: '#4ade80', r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="bench-history" ref={historyRef}>
            <h3>Historique des séances</h3>
            <div className="history-list">
              {[...benchSessions].reverse().map((session) => (
                <div key={session.id} className="history-item">
                  <span className="history-date">
                    {new Date(session.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                  </span>
                  <span className="history-scheme">
                    {session.sets} × {session.reps} @ <span className="text-highlight">{session.weight}kg</span>
                  </span>
                  <span className="history-1rm">
                    {calculate1RM(session.weight, session.reps)}kg
                  </span>
                  <div className="actions-cell">
                    <button 
                      className="btn btn-icon" 
                      onClick={() => handleDeleteSession(session.id)}
                      title="Supprimer"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <table className="history-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Poids</th>
                  <th>Reps</th>
                  <th>Séries</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {[...benchSessions].reverse().map((session) => (
                  <tr key={session.id}>
                    <td>{new Date(session.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</td>
                    <td>
                      <span 
                        className="editable-cell"
                        onClick={() => handleFieldClick(session.id, 'weight', session.weight)}
                      >
                        {editingField?.id === session.id && editingField.field === 'weight' ? (
                          <input
                            type="number"
                            step="0.5"
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            onBlur={handleFieldBlur}
                            onKeyDown={e => e.key === 'Enter' && handleFieldBlur()}
                            autoFocus
                            className="inline-edit-input"
                          />
                        ) : (
                          `${session.weight} kg`
                        )}
                      </span>
                    </td>
                    <td>
                      <span 
                        className="editable-cell"
                        onClick={() => handleFieldClick(session.id, 'reps', session.reps)}
                      >
                        {editingField?.id === session.id && editingField.field === 'reps' ? (
                          <input
                            type="number"
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            onBlur={handleFieldBlur}
                            onKeyDown={e => e.key === 'Enter' && handleFieldBlur()}
                            autoFocus
                            className="inline-edit-input"
                          />
                        ) : (
                          `${session.reps}`
                        )}
                      </span>
                    </td>
                    <td>
                      <span 
                        className="editable-cell"
                        onClick={() => handleFieldClick(session.id, 'sets', session.sets)}
                      >
                        {editingField?.id === session.id && editingField.field === 'sets' ? (
                          <input
                            type="number"
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            onBlur={handleFieldBlur}
                            onKeyDown={e => e.key === 'Enter' && handleFieldBlur()}
                            autoFocus
                            className="inline-edit-input"
                          />
                        ) : (
                          `${session.sets}`
                        )}
                      </span>
                    </td>
                    <td className="actions-cell">
                      <button 
                        className="btn btn-danger btn-sm" 
                        onClick={() => handleDeleteSession(session.id)}
                        title="Supprimer"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
