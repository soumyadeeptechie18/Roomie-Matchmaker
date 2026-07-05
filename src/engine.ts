import { StudentProfile, MatchmakingResult, TrueGroup, InstructionTicket } from './types';

export function runMatchmakingEngine(inputs: StudentProfile[]): MatchmakingResult {
  const studentMap = new Map(inputs.map(s => [s['Reg. No.'], s]));
  const trueGroupsMap = new Map<string, StudentProfile[]>();
  const matchedUids = new Set<string>();

  // 1. Validate Mutual Desires to form True Target Groups
  for (const s of inputs) {
    const d1 = studentMap.get(s.desired[0]);
    const d2 = studentMap.get(s.desired[1]);
    if (!d1 || !d2) continue;

    const d1Wants = d1.desired;
    const d2Wants = d2.desired;

    // Check if the trio is perfectly mutual
    if (
      d1Wants.includes(s['Reg. No.']) && d1Wants.includes(d2['Reg. No.']) &&
      d2Wants.includes(s['Reg. No.']) && d2Wants.includes(d1['Reg. No.'])
    ) {
      const groupKey = [s['Reg. No.'], d1['Reg. No.'], d2['Reg. No.']].sort().join('|');
      if (!trueGroupsMap.has(groupKey)) {
        trueGroupsMap.set(groupKey, [s, d1, d2]);
        matchedUids.add(s['Reg. No.']);
        matchedUids.add(d1['Reg. No.']);
        matchedUids.add(d2['Reg. No.']);
      }
    }
  }

  const trueGroups: TrueGroup[] = Array.from(trueGroupsMap.entries()).map(([id, members]) => ({
    id,
    members
  }));

  const unmatched = inputs.filter(s => !matchedUids.has(s['Reg. No.']));

  // 2. Group into Meta-Clusters by Branch Signature
  // A signature is the sorted branches of a True Group (e.g., "CSE|ECE|ME")
  const signatureMap = new Map<string, TrueGroup[]>();
  for (const tg of trueGroups) {
    const sig = tg.members.map(s => s.Program).sort().join('|');
    if (!signatureMap.has(sig)) signatureMap.set(sig, []);
    signatureMap.get(sig)!.push(tg);
  }

  const metaClusters = [];
  const dummyGroups = [];
  const tickets: InstructionTicket[] = [];

  let clusterId = 1;

  for (const [, groups] of signatureMap.entries()) {
    // 3. Pool together 3 True Groups (9 students) of the exact same signature
    // This allows us to perfectly form 3 Dummy Groups grouped by branch.
    for (let i = 0; i < groups.length; i += 3) {
      if (i + 2 < groups.length) {
        const t1 = groups[i];
        const t2 = groups[i + 1];
        const t3 = groups[i + 2];

        const all9 = [...t1.members, ...t2.members, ...t3.members];

        // Break the 9 students into departmental pools
        const branchPools = new Map<string, StudentProfile[]>();
        for (const s of all9) {
          if (!branchPools.has(s.Program)) branchPools.set(s.Program, []);
          branchPools.get(s.Program)!.push(s);
        }

        // Create the Dummy Groups
        const clusterDummies = [];
        for (const [branch, pool] of branchPools.entries()) {
          const dummy = { id: `DUMMY-${clusterId}-${branch}`, branch, members: pool };
          clusterDummies.push(dummy);
          dummyGroups.push(dummy);
        }

        metaClusters.push({
          id: clusterId,
          trueGroups: [t1, t2, t3],
          dummyGroups: clusterDummies,
          allMembers: all9
        });

        // 4. Generate the Instructions Ticket / Output Payload for each student
        for (const tg of [t1, t2, t3]) {
          for (const s of tg.members) {
            const myDummy = clusterDummies.find(d => d.members.some(m => m['Reg. No.'] === s['Reg. No.']))!;
            
            const dummyMates = myDummy.members.filter(m => m['Reg. No.'] !== s['Reg. No.']);
            const targetMates = tg.members.filter(m => m['Reg. No.'] !== s['Reg. No.']);

            const payload = {
              student_reg: s['Reg. No.'],
              official_form_entries: dummyMates.map(m => m['Reg. No.']),
              target_roommates: targetMates.map(m => m['Reg. No.']),
              post_allocation_swap_pool: all9.map(m => m['Reg. No.']),
              swap_instructions: [
                `Step 1: Submit the official hostel form listing ${dummyMates.map(m => `${m.Name} (${m['Reg. No.']})`).join(' and ')}.`,
                `Step 2: Wait for your Dummy Group to be allocated a room.`,
                `Step 3: Coordinate with Meta-Cluster #${clusterId} (9 members) to perform 1-to-1 key swaps until you are grouped with ${targetMates.map(m => `${m.Name} (${m['Reg. No.']})`).join(' and ')}.`
              ]
            };

            tickets.push({
              student: s,
              trueGroup: tg.members,
              dummyGroup: myDummy.members,
              metaCluster: all9,
              outputPayload: payload
            });
          }
        }
        clusterId++;
      }
    }
  }

  return { trueGroups, dummyGroups, metaClusters, tickets, unmatched };
}
