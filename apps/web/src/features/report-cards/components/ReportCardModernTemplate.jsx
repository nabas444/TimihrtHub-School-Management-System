import React from "react";
import clsx from "clsx";

export default function ReportCardModernTemplate({
  schoolName = "Demo International School",
  schoolLogo = null,
  studentName = "Abebe Kebede",
  classSection = "Grade 10 - Section A",
  schoolYear = "2024 / 2025",
  teacherName = "Mr. Daniel Tesfaye",
  subjects = [
    { name: "Reading & Comprehension", t1: 88, t2: 92, t3: 90, t4: 94, total: 100, obtained: 91, grade: "A" },
    { name: "English Language", t1: 85, t2: 89, t3: 88, t4: 92, total: 100, obtained: 88.5, grade: "A" },
    { name: "Spelling & Vocabulary", t1: 94, t2: 96, t3: 92, t4: 98, total: 100, obtained: 95, grade: "A+" },
    { name: "Writing & Composition", t1: 82, t2: 86, t3: 85, t4: 90, total: 100, obtained: 85.8, grade: "A" },
    { name: "Mathematics", t1: 90, t2: 95, t3: 94, t4: 96, total: 100, obtained: 93.8, grade: "A+" },
    { name: "General Science", t1: 86, t2: 90, t3: 89, t4: 93, total: 100, obtained: 89.5, grade: "A" },
    { name: "Social Studies & Civics", t1: 89, t2: 91, t3: 93, t4: 95, total: 100, obtained: 92, grade: "A" },
    { name: "Physical Education", t1: 95, t2: 98, t3: 96, t4: 99, total: 100, obtained: 97, grade: "A+" },
    { name: "Art & Design", t1: 90, t2: 92, t3: 91, t4: 94, total: 100, obtained: 91.8, grade: "A" },
    { name: "Music & Performing Arts", t1: 88, t2: 90, t3: 92, t4: 95, total: 100, obtained: 91.3, grade: "A" },
    { name: "Extracurricular / Clubs", t1: 95, t2: 96, t3: 97, t4: 98, total: 100, obtained: 96.5, grade: "A+" },
  ],
  termsGrades = {
    q1: "90.2%",
    q2: "92.4%",
    q3: "91.8%",
    q4: "94.6%",
    avg1: "3.85",
    avg2: "3.92",
    avg3: "3.90",
    avg4: "3.98",
  },
  teacherFeedback = "Abebe is a remarkably dedicated student who consistently exhibits scholarly curiosity, critical thinking, and exemplary peer leadership.",
  attendance = {
    totalDays: 180,
    attended: 176,
    absent: 4,
  },
  primaryColor = "#0D1B2A", // Deep Navy
  accentColor = "#7CB342",  // Grass Green
  showPencil = true,
  className = "",
}) {
  return (
    <div
      className={clsx(
        "relative bg-white text-gray-900 font-sans shadow-xl mx-auto overflow-hidden print:shadow-none print:m-0",
        className
      )}
      style={{
        width: "100%",
        maxWidth: "800px",
        minHeight: "1050px",
        padding: "36px 40px",
        boxSizing: "border-box",
      }}
    >
      {/* ── Outer Decorative Border Frame ── */}
      <div className="absolute inset-4 border-2 border-gray-800 pointer-events-none z-10">
        <div className="absolute inset-1 border border-gray-400 pointer-events-none" />
      </div>

      {/* ── Top-Right Dynamic Curved Wave Graphic ── */}
      <div className="absolute top-0 right-0 w-64 h-64 pointer-events-none z-0 overflow-hidden">
        <svg viewBox="0 0 250 250" className="w-full h-full" preserveAspectRatio="none">
          <path
            d="M 50,0 Q 180,40 210,180 Q 230,220 250,250 L 250,0 Z"
            fill={accentColor}
            opacity="0.9"
          />
          <path
            d="M 120,0 Q 200,60 230,160 Q 245,210 250,250 L 250,0 Z"
            fill={primaryColor}
          />
        </svg>
      </div>

      {/* ── Bottom-Left Dynamic Curved Wave Graphic ── */}
      <div className="absolute bottom-0 left-0 w-64 h-64 pointer-events-none z-0 overflow-hidden">
        <svg viewBox="0 0 250 250" className="w-full h-full" preserveAspectRatio="none">
          <path
            d="M 0,200 Q 70,210 40,70 Q 20,30 0,0 L 0,250 Z"
            fill={accentColor}
            opacity="0.9"
          />
          <path
            d="M 0,130 Q 50,190 20,90 Q 5,40 0,0 L 0,250 Z"
            fill={primaryColor}
          />
        </svg>
      </div>

      {/* ── Corner Filigrees ── */}
      <svg
        className="absolute top-6 left-6 w-12 h-12 text-gray-800 pointer-events-none z-20"
        viewBox="0 0 100 100"
        fill="currentColor"
      >
        <path d="M10,10 C30,10 40,25 35,45 C30,65 15,60 10,75 C25,70 35,80 40,95 C45,80 55,70 70,75 C65,60 50,65 45,45 C40,25 50,10 70,10 C50,15 45,5 10,10 Z M20,20 C35,20 40,30 38,42 C30,45 22,35 20,20 Z" />
      </svg>
      <svg
        className="absolute bottom-6 right-6 w-12 h-12 text-gray-800 pointer-events-none z-20 rotate-180"
        viewBox="0 0 100 100"
        fill="currentColor"
      >
        <path d="M10,10 C30,10 40,25 35,45 C30,65 15,60 10,75 C25,70 35,80 40,95 C45,80 55,70 70,75 C65,60 50,65 45,45 C40,25 50,10 70,10 C50,15 45,5 10,10 Z M20,20 C35,20 40,30 38,42 C30,45 22,35 20,20 Z" />
      </svg>

      {/* ── Right-Side Pencil Accent ── */}
      {showPencil && (
        <div className="absolute right-7 top-1/3 -translate-y-1/2 hidden sm:flex flex-col items-center pointer-events-none z-20">
          <div className="w-2.5 h-6 bg-red-400 rounded-t-sm" />
          <div className="w-2.5 h-1.5 bg-gray-400" />
          <div className="w-2.5 h-48 bg-emerald-600 border-x border-emerald-700 flex flex-col justify-around py-2">
            <div className="w-full h-0.5 bg-emerald-500" />
            <div className="w-full h-0.5 bg-emerald-500" />
          </div>
          <div className="w-0 h-0 border-x-[5px] border-x-transparent border-t-[14px] border-t-amber-100" />
          <div className="w-0 h-0 border-x-[2px] border-x-transparent border-t-[6px] border-t-gray-800 -mt-1.5" />
        </div>
      )}

      {/* ── Content Body ── */}
      <div className="relative z-20 px-4 py-2">
        {/* Header: Crest + Title + School Name */}
        <div className="flex items-center justify-center gap-4 mb-6">
          {schoolLogo ? (
            <img
              src={schoolLogo}
              alt="School Logo"
              className="h-16 w-auto max-h-16 object-contain"
            />
          ) : (
            <div
              className="w-14 h-14 rounded-xl flex items-center justify-center text-white shadow-md"
              style={{ backgroundColor: accentColor }}
            >
              <svg viewBox="0 0 24 24" className="w-9 h-9 fill-current">
                <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 4.5l1.91 3.87 4.27.62-3.09 3.01.73 4.25L12 15.24l-3.82 2.01.73-4.25-3.09-3.01 4.27-.62L12 5.5z" />
              </svg>
            </div>
          )}

          <div>
            <h1
              className="text-2xl sm:text-3xl font-black uppercase tracking-wider text-center sm:text-left"
              style={{ color: primaryColor }}
            >
              REPORT CARD
            </h1>
            <p className="text-sm sm:text-base font-semibold text-gray-700 tracking-wide text-center sm:text-left">
              {schoolName}
            </p>
          </div>
        </div>

        {/* Student Metadata Information Header */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2.5 text-xs text-gray-800 font-medium mb-6">
          <div className="flex items-baseline gap-2">
            <span className="font-bold text-gray-900 shrink-0">Student Name:</span>
            <span className="border-b border-gray-700 flex-1 px-1 font-semibold text-gray-900">
              {studentName}
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-bold text-gray-900 shrink-0">Class / Section:</span>
            <span className="border-b border-gray-700 flex-1 px-1 font-semibold text-gray-900">
              {classSection}
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-bold text-gray-900 shrink-0">School Year:</span>
            <span className="border-b border-gray-700 flex-1 px-1 font-semibold text-gray-900">
              {schoolYear}
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-bold text-gray-900 shrink-0">Teacher Name:</span>
            <span className="border-b border-gray-700 flex-1 px-1 font-semibold text-gray-900">
              {teacherName}
            </span>
          </div>
        </div>

        {/* ── Main Academic Subjects Table ── */}
        <div className="overflow-x-auto mb-5 border border-gray-700">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr style={{ backgroundColor: primaryColor }} className="text-white">
                <th className="py-2 px-3 font-bold border-r border-gray-600 w-1/3">Subject</th>
                <th className="py-2 px-2 text-center font-bold border-r border-gray-600">1ˢᵗ Term</th>
                <th className="py-2 px-2 text-center font-bold border-r border-gray-600">2ⁿᵈ Term</th>
                <th className="py-2 px-2 text-center font-bold border-r border-gray-600">3ʳᵈ Term</th>
                <th className="py-2 px-2 text-center font-bold border-r border-gray-600">4ᵗʰ Term</th>
                <th className="py-2 px-2 text-center font-bold border-r border-gray-600">Total</th>
                <th className="py-2 px-2 text-center font-bold border-r border-gray-600">Obtained</th>
                <th className="py-2 px-2 text-center font-bold">Grade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-300">
              {subjects.map((s, idx) => (
                <tr
                  key={idx}
                  className={idx % 2 === 1 ? "bg-gray-50/60" : "bg-white"}
                >
                  <td className="py-1.5 px-3 font-semibold text-gray-800 border-r border-gray-300">
                    {s.name}
                  </td>
                  <td className="py-1.5 px-2 text-center text-gray-700 border-r border-gray-300">
                    {s.t1 ?? "—"}
                  </td>
                  <td className="py-1.5 px-2 text-center text-gray-700 border-r border-gray-300">
                    {s.t2 ?? "—"}
                  </td>
                  <td className="py-1.5 px-2 text-center text-gray-700 border-r border-gray-300">
                    {s.t3 ?? "—"}
                  </td>
                  <td className="py-1.5 px-2 text-center text-gray-700 border-r border-gray-300">
                    {s.t4 ?? "—"}
                  </td>
                  <td className="py-1.5 px-2 text-center text-gray-700 border-r border-gray-300">
                    {s.total ?? 100}
                  </td>
                  <td className="py-1.5 px-2 text-center font-bold text-gray-900 border-r border-gray-300">
                    {s.obtained != null ? Number(s.obtained).toFixed(1) : "—"}
                  </td>
                  <td className="py-1.5 px-2 text-center font-extrabold text-gray-900">
                    {s.grade || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Terms Based Summary Table ── */}
        <div className="flex justify-end mb-6">
          <div className="w-full sm:w-80 border border-gray-700 overflow-hidden">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr style={{ backgroundColor: primaryColor }} className="text-white">
                  <th className="py-1.5 px-3 font-bold border-r border-gray-600">Terms Based Grades</th>
                  <th className="py-1.5 px-2 text-center font-bold border-r border-gray-600">1ˢᵗ</th>
                  <th className="py-1.5 px-2 text-center font-bold border-r border-gray-600">2ⁿᵈ</th>
                  <th className="py-1.5 px-2 text-center font-bold border-r border-gray-600">3ʳᵈ</th>
                  <th className="py-1.5 px-2 text-center font-bold">4ᵗʰ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-300">
                <tr className="bg-white">
                  <td className="py-1 px-3 font-semibold text-gray-800 border-r border-gray-300">Quarterly Grade</td>
                  <td className="py-1 px-2 text-center font-medium border-r border-gray-300">{termsGrades.q1 || "—"}</td>
                  <td className="py-1 px-2 text-center font-medium border-r border-gray-300">{termsGrades.q2 || "—"}</td>
                  <td className="py-1 px-2 text-center font-medium border-r border-gray-300">{termsGrades.q3 || "—"}</td>
                  <td className="py-1 px-2 text-center font-medium">{termsGrades.q4 || "—"}</td>
                </tr>
                <tr className="bg-gray-50/80">
                  <td className="py-1 px-3 font-semibold text-gray-800 border-r border-gray-300">Average GPA / Grade</td>
                  <td className="py-1 px-2 text-center font-bold border-r border-gray-300">{termsGrades.avg1 || "—"}</td>
                  <td className="py-1 px-2 text-center font-bold border-r border-gray-300">{termsGrades.avg2 || "—"}</td>
                  <td className="py-1 px-2 text-center font-bold border-r border-gray-300">{termsGrades.avg3 || "—"}</td>
                  <td className="py-1 px-2 text-center font-bold">{termsGrades.avg4 || "—"}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Teacher's Feedback & Comments Section ── */}
        <div className="mb-6">
          <p className="text-right text-[11px] font-black tracking-wider uppercase text-gray-900 mb-2">
            TEACHER'S FEEDBACK
          </p>
          <div className="space-y-3">
            <div className="border-b border-gray-700 min-h-[22px] text-xs text-gray-800 px-1 italic">
              {teacherFeedback}
            </div>
            <div className="border-b border-gray-700 min-h-[22px]" />
            <div className="border-b border-gray-700 min-h-[22px]" />
          </div>
        </div>

        {/* ── Bottom Attendance Summary ── */}
        <div className="flex items-center justify-between text-xs font-semibold text-gray-800 pt-2">
          <div className="flex items-baseline gap-2">
            <span>Total School Days:</span>
            <span className="border-b border-gray-700 w-16 text-center font-bold">
              {attendance.totalDays}
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span>Attended:</span>
            <span className="border-b border-gray-700 w-16 text-center font-bold text-emerald-700">
              {attendance.attended}
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span>Absent:</span>
            <span className="border-b border-gray-700 w-16 text-center font-bold text-red-600">
              {attendance.absent}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
