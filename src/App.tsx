import { useState, useMemo, useEffect } from 'react';
import { STUDENT_DATABASE, BaseStudent } from './data/students';
import { Database, Users, LayoutDashboard, UserPlus, Search, LogIn, ArrowRight, X, Edit2, AlertCircle } from 'lucide-react';
import { supabase } from './lib/supabase';

export default function App() {
  const [view, setView] = useState<'login' | 'select' | 'dashboard'>('login');
  const [currentUser, setCurrentUser] = useState<BaseStudent | null>(null);

  // Login State
  const [loginError, setLoginError] = useState('');

  // Select State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoommates, setSelectedRoommates] = useState<BaseStudent[]>([]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  // Dashboard State
  const [totalRegistered, setTotalRegistered] = useState<number>(0);
  const [branchStats, setBranchStats] = useState<Record<string, number>>({});
  const [registeredStudents, setRegisteredStudents] = useState<Record<string, string>>({});

  // --- DATABASE SYNC ---
  useEffect(() => {
    if (!currentUser) return;
    
    // Check if user already submitted
    const checkExistingSubmission = async () => {
      try {
        const { data, error } = await supabase
          .from('roommate_selections')
          .select('*')
          .eq('reg_no', currentUser['Reg. No.'])
          .maybeSingle();
          
        if (data) {
          setHasSubmitted(true);
          const r1 = STUDENT_DATABASE.find(s => s['Reg. No.'] === data.roommate1_reg_no);
          const r2 = STUDENT_DATABASE.find(s => s['Reg. No.'] === data.roommate2_reg_no);
          if (r1 && r2) {
            setSelectedRoommates([r1, r2]);
          }
          setView('dashboard');
        }
      } catch (err) {
        console.error("Error fetching submission:", err);
      }
    };
    
    checkExistingSubmission();
  }, [currentUser]);

  useEffect(() => {
    // Fetch total registered count
    const fetchTotal = async () => {
      try {
        const { data, error } = await supabase
          .from('roommate_selections')
          .select('reg_no, roommate1_reg_no, roommate2_reg_no');
        
        if (data && !error) {
          setTotalRegistered(data.length);

          const stats: Record<string, number> = {};
          const registeredMap: Record<string, string> = {};
          data.forEach(row => {
            const regs = [row.reg_no, row.roommate1_reg_no, row.roommate2_reg_no];
            regs.forEach(reg => {
              registeredMap[reg] = row.reg_no;
              const student = STUDENT_DATABASE.find(s => s['Reg. No.'] === reg);
              if (student) {
                stats[student.Program] = (stats[student.Program] || 0) + 1;
              }
            });
          });
          
          setBranchStats(stats);
          setRegisteredStudents(registeredMap);
        }
      } catch (err) {
        console.error(err);
      }
    };

    fetchTotal();

    // Subscribe to realtime changes
    const subscription = supabase
      .channel('roommate_selections_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'roommate_selections' }, () => {
        fetchTotal();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // --- LOGIN LOGIC ---
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (session?.user?.email) {
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
            setSelectedRoommates([]);
            setHasSubmitted(false);
            setIsEditMode(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoginError('');
    
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        queryParams: {
          prompt: 'select_account',
          hd: 'nitdgp.ac.in'
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
      s.Gender === 'M' &&
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

  const handleSubmitGroup = async () => {
    if (selectedRoommates.length !== 2 || !currentUser) return;
    
    try {
      const { error } = await supabase.from('roommate_selections').upsert({
        reg_no: currentUser['Reg. No.'],
        roommate1_reg_no: selectedRoommates[0]['Reg. No.'],
        roommate2_reg_no: selectedRoommates[1]['Reg. No.']
      });

      if (error) throw error;

      setHasSubmitted(true);
      setIsEditMode(false);
      setView('dashboard');
    } catch (err: any) {
      console.error(err);
      alert("Error saving your roommates to the database. Have you created the table in Supabase yet?");
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-blue-500/30 selection:text-blue-200">
      <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8">
        
        {/* HEADER */}
        <header className="flex flex-col sm:flex-row justify-between items-center mb-10 pb-6 border-b border-slate-800">
          <div className="flex items-center gap-3 mb-4 sm:mb-0">
            <div className="bg-gradient-to-br from-blue-500 to-emerald-400 p-2.5 rounded-xl shadow-lg shadow-blue-500/20">
              <Users size={28} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Hostel Match</h1>
              <p className="text-slate-400 text-sm font-medium">B.Tech Second Year (2025)</p>
            </div>
          </div>
          
          <div className="flex gap-3">
            {currentUser && (
              <>
                <button 
                  onClick={() => setView('select')}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${view === 'select' ? 'bg-slate-800 text-white shadow-inner' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'}`}
                >
                  My Group
                </button>
                <button 
                  onClick={() => setView('dashboard')}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${view === 'dashboard' ? 'bg-slate-800 text-white shadow-inner' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'}`}
                >
                  Dashboard
                </button>
              </>
            )}
          </div>
        </header>

        {/* VIEWS */}
        {view === 'login' && (
          <div className="flex justify-center items-center mt-12">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl w-full max-w-md relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-emerald-400"></div>
              <div className="flex justify-center mb-6">
                <div className="bg-blue-500/10 p-4 rounded-full border border-blue-500/20">
                  <LogIn size={32} className="text-blue-400" />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-center text-white mb-2">Institute Login</h2>
              <p className="text-center text-slate-400 mb-6 text-sm">
                Sign in with your official institute Google account to continue.
              </p>
              
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 mb-6 flex items-start gap-3 flex-col">
                <div className="flex items-start gap-3">
                  <AlertCircle className="text-amber-400 shrink-0 mt-0.5" size={20} />
                  <p className="text-sm text-amber-200/90 leading-relaxed">
                    <strong>Important:</strong> Only register yourself and your roommates if you are confirmed to change rooms unofficially later.
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <AlertCircle className="text-amber-400 shrink-0 mt-0.5" size={20} />
                  <p className="text-sm text-amber-200/90 leading-relaxed">
                    <strong>Notice:</strong> Register only if you haven't filled the official form of roommates yet.
                  </p>
                </div>
              </div>

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
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8 shadow-2xl w-full max-w-2xl">
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h2 className="text-2xl font-bold text-white">Select Your Roommates</h2>
                  <p className="text-slate-400 mt-1">Reg. No: {currentUser['Reg. No.']} • Branch: {currentUser.Program}</p>
                </div>
                <button 
                  onClick={handleLogout}
                  className="text-slate-500 hover:text-slate-300 transition-colors text-sm underline"
                >
                  Logout
                </button>
              </div>

              {hasSubmitted && !isEditMode ? (
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-6 text-center">
                  <div className="bg-emerald-500/20 p-4 rounded-full inline-block mb-4">
                    <Database size={32} className="text-emerald-400" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">Choices Submitted Successfully</h3>
                  <p className="text-slate-400 mb-6">You have successfully locked in your roommate choices. You can edit them if you change your mind.</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8 text-left">
                    {selectedRoommates.map((r, i) => (
                      <div key={r['Reg. No.']} className="bg-slate-950 border border-slate-800 rounded-lg p-4 flex items-center gap-3">
                         <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 font-bold text-sm">
                           {i+1}
                         </div>
                         <div>
                            <p className="text-white font-medium text-sm">{r.Name}</p>
                            <p className="text-slate-500 text-xs">{r['Reg. No.']} • {r.Program}</p>
                         </div>
                      </div>
                    ))}
                  </div>

                  <button 
                    onClick={() => setIsEditMode(true)}
                    className="bg-slate-800 hover:bg-slate-700 text-white px-6 py-2.5 rounded-lg font-medium transition-colors border border-slate-700 shadow-lg flex justify-center items-center gap-2 mx-auto"
                  >
                    <Edit2 size={18} /> Edit Choices
                  </button>
                </div>
              ) : (
                <>
                  <div className="relative mb-8">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Search size={18} className="text-slate-500" />
                    </div>
                    <input 
                      type="text" 
                      placeholder="Search male students by name or reg no..."
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-11 pr-4 py-4 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-inner" 
                      value={searchQuery} 
                      onChange={e => setSearchQuery(e.target.value)}
                      disabled={selectedRoommates.length >= 2}
                    />
                    
                    {/* Search Results Dropdown */}
                    {searchQuery && (
                      <div className="absolute z-10 w-full mt-2 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden divide-y divide-slate-700">
                        {filteredStudents.length > 0 ? (
                          filteredStudents.map(student => {
                            const isAlreadyRegistered = registeredStudents[student['Reg. No.']] && registeredStudents[student['Reg. No.']] !== currentUser?.['Reg. No.'];
                            return (
                              <button
                                key={student['Reg. No.']}
                                onClick={() => addRoommate(student)}
                                disabled={!!isAlreadyRegistered}
                                className={`w-full text-left px-4 py-3 flex justify-between items-center group ${isAlreadyRegistered ? 'opacity-50 cursor-not-allowed bg-slate-800/80' : 'hover:bg-slate-700/50 transition-colors'}`}
                              >
                                <div>
                                  <div className={`font-medium transition-colors ${isAlreadyRegistered ? 'text-slate-500' : 'text-white group-hover:text-blue-400'}`}>
                                    {student.Name}
                                  </div>
                                  <div className="text-slate-400 text-sm flex items-center gap-2">
                                    <span>{student['Reg. No.']} • {student.Program}</span>
                                    {isAlreadyRegistered && (
                                      <span className="text-red-400 text-xs font-semibold bg-red-400/10 px-2 py-0.5 rounded-full border border-red-500/20">
                                        Already registered with {registeredStudents[student['Reg. No.']]}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                {!isAlreadyRegistered && <UserPlus size={18} className="text-slate-500 group-hover:text-blue-400 transition-colors" />}
                              </button>
                            );
                          })
                        ) : (
                          <div className="px-4 py-4 text-slate-400 text-center text-sm">
                            No matching male students found.
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="space-y-4 mb-8">
                    <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-2">Selected Roommates ({selectedRoommates.length}/2)</h3>
                    
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

                  <div className="flex gap-3">
                    {isEditMode && (
                      <button 
                        onClick={() => setIsEditMode(false)}
                        className="flex-1 bg-slate-800 hover:bg-slate-700 text-white py-3 rounded-lg font-medium transition-colors border border-slate-700 shadow-lg"
                      >
                        Cancel
                      </button>
                    )}
                    <button 
                      onClick={handleSubmitGroup}
                      disabled={selectedRoommates.length !== 2}
                      className="flex-[2] bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white py-3 rounded-lg font-medium transition-colors border border-emerald-500 shadow-lg flex justify-center items-center gap-2"
                    >
                      {isEditMode ? 'Update Choices in Database' : 'Submit Choices to Database'} <ArrowRight size={18} />
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {view === 'dashboard' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                <LayoutDashboard size={20} className="text-slate-400" />
                Live Dashboard
              </h2>
            </div>
            
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl relative overflow-hidden text-center mb-6">
               <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-purple-500"></div>
               <div className="inline-flex items-center justify-center bg-blue-500/10 p-4 rounded-full border border-blue-500/20 mb-6 animate-pulse">
                  <Database size={48} className="text-blue-400" />
               </div>
               <h3 className="text-4xl font-bold text-white mb-2">{totalRegistered * 3}</h3>
               <p className="text-xl font-medium text-slate-300 mb-2">Total Students Registered in the System</p>
               <p className="text-slate-500 mb-6">({totalRegistered} independent groups formed)</p>

               <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 inline-block text-left mb-2">
                 <p className="text-sm text-blue-200/90 leading-relaxed">
                    <strong>Update:</strong> A list of dummy roommates to fill the official form will be generated today at 9 PM, on the basis of entries received till then.
                 </p>
               </div>
               
               <div className="mt-6 flex justify-center">
                 <div className="bg-slate-950 border border-slate-800 rounded-lg py-3 px-6 inline-flex items-center gap-3">
                   <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
                   <span className="text-slate-400 text-sm font-medium">Real-time database sync active</span>
                 </div>
               </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
              <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                <Users size={18} className="text-slate-400" />
                Branch-wise Registration Stats
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {Object.entries(branchStats).sort((a, b) => b[1] - a[1]).map(([branch, count]) => (
                  <div key={branch} className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
                    <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">{branch}</span>
                    <div className="flex items-end justify-between">
                      <span className="text-2xl font-bold text-emerald-400">{count}</span>
                      <span className="text-slate-500 text-sm mb-1">students</span>
                    </div>
                  </div>
                ))}
                {Object.keys(branchStats).length === 0 && (
                  <div className="col-span-full text-center text-slate-500 py-8">
                    No data available yet.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
