export default function ProfileLoading() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-md mx-auto animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-24 mb-4"></div>

        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="h-8 bg-gray-200 rounded w-48 mb-6"></div>

          {/* Form fields */}
          <div className="space-y-6">
            <div>
              <div className="h-4 bg-gray-200 rounded w-16 mb-2"></div>
              <div className="h-10 bg-gray-200 rounded w-full"></div>
            </div>
            <div>
              <div className="h-4 bg-gray-200 rounded w-20 mb-2"></div>
              <div className="h-10 bg-gray-200 rounded w-full"></div>
            </div>
            <div className="h-12 bg-gray-200 rounded w-full"></div>
          </div>

          <div className="mt-8 pt-6 border-t border-gray-200">
            <div className="h-6 bg-gray-200 rounded w-24 mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-48"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
