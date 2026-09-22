interface Props {
  label: string;
  value: number | undefined;
  color: 'blue' | 'amber' | 'red' | 'green';
  icon: string;
}

const colorMap = {
  blue: 'border-blue-500 text-blue-700',
  amber: 'border-amber-500 text-amber-700',
  red: 'border-red-500 text-red-700',
  green: 'border-green-500 text-green-700',
};

export default function StatsCard({ label, value, color, icon }: Props) {
  return (
    <div className={`bg-white rounded-xl shadow-sm border-l-4 p-4 ${colorMap[color]}`}>
      <div className="text-2xl mb-1">{icon}</div>
      <div className="text-3xl font-bold">
        {value === undefined ? (
          <span className="text-gray-300 animate-pulse">—</span>
        ) : value === -1 ? (
          <span className="text-gray-400 text-xl">N/A</span>
        ) : (
          value.toLocaleString()
        )}
      </div>
      <div className="text-sm text-gray-500 mt-1">{label}</div>
    </div>
  );
}
