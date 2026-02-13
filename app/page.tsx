'use client';

import Link from 'next/link';

const categories = [
  {
    name: 'Enrichment Programs',
    description: 'Classes, lessons & activities',
    emoji: '📚',
    href: '/programs',
    gradient: 'from-blue-100 to-indigo-100',
  },
  {
    name: 'Camps',
    description: 'Day & seasonal',
    emoji: '🏕️',
    href: '/camps',
    gradient: 'from-amber-100 to-orange-100',
  },
  {
    name: 'Birthday Parties',
    description: 'Venues & packages',
    emoji: '🎂',
    href: '/birthday-venues',
    gradient: 'from-pink-100 to-purple-100',
  },
];

export default function HomePage() {
  return (
    <div className="bg-white">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50"></div>
        <div className="absolute top-10 left-10 w-48 sm:w-72 h-48 sm:h-72 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse"></div>
        <div className="absolute bottom-10 right-10 w-48 sm:w-72 h-48 sm:h-72 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse"></div>

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20">
          <div className="text-center">
            <div className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-white/80 backdrop-blur-sm rounded-full shadow-sm mb-4 sm:mb-6">
              <span className="text-xl sm:text-2xl">👋</span>
              <span className="text-sm sm:text-base text-gray-600 font-medium">Welcome to PlanMyKids</span>
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-4 sm:mb-6">
              Your Family's Activity<br />
              <span className="bg-gradient-to-r from-primary-600 to-indigo-600 bg-clip-text text-transparent">Command Center</span>
            </h1>
            <p className="text-base sm:text-lg lg:text-xl text-gray-600 max-w-2xl mx-auto px-2 sm:px-0">
              Find programs, compare options, and keep your family's schedule organized — all in one place.
            </p>
          </div>
        </div>
      </section>

      {/* Family Planning Feature - Primary */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12 lg:py-16">
        <div className="grid md:grid-cols-2 gap-8 lg:gap-10 items-center">
          <div>
            <div className="inline-flex items-center px-3 py-1 rounded-full bg-green-100 text-green-700 text-xs sm:text-sm font-medium mb-3 sm:mb-4">
              Family Planning
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3 sm:mb-4">
              Organize your family's activities
            </h2>
            <p className="text-base sm:text-lg text-gray-600 mb-4 sm:mb-6">
              Add your kids, save programs you're considering, and track what's enrolled.
              Never miss a registration deadline again.
            </p>
            <ul className="space-y-2 sm:space-y-3 text-sm sm:text-base text-gray-600 mb-6 sm:mb-8">
              <li className="flex items-center">
                <svg className="w-5 h-5 text-green-500 mr-2 sm:mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Compare programs side-by-side
              </li>
              <li className="flex items-center">
                <svg className="w-5 h-5 text-green-500 mr-2 sm:mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Track enrollment dates & deadlines
              </li>
              <li className="flex items-center">
                <svg className="w-5 h-5 text-green-500 mr-2 sm:mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Assign activities to each child
              </li>
            </ul>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href="/familyplanning/dashboard"
                className="inline-flex items-center justify-center px-6 py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 active:bg-green-800 transition-colors min-h-[48px]"
              >
                Open Family Planner
                <svg className="ml-2 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
              <Link
                href="/programs"
                className="inline-flex items-center justify-center px-6 py-3 bg-white text-gray-700 font-semibold rounded-xl border border-gray-300 hover:bg-gray-50 active:bg-gray-100 transition-colors min-h-[48px]"
              >
                Browse Programs
              </Link>
              <Link
                href="/camps"
                className="inline-flex items-center justify-center px-6 py-3 bg-white text-gray-700 font-semibold rounded-xl border border-gray-300 hover:bg-gray-50 active:bg-gray-100 transition-colors min-h-[48px]"
              >
                Browse Camps
              </Link>
            </div>
          </div>

          {/* Family Planner Preview - Matches actual UI */}
          <div className="bg-gray-100 rounded-2xl p-4 shadow-lg">
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              {/* Header */}
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <h4 className="font-semibold text-gray-800 text-sm">My Saved Programs</h4>
                <div className="flex gap-1">
                  <span className="px-2 py-1 bg-blue-500 text-white text-xs rounded">List</span>
                  <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">Calendar</span>
                </div>
              </div>

              {/* Kids Section */}
              <div className="px-4 py-3 bg-blue-50 border-b border-blue-100">
                <p className="text-xs text-gray-500 mb-2">Your Kids</p>
                <div className="flex gap-2">
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg shadow-sm">
                    <span className="text-lg">🐻</span>
                    <div>
                      <p className="text-sm font-medium text-gray-800">Emma</p>
                      <p className="text-xs text-gray-500">Age 7</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg shadow-sm">
                    <span className="text-lg">🦊</span>
                    <div>
                      <p className="text-sm font-medium text-gray-800">Jack</p>
                      <p className="text-xs text-gray-500">Age 5</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Comparing Section */}
              <div className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm">📊</span>
                  <span className="text-sm font-medium text-gray-700">Comparing</span>
                  <span className="text-xs text-gray-500">(2)</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                    <div className="flex items-center gap-2 mb-1">
                      <span>🏊</span>
                      <span className="text-xs font-medium text-gray-800">Swim School</span>
                    </div>
                    <p className="text-xs text-amber-700">📅 Reg: Mar 15</p>
                  </div>
                  <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                    <div className="flex items-center gap-2 mb-1">
                      <span>💻</span>
                      <span className="text-xs font-medium text-gray-800">Code Ninjas</span>
                    </div>
                    <p className="text-xs text-amber-700">📅 Reg: Mar 20</p>
                  </div>
                </div>
              </div>

              {/* Current Activities */}
              <div className="px-4 pb-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm">✅</span>
                  <span className="text-sm font-medium text-gray-700">Current</span>
                  <span className="text-xs text-gray-500">(1)</span>
                </div>
                <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span>⚽</span>
                      <span className="text-sm font-medium text-gray-800">Soccer League</span>
                    </div>
                    <div className="flex gap-1">
                      <span className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs">🐻</span>
                    </div>
                  </div>
                  <p className="text-xs text-green-700 mt-1">Sun 9:00 AM</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="max-w-5xl mx-auto px-4">
        <div className="border-t border-gray-200"></div>
      </div>

      {/* Category Cards - Browse Section */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12 lg:py-16">
        <div className="text-center mb-8 sm:mb-10">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">
            Browse Activities
          </h2>
          <p className="text-sm sm:text-base text-gray-600">Find the perfect programs for your kids</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
          {categories.map((category) => (
            <Link
              key={category.name}
              href={category.href}
              className="group bg-white rounded-2xl p-4 sm:p-6 shadow-md border border-gray-100 hover:shadow-xl hover:border-primary-200 active:bg-gray-50 transition-all duration-200"
            >
              <div className={`w-full h-24 sm:h-28 bg-gradient-to-br ${category.gradient} rounded-xl mb-3 sm:mb-4 flex items-center justify-center group-hover:scale-105 transition-transform`}>
                <span className="text-4xl sm:text-5xl">{category.emoji}</span>
              </div>
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-1">
                {category.name}
              </h3>
              <p className="text-sm sm:text-base text-gray-500">{category.description}</p>
              <div className="mt-3 sm:mt-4 flex items-center text-primary-600 font-medium text-sm sm:text-base">
                Browse
                <svg className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gradient-to-r from-primary-600 to-indigo-600 py-10 sm:py-12 lg:py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-xl sm:text-2xl font-bold text-white mb-3 sm:mb-4">
            Ready to get organized?
          </h2>
          <p className="text-sm sm:text-base text-primary-100 mb-6 sm:mb-8">
            Start exploring programs and build your family's activity plan.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
            <Link
              href="/programs"
              className="inline-flex items-center justify-center px-6 sm:px-8 py-3 sm:py-4 bg-white text-primary-600 font-semibold rounded-xl hover:bg-gray-100 active:bg-gray-200 transition-colors text-base sm:text-lg min-h-[48px]"
            >
              Browse Programs
            </Link>
            <Link
              href="/familyplanning/dashboard"
              className="inline-flex items-center justify-center px-6 sm:px-8 py-3 sm:py-4 bg-primary-700 text-white font-semibold rounded-xl hover:bg-primary-800 active:bg-primary-900 transition-colors text-base sm:text-lg border border-primary-500 min-h-[48px]"
            >
              Open Family Planner
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
