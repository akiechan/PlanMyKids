import { Program, ProgramLocation } from './database';

export interface DayTimeSelection {
  day: string;
  time: string;
}

export interface ComparisonCustomization {
  costPerSession: number | null;
  selectedDays: DayTimeSelection[];
  assignedKids: string[]; // kid IDs or ['all']
  registrationDate: string | null; // user-editable registration date
  priority: number | null; // 1, 2, 3... for ranking
}

export interface ComparisonProgram {
  program: Program & {
    program_locations?: ProgramLocation[];
  };
  customization: ComparisonCustomization;
}

export interface CompareState {
  programs: ComparisonProgram[];
  lastUpdated: string;
}
