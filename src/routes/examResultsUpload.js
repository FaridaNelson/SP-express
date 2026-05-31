import express from "express";
import multer from "multer";
import { PDFParse } from "pdf-parse";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post("/parse-pdf", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        message: "PDF file is required",
      });
    }

    const parser = new PDFParse({ data: req.file.buffer });
    const parsedPdf = await parser.getText();
    const text = parsedPdf.text;

    console.log(text);

    const parsed = parseAbrsmMarkForm(text);

    res.json({
      rawText: text,
      parsed,
    });
  } catch (err) {
    console.error("PDF parse error:", err);

    res.status(500).json({
      message: "Failed to parse PDF",
    });
  }
});

function parseAbrsmMarkForm(text) {
  const resultMatch = text.match(
    /Overall result:\s*(Distinction|Merit|Pass|Fail)/i,
  );
  const totalMatch = text.match(/Total mark:\s*(\d+)\/150/i);
  const examDateMatch = text.match(/Date of exam:\s*(.+)/i);
  const examinerMatch = text.match(/Examiner:\s*([A-Z0-9]+)/i);

  const cleaned = text
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();

  const startIndex = cleaned.search(/Overall result:/i);
  const body = startIndex >= 0 ? cleaned.slice(startIndex) : cleaned;

  // Performance pieces + Practical pieces are all /30.
  // Practical components have different max scores: /21, /21, /18.
  const sectionRegex = /([^\n]+)\n([\s\S]*?)\n(\d+)\/(30|21|18)/g;

  const sections = [];
  let match;

  while ((match = sectionRegex.exec(body)) !== null) {
    const heading = match[1].trim();
    const comment = match[2].trim();
    const mark = Number(match[3]);
    const maxMark = Number(match[4]);

    sections.push({
      heading,
      comment,
      mark,
      maxMark,
    });
  }

  const performanceSection = sections.find((s) =>
    /^Performance as a whole$/i.test(s.heading),
  );

  const scalesSection = sections.find((s) =>
    /scales|arpeggios/i.test(s.heading),
  );

  const sightReadingSection = sections.find((s) =>
    /sight[-\s]?reading/i.test(s.heading),
  );

  const auralSection = sections.find((s) => /aural/i.test(s.heading));

  const pieceSections = sections.filter(
    (s) => s.maxMark === 30 && !/^Performance as a whole$/i.test(s.heading),
  );

  return {
    result: resultMatch?.[1] || "",
    totalMark: totalMatch?.[1] || "",
    examDate: examDateMatch?.[1]?.trim() || "",
    examinerId: examinerMatch?.[1] || "",

    pieces: pieceSections.slice(0, 4).map((s, index) => ({
      slot: ["A", "B", "C", "D"][index],
      heading: s.heading,
      mark: s.mark,
      maxMark: s.maxMark,
      examinerComment: s.comment,
    })),

    pieceScores: {
      pieceA: pieceSections[0]?.mark || "",
      pieceB: pieceSections[1]?.mark || "",
      pieceC: pieceSections[2]?.mark || "",
      pieceD: pieceSections[3]?.mark || "",
    },

    pieceComments: {
      pieceA: pieceSections[0]?.comment || "",
      pieceB: pieceSections[1]?.comment || "",
      pieceC: pieceSections[2]?.comment || "",
      pieceD: pieceSections[3]?.comment || "",
    },

    performanceAsWhole: {
      mark: performanceSection?.mark || "",
      examinerComment: performanceSection?.comment || "",
    },

    componentScores: {
      scales: scalesSection?.mark || "",
      sightReading: sightReadingSection?.mark || "",
      aural: auralSection?.mark || "",
    },

    componentComments: {
      scales: scalesSection?.comment || "",
      sightReading: sightReadingSection?.comment || "",
      aural: auralSection?.comment || "",
    },
  };
}

export default router;
