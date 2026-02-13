export default function FeaturedSetupLoading() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-24 mb-6"></div>
          <div className="bg-white rounded-xl shadow-lg p-8 space-y-6">
            <div className="h-8 bg-gray-200 rounded w-64 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-full mb-8"></div>

            {/* Form fields */}
            {[...Array(4)].map((_, i) => (
              <div key={i}>
                <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
                <div className="h-12 bg-gray-200 rounded w-full"></div>
              </div>
            ))}

            {/* Plan cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-48 bg-gray-200 rounded-lg"></div>
              ))}
            </div>

            <div className="h-12 bg-gray-200 rounded w-full mt-6"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
