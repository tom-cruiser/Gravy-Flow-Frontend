type NetworkLineProps = {
  d: string;
  highlighted?: boolean;
};

export function NetworkLine({ d, highlighted = false }: NetworkLineProps) {
  return (
    <path
      d={d}
      fill="none"
      stroke={highlighted ? 'rgba(167, 139, 250, 0.9)' : 'rgba(91, 61, 138, 0.55)'}
      strokeWidth={highlighted ? 2.5 : 1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeDasharray={highlighted ? '0' : '6 8'}
      className="drop-shadow-[0_0_12px_rgba(147,51,234,0.12)]"
    />
  );
}
