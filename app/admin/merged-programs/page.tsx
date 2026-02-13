'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Program } from '@/types/database';
import { useAdminLogger } from '@/hooks/useAdminLogger';

type MergedProgram = Program & {
  target_program?: Program;
};

export default function MergedProgramsPage() {
  const { logAction } = useAdminLogger();
  const [mergedPrograms, setMergedPrograms] = useState<MergedProgram[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMergedPrograms();
  }, []);

  const fetchMergedPrograms = async () => {
    try {
      setLoading(true);

      // Fetch programs that have been merged (have merged_into set)
      const { data, error } = await supabase
        .from('programs')
        .select('*')
        .not('merged_into', 'is', null)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      // Fetch target programs for each merged program
      const programsWithTargets = await Promise.all(
        (data || []).map(async (program) => {
          const { data: targetData } = await supabase
            .from('programs')
            .select('*')
            .eq('id', program.merged_into)
            .single();

          return {
            ...program,
            target_program: targetData,
          };
        })
      );

      setMergedPrograms(programsWithTargets);
    } catch (err) {
      console.error('Error fetching merged programs:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUnmerge = async (programId: string, programName: string) => {
    if (!confirm('Are you sure you want to unmerge this program? It will be reactivated.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('programs')
        .update({
          status: 'active',
          merged_into: null,
        })
        .eq('id', programId);

      if (error) throw error;

      // Log the unmerge action
      await logAction({
        action: 'Find & Merge Duplicates',
        entityType: 'program',
        entityId: programId,
        entityName: programName,
        details: {
          action: 'updated',
          unmerged: true,
        },
      });

      alert('✅ Program unmerged successfully!');
      fetchMergedPrograms();
    } catch (err) {
      console.error('Error unmerging program:', err);
      alert('❌ Failed to unmerge program');
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="animate-pulse space-y-4">
          <div className="bg-gray-200 h-8 w-1/3 rounded" />
          <div className="bg-gray-200 h-64 w-full rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Merged Programs</h1>
          <p className="text-gray-600 mt-2">
            Programs that have been merged into other programs
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/admin/edits" className="btn-secondary">
            Back to Edits
          </Link>
          <Link href="/admin" className="btn-secondary">
            ← Back to Admin
          </Link>
        </div>
      </div>

      {mergedPrograms.length === 0 ? (
        <div className="bg-white rounded-xl shadow-md p-12 text-center">
          <p className="text-gray-500 text-lg">No merged programs found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {mergedPrograms.map((program) => (
            <div key={program.id} className="bg-white rounded-xl shadow-md p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="text-xl font-bold text-gray-900">{program.name}</h2>
                    <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                      Inactive
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">{program.description}</p>

                  {program.target_program && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-3">
                      <p className="text-sm font-semibold text-gray-700 mb-1">
                        ➜ Merged into:
                      </p>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">
                            {program.target_program.name}
                          </p>
                          <p className="text-xs text-gray-600 mt-1">
                            {program.target_program.category?.join(', ')}
                          </p>
                        </div>
                        <Link
                          href={`/programs/${program.target_program.id}`}
                          target="_blank"
                          className="text-sm text-primary-600 hover:text-primary-700"
                        >
                          View Program →
                        </Link>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-4 mt-4 text-sm text-gray-500">
                    <span>Categories: {program.category.join(', ')}</span>
                    <span>•</span>
                    <span>
                      Merged: {new Date(program.updated_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => handleUnmerge(program.id, program.name)}
                  className="ml-4 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
                >
                  Unmerge
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
