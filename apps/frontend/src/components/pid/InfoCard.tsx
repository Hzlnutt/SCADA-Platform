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
  // ─── Helper untuk mengukur dan membungkus teks ke baris baru ────────────
  const getEstWidth = (str: string, fontSz: number) => {
    let w = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str[i];
      if (char >= 'A' && char <= 'Z') w += fontSz * 0.78;
      else if (char === ' ') w += fontSz * 0.35;
      else if (char >= '0' && char <= '9') w += fontSz * 0.72;
      else w += fontSz * 0.60;
    }
    return w;
  };

  const wrapText = (text: string, fontSize: number, maxWidth: number): string[] => {
    if (getEstWidth(text, fontSize) <= maxWidth) return [text];

    const words = text.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let currentLine = "";

    for (const word of words) {
      const testLine = currentLine ? currentLine + " " + word : word;
      if (getEstWidth(testLine, fontSize) > maxWidth) {
        if (currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          let chunk = "";
          for (let i = 0; i < word.length; i++) {
            if (getEstWidth(chunk + word[i], fontSize) > maxWidth) {
              if (chunk) lines.push(chunk);
              chunk = word[i];
            } else {
              chunk += word[i];
            }
          }
          if (chunk) currentLine = chunk;
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
  const baseContentFontSize = contentFontSize ?? (width <= 145 ? 10.5 : 11.5);

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
          const lineEstWidth = getEstWidth(line, scaledTitleFontSize);
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
              const lineEstWidth = getEstWidth(line, scaledSubtitleFontSize);
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

          const colonIndex = line.indexOf(":");
          if (colonIndex !== -1) {
            const labelText = line.substring(0, colonIndex).trim();
            const colonX = paddingX + (width <= 145 ? 48 : width >= 175 ? 72 : width >= 170 ? 66 : 68);

            return (
              <g key={`content-${index}`}>
                <text
                  x={paddingX + 4}
                  y={yPos}
                  textAnchor="start"
                  fill={textColor}
                  fontSize={scaledContentFontSize}
                  fontWeight="bold"
                  fontFamily="sans-serif"
                >
                  {labelText}
                </text>
                <text
                  x={colonX}
                  y={yPos}
                  textAnchor="start"
                  fill={textColor}
                  fontSize={scaledContentFontSize}
                  fontWeight="bold"
                  fontFamily="sans-serif"
                >
                  :
                </text>
              </g>
            );
          }

          const lineEstWidth = getEstWidth(line, scaledContentFontSize);
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