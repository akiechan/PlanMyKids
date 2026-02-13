'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function SavePromoPage() {
  const router = useRouter();
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const handleGetStarted = () => {
    // For now, bypass signup and go directly to dashboard
    router.push('/familyplanning/dashboard');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-800 px-4 py-2 rounded-full text-sm font-medium mb-6">
            <span>📋</span> Family Activity Planner
          </div>
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            Never Miss a Registration Date Again
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Save programs you're comparing, track activities your kids are enrolled in,
            and get reminders when registration opens. All in one family dashboard.
          </p>
        </div>

        {/* Feature Preview Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-transparent hover:border-blue-300 transition-colors">
            <div className="text-4xl mb-4">📊</div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Compare Programs</h3>
            <p className="text-gray-600 text-sm">
              Save programs side-by-side to compare prices, schedules, and reviews before deciding.
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-transparent hover:border-green-300 transition-colors">
            <div className="text-4xl mb-4">✅</div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Track Current Activities</h3>
            <p className="text-gray-600 text-sm">
              Move programs to "Current" when enrolled. Keep track of what each child is doing.
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-transparent hover:border-purple-300 transition-colors">
            <div className="text-4xl mb-4">👶</div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Kid Profiles</h3>
            <p className="text-gray-600 text-sm">
              Add your children with their ages. See age-appropriate recommendations for each.
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-transparent hover:border-amber-300 transition-colors">
            <div className="text-4xl mb-4">📅</div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Calendar Reminders</h3>
            <p className="text-gray-600 text-sm">
              Get notified before registration opens. Never miss the signup window again.
            </p>
          </div>
        </div>

        {/* Dashboard Preview Mockup */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden mb-16 border border-gray-200">
          <div className="bg-gray-800 px-4 py-3 flex items-center gap-2">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
            </div>
            <div className="flex-1 text-center">
              <span className="text-gray-400 text-sm">planmykids.com/familyplanning/dashboard</span>
            </div>
          </div>

          <div className="p-6 bg-gray-50">
            <div className="grid md:grid-cols-3 gap-6">
              {/* Left Column - Kids */}
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <span>👨‍👩‍👧‍👦</span> Your Kids
                </h4>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                    <div className="w-10 h-10 bg-blue-200 rounded-full flex items-center justify-center text-xl">👧</div>
                    <div>
                      <p className="font-medium text-gray-900">Emma</p>
                      <p className="text-sm text-gray-500">Age 7 • 3 activities</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                    <div className="w-10 h-10 bg-green-200 rounded-full flex items-center justify-center text-xl">👦</div>
                    <div>
                      <p className="font-medium text-gray-900">Lucas</p>
                      <p className="text-sm text-gray-500">Age 10 • 2 activities</p>
                    </div>
                  </div>
                  <button className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-gray-400 hover:text-gray-600 text-sm">
                    + Add Child
                  </button>
                </div>
              </div>

              {/* Middle Column - Programs */}
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <span>📋</span> Comparing (3)
                </h4>
                <div className="space-y-2">
                  <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                    <p className="font-medium text-gray-900 text-sm">Bay Area Chess Club</p>
                    <p className="text-xs text-gray-500">Chess • $180/month</p>
                    <div className="flex gap-1 mt-2">
                      <button className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">Enroll</button>
                      <button className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">Remove</button>
                    </div>
                  </div>
                  <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                    <p className="font-medium text-gray-900 text-sm">SF Swim School</p>
                    <p className="text-xs text-gray-500">Swimming • $220/month</p>
                  </div>
                  <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                    <p className="font-medium text-gray-900 text-sm">Young Artists Studio</p>
                    <p className="text-xs text-gray-500">Art • $150/month</p>
                  </div>
                </div>
              </div>

              {/* Right Column - Calendar */}
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <span>📅</span> Upcoming
                </h4>
                <div className="space-y-2">
                  <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                    <div className="flex items-center gap-2">
                      <span className="text-red-500">🔔</span>
                      <div>
                        <p className="font-medium text-gray-900 text-sm">Registration Opens</p>
                        <p className="text-xs text-gray-500">SF Swim School • Feb 15</p>
                      </div>
                    </div>
                  </div>
                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-center gap-2">
                      <span className="text-blue-500">📌</span>
                      <div>
                        <p className="font-medium text-gray-900 text-sm">Re-enrollment Deadline</p>
                        <p className="text-xs text-gray-500">Bay Area Chess • Feb 20</p>
                      </div>
                    </div>
                  </div>
                  <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex items-center gap-2">
                      <span className="text-green-500">🎉</span>
                      <div>
                        <p className="font-medium text-gray-900 text-sm">Session Starts</p>
                        <p className="text-xs text-gray-500">Young Artists • Mar 1</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Current Activities Row */}
            <div className="mt-6 bg-white rounded-xl p-4 shadow-sm">
              <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                <span>✅</span> Current Activities (2)
              </h4>
              <div className="grid md:grid-cols-2 gap-3">
                <div className="p-3 bg-green-50 rounded-lg border border-green-200 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900 text-sm">Piano Academy SF</p>
                    <p className="text-xs text-gray-500">Music • Emma • Tue & Thu</p>
                  </div>
                  <span className="text-green-600 text-xl">🎹</span>
                </div>
                <div className="p-3 bg-green-50 rounded-lg border border-green-200 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900 text-sm">Soccer Stars</p>
                    <p className="text-xs text-gray-500">Sports • Lucas • Sat</p>
                  </div>
                  <span className="text-green-600 text-xl">⚽</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Pricing */}
        <div className="max-w-4xl mx-auto mb-16">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-8">
            Simple Pricing
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            {/* Basic Plan */}
            <div className="bg-white rounded-2xl shadow-lg p-8 border-2 border-gray-200">
              <h3 className="text-xl font-bold text-gray-900 mb-2">Basic</h3>
              <p className="text-gray-600 mb-4">Get started organizing</p>
              <div className="mb-6">
                <span className="text-5xl font-bold text-gray-900">$0</span>
                <span className="text-gray-600">/forever</span>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-2 text-gray-700">
                  <span className="text-green-500">✓</span> Save up to 5 programs
                </li>
                <li className="flex items-center gap-2 text-gray-700">
                  <span className="text-green-500">✓</span> 1 child profile
                </li>
                <li className="flex items-center gap-2 text-gray-700">
                  <span className="text-green-500">✓</span> 1 parent profile
                </li>
                <li className="flex items-center gap-2 text-gray-700">
                  <span className="text-green-500">✓</span> Basic calendar view
                </li>
                <li className="flex items-center gap-2 text-gray-400">
                  <span>✗</span> <span className="line-through">Email reminders</span>
                </li>
                <li className="flex items-center gap-2 text-gray-400">
                  <span>✗</span> <span className="line-through">Calendar sync (Google/Apple)</span>
                </li>
              </ul>
              <button
                onClick={handleGetStarted}
                className="w-full py-3 rounded-lg font-medium transition-colors bg-gray-100 text-gray-700 hover:bg-gray-200"
              >
                Get Started Free
              </button>
            </div>

            {/* Pro Plan */}
            <div className="bg-white rounded-2xl shadow-lg p-8 border-2 border-blue-500 relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                RECOMMENDED
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Family Pro</h3>
              <p className="text-gray-600 mb-4">Full family organization</p>
              <div className="mb-6">
                <span className="text-5xl font-bold text-gray-900">$8.50</span>
                <span className="text-gray-600">/month</span>
                <p className="text-sm text-blue-600 mt-1">or $60/year (save 41%)</p>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-2 text-gray-700">
                  <span className="text-blue-500">✓</span> Unlimited saved programs
                </li>
                <li className="flex items-center gap-2 text-gray-700">
                  <span className="text-blue-500">✓</span> Unlimited child profiles
                </li>
                <li className="flex items-center gap-2 text-gray-700">
                  <span className="text-blue-500">✓</span> Full calendar view
                </li>
                <li className="flex items-center gap-2 text-gray-700">
                  <span className="text-blue-500">✓</span> Email reminders before registration
                </li>
                <li className="flex items-center gap-2 text-gray-700">
                  <span className="text-blue-500">✓</span> Sync to Google/Apple Calendar
                </li>
                <li className="flex items-center gap-2 text-gray-700">
                  <span className="text-blue-500">✓</span> Family sharing (2 accounts)
                </li>
              </ul>
              <button
                onClick={handleGetStarted}
                className="w-full py-3 rounded-lg font-medium transition-colors bg-gradient-to-r from-blue-500 to-indigo-500 text-white hover:from-blue-600 hover:to-indigo-600"
              >
                Start 7-Day Free Trial
              </button>
              <p className="text-xs text-gray-500 text-center mt-2">
                No credit card required for trial
              </p>
            </div>
          </div>
        </div>

        {/* How It Works */}
        <div className="max-w-4xl mx-auto mb-16">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">
            How It Works
          </h2>
          <div className="grid md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-3xl mx-auto mb-4">
                🔍
              </div>
              <h3 className="font-bold text-gray-900 mb-2">1. Browse</h3>
              <p className="text-gray-600 text-sm">
                Find programs on PlanMyKids
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center text-3xl mx-auto mb-4">
                💾
              </div>
              <h3 className="font-bold text-gray-900 mb-2">2. Save</h3>
              <p className="text-gray-600 text-sm">
                Click "Save" to add to your comparison list
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center text-3xl mx-auto mb-4">
                ✅
              </div>
              <h3 className="font-bold text-gray-900 mb-2">3. Decide</h3>
              <p className="text-gray-600 text-sm">
                Move to "Current" when you've enrolled
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center text-3xl mx-auto mb-4">
                🔔
              </div>
              <h3 className="font-bold text-gray-900 mb-2">4. Remember</h3>
              <p className="text-gray-600 text-sm">
                Get reminders for registration dates
              </p>
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div className="max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-8">
            Frequently Asked Questions
          </h2>
          <div className="space-y-3">
            {[
              {
                question: 'Can I try it before paying?',
                answer: 'Yes! You can use the Basic plan indefinitely with up to 3 saved programs and 1 child profile. The Pro plan also has a 7-day free trial.'
              },
              {
                question: 'How do registration reminders work?',
                answer: 'When you save a program, we automatically track its registration dates. Pro users get email reminders 1 week and 1 day before registration opens or closes.'
              },
              {
                question: 'Can I share with my partner/spouse?',
                answer: 'Pro plans include family sharing for up to 2 accounts. Both parents can view and manage the same saved programs and kid profiles.'
              },
              {
                question: 'What happens to my saved programs if I cancel Pro?',
                answer: 'Your data is never deleted. If you cancel Pro, you\'ll revert to the Basic plan with 3 active saves, 1 child profile, and no email reminders.'
              },
            ].map((faq, index) => (
              <div
                key={index}
                className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
              >
                <button
                  onClick={() => setExpandedFaq(expandedFaq === index ? null : index)}
                  className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-gray-50"
                >
                  <span className="font-medium text-gray-900">{faq.question}</span>
                  <span className="text-gray-400 text-xl">
                    {expandedFaq === index ? '−' : '+'}
                  </span>
                </button>
                {expandedFaq === index && (
                  <div className="px-6 pb-4">
                    <p className="text-gray-600">{faq.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <button
            onClick={handleGetStarted}
            className="px-8 py-4 rounded-xl font-bold text-lg transition-colors bg-gradient-to-r from-blue-500 to-indigo-500 text-white hover:from-blue-600 hover:to-indigo-600 shadow-lg"
          >
            Start Organizing Your Family's Activities
          </button>
          <p className="text-gray-500 mt-4">
            Free to start • No credit card required
          </p>
        </div>
      </section>
    </div>
  );
}
