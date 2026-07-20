import React from "react";

interface InfoCardProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  title: string;
  subtitle?: string;
  lines?: string[];
  color?: string;
  textColor?: string;
  titleFontSize?: number;
  contentFontSize?: number;
}

const InfoCard: React.FC<InfoCardProps> = ({
  x = 0,
  y = 0,
  width = 160,
  height,
  title,
  subtitle,
  lines = [],
  color = "#0B3B60",
  textColor = "#FFFFFF",
  titleFontSize,
  contentFontSize,
}) => {
  // ─── Helper untuk membungkus teks ───────────────────────────────────────
  const wrapText = (text: string, fontSize: number, maxWidth: number): string[] => {
    const charWidth = fontSize * 0.65;
    const maxChars = Math.max(1, Math.floor(maxWidth / charWidth));
    
    if (text.length <= maxChars) return [text];

    const words = text.split(" ");
    const lines: string[] = [];
    let currentLine = "";

    for (const word of words) {
      const testLine = currentLine ? currentLine + " " + word : word;
      if (testLine.length > maxChars) {
        if (currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          lines.push(word);
          currentLine = "";
        }
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);
    return lines;
  };

  // ─── Konfigurasi Layout (Base) ──────────────────────────────────────────
  const paddingX = 12;
  const paddingY = 14;
  const borderWidth = 2;
  const availableWidth = width - paddingX * 2;

  // Base font sizes
  const baseTitleFontSize = titleFontSize ?? 18;
  const baseSubtitleFontSize = 14;
  const baseContentFontSize = contentFontSize ?? 14;

  // Base line heights & spacings
  const baseTitleLineHeight = baseTitleFontSize * 1.1;
  const baseTitleToContentPadding = 12;
  const baseSubtitleLineHeight = 16;
  const baseSubtitleToContentPadding = 8;
  const baseContentLineHeight = 22;

  // Hitung semua baris teks (base)
  const titleLines = wrapText(title, baseTitleFontSize, availableWidth);
  const subtitleLines = subtitle ? wrapText(subtitle, baseSubtitleFontSize, availableWidth) : [];
  const contentLines = lines.flatMap((line) => wrapText(line, baseContentFontSize, availableWidth));

  // Hitung tinggi total base (tanpa scaling)
  const baseTotalContentHeight =
    (titleLines.length - 1) * baseTitleLineHeight +
    baseTitleFontSize +
    (subtitleLines.length > 0
      ? (subtitleLines.length - 1) * baseSubtitleLineHeight + baseSubtitleFontSize + baseSubtitleToContentPadding
      : 0) +
    contentLines.length * baseContentLineHeight +
    baseTitleToContentPadding;

  const baseTotalHeight = baseTotalContentHeight + paddingY * 2;

  // ─── Tentukan tinggi final ──────────────────────────────────────────────
  const finalHeight = height !== undefined ? height : baseTotalHeight;

  // ─── Hitung faktor skala ──────────────────────────────────────────────
  const scale = finalHeight / baseTotalHeight;

  // ─── Nilai yang diskalakan ──────────────────────────────────────────────
  const scaledPaddingY = paddingY * scale;
  const scaledTitleFontSize = baseTitleFontSize * scale;
  const scaledSubtitleFontSize = baseSubtitleFontSize * scale;
  const scaledContentFontSize = baseContentFontSize * scale;
  const scaledTitleLineHeight = baseTitleLineHeight * scale;
  const scaledTitleToContentPadding = baseTitleToContentPadding * scale;
  const scaledSubtitleLineHeight = baseSubtitleLineHeight * scale;
  const scaledSubtitleToContentPadding = baseSubtitleToContentPadding * scale;
  const scaledContentLineHeight = baseContentLineHeight * scale;

  const clipId = `card-clip-${Math.round(x)}-${Math.round(y)}-${title.replace(/[^a-zA-Z0-9]/g, "")}`;

  // ─── Render ─────────────────────────────────────────────────────────────
  let currentY = scaledPaddingY;

  return (
    <g transform={`translate(${x}, ${y})`}>
      <defs>
        <clipPath id={clipId}>
          <rect x={1} y={1} width={Math.max(0, width - 2)} height={Math.max(0, finalHeight - 2)} rx={2} />
        </clipPath>
      </defs>

      {/* ── Border / Card Background ────────────────────────────────────── */}
      <rect
        x={0}
        y={0}
        width={width}
        height={finalHeight}
        fill={color}
        stroke={textColor}
        strokeWidth={borderWidth}
        opacity="0.9"
        rx={2}
      />

      <g clipPath={`url(#${clipId})`}>
        {/* ── Title ────────────────────────────────────────────────────────── */}
        {titleLines.map((line, index) => {
          const yPos = currentY + scaledTitleFontSize;
          currentY += index === 0 ? scaledTitleFontSize : scaledTitleLineHeight;
          const lineEstWidth = line.length * (scaledTitleFontSize * 0.65);
          const needsSqueeze = lineEstWidth > availableWidth;

          return (
            <text
              key={`title-${index}`}
              x={width / 2}
              y={yPos}
              textAnchor="middle"
              fill={textColor}
              fontSize={scaledTitleFontSize}
              fontWeight="bold"
              fontFamily="sans-serif"
              {...(needsSqueeze ? { textLength: availableWidth, lengthAdjust: "spacingAndGlyphs" } : {})}
            >
              {line}
            </text>
          );
        })}

        {/* ── Padding setelah judul ────────────────────────────────────────── */}
        {currentY += scaledTitleToContentPadding}

        {/* ── Subtitle ─────────────────────────────────────────────────────── */}
        {subtitleLines.length > 0 && (
          <>
            {subtitleLines.map((line, index) => {
              const yPos = currentY + scaledSubtitleFontSize;
              currentY += index === 0 ? scaledSubtitleFontSize : scaledSubtitleLineHeight;
              const lineEstWidth = line.length * (scaledSubtitleFontSize * 0.65);
              const needsSqueeze = lineEstWidth > availableWidth;

              return (
                <text
                  key={`subtitle-${index}`}
                  x={width / 2}
                  y={yPos}
                  textAnchor="middle"
                  fill={textColor}
                  fontSize={scaledSubtitleFontSize}
                  fontWeight="bold"
                  opacity="0.85"
                  fontFamily="sans-serif"
                  {...(needsSqueeze ? { textLength: availableWidth, lengthAdjust: "spacingAndGlyphs" } : {})}
                >
                  {line}
                </text>
              );
            })}
            {currentY += scaledSubtitleToContentPadding}
          </>
        )}

        {/* ── Content Lines ────────────────────────────────────────────────── */}
        {contentLines.map((line, index) => {
          const yPos = currentY + scaledContentFontSize;
          currentY += scaledContentLineHeight;
          const lineEstWidth = line.length * (scaledContentFontSize * 0.65);
          const needsSqueeze = lineEstWidth > (availableWidth - 4);

          return (
            <text
              key={`content-${index}`}
              x={paddingX + 4}
              y={yPos}
              textAnchor="start"
              fill={textColor}
              fontSize={scaledContentFontSize}
              fontWeight="bold"
              fontFamily="sans-serif"
              {...(needsSqueeze ? { textLength: availableWidth - 4, lengthAdjust: "spacingAndGlyphs" } : {})}
            >
              {line}
            </text>
          );
        })}
      </g>
    </g>
  );
};

export default InfoCard;