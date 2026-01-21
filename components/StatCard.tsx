
import React from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  icon?: React.ReactNode;
  trend?: {
    value: string;
    isUp: boolean;
  };
  colorClass?: string;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, subValue, icon, trend, colorClass = "bg-white" }) => {
  return (
    <div className={`${colorClass} rounded-xl p-5 shadow-sm border border-slate-200 transition-all hover:shadow-md`}>
      <div className="flex justify-between items-start mb-4">
        <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
          {icon}
        </div>
        {trend && (
          <span className={`text-xs font-medium px-2 py-1 rounded-full ${trend.isUp ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {trend.isUp ? '↑' : '↓'} {trend.value}
          </span>
        )}
      </div>
      <div>
        <p className="text-sm font-medium text-slate-500 mb-1">{label}</p>
        <h3 className="text-2xl font-bold text-slate-900 tracking-tight">{value}</h3>
        {subValue && <p className="text-xs text-slate-400 mt-1">{subValue}</p>}
      </div>
    </div>
  );
};

export default StatCard;
