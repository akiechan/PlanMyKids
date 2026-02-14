'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Program, ProgramEditRequest } from '@/types/database';
import { useAdminLogger } from '@/hooks/useAdminLogger';

type EditRequestWithProgram = ProgramEditRequest & {
  original_program?: Program;
};

type ProgramWithLocations = Program & {
  program_locations?: Array<{
    id: string;
    address: string | null;
    neighborhood: string | null;
  }>;
  hasAddressMismatch?: boolean;
};

export default function AdminEditsPage() {
  const { logAction } = useAdminLogger();
  const [editRequests, setEditRequests] = useState<EditRequestWithProgram[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<EditRequestWithProgram | null>(null);
  const [duplicates, setDuplicates] = useState<ProgramWithLocations[]>([]);
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [retrieveReviewsForRequests, setRetrieveReviewsForRequests] = useState<Set<string>>(new Set());
  const [selectedDuplicateIds, setSelectedDuplicateIds] = useState<Set<string>>(new Set());
  const [showMergeReview, setShowMergeReview] = useState(false);
  const [mergedData, setMergedData] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState<'pending' | 'approved' | 'rejected'>('pending');

  // Check if an edit request has any actual changes compared to the original program
  const hasNoChanges = (editedData: any, original: any): boolean => {
    if (!original) return false;

    const fieldsToCompare = [
      'name', 'description',
      'price_min', 'price_max', 'price_unit',
      'provider_website', 'contact_email', 'contact_phone',
      'registration_url', 'new_registration_date', 're_enrollment_date',
    ];

    for (const field of fieldsToCompare) {
      if (editedData[field] === undefined) continue;
      const edited = editedData[field] ?? null;
      const orig = original[field] ?? null;
      if (JSON.stringify(edited) !== JSON.stringify(orig)) return false;
    }

    // Check category array
    if (editedData.category !== undefined) {
      if (JSON.stringify(editedData.category) !== JSON.stringify(original.category)) return false;
    }

    return true;
  };

  useEffect(() => {
    fetchEditRequests();
  }, [statusFilter]);

  const fetchEditRequests = async () => {
    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('program_edit_requests')
        .select('*')
        .eq('status', statusFilter)
        .order('created_at', { ascending: false });

      if (fetchError) {
        // Check if table doesn't exist
        if (fetchError.message.includes('relation') && fetchError.message.includes('does not exist')) {
          setError('The program_edit_requests table does not exist. Please run the migration first.');
          setEditRequests([]);
          setLoading(false);
          return;
        }
        throw fetchError;
      }

      // Fetch original program data for each request
      const requestsWithPrograms = await Promise.all(
        (data || []).map(async (request) => {
          const { data: programData } = await supabase
            .from('programs')
            .select('*')
            .eq('id', request.program_id)
            .single();

          return {
            ...request,
            original_program: programData,
          };
        })
      );

      // Auto-approve pending requests with no actual changes
      if (statusFilter === 'pending') {
        const noChangeRequests = requestsWithPrograms.filter(
          (r) => r.original_program && hasNoChanges(r.edited_data, r.original_program)
        );

        if (noChangeRequests.length > 0) {
          console.log(`Auto-approving ${noChangeRequests.length} no-change edit(s)`);
          await Promise.all(
            noChangeRequests.map((r) =>
              supabase
                .from('program_edit_requests')
                .update({ status: 'approved', reviewed_at: new Date().toISOString() })
                .eq('id', r.id)
            )
          );
          // Filter them out of the displayed list
          const remaining = requestsWithPrograms.filter(
            (r) => !noChangeRequests.some((nc) => nc.id === r.id)
          );
          setEditRequests(remaining);
        } else {
          setEditRequests(requestsWithPrograms);
        }
      } else {
        setEditRequests(requestsWithPrograms);
      }
    } catch (err) {
      console.error('Error fetching edit requests:', err);
      setError(err instanceof Error ? err.message : 'Failed to load edit requests');
    } finally {
      setLoading(false);
    }
  };

  const checkDuplicates = async (editedData: any): Promise<ProgramWithLocations[]> => {
    try {
      // Get all active programs (not merged) with their locations
      const { data, error } = await supabase
        .from('programs')
        .select('*, program_locations(*)')
        .eq('status', 'active')
        .is('merged_into', null)
        .neq('id', editedData.id);

      if (error) throw error;

      // Get the edited program's address for comparison
      const editedAddress = editedData._location?.address?.toLowerCase().trim() || '';

      // Multi-factor duplicate detection
      const potentialDuplicates = (data || []).filter((program) => {
        const programNameLower = program.name.toLowerCase().trim();
        const editedNameLower = editedData.name.toLowerCase().trim();

        const nameSimilarity = calculateSimilarity(programNameLower, editedNameLower);

        // Check category overlap
        const programCategories = new Set(program.category || []);
        const editedCategories = new Set(editedData.category || []);
        const categoryOverlap = [...programCategories].filter(c => editedCategories.has(c)).length;
        const categoryScore = categoryOverlap > 0 ? categoryOverlap / Math.max(programCategories.size, editedCategories.size) : 0;

        // Check if one name contains/starts with the other
        const shorterName = programNameLower.length < editedNameLower.length ? programNameLower : editedNameLower;
        const longerName = programNameLower.length < editedNameLower.length ? editedNameLower : programNameLower;
        const containsMatch = longerName.includes(shorterName) || longerName.startsWith(shorterName);

        // Check for common prefix
        const words1 = programNameLower.split(/\s+/);
        const words2 = editedNameLower.split(/\s+/);
        let commonPrefixWords = 0;
        for (let i = 0; i < Math.min(words1.length, words2.length); i++) {
          if (words1[i] === words2[i]) {
            commonPrefixWords++;
          } else {
            break;
          }
        }
        const commonPrefix = words1.slice(0, commonPrefixWords).join(' ');
        const hasSignificantPrefix = commonPrefixWords >= 3 || commonPrefix.length >= 15;

        // Check for significant common prefix
        if (hasSignificantPrefix) {
          return true;
        }

        // If one name contains the other
        if (containsMatch && shorterName.length >= 10) {
          if (shorterName.length >= 15) {
            return true;
          }
          if (categoryScore > 0.3) {
            return true;
          }
        }

        // Scoring system based on name and category
        if (nameSimilarity > 0.65 && categoryScore > 0.3) {
          return true;
        }

        if (nameSimilarity > 0.75) {
          return true;
        }

        return false;
      });

      // Check address mismatch for each duplicate (potential multi-location)
      const duplicatesWithAddressCheck = potentialDuplicates.map((program: any) => {
        const programLocations = program.program_locations || [];
        const programAddress = programLocations[0]?.address?.toLowerCase().trim() || '';

        // Check if addresses are significantly different (potential multi-location)
        let hasAddressMismatch = false;
        if (editedAddress && programAddress) {
          // If both have addresses and they're different, flag as potential multi-location
          const addressSimilarity = calculateSimilarity(editedAddress, programAddress);
          hasAddressMismatch = addressSimilarity < 0.7; // Less than 70% similar = different location
        } else if (editedAddress && !programAddress) {
          // Edited has address but duplicate doesn't
          hasAddressMismatch = true;
        } else if (!editedAddress && programAddress) {
          // Duplicate has address but edited doesn't
          hasAddressMismatch = true;
        }

        return {
          ...program,
          hasAddressMismatch,
        } as ProgramWithLocations;
      });

      console.log(`Found ${duplicatesWithAddressCheck.length} potential duplicates for: ${editedData.name}`);
      return duplicatesWithAddressCheck;
    } catch (err) {
      console.error('Error checking duplicates:', err);
      return [];
    }
  };

  // Simple similarity calculation (Levenshtein distance-based)
  const calculateSimilarity = (str1: string, str2: string): number => {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const editDistance = levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  };

  const levenshteinDistance = (str1: string, str2: string): number => {
    const matrix = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  };

  const fetchGoogleReviews = async (placeId: string) => {
    try {
      console.log('Fetching Google reviews for place:', placeId);
      const response = await fetch('/api/google-place-details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ placeId }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch place details');
      }

      const data = await response.json();
      if (data.status !== 'OK' || !data.result) {
        throw new Error('Invalid place data received');
      }

      return {
        google_rating: data.result.rating || null,
        google_review_count: data.result.user_ratings_total || 0,
        google_reviews_url: placeId
          ? `https://search.google.com/local/reviews?placeid=${placeId}`
          : null,
      };
    } catch (err) {
      console.error('Error fetching Google reviews:', err);
      return null;
    }
  };

  // Helper to check if this is a partial edit (only has specific fields like registration info)
  const isPartialEdit = (editedData: any): boolean => {
    // If it has name and category, it's a full edit
    if (editedData.name && editedData.category) {
      return false;
    }
    // If it only has registration-related fields, it's a partial edit
    const registrationFields = ['registration_url', 'new_registration_date', 're_enrollment_date'];
    const hasRegistrationFields = registrationFields.some(f => editedData[f] !== undefined);
    return hasRegistrationFields;
  };

  const handleApprove = async (request: EditRequestWithProgram) => {
    setProcessing(true);
    setSelectedRequest(request);

    try {
      const editedData = request.edited_data as any;

      // Skip duplicate check for partial edits (registration-only changes)
      if (!isPartialEdit(editedData)) {
        // Check for duplicates
        const foundDuplicates = await checkDuplicates(request.edited_data);

        if (foundDuplicates.length > 0) {
          setDuplicates(foundDuplicates);
          setSelectedDuplicateIds(new Set()); // Reset selection
          setShowDuplicates(true);
          setProcessing(false);
          return;
        }
      }

      // No duplicates, proceed with approval
      await applyEdit(request, false);
    } catch (err) {
      console.error('Error approving edit:', err);
      setError(err instanceof Error ? err.message : 'Failed to approve edit');
      setProcessing(false);
    }
  };

  const applyEdit = async (request: EditRequestWithProgram, mergeDuplicates: boolean = false) => {
    try {
      setProcessing(true);
      setError(''); // Clear previous errors

      const editedData = request.edited_data as any;
      const shouldRetrieveReviews = retrieveReviewsForRequests.has(request.id);

      console.log('Applying edit to program:', request.program_id);
      console.log('Merge duplicates:', mergeDuplicates);
      console.log('Retrieve reviews:', shouldRetrieveReviews);
      console.log('Google Place ID:', editedData.google_place_id);

      // Fetch Google reviews if requested
      let reviewData = null;
      if (shouldRetrieveReviews && editedData.google_place_id) {
        console.log('Fetching latest Google reviews for place:', editedData.google_place_id);
        reviewData = await fetchGoogleReviews(editedData.google_place_id);
        if (reviewData) {
          console.log('Retrieved review data:', reviewData);
        } else {
          console.warn('Failed to retrieve review data, continuing without it');
        }
      } else {
        if (shouldRetrieveReviews && !editedData.google_place_id) {
          console.warn('Cannot retrieve reviews: google_place_id is missing');
        }
      }

      // Update the program with edited data
      // Only include fields that are actually present in the edit
      const updateData: any = {
        updated_at: new Date().toISOString(),
      };

      // For full edits, include all program fields
      if (editedData.name !== undefined) updateData.name = editedData.name;
      if (editedData.category !== undefined) updateData.category = editedData.category;
      if (editedData.description !== undefined) updateData.description = editedData.description;
      if (editedData.price_min !== undefined) updateData.price_min = editedData.price_min;
      if (editedData.price_max !== undefined) updateData.price_max = editedData.price_max;
      if (editedData.price_unit !== undefined) updateData.price_unit = editedData.price_unit;
      if (editedData.provider_website !== undefined) updateData.provider_website = editedData.provider_website;
      if (editedData.contact_email !== undefined) updateData.contact_email = editedData.contact_email;
      if (editedData.contact_phone !== undefined) updateData.contact_phone = editedData.contact_phone;

      // Registration-specific fields (from family planner partial edits)
      if (editedData.registration_url !== undefined) updateData.registration_url = editedData.registration_url;
      if (editedData.new_registration_date !== undefined) updateData.new_registration_date = editedData.new_registration_date;
      if (editedData.re_enrollment_date !== undefined) updateData.re_enrollment_date = editedData.re_enrollment_date;

      console.log('=== ADMIN EDIT APPLY DEBUG ===');
      console.log('Edit data received:', editedData);
      console.log('Registration fields in edit:', {
        new_registration_date: editedData.new_registration_date,
        re_enrollment_date: editedData.re_enrollment_date,
        registration_url: editedData.registration_url,
      });
      console.log('Update data to apply:', updateData);
      console.log('Program ID:', request.program_id);
      console.log('Is partial edit:', isPartialEdit(editedData));

      // Add review data if retrieved
      if (reviewData) {
        updateData.google_rating = reviewData.google_rating;
        updateData.google_review_count = reviewData.google_review_count;
        updateData.google_reviews_url = reviewData.google_reviews_url;
      }

      const { data: updateResult, error: updateError } = await supabase
        .from('programs')
        .update(updateData)
        .eq('id', request.program_id)
        .select();

      console.log('Update result:', updateResult);
      console.log('Update result registration date:', updateResult?.[0]?.new_registration_date);

      if (updateError) {
        console.error('Program update error:', updateError);
        throw new Error(`Failed to update program: ${updateError.message}`);
      }

      // Verify the update was applied by fetching the program again
      const { data: verifyData, error: verifyError } = await supabase
        .from('programs')
        .select('new_registration_date, re_enrollment_date, registration_url, updated_at')
        .eq('id', request.program_id)
        .single();

      console.log('=== VERIFICATION AFTER UPDATE ===');
      console.log('Verify data:', verifyData);
      if (verifyError) {
        console.error('Verification error:', verifyError);
      }

      // Update location if provided
      if (editedData._location) {
        const { error: locationError } = await supabase
          .from('program_locations')
          .update({
            address: editedData._location.address,
            neighborhood: editedData._location.neighborhood,
          })
          .eq('program_id', request.program_id);

        if (locationError) console.error('Location update error:', locationError);
      }

      // If merging duplicates, mark them as merged
      if (mergeDuplicates && duplicates.length > 0) {
        console.log(`Merging ${duplicates.length} duplicates...`);

        const mergeResults = await Promise.all(
          duplicates.map(async (dup) => {
            console.log(`Merging program ${dup.id} (${dup.name})...`);
            const { error } = await supabase
              .from('programs')
              .update({
                status: 'inactive',  // Mark as inactive instead of merged
                merged_into: request.program_id
              })
              .eq('id', dup.id);

            if (error) {
              console.error(`Error merging program ${dup.id}:`, error);
              return { success: false, error, id: dup.id, name: dup.name };
            }
            console.log(`Successfully merged program ${dup.id}`);
            return { success: true, id: dup.id, name: dup.name };
          })
        );

        // Log merge results
        const failed = mergeResults.filter(r => !r.success);
        if (failed.length > 0) {
          console.error(`Failed to merge ${failed.length} programs:`, failed);
          const errorDetails = failed.map(f => `${f.name} (${f.error?.message})`).join(', ');
          throw new Error(`Failed to merge ${failed.length} duplicate(s): ${errorDetails}`);
        }
        console.log(`Successfully merged all ${duplicates.length} duplicates`);
      }

      // Mark edit request as approved
      console.log('Marking edit request as approved...');
      const { error: requestUpdateError } = await supabase
        .from('program_edit_requests')
        .update({
          status: 'approved',
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', request.id);

      if (requestUpdateError) {
        console.error('Request update error:', requestUpdateError);
        throw new Error(`Failed to update request status: ${requestUpdateError.message}`);
      }

      console.log('Edit approved successfully!');

      // Calculate which fields actually changed
      const originalProgram = request.original_program || {};
      const editedFields: string[] = [];
      const beforeValues: Record<string, unknown> = {};
      const afterValues: Record<string, unknown> = {};

      const fieldsToCheck = [
        'name', 'category', 'description',
        'price_min', 'price_max', 'price_unit',
        'provider_website', 'contact_email', 'contact_phone'
      ];

      for (const field of fieldsToCheck) {
        const beforeVal = (originalProgram as any)[field];
        const afterVal = editedData[field];
        if (JSON.stringify(beforeVal) !== JSON.stringify(afterVal)) {
          editedFields.push(field);
          beforeValues[field] = beforeVal;
          afterValues[field] = afterVal;
        }
      }

      await logAction({
        action: 'Edit Requests',
        entityType: 'program',
        entityId: request.program_id,
        entityName: (request.edited_data as any)?.name || request.original_program?.name,
        details: {
          action: 'approved',
          mergeDuplicates,
          duplicatesCount: duplicates.length,
          updatedFields: editedFields,
          beforeValues,
          afterValues,
        },
      });

      const successMsg = [
        '✅ Edit approved and applied successfully!',
        mergeDuplicates && duplicates.length > 0 ? ` ${duplicates.length} duplicate(s) merged.` : '',
        shouldRetrieveReviews && reviewData ? ' Google reviews updated.' : ''
      ].filter(Boolean).join('');

      alert(successMsg);

      // Reset state
      setShowDuplicates(false);
      setDuplicates([]);
      setSelectedRequest(null);
      setRetrieveReviewsForRequests(prev => {
        const newSet = new Set(prev);
        newSet.delete(request.id);
        return newSet;
      });
      setError(''); // Clear any previous errors

      // Refresh list
      await fetchEditRequests();
    } catch (err) {
      console.error('Error applying edit:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to apply edit';
      setError(errorMessage);
      alert(`❌ Error: ${errorMessage}`);
      // Don't reset modal state so user can see the error
    } finally {
      setProcessing(false);
    }
  };

  const toggleDuplicateSelection = (duplicateId: string) => {
    setSelectedDuplicateIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(duplicateId)) {
        newSet.delete(duplicateId);
      } else {
        newSet.add(duplicateId);
      }
      return newSet;
    });
  };

  const proceedToMergeReview = () => {
    if (!selectedRequest || selectedDuplicateIds.size === 0) {
      alert('Please select at least one duplicate to merge');
      return;
    }

    // Get selected duplicates
    const selectedDupes = duplicates.filter(d => selectedDuplicateIds.has(d.id));

    // Initialize merged data with the edited program data
    const editedData = selectedRequest.edited_data as any;
    setMergedData({ ...editedData });

    // Show merge review modal
    setShowMergeReview(true);
    setShowDuplicates(false);
  };

  const applyMergeWithReview = async () => {
    if (!selectedRequest || !mergedData) return;

    try {
      setProcessing(true);
      setError('');

      const shouldRetrieveReviews = retrieveReviewsForRequests.has(selectedRequest.id);

      // Fetch Google reviews if requested
      let reviewData = null;
      if (shouldRetrieveReviews && mergedData.google_place_id) {
        console.log('Fetching latest Google reviews for place:', mergedData.google_place_id);
        reviewData = await fetchGoogleReviews(mergedData.google_place_id);
        if (reviewData) {
          console.log('Retrieved review data:', reviewData);
        }
      }

      // Update the program with merged data
      const updateData: any = {
        name: mergedData.name,
        category: mergedData.category,
        description: mergedData.description,
        price_min: mergedData.price_min,
        price_max: mergedData.price_max,
        price_unit: mergedData.price_unit,
        provider_website: mergedData.provider_website,
        contact_email: mergedData.contact_email,
        contact_phone: mergedData.contact_phone,
        updated_at: new Date().toISOString(),
      };

      if (reviewData) {
        updateData.google_rating = reviewData.google_rating;
        updateData.google_review_count = reviewData.google_review_count;
        updateData.google_reviews_url = reviewData.google_reviews_url;
      }

      const { error: updateError } = await supabase
        .from('programs')
        .update(updateData)
        .eq('id', selectedRequest.program_id);

      if (updateError) throw new Error(`Failed to update program: ${updateError.message}`);

      // Update location if provided
      if (mergedData._location) {
        await supabase
          .from('program_locations')
          .update({
            address: mergedData._location.address,
            neighborhood: mergedData._location.neighborhood,
          })
          .eq('program_id', selectedRequest.program_id);
      }

      // Mark selected duplicates as merged
      const selectedDupes = duplicates.filter(d => selectedDuplicateIds.has(d.id));
      await Promise.all(
        selectedDupes.map(dup =>
          supabase
            .from('programs')
            .update({
              status: 'inactive',
              merged_into: selectedRequest.program_id
            })
            .eq('id', dup.id)
        )
      );

      // Mark edit request as approved
      await supabase
        .from('program_edit_requests')
        .update({
          status: 'approved',
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', selectedRequest.id);

      const successMsg = [
        `✅ Merged ${selectedDupes.length} duplicate(s) successfully!`,
        shouldRetrieveReviews && reviewData ? ' Google reviews updated.' : ''
      ].filter(Boolean).join('');

      alert(successMsg);

      // Reset state
      setShowMergeReview(false);
      setMergedData(null);
      setDuplicates([]);
      setSelectedDuplicateIds(new Set());
      const requestId = selectedRequest.id;
      setSelectedRequest(null);
      setRetrieveReviewsForRequests(prev => {
        const newSet = new Set(prev);
        newSet.delete(requestId);
        return newSet;
      });

      await fetchEditRequests();
    } catch (err) {
      console.error('Error applying merge:', err);
      setError(err instanceof Error ? err.message : 'Failed to apply merge');
      alert(`❌ Error: ${err instanceof Error ? err.message : 'Failed to apply merge'}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async (request: EditRequestWithProgram) => {
    if (!confirm('Are you sure you want to reject this edit request?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('program_edit_requests')
        .update({
          status: 'rejected',
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', request.id);

      if (error) throw error;

      await logAction({
        action: 'Edit Requests',
        entityType: 'program',
        entityId: request.program_id,
        entityName: (request.edited_data as any)?.name || request.original_program?.name,
        details: { action: 'rejected' },
      });

      alert('Edit request rejected');
      fetchEditRequests();
    } catch (err) {
      console.error('Error rejecting edit:', err);
      setError(err instanceof Error ? err.message : 'Failed to reject edit');
    }
  };

  const handleClearHistory = async () => {
    const statusName = statusFilter === 'approved' ? 'approved' : 'rejected';
    if (!confirm(`Are you sure you want to clear all ${statusName} requests from history? This cannot be undone.`)) {
      return;
    }

    try {
      setProcessing(true);
      const { error } = await supabase
        .from('program_edit_requests')
        .delete()
        .eq('status', statusFilter);

      if (error) throw error;

      alert(`All ${statusName} requests have been cleared from history`);
      fetchEditRequests();
    } catch (err) {
      console.error('Error clearing history:', err);
      setError(err instanceof Error ? err.message : 'Failed to clear history');
    } finally {
      setProcessing(false);
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
          <h1 className="text-3xl font-bold text-gray-900">Review Program Edits</h1>
          <p className="text-gray-600 mt-2">
            Review and approve user-submitted edits to programs
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/admin/merged-programs" className="btn-secondary">
            View Merged Programs
          </Link>
          <Link href="/admin" className="btn-secondary">
            ← Back to Admin
          </Link>
        </div>
      </div>

      {/* Status Filter Tabs */}
      <div className="mb-6">
        <div className="border-b border-gray-200 flex items-center justify-between">
          <nav className="-mb-px flex gap-4">
            <button
              onClick={() => setStatusFilter('pending')}
              className={`py-2 px-4 border-b-2 font-medium text-sm transition-colors ${
                statusFilter === 'pending'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Pending
            </button>
            <button
              onClick={() => setStatusFilter('approved')}
              className={`py-2 px-4 border-b-2 font-medium text-sm transition-colors ${
                statusFilter === 'approved'
                  ? 'border-green-600 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Approved
            </button>
            <button
              onClick={() => setStatusFilter('rejected')}
              className={`py-2 px-4 border-b-2 font-medium text-sm transition-colors ${
                statusFilter === 'rejected'
                  ? 'border-red-600 text-red-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Rejected
            </button>
          </nav>

          {/* Clear History Button - only show for approved/rejected tabs */}
          {statusFilter !== 'pending' && editRequests.length > 0 && (
            <button
              onClick={handleClearHistory}
              disabled={processing}
              className="px-4 py-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Clear History
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6">
          {error}
        </div>
      )}

      {editRequests.length === 0 ? (
        <div className="bg-white rounded-xl shadow-md p-12 text-center">
          <p className="text-gray-500 text-lg">
            {statusFilter === 'pending' && 'No pending edit requests'}
            {statusFilter === 'approved' && 'No approved edit requests'}
            {statusFilter === 'rejected' && 'No rejected edit requests'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {editRequests.map((request) => {
            const editedData = request.edited_data as any;
            const original = request.original_program;

            return (
              <div key={request.id} className="bg-white rounded-xl shadow-md overflow-hidden">
                {/* Featured Warning Banner */}
                {original?.is_featured && (
                  <div className="bg-amber-50 border-b border-amber-200 px-6 py-3 flex items-center gap-2">
                    <span className="text-amber-500 text-lg">⚠️</span>
                    <div>
                      <span className="font-medium text-amber-800">Featured Program</span>
                      <span className="text-amber-700 text-sm ml-2">
                        Changes will be immediately visible to all users
                      </span>
                    </div>
                    <span className="ml-auto text-amber-500">⭐</span>
                  </div>
                )}

                {/* Header */}
                <div className="bg-blue-50 px-6 py-4 border-b border-blue-100">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="animate-pulse text-xl">💡</span>
                        <h2 className="text-xl font-bold text-gray-900">{editedData.name || original?.name || 'Unknown Program'}</h2>
                        {original?.is_featured && (
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
                            ⭐ Featured
                          </span>
                        )}
                        {isPartialEdit(editedData) && (
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                            Registration Edit
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        Submitted by {request.submitted_by_name || request.submitted_by_email || 'Anonymous'}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(request.created_at).toLocaleDateString()} at{' '}
                        {new Date(request.created_at).toLocaleTimeString()}
                      </p>
                    </div>
                    <Link
                      href={`/programs/${request.program_id}`}
                      target="_blank"
                      className="text-sm text-primary-600 hover:text-primary-700"
                    >
                      View Program →
                    </Link>
                  </div>
                  {request.edit_notes && (
                    <div className="mt-3 p-3 bg-white rounded-lg border border-blue-200">
                      <p className="text-sm font-semibold text-gray-700 mb-1">Edit Notes:</p>
                      <p className="text-sm text-gray-600">{request.edit_notes}</p>
                    </div>
                  )}
                </div>

                {/* Comparison */}
                <div className="p-6">
                  {isPartialEdit(editedData) ? (
                    /* Partial Edit View - Registration Fields Only */
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b">
                        Registration Changes
                      </h3>
                      <div className="grid grid-cols-2 gap-6">
                        {/* Original Values */}
                        <div className="space-y-3 text-sm">
                          <h4 className="font-medium text-gray-500">Current Values</h4>
                          {editedData.registration_url !== undefined && (
                            <div>
                              <span className="font-medium text-gray-700">Registration URL:</span>
                              <p className="text-gray-900 break-all">{original?.registration_url || 'Not set'}</p>
                            </div>
                          )}
                          {editedData.new_registration_date !== undefined && (
                            <div>
                              <span className="font-medium text-gray-700">New Student Registration Date:</span>
                              <p className="text-gray-900">{original?.new_registration_date || 'Not set'}</p>
                            </div>
                          )}
                          {editedData.re_enrollment_date !== undefined && (
                            <div>
                              <span className="font-medium text-gray-700">Re-enrollment Date:</span>
                              <p className="text-gray-900">{original?.re_enrollment_date || 'Not set'}</p>
                            </div>
                          )}
                        </div>
                        {/* New Values */}
                        <div className="space-y-3 text-sm">
                          <h4 className="font-medium text-gray-500">Proposed Changes</h4>
                          {editedData.registration_url !== undefined && (
                            <div>
                              <span className="font-medium text-gray-700">Registration URL:</span>
                              <p className={`text-gray-900 break-all ${editedData.registration_url !== original?.registration_url ? 'bg-yellow-100 px-2 py-1 rounded' : ''}`}>
                                {editedData.registration_url || 'Remove'}
                              </p>
                            </div>
                          )}
                          {editedData.new_registration_date !== undefined && (
                            <div>
                              <span className="font-medium text-gray-700">New Student Registration Date:</span>
                              <p className={`text-gray-900 ${editedData.new_registration_date !== original?.new_registration_date ? 'bg-yellow-100 px-2 py-1 rounded' : ''}`}>
                                {editedData.new_registration_date || 'Remove'}
                              </p>
                            </div>
                          )}
                          {editedData.re_enrollment_date !== undefined && (
                            <div>
                              <span className="font-medium text-gray-700">Re-enrollment Date:</span>
                              <p className={`text-gray-900 ${editedData.re_enrollment_date !== original?.re_enrollment_date ? 'bg-yellow-100 px-2 py-1 rounded' : ''}`}>
                                {editedData.re_enrollment_date || 'Remove'}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Full Edit View */
                    <div className="grid grid-cols-2 gap-6">
                      {/* Original */}
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b">
                          Original
                        </h3>
                        <div className="space-y-3 text-sm">
                          <div>
                            <span className="font-medium text-gray-700">Name:</span>
                            <p className="text-gray-900">{original?.name}</p>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">Categories:</span>
                            <p className="text-gray-900">{original?.category?.join(', ') || 'N/A'}</p>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">Description:</span>
                            <p className="text-gray-900 line-clamp-3">{original?.description}</p>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">Price:</span>
                            <p className="text-gray-900">
                              {original?.price_min != null || original?.price_max != null
                                ? `$${original?.price_min ?? '?'} - $${original?.price_max ?? '?'} ${original?.price_unit || ''}`
                                : 'N/A'}
                            </p>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">Contact:</span>
                            <p className="text-gray-900">
                              {original?.contact_email || original?.contact_phone || 'N/A'}
                            </p>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">Registration URL:</span>
                            <p className="text-gray-900 break-all">
                              {original?.registration_url || 'N/A'}
                            </p>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">New Registration Date:</span>
                            <p className="text-gray-900">{original?.new_registration_date || 'N/A'}</p>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">Re-enrollment Date:</span>
                            <p className="text-gray-900">{original?.re_enrollment_date || 'N/A'}</p>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">Google Reviews:</span>
                            <p className="text-gray-900">
                              {original?.google_rating ? (
                                <span className="flex items-center gap-1">
                                  <span className="text-yellow-500">⭐</span>
                                  {original.google_rating} ({original.google_review_count || 0} reviews)
                                </span>
                              ) : (
                                'No reviews'
                              )}
                            </p>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">Last Updated:</span>
                            <p className="text-gray-900">
                              {original?.updated_at
                                ? new Date(original.updated_at).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                    hour: 'numeric',
                                    minute: '2-digit'
                                  })
                                : 'N/A'}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Edited */}
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b">
                          Edited Version
                        </h3>
                        <div className="space-y-3 text-sm">
                          <div>
                            <span className="font-medium text-gray-700">Name:</span>
                            <p className={`text-gray-900 ${editedData.name !== original?.name ? 'bg-yellow-100 px-2 py-1 rounded' : ''}`}>
                              {editedData.name}
                            </p>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">Categories:</span>
                            <p className={`text-gray-900 ${JSON.stringify(editedData.category) !== JSON.stringify(original?.category) ? 'bg-yellow-100 px-2 py-1 rounded' : ''}`}>
                              {editedData.category?.join(', ') || 'N/A'}
                            </p>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">Description:</span>
                            <p className={`text-gray-900 line-clamp-3 ${editedData.description !== original?.description ? 'bg-yellow-100 px-2 py-1 rounded' : ''}`}>
                              {editedData.description}
                            </p>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">Price:</span>
                            <p className={`text-gray-900 ${(editedData.price_min !== original?.price_min || editedData.price_max !== original?.price_max || editedData.price_unit !== original?.price_unit) ? 'bg-yellow-100 px-2 py-1 rounded' : ''}`}>
                              {editedData.price_min != null || editedData.price_max != null
                                ? `$${editedData.price_min ?? '?'} - $${editedData.price_max ?? '?'} ${editedData.price_unit || ''}`
                                : 'N/A'}
                            </p>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">Contact:</span>
                            <p className={`text-gray-900 ${(editedData.contact_email !== original?.contact_email || editedData.contact_phone !== original?.contact_phone) ? 'bg-yellow-100 px-2 py-1 rounded' : ''}`}>
                              {editedData.contact_email || editedData.contact_phone || 'N/A'}
                            </p>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">Registration URL:</span>
                            <p className={`text-gray-900 break-all ${editedData.registration_url !== original?.registration_url ? 'bg-yellow-100 px-2 py-1 rounded' : ''}`}>
                              {editedData.registration_url || 'N/A'}
                            </p>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">New Registration Date:</span>
                            <p className={`text-gray-900 ${editedData.new_registration_date !== original?.new_registration_date ? 'bg-yellow-100 px-2 py-1 rounded' : ''}`}>
                              {editedData.new_registration_date || 'N/A'}
                            </p>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">Re-enrollment Date:</span>
                            <p className={`text-gray-900 ${editedData.re_enrollment_date !== original?.re_enrollment_date ? 'bg-yellow-100 px-2 py-1 rounded' : ''}`}>
                              {editedData.re_enrollment_date || 'N/A'}
                            </p>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">Google Reviews:</span>
                            <p className={`text-gray-900 ${(editedData.google_rating !== original?.google_rating || editedData.google_review_count !== original?.google_review_count) ? 'bg-yellow-100 px-2 py-1 rounded' : ''}`}>
                              {editedData.google_rating ? (
                                <span className="flex items-center gap-1">
                                  <span className="text-yellow-500">⭐</span>
                                  {editedData.google_rating} ({editedData.google_review_count || 0} reviews)
                                </span>
                              ) : (
                                'No reviews'
                              )}
                            </p>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">Edit Submitted:</span>
                            <p className="text-gray-900">
                              {request.created_at
                                ? new Date(request.created_at).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                    hour: 'numeric',
                                    minute: '2-digit'
                                  })
                                : 'N/A'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="bg-gray-50 px-6 py-4 flex items-center justify-between">
                  {statusFilter === 'pending' ? (
                    <>
                      <div className="flex items-center gap-2">
                        {editedData.google_place_id && (
                          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={retrieveReviewsForRequests.has(request.id)}
                              onChange={(e) => {
                                setRetrieveReviewsForRequests(prev => {
                                  const newSet = new Set(prev);
                                  if (e.target.checked) {
                                    newSet.add(request.id);
                                  } else {
                                    newSet.delete(request.id);
                                  }
                                  return newSet;
                                });
                              }}
                              className="rounded text-primary-600 focus:ring-primary-500"
                            />
                            <span>Update Google reviews</span>
                          </label>
                        )}
                      </div>
                      <div className="flex gap-3">
                        <button
                          onClick={() => handleReject(request)}
                          className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                        >
                          Reject
                        </button>
                        <button
                          onClick={() => handleApprove(request)}
                          disabled={processing}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {processing ? 'Processing...' : 'Approve'}
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center justify-between w-full">
                      <div className="text-sm text-gray-600">
                        {request.reviewed_at && (
                          <>
                            Reviewed: {new Date(request.reviewed_at).toLocaleDateString()} at{' '}
                            {new Date(request.reviewed_at).toLocaleTimeString()}
                          </>
                        )}
                      </div>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          statusFilter === 'approved'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {statusFilter === 'approved' ? 'APPROVED' : 'REJECTED'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Duplicate Detection Modal */}
      {showDuplicates && selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">⚠️ Potential Duplicates Found</h2>
              <p className="text-gray-600 mt-2">
                We found {duplicates.length} program(s) that might be duplicates. Select which ones to merge.
              </p>
              {selectedDuplicateIds.size > 0 && (
                <p className="text-sm text-primary-600 mt-1 font-medium">
                  {selectedDuplicateIds.size} duplicate(s) selected
                </p>
              )}
              {/* Multi-location warning summary */}
              {duplicates.some(d => d.hasAddressMismatch) && (
                <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="text-amber-600">📍</span>
                    <span className="text-sm font-medium text-amber-800">
                      {duplicates.filter(d => d.hasAddressMismatch).length} program(s) have different addresses
                    </span>
                  </div>
                  <p className="text-xs text-amber-700 mt-1">
                    These may be separate locations of the same program, not duplicates.
                    If so, click &quot;Approve Without Merging&quot; to keep them as separate programs.
                  </p>
                </div>
              )}
            </div>

            <div className="p-6">
              {/* Select All Checkbox */}
              <div className="mb-4 pb-4 border-b border-gray-200">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedDuplicateIds.size === duplicates.length && duplicates.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedDuplicateIds(new Set(duplicates.map(d => d.id)));
                      } else {
                        setSelectedDuplicateIds(new Set());
                      }
                    }}
                    className="w-5 h-5 rounded text-primary-600 focus:ring-primary-500"
                  />
                  <span className="font-semibold text-gray-900">Select All</span>
                </label>
              </div>

              {/* Duplicate List with Checkboxes */}
              <div className="space-y-3">
                {duplicates.map((dup) => {
                  const dupAddress = dup.program_locations?.[0]?.address;
                  const editedAddress = (selectedRequest?.edited_data as any)?._location?.address;

                  return (
                    <label
                      key={dup.id}
                      className={`flex items-start gap-3 border rounded-lg p-4 cursor-pointer transition-colors ${
                        selectedDuplicateIds.has(dup.id)
                          ? 'border-primary-500 bg-primary-50'
                          : dup.hasAddressMismatch
                          ? 'border-amber-300 bg-amber-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedDuplicateIds.has(dup.id)}
                        onChange={() => toggleDuplicateSelection(dup.id)}
                        className="w-5 h-5 mt-1 rounded text-primary-600 focus:ring-primary-500"
                      />
                      <div className="flex-1">
                        {/* Multi-location warning */}
                        {dup.hasAddressMismatch && (
                          <div className="flex items-center gap-2 mb-2 p-2 bg-amber-100 rounded-md border border-amber-200">
                            <span className="text-amber-600 text-lg">📍</span>
                            <div className="text-sm">
                              <span className="font-medium text-amber-800">Possible Multi-Location</span>
                              <p className="text-amber-700 text-xs mt-0.5">
                                Addresses differ - this may be a separate location, not a duplicate.
                              </p>
                            </div>
                          </div>
                        )}
                        <h3 className="font-bold text-gray-900">{dup.name}</h3>
                        <p className="text-sm text-gray-600 mt-1">{dup.description}</p>
                        <div className="flex flex-col gap-1 mt-2 text-sm text-gray-500">
                          <span>Categories: {dup.category.join(', ')}</span>
                          {/* Show address comparison */}
                          {(dupAddress || editedAddress) && (
                            <div className="mt-1 space-y-0.5">
                              {dupAddress && (
                                <div className="flex items-start gap-1">
                                  <span className="text-gray-400 text-xs">This:</span>
                                  <span className="text-xs">{dupAddress}</span>
                                </div>
                              )}
                              {editedAddress && (
                                <div className="flex items-start gap-1">
                                  <span className="text-gray-400 text-xs">Edited:</span>
                                  <span className="text-xs">{editedAddress}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        <Link
                          href={`/programs/${dup.id}`}
                          target="_blank"
                          className="text-sm text-primary-600 hover:text-primary-700 mt-2 inline-block"
                          onClick={(e) => e.stopPropagation()}
                        >
                          View Program →
                        </Link>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
              {selectedRequest?.edited_data?.google_place_id && (
                <div className="mb-4">
                  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={retrieveReviewsForRequests.has(selectedRequest.id)}
                      onChange={(e) => {
                        setRetrieveReviewsForRequests(prev => {
                          const newSet = new Set(prev);
                          if (e.target.checked) {
                            newSet.add(selectedRequest.id);
                          } else {
                            newSet.delete(selectedRequest.id);
                          }
                          return newSet;
                        });
                      }}
                      className="rounded text-primary-600 focus:ring-primary-500"
                    />
                    <span>Update Google reviews when approving</span>
                  </label>
                </div>
              )}
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setShowDuplicates(false);
                    setDuplicates([]);
                    setSelectedRequest(null);
                    setSelectedDuplicateIds(new Set());
                    setProcessing(false);
                  }}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => applyEdit(selectedRequest, false)}
                  disabled={processing}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {processing ? 'Processing...' : 'Approve Without Merging'}
                </button>
                <button
                  onClick={proceedToMergeReview}
                  disabled={selectedDuplicateIds.size === 0}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Review & Merge ({selectedDuplicateIds.size})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Merge Review Modal */}
      {showMergeReview && selectedRequest && mergedData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
              <h2 className="text-2xl font-bold text-gray-900">Review Merge Data</h2>
              <p className="text-gray-600 mt-2">
                Review and select the data you want to keep from each program. Click on any field to select it.
              </p>
            </div>

            <div className="p-6">
              {/* Field comparison table */}
              <div className="space-y-6">
                {/* Program Name */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Program Name</label>
                  <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${duplicates.filter(d => selectedDuplicateIds.has(d.id)).length + 1}, 1fr)` }}>
                    <button
                      onClick={() => setMergedData({ ...mergedData, name: selectedRequest.edited_data.name })}
                      className={`p-3 rounded-lg border-2 text-left transition-colors ${
                        mergedData.name === selectedRequest.edited_data.name
                          ? 'border-primary-600 bg-primary-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="text-xs text-gray-500 mb-1">Edited Program</div>
                      <div className="font-medium">{selectedRequest.edited_data.name}</div>
                    </button>
                    {duplicates.filter(d => selectedDuplicateIds.has(d.id)).map(dup => (
                      <button
                        key={dup.id}
                        onClick={() => setMergedData({ ...mergedData, name: dup.name })}
                        className={`p-3 rounded-lg border-2 text-left transition-colors ${
                          mergedData.name === dup.name
                            ? 'border-primary-600 bg-primary-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="text-xs text-gray-500 mb-1">Duplicate</div>
                        <div className="font-medium">{dup.name}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
                  <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${duplicates.filter(d => selectedDuplicateIds.has(d.id)).length + 1}, 1fr)` }}>
                    <button
                      onClick={() => setMergedData({ ...mergedData, description: selectedRequest.edited_data.description })}
                      className={`p-3 rounded-lg border-2 text-left transition-colors ${
                        mergedData.description === selectedRequest.edited_data.description
                          ? 'border-primary-600 bg-primary-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="text-xs text-gray-500 mb-1">Edited Program</div>
                      <div className="text-sm">{selectedRequest.edited_data.description || '(empty)'}</div>
                    </button>
                    {duplicates.filter(d => selectedDuplicateIds.has(d.id)).map(dup => (
                      <button
                        key={dup.id}
                        onClick={() => setMergedData({ ...mergedData, description: dup.description })}
                        className={`p-3 rounded-lg border-2 text-left transition-colors ${
                          mergedData.description === dup.description
                            ? 'border-primary-600 bg-primary-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="text-xs text-gray-500 mb-1">Duplicate</div>
                        <div className="text-sm">{dup.description || '(empty)'}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Contact Email */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Contact Email</label>
                  <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${duplicates.filter(d => selectedDuplicateIds.has(d.id)).length + 1}, 1fr)` }}>
                    <button
                      onClick={() => setMergedData({ ...mergedData, contact_email: selectedRequest.edited_data.contact_email })}
                      className={`p-3 rounded-lg border-2 text-left transition-colors ${
                        mergedData.contact_email === selectedRequest.edited_data.contact_email
                          ? 'border-primary-600 bg-primary-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="text-xs text-gray-500 mb-1">Edited Program</div>
                      <div className="text-sm">{selectedRequest.edited_data.contact_email || '(empty)'}</div>
                    </button>
                    {duplicates.filter(d => selectedDuplicateIds.has(d.id)).map(dup => (
                      <button
                        key={dup.id}
                        onClick={() => setMergedData({ ...mergedData, contact_email: dup.contact_email })}
                        className={`p-3 rounded-lg border-2 text-left transition-colors ${
                          mergedData.contact_email === dup.contact_email
                            ? 'border-primary-600 bg-primary-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="text-xs text-gray-500 mb-1">Duplicate</div>
                        <div className="text-sm">{dup.contact_email || '(empty)'}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Contact Phone */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Contact Phone</label>
                  <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${duplicates.filter(d => selectedDuplicateIds.has(d.id)).length + 1}, 1fr)` }}>
                    <button
                      onClick={() => setMergedData({ ...mergedData, contact_phone: selectedRequest.edited_data.contact_phone })}
                      className={`p-3 rounded-lg border-2 text-left transition-colors ${
                        mergedData.contact_phone === selectedRequest.edited_data.contact_phone
                          ? 'border-primary-600 bg-primary-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="text-xs text-gray-500 mb-1">Edited Program</div>
                      <div className="text-sm">{selectedRequest.edited_data.contact_phone || '(empty)'}</div>
                    </button>
                    {duplicates.filter(d => selectedDuplicateIds.has(d.id)).map(dup => (
                      <button
                        key={dup.id}
                        onClick={() => setMergedData({ ...mergedData, contact_phone: dup.contact_phone })}
                        className={`p-3 rounded-lg border-2 text-left transition-colors ${
                          mergedData.contact_phone === dup.contact_phone
                            ? 'border-primary-600 bg-primary-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="text-xs text-gray-500 mb-1">Duplicate</div>
                        <div className="text-sm">{dup.contact_phone || '(empty)'}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Website */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Website</label>
                  <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${duplicates.filter(d => selectedDuplicateIds.has(d.id)).length + 1}, 1fr)` }}>
                    <button
                      onClick={() => setMergedData({ ...mergedData, website: selectedRequest.edited_data.provider_website })}
                      className={`p-3 rounded-lg border-2 text-left transition-colors ${
                        mergedData.provider_website === selectedRequest.edited_data.provider_website
                          ? 'border-primary-600 bg-primary-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="text-xs text-gray-500 mb-1">Edited Program</div>
                      <div className="text-sm truncate">{selectedRequest.edited_data.provider_website || '(empty)'}</div>
                    </button>
                    {duplicates.filter(d => selectedDuplicateIds.has(d.id)).map(dup => (
                      <button
                        key={dup.id}
                        onClick={() => setMergedData({ ...mergedData, website: dup.provider_website })}
                        className={`p-3 rounded-lg border-2 text-left transition-colors ${
                          mergedData.provider_website === dup.provider_website
                            ? 'border-primary-600 bg-primary-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="text-xs text-gray-500 mb-1">Duplicate</div>
                        <div className="text-sm truncate">{dup.provider_website || '(empty)'}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Price Range */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Price Range</label>
                  <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${duplicates.filter(d => selectedDuplicateIds.has(d.id)).length + 1}, 1fr)` }}>
                    <button
                      onClick={() => setMergedData({
                        ...mergedData,
                        price_min: selectedRequest.edited_data.price_min,
                        price_max: selectedRequest.edited_data.price_max,
                        price_unit: selectedRequest.edited_data.price_unit
                      })}
                      className={`p-3 rounded-lg border-2 text-left transition-colors ${
                        mergedData.price_min === selectedRequest.edited_data.price_min &&
                        mergedData.price_max === selectedRequest.edited_data.price_max
                          ? 'border-primary-600 bg-primary-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="text-xs text-gray-500 mb-1">Edited Program</div>
                      <div className="text-sm">
                        {selectedRequest.edited_data.price_min && selectedRequest.edited_data.price_max
                          ? `$${selectedRequest.edited_data.price_min} - $${selectedRequest.edited_data.price_max} ${selectedRequest.edited_data.price_unit || ''}`
                          : 'Free'}
                      </div>
                    </button>
                    {duplicates.filter(d => selectedDuplicateIds.has(d.id)).map(dup => (
                      <button
                        key={dup.id}
                        onClick={() => setMergedData({
                          ...mergedData,
                          price_min: dup.price_min,
                          price_max: dup.price_max,
                          price_unit: dup.price_unit
                        })}
                        className={`p-3 rounded-lg border-2 text-left transition-colors ${
                          mergedData.price_min === dup.price_min &&
                          mergedData.price_max === dup.price_max
                            ? 'border-primary-600 bg-primary-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="text-xs text-gray-500 mb-1">Duplicate</div>
                        <div className="text-sm">
                          {dup.price_min && dup.price_max
                            ? `$${dup.price_min} - $${dup.price_max} ${dup.price_unit || ''}`
                            : 'Free'}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 sticky bottom-0">
              {mergedData?.google_place_id && selectedRequest && (
                <div className="mb-4">
                  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={retrieveReviewsForRequests.has(selectedRequest.id)}
                      onChange={(e) => {
                        setRetrieveReviewsForRequests(prev => {
                          const newSet = new Set(prev);
                          if (e.target.checked) {
                            newSet.add(selectedRequest.id);
                          } else {
                            newSet.delete(selectedRequest.id);
                          }
                          return newSet;
                        });
                      }}
                      className="rounded text-primary-600 focus:ring-primary-500"
                    />
                    <span>Update Google reviews when applying merge</span>
                  </label>
                </div>
              )}
              <div className="flex gap-3 justify-between items-center">
                <div className="text-sm text-gray-600">
                  Merging {selectedDuplicateIds.size} duplicate(s) into the edited program
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowMergeReview(false);
                      setShowDuplicates(true);
                    }}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={applyMergeWithReview}
                    disabled={processing}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {processing ? 'Applying Merge...' : 'Apply Merge'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
