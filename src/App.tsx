import { useState, useMemo, useEffect } from 'react';
import { runMatchmakingEngine } from './engine';
import { StudentProfile, MatchmakingResult } from './types';
import TicketCard from './components/TicketCard';
import { STUDENT_DATABASE, BaseStudent } from './data/students';
import { Database, Users, LayoutDashboard, UserPlus, Play, List, Trash2, Search, LogIn, ArrowRight, X } from 'lucide-react';
import { supabase } from './lib/supabase';

export default function App() {
  const [view, setView] = useState<'login' | 'select' | 'dashboard'>('login');
  const [pool, setPool] = useState<StudentProfile[]>([]);
  const [currentUser, setCurrentUser] = useState<BaseStudent | null>(null);

  // Login State
  const [loginError, setLoginError] = useState('');

  // Select State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoommates, setSelectedRoommates] = useState<BaseStudent[]>([]);

  // Dashboard State
  const [result, setResult] = useState<MatchmakingResult | null>(null);
  const [activeTab, setActiveTab] = useState<'database' | 'results'>('database');

  // --- LOGIN LOGIC ---
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_IN' && session?.user?.email) {
          const email = session.user.email;
          
          if (!email.endsWith('@nitdgp.ac.in')) {
            setLoginError("Please use your official institute email (@nitdgp.ac.in).");
            supabase.auth.signOut();
            return;
          }

          const match = email.match(/\d{2}[a-zA-Z]\d{5}/i);
          if (!match) {
            setLoginError("Invalid institute email format. Reg. No. not found.");
            supabase.auth.signOut();
            return;
          }

          const regNo = match[0].toUpperCase();
          const student = STUDENT_DATABASE.find(s => s['Reg. No.'].toUpperCase() === regNo);
          
          if (student) {
            setCurrentUser(student);
            setView('select');
            setLoginError('');
          } else {
            setLoginError(`Reg. No. ${regNo} not found in the official database.`);
            supabase.auth.signOut();
          }
        } else if (event === 'SIGNED_OUT') {
            setCurrentUser(null);
            setView('login');
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoginError('');

    // Check if running in iframe (AI Studio preview)
    if (window !== window.top) {
      setLoginError("Google Sign-in cannot run inside this preview window. Please click the 'Open in New Tab' icon (↗️) at the top right of the preview pane to log in.");
      return;
    }
    
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        queryParams: {
          prompt: 'select_account'
        }
      }
    });

    if (error) {
      setLoginError(error.message);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  // --- SELECT LOGIC ---
  const filteredStudents = useMemo(() => {
    if (!searchQuery) return [];
    return STUDENT_DATABASE.filter(s => 
      s['Reg. No.'] !== currentUser?.['Reg. No.'] && 
      !selectedRoommates.some(r => r['Reg. No.'] === s['Reg. No.']) &&
      (s.Name.toLowerCase().includes(searchQuery.toLowerCase()) || s['Reg. No.'].toLowerCase().includes(searchQuery.toLowerCase()))
    ).slice(0, 5);
  }, [searchQuery, currentUser, selectedRoommates]);

  const addRoommate = (student: BaseStudent) => {
    if (selectedRoommates.length < 2) {
      setSelectedRoommates([...selectedRoommates, student]);
      setSearchQuery('');
    }
  };

  const removeRoommate = (regNo: string) => {
    setSelectedRoommates(selectedRoommates.filter(r => r['Reg. No.'] !== regNo));
  };

  const handleSubmitGroup = () => {
    if (selectedRoommates.length !== 2 || !currentUser) return;
    
    // Automatically load all three entries acting as mutual desires for simplicity of the workflow demo
    const newEntries: StudentProfile[] = [
      { ...currentUser, desired: [selectedRoommates[0]['Reg. No.'], selectedRoommates[1]['Reg. No.']] },
      { ...selectedRoommates[0], desired: [currentUser['Reg. No.'], selectedRoommates[1]['Reg. No.']] },
      { ...selectedRoommates[1], desired: [currentUser['Reg. No.'], selectedRoommates[0]['Reg. No.']] }
    ];

    // Remove old entries for these Reg. No.s if they exist in the pool to prevent duplicates
    const targetRegs = [currentUser['Reg. No.'], selectedRoommates[0]['Reg. No.'], selectedRoommates[1]['Reg. No.']];
    const filteredPool = pool.filter(p => !targetRegs.includes(p['Reg. No.']));
    
    setPool([...filteredPool, ...newEntries]);
    setSelectedRoommates([]); // reset selection
    setView('dashboard');
    setActiveTab('database');
  };

  // --- DASHBOARD LOGIC ---
  const handleRunEngine = () => {
    try {
      const output = runMatchmakingEngine(pool);
      setResult(output);
      setActiveTab('results');
    } catch (e: any) {
      console.error(e);
      alert("Error running engine. Please check your data.");
    }
  };

  const clearDatabase = () => {
    if (confirm("Are you sure you want to clear the database?")) {
      setPool([]);
      setResult(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans p-4 md:p-8 flex justify-center">
      <div className="max-w-6xl w-full space-y-8">
        
        {/* Header always visible */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Database className="text-blue-500" />
              Roomie Matchmaker
            </h1>
            <p className="text-slate-400 mt-2">
              Cross-branch roommate clustering & post-allocation swap mapping.
            </p>
          </div>
          {view === 'dashboard' && (
            <div className="flex gap-4">
              <button 
                onClick={() => setView('select')}
                className="text-slate-400 hover:text-white transition-colors flex items-center gap-2 font-medium"
              >
                <UserPlus size={18} /> Add More
              </button>
              <button 
                onClick={handleRunEngine}
                disabled={pool.length === 0}
                className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 text-white px-6 py-2.5 rounded-lg font-medium transition-colors shadow-lg shadow-blue-500/20 flex items-center gap-2"
              >
                <Play size={18} /> Run Engine
              </button>
            </div>
          )}
        </header>

        {/* VIEWS */}
        {view === 'login' && (
          <div className="flex justify-center items-center mt-12">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl w-full max-w-md relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-emerald-400"></div>
              <div className="flex justify-center mb-6">
                <div className="bg-blue-500/10 p-4 rounded-full border border-blue-500/20">
                  <LogIn className="text-blue-400" size={32} />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-center text-white mb-2">Institute Login</h2>
              <p className="text-center text-slate-400 mb-8 text-sm">
                Sign in with your official institute Google account to continue.
              </p>
              
              <div className="space-y-4">
                {loginError && <p className="text-red-400 text-sm mt-2 text-center bg-red-400/10 p-3 rounded-lg border border-red-500/20">{loginError}</p>}
                
                <button 
                  onClick={() => handleLogin()} 
                  className="w-full bg-white hover:bg-slate-100 text-slate-900 py-3 rounded-lg font-semibold transition-colors shadow-lg flex justify-center items-center gap-3"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  Sign in with Google
                </button>
              </div>
            </div>
          </div>
        )}

        {view === 'select' && currentUser && (
          <div className="flex justify-center mt-8">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl w-full max-w-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-purple-400"></div>
              <div className="flex justify-between items-center mb-6 pb-6 border-b border-slate-800">
                <div>
                  <h2 className="text-2xl font-bold text-white">Welcome, {currentUser.Name}</h2>
                  <p className="text-slate-400 mt-1">Reg. No: {currentUser['Reg. No.']} • Branch: {currentUser.Program}</p>
                </div>
                <button 
                  onClick={handleLogout}
                  className="text-slate-500 hover:text-slate-300 transition-colors text-sm underline"
                >
                  Logout
                </button>
              </div>

              <h3 className="text-lg font-semibold text-white mb-4">Select Target Roommates (Choose 2)</h3>
              
              <div className="relative mb-6">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search size={18} className="text-slate-500" />
                </div>
                <input 
                  type="text" 
                  placeholder="Search by name or Reg. No..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-10 pr-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  disabled={selectedRoommates.length >= 2}
                />
                
                {filteredStudents.length > 0 && selectedRoommates.length < 2 && (
                  <div className="absolute z-10 w-full mt-2 bg-slate-800 border border-slate-700 rounded-lg shadow-xl overflow-hidden">
                    {filteredStudents.map(s => (
                      <button
                        key={s['Reg. No.']}
                        onClick={() => addRoommate(s)}
                        className="w-full text-left px-4 py-3 hover:bg-slate-700 flex justify-between items-center transition-colors border-b border-slate-700/50 last:border-0"
                      >
                        <span className="text-white font-medium">{s.Name}</span>
                        <span className="text-slate-400 text-sm">{s['Reg. No.']} • {s.Program}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-3 mb-8">
                {selectedRoommates.map((r, i) => (
                  <div key={r['Reg. No.']} className="flex justify-between items-center bg-slate-950 border border-slate-700 rounded-lg p-4">
                    <div>
                      <span className="text-slate-400 text-sm uppercase font-semibold mr-3 tracking-wider">Roommate {i + 1}</span>
                      <span className="text-white font-medium">{r.Name}</span>
                      <span className="text-slate-500 text-sm ml-2">({r['Reg. No.']} • {r.Program})</span>
                    </div>
                    <button 
                      onClick={() => removeRoommate(r['Reg. No.'])}
                      className="text-red-400 hover:text-red-300 p-1 bg-red-400/10 rounded-md transition-colors"
                    >
                      <X size={18} />
                    </button>
                  </div>
                ))}
                {[...Array(2 - selectedRoommates.length)].map((_, i) => (
                  <div key={`empty-${i}`} className="flex items-center bg-slate-950/50 border border-dashed border-slate-700 rounded-lg p-4 text-slate-500">
                    <span className="text-sm uppercase font-semibold mr-3 tracking-wider">Roommate {selectedRoommates.length + i + 1}</span>
                    <span className="italic">Waiting for selection...</span>
                  </div>
                ))}
              </div>

              <button 
                onClick={handleSubmitGroup}
                disabled={selectedRoommates.length !== 2}
                className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white py-3 rounded-lg font-medium transition-colors border border-emerald-500 shadow-lg flex justify-center items-center gap-2"
              >
                Submit Group to Database <ArrowRight size={18} />
              </button>
            </div>
          </div>
        )}

        {view === 'dashboard' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                <LayoutDashboard size={20} className="text-slate-400" />
                System Dashboard
              </h2>
              <div className="flex gap-2 bg-slate-900 p-1 rounded-lg border border-slate-800">
                <button 
                  onClick={() => setActiveTab('database')}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === 'database' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  <List size={16} />
                  Database ({pool.length})
                </button>
                <button 
                  onClick={() => setActiveTab('results')}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === 'results' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  <Users size={16} />
                  Results
                </button>
              </div>
            </div>

            {activeTab === 'database' && (
              <div className="bg-slate-900 rounded-xl border border-slate-800 shadow-xl overflow-hidden flex flex-col h-[600px]">
                <div className="flex justify-between items-center p-4 border-b border-slate-800">
                  <h3 className="text-slate-300 font-medium">Current Matchmaking Pool</h3>
                  <button 
                    onClick={clearDatabase}
                    className="text-red-400 hover:text-red-300 text-sm flex items-center gap-1 transition-colors"
                  >
                    <Trash2 size={14} /> Clear All
                  </button>
                </div>
                <div className="overflow-y-auto flex-1 custom-scrollbar">
                  <table className="w-full text-left text-sm text-slate-300">
                    <thead className="bg-slate-800/50 text-slate-400 sticky top-0 backdrop-blur-sm">
                      <tr>
                        <th className="px-6 py-3 font-medium">Student</th>
                        <th className="px-6 py-3 font-medium">Reg. No.</th>
                        <th className="px-6 py-3 font-medium">Branch</th>
                        <th className="px-6 py-3 font-medium">Desired Roommates</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {pool.map((s, i) => (
                        <tr key={i} className="hover:bg-slate-800/30 transition-colors">
                          <td className="px-6 py-4 text-white font-medium">{s.Name}</td>
                          <td className="px-6 py-4 font-mono text-blue-300">{s['Reg. No.']}</td>
                          <td className="px-6 py-4">
                            <span className="bg-slate-800 border border-slate-700 px-2.5 py-1 rounded-md text-xs text-slate-300 font-medium">
                              {s.Program}
                            </span>
                          </td>
                          <td className="px-6 py-4 font-mono text-slate-400">
                            {s.desired.join(', ')}
                          </td>
                        </tr>
                      ))}
                      {pool.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                            <Database size={32} className="mx-auto mb-3 opacity-20" />
                            No students registered yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'results' && !result && (
              <div className="h-[600px] flex flex-col items-center justify-center border-2 border-dashed border-slate-800 rounded-xl text-slate-500 bg-slate-900/50">
                <Users size={48} className="mb-4 opacity-50" />
                <p className="text-lg font-medium text-slate-400">No results generated yet.</p>
                <p className="text-sm mt-2">Click "Run Engine" to process the database.</p>
              </div>
            )}

            {activeTab === 'results' && result && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 shadow-lg">
                    <div className="text-3xl font-bold text-emerald-400">{result.trueGroups.length}</div>
                    <div className="text-sm text-slate-400 mt-1 font-medium">True Target Groups</div>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 shadow-lg">
                    <div className="text-3xl font-bold text-blue-400">{result.dummyGroups.length}</div>
                    <div className="text-sm text-slate-400 mt-1 font-medium">Dummy Trios Formed</div>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 shadow-lg">
                    <div className="text-3xl font-bold text-purple-400">{result.metaClusters.length}</div>
                    <div className="text-sm text-slate-400 mt-1 font-medium">Meta-Clusters (9-person pools)</div>
                  </div>
                </div>

                <div className="space-y-6 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                  {result.tickets.length > 0 ? (
                    result.tickets.map((ticket, idx) => (
                      <TicketCard key={idx} ticket={ticket} />
                    ))
                  ) : (
                    <div className="p-8 text-center text-slate-400 bg-slate-900 rounded-xl border border-slate-800">
                      No mutual matches found in the current pool.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
