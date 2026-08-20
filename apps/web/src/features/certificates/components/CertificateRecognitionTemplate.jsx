import React from "react";
import clsx from "clsx";

export default function CertificateRecognitionTemplate({
  schoolName = "DEMO INTERNATIONAL ACADEMY",
  certificateTitle = "CERTIFICATE OF RECOGNITION",
  recipientName = "Abebe Kebede Girma",
  section = "Section 10A",
  yearLevel = "Grade 10",
  batch = "2024/2025",
  achievement = "First Rank Academic Excellence & Exemplary Scholarly Discipline",
  issueDay = "20th",
  issueMonth = "June",
  issueYear = "2025",
  location = "Addis Ababa, Ethiopia",
  citationParagraph1 = "Thank you for demonstrating the type of character and integrity that inspire others.",
  citationParagraph2 = "Your selfless efforts are appreciated and haven't gone unnoticed.",
  signatoryLeft = {
    title: "Homeroom Teacher",
    name: "Mr. Daniel Tesfaye",
    signatureUrl: null,
  },
  signatoryRight = {
    title: "School Principal / Director",
    name: "Dr. Almaz Bekele",
    signatureUrl: null,
  },
  ribbonColor = "#0284C7", // Sky/Blue Ribbon
  sealColor = "#0F172A",   // Navy/Slate Seal
  borderColor = "#64748B",  // Slate Border
  className = "",
}) {
  return (
    <div
      className={clsx(
        "relative bg-[#FCFCFD] text-gray-900 font-serif shadow-2xl mx-auto overflow-hidden print:shadow-none print:m-0",
        className
      )}
      style={{
        width: "100%",
        maxWidth: "850px",
        minHeight: "1150px",
        padding: "48px 56px",
        boxSizing: "border-box",
      }}
    >
      {/* ── Ornate Classic Guilloche Border SVG ── */}
      <div className="absolute inset-5 border-[3px] border-slate-700 pointer-events-none z-10">
        <div className="absolute inset-1.5 border border-slate-400 pointer-events-none" />
        <div className="absolute inset-3 border-2 border-dashed border-slate-300 pointer-events-none" />
      </div>

      {/* Decorative Guilloche Corners */}
      <svg className="absolute top-7 left-7 w-16 h-16 text-slate-700 pointer-events-none z-20" viewBox="0 0 100 100" fill="currentColor">
        <path d="M5,5 L45,5 C25,15 15,25 5,45 Z M10,10 L35,10 C22,18 18,22 10,35 Z" />
        <circle cx="20" cy="20" r="4" />
      </svg>
      <svg className="absolute top-7 right-7 w-16 h-16 text-slate-700 pointer-events-none z-20 rotate-90" viewBox="0 0 100 100" fill="currentColor">
        <path d="M5,5 L45,5 C25,15 15,25 5,45 Z M10,10 L35,10 C22,18 18,22 10,35 Z" />
        <circle cx="20" cy="20" r="4" />
      </svg>
      <svg className="absolute bottom-7 left-7 w-16 h-16 text-slate-700 pointer-events-none z-20 -rotate-90" viewBox="0 0 100 100" fill="currentColor">
        <path d="M5,5 L45,5 C25,15 15,25 5,45 Z M10,10 L35,10 C22,18 18,22 10,35 Z" />
        <circle cx="20" cy="20" r="4" />
      </svg>
      <svg className="absolute bottom-7 right-7 w-16 h-16 text-slate-700 pointer-events-none z-20 rotate-180" viewBox="0 0 100 100" fill="currentColor">
        <path d="M5,5 L45,5 C25,15 15,25 5,45 Z M10,10 L35,10 C22,18 18,22 10,35 Z" />
        <circle cx="20" cy="20" r="4" />
      </svg>

      {/* ── Certificate Body ── */}
      <div className="relative z-20 flex flex-col items-center justify-between text-center min-h-[1050px] py-4">
        {/* Top: School Name */}
        <div>
          <h3 className="text-sm sm:text-base font-bold uppercase tracking-[0.25em] text-slate-700 mb-6">
            [{schoolName}]
          </h3>

          {/* Certificate Title */}
          <h1 className="text-2xl sm:text-4xl font-extrabold uppercase tracking-[0.12em] text-slate-900 mb-8 font-sans">
            {certificateTitle}
          </h1>

          {/* Centered Rosette Award Medal Seal Graphic */}
          <div className="flex justify-center my-6">
            <div className="relative flex flex-col items-center">
              {/* Rosette Outer Gear / Seal */}
              <div
                className="w-20 h-20 rounded-full border-4 flex items-center justify-center shadow-lg relative z-20 bg-white"
                style={{ borderColor: sealColor }}
              >
                <div
                  className="w-16 h-16 rounded-full border-2 border-dashed flex items-center justify-center"
                  style={{ borderColor: sealColor }}
                >
                  <svg viewBox="0 0 24 24" className="w-8 h-8 fill-amber-500">
                    <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                  </svg>
                </div>
              </div>

              {/* Dangling Blue Ribbon Tails */}
              <div className="flex gap-2 -mt-3 z-10">
                <div
                  className="w-5 h-12 clip-ribbon-left shadow-md"
                  style={{
                    backgroundColor: ribbonColor,
                    clipPath: "polygon(0 0, 100% 0, 100% 85%, 50% 100%, 0 85%)",
                  }}
                />
                <div
                  className="w-5 h-12 clip-ribbon-right shadow-md"
                  style={{
                    backgroundColor: ribbonColor,
                    clipPath: "polygon(0 0, 100% 0, 100% 85%, 50% 100%, 0 85%)",
                  }}
                />
              </div>
            </div>
          </div>

          <p className="text-sm italic font-medium text-slate-600 mb-4">
            This certificate is presented to
          </p>

          {/* Recipient Name */}
          <h2 className="text-2xl sm:text-3xl font-extrabold uppercase tracking-wide text-slate-900 font-sans border-b-2 border-slate-400 inline-block px-8 pb-1 mb-4">
            {recipientName}
          </h2>

          {/* Recipient Class / Batch Details */}
          <p className="text-xs sm:text-sm text-slate-700 mb-2">
            of <strong className="font-bold">{section}</strong> in{" "}
            <strong className="font-bold">{yearLevel}</strong> Batch{" "}
            <strong className="font-bold">[{batch}]</strong> for winning the
          </p>

          {/* Achievement Description Title */}
          <div className="max-w-xl mx-auto my-3 py-1.5 px-4 bg-slate-50 border border-slate-200 rounded-md">
            <h4 className="text-base sm:text-lg font-bold text-slate-900 uppercase font-sans tracking-wide">
              {achievement}
            </h4>
          </div>

          {/* Date & Location */}
          <p className="text-xs text-slate-600 my-4">
            Given this <strong className="font-semibold">{issueDay}</strong> day of{" "}
            <strong className="font-semibold">{issueMonth}</strong>,{" "}
            <strong className="font-semibold">{issueYear}</strong> at{" "}
            <strong className="font-semibold">{location}</strong>.
          </p>

          {/* Inspirational Citation Paragraphs */}
          <div className="max-w-lg mx-auto space-y-1.5 text-xs sm:text-sm text-slate-700 italic my-6 font-sans">
            <p>{citationParagraph1}</p>
            <p>{citationParagraph2}</p>
          </div>
        </div>

        {/* Bottom: Dual Signatures */}
        <div className="w-full grid grid-cols-2 gap-12 pt-10 px-4">
          {/* Left Signatory */}
          <div className="flex flex-col items-center">
            {/* Signature Graphic / Calligraphy */}
            <div className="h-14 flex items-center justify-center">
              <span className="font-signature text-2xl text-slate-800 -rotate-3 select-none" style={{ fontFamily: "cursive" }}>
                {signatoryLeft.name}
              </span>
            </div>
            <div className="w-48 border-b-2 border-slate-700 mb-1.5" />
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-900 font-sans">
              [AUTHORIZED SIGNATURE]
            </p>
            <p className="text-xs font-semibold text-slate-800 font-sans">
              {signatoryLeft.name}
            </p>
            <p className="text-[11px] text-slate-600 font-sans">
              [{signatoryLeft.title}]
            </p>
          </div>

          {/* Right Signatory */}
          <div className="flex flex-col items-center">
            {/* Signature Graphic / Calligraphy */}
            <div className="h-14 flex items-center justify-center">
              <span className="font-signature text-2xl text-slate-800 -rotate-3 select-none" style={{ fontFamily: "cursive" }}>
                {signatoryRight.name}
              </span>
            </div>
            <div className="w-48 border-b-2 border-slate-700 mb-1.5" />
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-900 font-sans">
              [AUTHORIZED SIGNATURE]
            </p>
            <p className="text-xs font-semibold text-slate-800 font-sans">
              {signatoryRight.name}
            </p>
            <p className="text-[11px] text-slate-600 font-sans">
              [{signatoryRight.title}]
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
