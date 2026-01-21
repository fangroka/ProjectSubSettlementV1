
import React from 'react';
import { TimelineEvent } from '../types';
import { Icons } from '../constants';

interface SettlementTimelineProps {
  events: TimelineEvent[];
}

const SettlementTimeline: React.FC<SettlementTimelineProps> = ({ events }) => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-6 border-b border-slate-100 bg-slate-50/30">
        <div className="flex items-center gap-3">
          <div className="w-1 h-5 bg-blue-600 rounded-full"></div>
          <h3 className="text-base font-bold text-slate-900 tracking-tight">结算生命周期轨迹</h3>
        </div>
      </div>
      <div className="p-6">
        <div className="relative">
          {events.map((event, idx) => (
            <div key={event.id} className="flex group mb-8 last:mb-0">
              {/* Timeline connector */}
              {idx !== events.length - 1 && (
                <div className={`absolute left-4 top-8 w-0.5 h-full -ml-px ${event.isCompleted ? 'bg-blue-500' : 'bg-slate-200'}`} />
              )}
              
              <div className="relative flex items-center justify-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center z-10 border-2 ${
                  event.isCompleted 
                    ? 'bg-blue-500 border-blue-500 text-white' 
                    : event.isCurrent 
                      ? 'bg-white border-blue-500 text-blue-500' 
                      : 'bg-white border-slate-200 text-slate-300'
                }`}>
                  {event.isCompleted ? <Icons.Check className="w-5 h-5" /> : <span className="text-xs font-bold">{idx + 1}</span>}
                </div>
              </div>

              <div className="ml-4 flex-1">
                <div className="flex items-center justify-between">
                  <h4 className={`text-sm font-semibold ${event.isCurrent ? 'text-blue-600' : 'text-slate-900'}`}>
                    {event.status === 'Draft' ? '创建结算表单' : 
                     event.status === 'Reviewing' ? '部门初审' : 
                     event.status === 'Auditing' ? '财务审计' : 
                     event.status === 'Approved' ? '高层审批' : '结算完成'}
                  </h4>
                  <span className="text-xs text-slate-400 font-mono">{event.time}</span>
                </div>
                <div className="flex items-center mt-1">
                  <span className="text-xs font-medium text-slate-600 mr-2">{event.user}</span>
                  <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded border border-slate-200">{event.role}</span>
                </div>
                {event.comment && (
                  <p className="mt-2 text-xs text-slate-500 italic bg-slate-50 p-2 rounded border-l-2 border-slate-200">
                    “{event.comment}”
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SettlementTimeline;
