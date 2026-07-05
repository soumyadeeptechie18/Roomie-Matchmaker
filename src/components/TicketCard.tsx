import { InstructionTicket } from '../types';
import { User, FileCheck, ArrowRightLeft, CheckCircle2 } from 'lucide-react';

export default function TicketCard({ ticket }: { ticket: InstructionTicket }) {
  const { student, outputPayload } = ticket;

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-xl w-full max-w-2xl text-slate-200">
      <div className="flex items-center justify-between border-b border-slate-700 pb-4 mb-4">
        <div>
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <User className="text-emerald-400" size={24} />
            {student.Name}
          </h3>
          <p className="text-sm text-slate-400">Reg. No: {student['Reg. No.']} • Branch: {student.Program}</p>
        </div>
        <div className="bg-emerald-400/10 text-emerald-400 px-3 py-1 rounded-full text-sm font-medium border border-emerald-400/20">
          Match Confirmed
        </div>
      </div>

      <div className="space-y-6">
        {/* Step 1: Official Form */}
        <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700/50">
          <h4 className="font-semibold text-white flex items-center gap-2 mb-2">
            <FileCheck className="text-blue-400" size={18} />
            Official Form Entries (Dummy Group)
          </h4>
          <p className="text-sm text-slate-300 mb-2">
            To bypass the branch restriction, fill out the official hostel form with these same-branch students:
          </p>
          <div className="flex flex-wrap gap-2">
            {ticket.dummyGroup.filter(m => m['Reg. No.'] !== student['Reg. No.']).map(m => (
              <span key={m['Reg. No.']} className="bg-blue-500/10 border border-blue-500/20 text-blue-300 px-3 py-1.5 rounded-md text-sm">
                {m.Name} ({m['Reg. No.']})
              </span>
            ))}
          </div>
        </div>

        {/* Step 2: Target Roommates */}
        <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700/50">
          <h4 className="font-semibold text-white flex items-center gap-2 mb-2">
            <CheckCircle2 className="text-emerald-400" size={18} />
            True Target Group
          </h4>
          <p className="text-sm text-slate-300 mb-2">
            These are your mutually desired cross-branch roommates for the final room:
          </p>
          <div className="flex flex-wrap gap-2">
            {ticket.trueGroup.filter(m => m['Reg. No.'] !== student['Reg. No.']).map(m => (
              <span key={m['Reg. No.']} className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 px-3 py-1.5 rounded-md text-sm">
                {m.Name} ({m['Reg. No.']})
              </span>
            ))}
          </div>
        </div>

        {/* Step 3: Swap Instructions */}
        <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700/50">
          <h4 className="font-semibold text-white flex items-center gap-2 mb-2">
            <ArrowRightLeft className="text-purple-400" size={18} />
            Post-Allocation Swap
          </h4>
          <ul className="space-y-2 text-sm text-slate-300">
            {outputPayload.swap_instructions.map((inst: string, i: number) => (
              <li key={i} className="flex gap-2">
                <span className="text-purple-400 opacity-80 mt-0.5">•</span>
                <span>{inst}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
