import { useEffect, useState } from "react";

export function StreamingText({
  text,
  speed = 12,
  className,
  onDone,
}: {
  text: string;
  speed?: number;
  className?: string;
  onDone?: () => void;
}) {
  const [i, setI] = useState(0);
  useEffect(() => {
    setI(0);
  }, [text]);
  useEffect(() => {
    if (i >= text.length) {
      onDone?.();
      return;
    }
    const t = setTimeout(() => setI((v) => v + 1), speed);
    return () => clearTimeout(t);
  }, [i, text, speed, onDone]);
  const done = i >= text.length;
  return (
    <span className={className}>
      {text.slice(0, i)}
      {!done && <span className="caret" />}
    </span>
  );
}
