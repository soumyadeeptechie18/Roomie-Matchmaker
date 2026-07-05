const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');
const search = `  // --- LOGIN LOGIC ---
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

          const match = email.match(/\\d{2}[a-zA-Z]\\d{5}/i);
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
            setLoginError(\`Reg. No. \${regNo} not found in the official database.\`);
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
  }, []);`;

const replace = `  // --- LOGIN LOGIC ---
  useEffect(() => {
    const handleSession = (session: any) => {
        if (session?.user?.email) {
          const email = session.user.email;
          
          if (!email.endsWith('@nitdgp.ac.in')) {
            setLoginError("Please use your official institute email (@nitdgp.ac.in).");
            supabase.auth.signOut();
            return;
          }

          const match = email.match(/\\d{2}[a-zA-Z]\\d{5}/i);
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
            
            // clear hash from URL for cleaner look
            if (window.location.hash) {
              window.history.replaceState(null, '', window.location.pathname);
            }
          } else {
            setLoginError(\`Reg. No. \${regNo} not found in the official database.\`);
            supabase.auth.signOut();
          }
        }
    };

    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
       handleSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        handleSession(session);
        if (event === 'SIGNED_OUT') {
            setCurrentUser(null);
            setView('login');
            setSelectedRoommates([]);
            setHasSubmitted(false);
            setIsEditMode(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);`;

if(code.includes('const { data: { subscription } } = supabase.auth.onAuthStateChange')) {
    code = code.replace(search, replace);
    fs.writeFileSync('src/App.tsx', code);
    console.log("Fixed!");
} else {
    console.log("Not found.");
}
