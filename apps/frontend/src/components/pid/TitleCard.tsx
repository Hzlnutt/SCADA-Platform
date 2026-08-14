import React from "react";

interface TitleCardProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  title: string;
  color?: string;
  textColor?: string;
  fontSize?: number;
  borderWidth?: number;
  borderRadius?: number;
  paddingTop?: number;
}

const TitleCard: React.FC<TitleCardProps> = ({
  x = 0,
  y = 0,
  width = 160,
  height = 80,
  title,
  color = "#0f172a", // ISA-101 Monochromatic Slate
  textColor = "#f8fafc",
  fontSize = 17,
  borderWidth = 1.5,
  borderRadius = 4,
  paddingTop = 12,
}) => {
  const wrapText = (text: string, maxWidth: number): string[] => {
    const charWidth = fontSize * 0.65;
    const maxChars = Math.floor((maxWidth - 8) / charWidth);
    if (text.length <= maxChars) return [text];

    const words = text.split(" ");
    const result: string[] = [];
    let currentLine = "";

    for (const word of words) {
      const testLine = currentLine ? currentLine + " " + word : word;
      if (testLine.length > maxChars) {
        if (currentLine) {
          result.push(currentLine);
          currentLine = word;
        } else {
          const truncated = word.slice(0, maxChars - 1) + "…";
          result.push(truncated);
          currentLine = "";
        }
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) result.push(currentLine);

    return result.map((line) =>
      line.length > maxChars ? line.slice(0, maxChars - 1) + "…" : line
    );
  };

  const availableWidth = width - 8;
  const titleLines = wrapText(title, availableWidth);
  const lineHeight = fontSize * 1.2;

  return (
    <g transform={`translate(${x}, ${y})`}>
      {/* Background card (ISA-101 Monochromatic) */}
      <rect
        x={0}
        y={0}
        width={width}
        height={height}
        fill={color}
        stroke="#334155"
        strokeWidth={borderWidth}
        rx={borderRadius}
        opacity="0.95"
      />

      {/* Judul */}
      {titleLines.map((line, index) => {
        const yPos = paddingTop + index * lineHeight + fontSize;
        return (
          <text
            key={`title-${index}`}
            x={width / 2}
            y={yPos}
            textAnchor="middle"
            fill={textColor}
            fontSize={fontSize}
            fontWeight="bold"
            fontFamily="'Plus Jakarta Sans', sans-serif"
            letterSpacing="0.03em"
          >
            {line}
          </text>
        );
      })}
    </g>
  );
};

export default TitleCard;