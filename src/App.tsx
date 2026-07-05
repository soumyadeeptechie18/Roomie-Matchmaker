import React, { useState, useEffect, useMemo } from 'react';
import { 
  Heart, Users, User, Search, MessageSquare, ArrowRight, 
  Check, X, Shield, Filter, MapPin, BookOpen, Coffee,
  LogOut, UserPlus, Sparkles, Send, Loader2, AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from './lib/supabase';
import { STUDENT_DATABASE } from './data/students';

// --- TYPES ---
type Branch = 'Computer Science' | 'Electronics' | 'Mechanical' | 'Civil' | 'Chemical' | 'Biotech';
type Gender = 'M' | 'F' | 'Other';

interface UserProfile {
  id: string;
  email: string;
  name: string;
  branch: Branch | '';
  gender: Gender | '';
  bio: string;
  preferences: string[];
  alreadyHasRoommate: boolean;
  existingRoommateName?: string;
  lookingFor: number;
  avatarUrl: string;
}

interface RoommateRequest {
  id: string;
  fromId: string;
  toId: string;
  status: 'pending' | 'accepted' | 'rejected';
}

const PREFERENCE_TAGS = [
  'Bengali', 'Hindi', 'English', 'Telugu', 'Tamil',
  'Night Owl', 'Early Bird', 'Neat Freak', 'Relaxed about cleaning',
  'Non-Smoker', 'Smoker', 'Vegetarian', 'Non-Vegetarian',
  'Gamer', 'Studious', 'Gym Bro', 'Music Lover'
];

export default function App() {
  const [view, setView] = useState<'auth' | 'onboarding' | 'feed' | 'requests' | 'profile'>('auth');
  const [isLoading, setIsLoading] = useState(true);
  
  // Auth & Profile State
  const [session, setSession] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [authError, setAuthError] = useState('');

  // App State (Fallback to local state if Supabase tables don't exist)
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [requests, setRequests] = useState<RoommateRequest[]>([]);
  const [dbError, setDbError] = useState(false);

  // --- AUTH LOGIC ---
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      handleSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      handleSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSession = async (currentSession: any) => {
    setSession(currentSession);
    if (currentSession?.user) {
      const userEmail = currentSession.user.email || '';
      
      // Strict Institute Email Check
      if (!userEmail.endsWith('@nitdgp.ac.in')) {
        setAuthError('Only @nitdgp.ac.in emails are allowed to access this network.');
        await supabase.auth.signOut();
        setIsLoading(false);
        return;
      }

      // Extract Reg No from email
      const parts = userEmail.split('@')[0].split('.');
      const regNo = parts[parts.length - 1].toUpperCase();
      
      // Find in student database
      const student = STUDENT_DATABASE.find(s => s['Reg. No.'] === regNo);
      
      if (!student) {
        setAuthError('Student not found in the database for this email.');
        await supabase.auth.signOut();
        setIsLoading(false);
        return;
      }

      if (student.Gender !== 'M') {
        setAuthError('Registration is currently restricted to males only.');
        await supabase.auth.signOut();
        setIsLoading(false);
        return;
      }
      
      setAuthError('');
      await loadUserData(currentSession.user.id, userEmail, student);
    } else {
      setCurrentUser(null);
      setView('auth');
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setAuthError('');
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          queryParams: {
            // Optional: prefill hosted domain to restrict google account picker
            hd: 'nitdgp.ac.in'
          }
        }
      });
      if (error) throw error;
    } catch (err: any) {
      setAuthError(err.message);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    setView('auth');
  };

  // --- DATABASE LOGIC (WITH LOCAL FALLBACK) ---
  const loadUserData = async (userId: string, email: string, student: any) => {
    try {
      // Attempt to load from Supabase
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (profileError && profileError.code === '42P01') {
        // Table doesn't exist - use local state fallback
        setDbError(true);
        handleLocalFallbackMode(userId, email, student);
        return;
      }

      if (profileData) {
        setCurrentUser(profileData as UserProfile);
        await loadFeedData(userId, profileData.branch, profileData.gender);
        setView('feed');
      } else {
                // Needs onboarding
        setCurrentUser({
          id: userId,
          email: email,
          name: student.Name,
          branch: student.Program,
          gender: student.Gender,
          bio: '',
          preferences: [],
          alreadyHasRoommate: false,
          lookingFor: 2,
          avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`
        });
        setView('onboarding');
      }
    } catch (err) {
      console.error(err);
      handleLocalFallbackMode(userId, email, student);
    } finally {
      setIsLoading(false);
    }
  };

  const loadFeedData = async (userId: string, branch: string, gender: string) => {
    try {
      const { data: profiles, error: pError } = await supabase
        .from('profiles')
        .select('*')
        .eq('branch', branch)
        .eq('gender', gender)
        .neq('id', userId);
        
      if (!pError && profiles) setAllUsers(profiles as UserProfile[]);

      const { data: reqs, error: rError } = await supabase
        .from('roommate_requests')
        .select('*')
        .or(`fromId.eq.${userId},toId.eq.${userId}`);
        
      if (!rError && reqs) setRequests(reqs as RoommateRequest[]);
    } catch (e) {
      console.error(e);
    }
  };

  // Local fallback logic when Supabase tables aren't created yet
  const handleLocalFallbackMode = (userId: string, email: string, student: any) => {
    setIsLoading(false);
    const existing = allUsers.find(u => u.id === userId);
    if (existing) {
      setCurrentUser(existing);
      setView('feed');
    } else {
      setCurrentUser({
        id: userId,
        email: email,
        name: student.Name,
        branch: student.Program,
        gender: student.Gender,
        bio: '',
        preferences: [],
        alreadyHasRoommate: false,
        lookingFor: 2,
        avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`
      });
      setView('onboarding');
    }
  };

  // --- ONBOARDING STATE ---
  const [onboardingData, setOnboardingData] = useState<Partial<UserProfile>>({});
  
  const handleOnboardingSubmit = async () => {
    if (!currentUser) return;
    const updatedUser = { ...currentUser, ...onboardingData } as UserProfile;
    
    if (!dbError) {
      try {
        const { error } = await supabase.from('profiles').upsert(updatedUser);
        if (error) throw error;
      } catch (err) {
        console.error("DB Save failed, falling back to local state", err);
        setDbError(true);
      }
    }
    
    // Update local state regardless
    setAllUsers(prev => [...prev.filter(u => u.id !== updatedUser.id), updatedUser]);
    setCurrentUser(updatedUser);
    setView('feed');
  };

  const togglePreference = (pref: string) => {
    setOnboardingData(prev => {
      const current = prev.preferences || [];
      if (current.includes(pref)) {
        return { ...prev, preferences: current.filter(p => p !== pref) };
      } else {
        return { ...prev, preferences: [...current, pref] };
      }
    });
  };

  // --- FEED LOGIC ---
  const feedUsers = useMemo(() => {
    if (!currentUser) return [];
    return allUsers.filter(u => 
      u.id !== currentUser.id && 
      u.branch === currentUser.branch &&
      u.gender === currentUser.gender &&
      u.lookingFor > 0 // Only show people who are looking for someone
    );
  }, [currentUser, allUsers]);

  const handleSendRequest = async (toId: string) => {
    if (!currentUser) return;
    const newReq: RoommateRequest = {
      id: `req_${Date.now()}`,
      fromId: currentUser.id,
      toId,
      status: 'pending'
    };
    
    if (!dbError) {
       await supabase.from('roommate_requests').insert(newReq);
    }
    
    setRequests(prev => [...prev, newReq]);
  };

  const handleAcceptRequest = async (reqId: string) => {
    if (!currentUser) return;
    
    // Update request status
    if (!dbError) {
        await supabase.from('roommate_requests').update({ status: 'accepted' }).eq('id', reqId);
    }
    setRequests(prev => prev.map(r => r.id === reqId ? { ...r, status: 'accepted' } : r));
    
    // Update our own profile
    const req = requests.find(r => r.id === reqId);
    if (req) {
       const otherUser = allUsers.find(u => u.id === req.fromId);
       if (otherUser) {
           const updatedMe = { 
               ...currentUser, 
               alreadyHasRoommate: true,
               existingRoommateName: currentUser.alreadyHasRoommate 
                  ? `${currentUser.existingRoommateName} & ${otherUser.name}` 
                  : otherUser.name,
               lookingFor: Math.max(0, currentUser.lookingFor - 1)
           };
           setCurrentUser(updatedMe);
           setAllUsers(prev => prev.map(u => u.id === currentUser.id ? updatedMe : u));
           
           if (!dbError) {
              await supabase.from('profiles').update(updatedMe).eq('id', currentUser.id);
           }
       }
    }
  };

  // --- DERIVED STATE ---
  const incomingRequests = requests.filter(r => r.toId === currentUser?.id && r.status === 'pending');
  const outgoingRequests = requests.filter(r => r.fromId === currentUser?.id);

  // --- RENDERERS ---
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <Loader2 className="animate-spin text-rose-500 mb-4" size={48} />
        <p className="text-slate-400 font-medium">Authenticating...</p>
      </div>
    );
  }

  if (view === 'auth') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 selection:bg-rose-500/30">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-rose-500 to-orange-500"></div>
          
          <div className="flex justify-center mb-8">
            <div className="bg-rose-500/10 p-4 rounded-full border border-rose-500/20">
              <Heart className="text-rose-500" size={40} fill="currentColor" />
            </div>
          </div>
          
          <h1 className="text-3xl font-bold text-white text-center mb-2 tracking-tight">RoommateMatch</h1>
          <p className="text-slate-400 text-center mb-8">Find your perfect dorm companion.</p>
          
          {authError && (
            <div className="mb-6 flex items-start gap-3 text-rose-400 text-sm bg-rose-500/10 p-4 rounded-xl border border-rose-500/20">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <span>{authError}</span>
            </div>
          )}
          
          <button
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-50 text-slate-900 font-semibold py-3.5 rounded-xl shadow-lg transition-all transform hover:scale-[1.02] active:scale-95"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" xmlns="http://www.w3.org/2000/svg"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            Sign in with Institute Google
          </button>
          
          <div className="mt-6 flex items-center justify-center gap-2 text-sm text-slate-500">
            <Shield size={14} />
            <span>Secure @nitdgp.ac.in network</span>
          </div>
        </motion.div>
      </div>
    );
  }

  if (view === 'onboarding') {
    return (
      <div className="min-h-screen bg-slate-950 p-4 sm:p-8 flex justify-center">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl"
        >
          <h2 className="text-2xl font-bold text-white mb-2">Build Your Profile</h2>
          <p className="text-slate-400 mb-8">Let's set up your roommate preferences.</p>
          
          <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Full Name</label>
                <input
                  type="text"
                  value={currentUser?.name || ''}
                  disabled
                  className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 text-slate-500 cursor-not-allowed"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Branch</label>
                <input
                  type="text"
                  value={currentUser?.branch || ''}
                  disabled
                  className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 text-slate-500 cursor-not-allowed"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Gender</label>
                <input
                  type="text"
                  value={currentUser?.gender === 'M' ? 'Male' : currentUser?.gender === 'F' ? 'Female' : currentUser?.gender || ''}
                  disabled
                  className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 text-slate-500 cursor-not-allowed"
                />
              </div>
            </div>

            <div className="border-t border-slate-800 pt-6">
              <label className="block text-sm font-medium text-slate-400 mb-4">Current Status</label>
              <div className="flex gap-4">
                <button
                  onClick={() => setOnboardingData({...onboardingData, alreadyHasRoommate: false, lookingFor: 2})}
                  className={`flex-1 py-3 px-4 rounded-xl border transition-all ${onboardingData.alreadyHasRoommate === false ? 'bg-rose-500/10 border-rose-500 text-rose-400' : 'bg-slate-950 border-slate-800 text-slate-400'}`}
                >
                  I'm alone, looking for roommates
                </button>
                <button
                  onClick={() => setOnboardingData({...onboardingData, alreadyHasRoommate: true, lookingFor: 1})}
                  className={`flex-1 py-3 px-4 rounded-xl border transition-all ${onboardingData.alreadyHasRoommate === true ? 'bg-rose-500/10 border-rose-500 text-rose-400' : 'bg-slate-950 border-slate-800 text-slate-400'}`}
                >
                  We are 2, looking for a 3rd
                </button>
              </div>
            </div>

            {onboardingData.alreadyHasRoommate && (
              <motion.div initial={{opacity:0, height:0}} animate={{opacity:1, height:'auto'}}>
                <label className="block text-sm font-medium text-slate-400 mb-2 mt-4">Existing Roommate's Name</label>
                <input
                  type="text"
                  value={onboardingData.existingRoommateName || ''}
                  onChange={e => setOnboardingData({...onboardingData, existingRoommateName: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:border-rose-500 outline-none"
                  placeholder="E.g. Rohan"
                />
              </motion.div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">Short Bio / Description</label>
              <textarea
                value={onboardingData.bio || ''}
                onChange={e => setOnboardingData({...onboardingData, bio: e.target.value})}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:border-rose-500 outline-none h-24 resize-none"
                placeholder="Tell others about your daily routine, habits, what you study, etc."
              ></textarea>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-400 mb-3">Tags & Preferences (Select multiple)</label>
              <div className="flex flex-wrap gap-2">
                {PREFERENCE_TAGS.map(tag => (
                  <button
                    key={tag}
                    onClick={() => togglePreference(tag)}
                    className={`px-3 py-1.5 rounded-full text-sm border transition-all ${
                      (onboardingData.preferences || []).includes(tag)
                        ? 'bg-rose-500 text-white border-rose-500'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-600'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleOnboardingSubmit}
              disabled={false}
              className="w-full bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-400 hover:to-orange-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-4 rounded-xl shadow-lg transition-all mt-8 text-lg"
            >
              Complete Profile & Enter Feed
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans pb-24">
      {/* TOP NAV */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-50 px-4 py-4">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Heart className="text-rose-500" size={24} fill="currentColor" />
            <span className="text-xl font-bold text-white tracking-tight">Match</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-400 hidden sm:inline-block">
              {currentUser?.branch}
            </span>
            <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 overflow-hidden">
                <img src={currentUser?.avatarUrl} alt="avatar" />
            </div>
          </div>
        </div>
      </header>

      {dbError && (
        <div className="bg-orange-500/10 border-b border-orange-500/20 px-4 py-2 flex items-center justify-center gap-2">
          <AlertCircle size={16} className="text-orange-400" />
          <span className="text-xs font-medium text-orange-200">Supabase tables missing. Running in local memory mode.</span>
        </div>
      )}

      {/* MAIN CONTENT */}
      <main className="max-w-md mx-auto p-4 mt-4">
        
        {view === 'feed' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between px-2">
              <h2 className="text-lg font-semibold text-white">Suggested for You</h2>
              <Filter size={18} className="text-slate-400" />
            </div>

            {feedUsers.length === 0 ? (
              <div className="text-center py-20 bg-slate-900 border border-slate-800 rounded-3xl">
                <Users size={48} className="text-slate-700 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-white">No matches found</h3>
                <p className="text-slate-400 mt-2">Check back later for new registrations.</p>
              </div>
            ) : (
              <div className="relative">
                {feedUsers.map((user, idx) => {
                  const hasSentRequest = requests.some(r => r.toId === user.id && r.fromId === currentUser?.id);
                  return (
                    <motion.div 
                      key={user.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden mb-6 shadow-xl"
                    >
                      <div className="bg-slate-800 h-48 relative overflow-hidden flex items-center justify-center p-6">
                         <div className="absolute inset-0 opacity-30 bg-gradient-to-br from-rose-500/20 to-purple-500/20"></div>
                         <img src={user.avatarUrl} alt={user.name} className="w-32 h-32 rounded-full border-4 border-slate-900 bg-slate-900 relative z-10 shadow-lg" />
                         
                         {user.alreadyHasRoommate && (
                           <div className="absolute top-4 right-4 bg-slate-950/80 backdrop-blur border border-slate-700 px-3 py-1.5 rounded-full flex items-center gap-2 text-xs font-medium text-slate-200">
                             <Users size={14} className="text-rose-400" />
                             Group of 2
                           </div>
                         )}
                      </div>
                      
                      <div className="p-6">
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                              {user.name}
                              <Check size={18} className="text-blue-400 bg-blue-400/10 rounded-full p-0.5" />
                            </h3>
                            <p className="text-slate-400 text-sm flex items-center gap-1 mt-1">
                              <BookOpen size={14} /> {user.branch} • Looking for {user.lookingFor}
                            </p>
                          </div>
                        </div>

                        {user.alreadyHasRoommate && (
                          <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 mb-4 flex items-start gap-3">
                            <Sparkles className="text-rose-400 shrink-0 mt-0.5" size={16} />
                            <p className="text-sm text-rose-200/90 leading-tight">
                              Already rooming with <strong>{user.existingRoommateName}</strong>. Looking for {user.lookingFor} more person.
                            </p>
                          </div>
                        )}

                        <div className="mb-6">
                          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">About</h4>
                          <p className="text-slate-300 text-sm leading-relaxed">{user.bio || 'No bio provided.'}</p>
                        </div>

                        <div className="mb-6">
                           <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Preferences</h4>
                           <div className="flex flex-wrap gap-2">
                             {(user.preferences || []).map(pref => (
                               <span key={pref} className="bg-slate-950 border border-slate-800 text-slate-300 px-3 py-1 rounded-full text-xs font-medium">
                                 {pref}
                               </span>
                             ))}
                             {(!user.preferences || user.preferences.length === 0) && (
                               <span className="text-slate-500 text-sm italic">None selected</span>
                             )}
                           </div>
                        </div>

                        <button
                          onClick={() => handleSendRequest(user.id)}
                          disabled={hasSentRequest || currentUser?.lookingFor === 0}
                          className={`w-full py-3.5 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all ${
                            hasSentRequest || currentUser?.lookingFor === 0
                              ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                              : 'bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-400 hover:to-orange-400 text-white shadow-lg shadow-rose-500/20'
                          }`}
                        >
                          {currentUser?.lookingFor === 0 ? (
                            <>Room Full</>
                          ) : hasSentRequest ? (
                            <>Request Sent <Check size={18} /></>
                          ) : (
                            <>Send Roommate Request <Send size={18} /></>
                          )}
                        </button>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {view === 'requests' && (
          <div className="space-y-8">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-4">
                <MessageSquare className="text-rose-500" />
                Incoming Requests
              </h2>
              
              {incomingRequests.length === 0 ? (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center text-slate-500">
                  No new requests yet.
                </div>
              ) : (
                <div className="space-y-4">
                  {incomingRequests.map(req => {
                    const fromUser = allUsers.find(u => u.id === req.fromId);
                    if (!fromUser) return null;
                    return (
                      <div key={req.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex gap-4 items-center">
                        <img src={fromUser.avatarUrl} alt={fromUser.name} className="w-16 h-16 rounded-full bg-slate-800" />
                        <div className="flex-1 min-w-0">
                          <h3 className="text-white font-medium truncate">{fromUser.name}</h3>
                          {fromUser.alreadyHasRoommate && <p className="text-rose-400 text-[10px] uppercase font-bold tracking-wider mt-0.5">Group of 2</p>}
                          <p className="text-slate-400 text-xs mt-1 truncate">{fromUser.bio}</p>
                        </div>
                        <div className="flex flex-col gap-2 shrink-0">
                          <button 
                            onClick={() => handleAcceptRequest(req.id)}
                            className="bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 p-2 rounded-lg transition-colors"
                          >
                            <Check size={18} />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-4">
                <Send className="text-slate-500" />
                Sent Requests
              </h2>
              {outgoingRequests.length === 0 ? (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center text-slate-500">
                  You haven't sent any requests.
                </div>
              ) : (
                <div className="space-y-3">
                  {outgoingRequests.map(req => {
                    const toUser = allUsers.find(u => u.id === req.toId);
                    if (!toUser) return null;
                    return (
                      <div key={req.id} className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <img src={toUser.avatarUrl} alt={toUser.name} className="w-10 h-10 rounded-full bg-slate-800" />
                          <span className="text-slate-300 text-sm font-medium">{toUser.name}</span>
                        </div>
                        <span className="text-xs font-semibold bg-slate-800 text-slate-400 px-2 py-1 rounded-md uppercase tracking-wider">
                          {req.status}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {view === 'profile' && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-center shadow-xl">
               <img src={currentUser?.avatarUrl} alt="You" className="w-24 h-24 rounded-full mx-auto mb-4 border-4 border-slate-950 bg-slate-800" />
               <h2 className="text-2xl font-bold text-white mb-1">{currentUser?.name}</h2>
               <p className="text-slate-400 text-sm mb-6">{currentUser?.email}</p>
               
               {currentUser?.alreadyHasRoommate ? (
                 <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 text-left">
                   <h4 className="text-sm font-semibold text-rose-400 mb-2 flex items-center gap-2"><Users size={16}/> Your Current Group</h4>
                   <p className="text-rose-100/80 text-sm">You are currently paired with <strong>{currentUser.existingRoommateName}</strong>. You are looking for {currentUser.lookingFor} more person.</p>
                 </div>
               ) : (
                 <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 text-left">
                   <h4 className="text-sm font-semibold text-slate-300 mb-2 flex items-center gap-2"><User size={16}/> Solo</h4>
                   <p className="text-slate-400 text-sm">You are looking for {currentUser?.lookingFor} more roommates to form a group.</p>
                 </div>
               )}
            </div>

            <button
              onClick={handleSignOut}
              className="w-full bg-slate-900 hover:bg-slate-800 text-rose-400 border border-slate-800 py-4 rounded-2xl font-medium transition-colors flex items-center justify-center gap-2"
            >
              <LogOut size={18} /> Sign Out
            </button>
          </div>
        )}

      </main>

      {/* BOTTOM NAV */}
      <nav className="fixed bottom-0 w-full bg-slate-950/90 backdrop-blur-lg border-t border-slate-800 pb-safe">
        <div className="max-w-md mx-auto flex justify-around px-2 py-3">
          <button 
            onClick={() => setView('feed')}
            className={`flex flex-col items-center gap-1 p-2 w-16 transition-colors ${view === 'feed' ? 'text-rose-500' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <Users size={24} className={view === 'feed' ? 'fill-rose-500/20' : ''} />
            <span className="text-[10px] font-semibold uppercase tracking-wider">Feed</span>
          </button>
          <button 
            onClick={() => setView('requests')}
            className={`flex flex-col items-center gap-1 p-2 w-16 transition-colors relative ${view === 'requests' ? 'text-rose-500' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <div className="relative">
              <MessageSquare size={24} className={view === 'requests' ? 'fill-rose-500/20' : ''} />
              {incomingRequests.length > 0 && (
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-rose-500 rounded-full border-2 border-slate-950"></span>
              )}
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-wider">Requests</span>
          </button>
          <button 
            onClick={() => setView('profile')}
            className={`flex flex-col items-center gap-1 p-2 w-16 transition-colors ${view === 'profile' ? 'text-rose-500' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <User size={24} className={view === 'profile' ? 'fill-rose-500/20' : ''} />
            <span className="text-[10px] font-semibold uppercase tracking-wider">Profile</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
