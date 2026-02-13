'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

interface ReviewFormProps {
  programId: string;
  onSuccess: () => void;
}

export default function ReviewForm({ programId, onSuccess }: ReviewFormProps) {
  const [formData, setFormData] = useState({
    reviewer_name: '',
    reviewer_email: '',
    rating: 5,
    comment: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const { error } = await supabase.from('reviews').insert([
        {
          program_id: programId,
          ...formData
        }
      ]);

      if (error) throw error;

      // Reset form
      setFormData({
        reviewer_name: '',
        reviewer_email: '',
        rating: 5,
        comment: ''
      });

      onSuccess();
    } catch (err) {
      console.error('Error submitting review:', err);
      setError('Failed to submit review. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-md p-6 space-y-4">
      <h3 className="text-xl font-bold text-gray-900">Write a Review</h3>

      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Your Name *
        </label>
        <input
          type="text"
          required
          className="input-field w-full"
          value={formData.reviewer_name}
          onChange={(e) => setFormData({ ...formData, reviewer_name: e.target.value })}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Email (not displayed publicly) *
        </label>
        <input
          type="email"
          required
          className="input-field w-full"
          value={formData.reviewer_email}
          onChange={(e) => setFormData({ ...formData, reviewer_email: e.target.value })}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Rating *
        </label>
        <div className="flex items-center space-x-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setFormData({ ...formData, rating: star })}
              className="text-3xl focus:outline-none"
            >
              {star <= formData.rating ? '⭐' : '☆'}
            </button>
          ))}
          <span className="text-gray-600 ml-2">
            ({formData.rating} star{formData.rating !== 1 ? 's' : ''})
          </span>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Your Review *
        </label>
        <textarea
          required
          rows={4}
          className="input-field w-full"
          placeholder="Share your experience with this program..."
          value={formData.comment}
          onChange={(e) => setFormData({ ...formData, comment: e.target.value })}
        />
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {submitting ? 'Submitting...' : 'Submit Review'}
      </button>

      <p className="text-xs text-gray-500 text-center">
        Your review will be pending approval before appearing publicly.
      </p>
    </form>
  );
}
