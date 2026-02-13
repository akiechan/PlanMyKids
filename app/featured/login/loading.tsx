export default function FeaturedLoginLoading() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full animate-pulse">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="h-8 bg-gray-200 rounded w-48 mx-auto mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-full mb-8"></div>

          <div className="h-4 bg-gray-200 rounded w-16 mb-2"></div>
          <div className="h-12 bg-gray-200 rounded w-full mb-6"></div>

          <div className="h-12 bg-gray-200 rounded w-full"></div>
        </div>
      </div>
    </div>
  );
}
