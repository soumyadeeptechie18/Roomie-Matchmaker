import { BaseStudent } from './data/students';

export interface StudentProfile extends BaseStudent {
  desired: [string, string];
}

export interface TrueGroup {
  id: string;
  members: StudentProfile[];
}

export interface DummyGroup {
  id: string;
  branch: string;
  members: StudentProfile[];
}

export interface MetaCluster {
  id: number;
  trueGroups: TrueGroup[];
  dummyGroups: DummyGroup[];
  allMembers: StudentProfile[];
}

export interface InstructionTicket {
  student: StudentProfile;
  trueGroup: StudentProfile[];
  dummyGroup: StudentProfile[];
  metaCluster: StudentProfile[];
  outputPayload: any;
}

export interface MatchmakingResult {
  trueGroups: TrueGroup[];
  dummyGroups: DummyGroup[];
  metaClusters: MetaCluster[];
  tickets: InstructionTicket[];
  unmatched: StudentProfile[];
}
