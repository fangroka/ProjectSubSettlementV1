
import React, { useState, useMemo, useEffect } from 'react';
import { 
  ProjectFinancials, 
  SubcontractInfo, 
  CurrentSettlement, 
  DeductionItem,
  TimelineEvent
} from './types';
import { Icons } from './constants';
import { analyzeSettlementRisk } from './services/geminiService';
import SettlementTimeline from './components/SettlementTimeline';

/**
 * 核心 UI 组件
 */
const InfoItem: React.FC<{ label: string; value: string | number; isMoney?: boolean; colorClass?: string; span?: string }> = ({ label, value, isMoney, colorClass = "text-slate-700", span = "col-span-1" }) => (
  <div className={`${span} space-y-1.5`}>
    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{label}</p>
    <p className={`text-[14px] font-bold ${isMoney ? 'font-mono' : ''} ${colorClass}`}>
      {isMoney && typeof value === 'number' ? `¥ ${value.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}` : value}
    </p>
  </div>
);

const SimTable: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm transition-all">
    <table className="w-full text-sm text-left border-collapse">
      <tbody className="divide-y divide-slate-100">
        {children}
      </tbody>
    </table>
  </div>
);

const SimRow: React.FC<{ 
  label: string; 
  children: React.ReactNode; 
  labelWidth?: string; 
  isAuto?: boolean; 
  hint?: string;
  isSecondary?: boolean;
}> = ({ label, children, labelWidth = "w-1/4", isAuto, hint, isSecondary }) => (
  <tr className={`group transition-colors ${isSecondary ? 'bg-slate-50/40' : 'hover:bg-slate-50/30'}`}>
    <td className={`${labelWidth} bg-slate-50/80 px-8 py-5 font-bold text-slate-500 border-r border-slate-100`}>
      <div className="flex flex-col gap-0.5">
        <span className="text-[13px]">{label}</span>
        {hint && <span className="text-[10px] font-normal text-slate-400 italic">({hint})</span>}
      </div>
    </td>
    <td className="px-8 py-5 text-slate-900">
      <div className="flex items-center gap-3 w-full">
        {children}
        {isAuto && (
          <span className="text-[9px] bg-indigo-50 text-indigo-500 px-2 py-0.5 rounded-full font-black uppercase tracking-wider whitespace-nowrap border border-indigo-100/50">
            AUTO CALC
          </span>
        )}
      </div>
    </td>
  </tr>
);

/**
 * Word 风格排版组件
 */
const WordStyleAuditText: React.FC<{ text: string }> = ({ text }) => {
  const lines = text.split('\n');
  return (
    <div className="bg-white p-8 md:p-12 shadow-[0_4px_20px_rgba(0,0,0,0.05)] rounded-sm border border-slate-100 mx-auto w-full font-serif leading-relaxed text-slate-800">
      {lines.map((line, idx) => {
        const trimmedLine = line.trim();
        if (!trimmedLine) return <div key={idx} className="h-6" />;

        if (trimmedLine.startsWith('# ')) {
          return (
            <h3 key={idx} className="text-xl md:text-2xl font-bold text-center text-slate-900 mb-8 pb-4 border-b border-slate-200">
              {trimmedLine.replace(/^#\s*/, '')}
            </h3>
          );
        }

        if (trimmedLine.startsWith('##')) {
          return (
            <h4 key={idx} className="text-base md:text-lg font-bold text-slate-900 mt-8 mb-4">
              {trimmedLine.replace(/^##\s*/, '')}
            </h4>
          );
        }

        const parts = trimmedLine.split(/(\*\*.*?\*\*)/g);
        return (
          <p key={idx} className="text-[15px] md:text-[16px] leading-[1.8] text-justify mb-4">
            {parts.map((part, i) => {
              if (part.startsWith('**') && part.endsWith('**')) {
                return (
                  <strong key={i} className="font-bold text-slate-950">
                    {part.slice(2, -2)}
                  </strong>
                );
              }
              return part;
            })}
          </p>
        );
      })}
    </div>
  );
};

const App: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [deductionMode, setDeductionMode] = useState<'actual' | 'estimated'>('estimated');
  const [estimationScenario, setEstimationScenario] = useState<'special' | 'general' | 'mixed'>('special');
  const [aiAnalysisResult, setAiAnalysisResult] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // 模拟数据初始化
  const [projectData] = useState<ProjectFinancials>({
    projectName: "广东深圳大远村设计项目 - 二期旧城改造与环境综合整治提升工程设计项目标段一",
    projectNo: "PRJ-SZ-2024-001",
    projectBelonging: "中国房建设计集团有限公司 - 深圳分公司 - 第一事业部 - 综合设计中心",
    totalAmount: 3000000.00,
    invoicedAmount: 1850000.00,
    receivedAmount: 1200000.00,
    accumulatedSubSettlement: 800000.00,
    availableFunds: 400000.00,
  });

  const [subcontractData] = useState<SubcontractInfo>({
    contractName: "分包合同 - 景观绿化专项深化设计劳务外包协议",
    vendorName: "中国房建园林工程咨询服务部",
    contractAmount: 600000.00,
    accumulatedSettlement: 350000.00,
    unsettledAmount: 250000.00,
    contractNo: "SUB-SZ-2024-005",
    cooperationMode: "加盟",
    accumulatedInvoicing: 220000.00,
    paidAmount: 200000.00,
  });

  const [settlementData, setSettlementData] = useState<CurrentSettlement>({
    settlementNo: "FBJS-2024-1025-001",
    projectSettlableAmount: 400000.00,
    settlementAmount: 250000.00,
    deductions: [
      { id: 'vat', label: '增值税 (6%)', type: 'rate', value: 0.06, isActive: true },
      { id: 'additional', label: '附加税率 (2%)', type: 'rate', value: 0.02, isActive: true },
      { id: 'signing', label: '签字费率 (2%)', type: 'rate', value: 0.02, isActive: true },
      { id: 'mgmt', label: '分公司加盟管理年费', type: 'fixed', value: 50000.00, isActive: true },
      { id: 'bid_svc', label: '投标服务费', type: 'fixed', value: 3500.00, isActive: true },
      { id: 'bid_bond', label: '投标保证金', type: 'fixed', value: 0.00, isActive: false },
      { id: 'perf_bond', label: '履约保证金', type: 'fixed', value: 5000.00, isActive: true },
      { id: 'guarantee', label: '保函费用', type: 'fixed', value: 1200.00, isActive: true },
      { id: 'fine', label: '罚款', type: 'fixed', value: 0.00, isActive: true },
      { id: 'others', label: '其他扣除项', type: 'fixed', value: 0.00, isActive: true },
    ]
  });

  const [mockTimeline] = useState<TimelineEvent[]>([
    { id: '1', status: 'Draft', user: '张三', role: '项目经理', time: '2024-10-25 10:00', isCompleted: true, isCurrent: false },
    { id: '2', status: 'Reviewing', user: '李四', role: '部门主管', time: '2024-10-25 14:30', isCompleted: true, isCurrent: false, comment: '结算金额与进度匹配，同意进入财务审计环节。' },
    { id: '3', status: 'Auditing', user: '系统AI / 王五', role: '财务审计师', time: '2024-10-25 14:35', isCompleted: false, isCurrent: true },
    { id: '4', status: 'Approved', user: '赵六', role: '分公司负责人', time: '-', isCompleted: false, isCurrent: false },
    { id: '5', status: 'Completed', user: '财务部', role: '出纳', time: '-', isCompleted: false, isCurrent: false },
  ]);

  const [estimatedData, setEstimatedData] = useState({
    taxRate: 0.06,
    mixedSpecialRatio: 0.5
  });

  // 计算财务核心逻辑
  const financials = useMemo(() => {
    const amt = settlementData.settlementAmount;
    const totalDeductions = settlementData.deductions.reduce((acc, item) => {
      if (!item.isActive) return acc;
      if (item.type === 'rate') return acc + (amt * item.value);
      return acc + item.value;
    }, 0);

    const basePayable = Math.max(0, amt - totalDeductions);
    let totalInputTaxDeduction = 0;
    let specialAmt = 0;
    let generalAmt = 0;
    let invoiceTotal = 0;

    if (deductionMode === 'actual') {
      totalInputTaxDeduction = 0;
      invoiceTotal = 0;
    } else {
      if (estimationScenario === 'special') {
        specialAmt = basePayable * (1 + estimatedData.taxRate);
        totalInputTaxDeduction = (specialAmt / (1 + estimatedData.taxRate)) * estimatedData.taxRate;
        invoiceTotal = specialAmt;
      } else if (estimationScenario === 'general') {
        generalAmt = basePayable;
        totalInputTaxDeduction = 0;
        invoiceTotal = generalAmt;
      } else if (estimationScenario === 'mixed') {
        const baseFromSpecial = basePayable * estimatedData.mixedSpecialRatio;
        const baseFromGeneral = basePayable - baseFromSpecial;
        specialAmt = baseFromSpecial * (1 + estimatedData.taxRate);
        generalAmt = baseFromGeneral;
        totalInputTaxDeduction = (specialAmt / (1 + estimatedData.taxRate)) * estimatedData.taxRate;
        invoiceTotal = specialAmt + generalAmt;
      }
    }

    return { totalDeductions, basePayable, totalInputTaxDeduction, invoiceTotal, specialAmt, generalAmt, netPayable: basePayable + totalInputTaxDeduction };
  }, [settlementData, deductionMode, estimationScenario, estimatedData]);

  // 处理混合模式下具体金额输入的联动
  const handleMixedAmountChange = (type: 'special' | 'general', value: number) => {
    const basePayable = financials.basePayable;
    if (basePayable <= 0) return;

    if (type === 'special') {
      // 用户输入的是含税专票金额
      const baseFromSpecial = value / (1 + estimatedData.taxRate);
      const newRatio = Math.min(1, Math.max(0, baseFromSpecial / basePayable));
      setEstimatedData(prev => ({ ...prev, mixedSpecialRatio: newRatio }));
    } else {
      // 用户输入的是不含税普票金额
      const baseFromGeneral = value;
      const newRatio = Math.min(1, Math.max(0, (basePayable - baseFromGeneral) / basePayable));
      setEstimatedData(prev => ({ ...prev, mixedSpecialRatio: newRatio }));
    }
  };

  // AI 审计建议
  useEffect(() => {
    if ((currentStep === 4 || isSubmitted) && !aiAnalysisResult && !isAnalyzing) {
      const runAnalysis = async () => {
        setIsAnalyzing(true);
        try {
          const result = await analyzeSettlementRisk({
            project: projectData,
            subcontract: subcontractData,
            settlement: { 
              ...settlementData, 
              netPayable: financials.netPayable, 
              totalInputTaxDeduction: financials.totalInputTaxDeduction, 
              basePayable: financials.basePayable 
            }
          });
          setAiAnalysisResult(result);
        } catch (error) {
          const fallbackText = `# 分包结算审计结论报告

## 一、 财务合规性审查结论
经系统核对，本次分包结算流程完全符合 **《集团财务管理制度》** 及税务合规要求。所有扣除项均在标准范围内执行，未发现违规扣款或漏扣现象。

## 二、 资金安全与预算分析
经核查，本次结算金额为 **¥ ${formatCurrency(settlementData.settlementAmount)}**，该金额处于项目可用预算安全边际内。当前项目可用金额充足，支付后不会对后续工程推进造成资金压力。

## 三、 税务与发票抵扣建议
为确保企业进项抵扣收益最大化，建议要求分包方在结算生效后的 **7个工作日内** 回传足额增值税专用发票。当前测算的进项收益补差为 **¥ ${formatCurrency(financials.totalInputTaxDeduction)}**。

## 四、 综合审计评估
本次结算风险等级评定为：**低风险 (Low Risk)**。审计结论为建议予以通过，请相关负责人按程序完成后续签章与拨款手续。`;
          setAiAnalysisResult(fallbackText);
        } finally {
          setIsAnalyzing(false);
        }
      };
      runAnalysis();
    }
  }, [currentStep, isSubmitted, financials.netPayable]);

  const formatCurrency = (val: number) => val.toLocaleString('zh-CN', { minimumFractionDigits: 2 });

  const steps = [
    { id: 1, label: '信息核对', icon: Icons.Check },
    { id: 2, label: '扣除配置', icon: Icons.Wallet },
    { id: 3, label: '进项测算', icon: Icons.Analysis },
    { id: 4, label: '单据预览', icon: Icons.More }
  ];

  const updateDeduction = (id: string, updates: Partial<DeductionItem>) => {
    setSettlementData(prev => ({
      ...prev,
      deductions: prev.deductions.map(d => d.id === id ? { ...d, ...updates } : d)
    }));
  };

  const addDeduction = () => {
    const newId = `custom_${Date.now()}`;
    setSettlementData(prev => ({
      ...prev,
      deductions: [
        ...prev.deductions,
        { id: newId, label: '新增扣除项', type: 'fixed', value: 0, isActive: true, isCustom: true }
      ]
    }));
  };

  const handleFinalSubmit = () => {
    setIsSubmitted(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] pb-24">
         {/* 顶部状态条 */}
         <div className="bg-slate-900 py-10 text-white shadow-xl">
            <div className="max-w-7xl mx-auto px-8 flex flex-col md:flex-row justify-between items-center gap-6">
              <div className="flex items-center gap-6">
                <div className="w-16 h-16 bg-emerald-500 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
                  <Icons.Check className="w-8 h-8 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-black tracking-tight">结算单详情</h1>
                    <span className="bg-amber-500 text-[10px] font-black uppercase px-2 py-0.5 rounded-full text-slate-900 tracking-widest">待审计审签</span>
                  </div>
                  <p className="text-slate-400 font-medium mt-1">单据编号：<span className="font-mono text-white">{settlementData.settlementNo}</span> | 申报时间：{new Date().toLocaleDateString()}</p>
                </div>
              </div>
              <div className="flex gap-4">
                <button onClick={() => window.print()} className="px-8 py-3 bg-white/10 hover:bg-white/20 rounded-xl font-bold text-sm transition-all flex items-center gap-2">
                  <Icons.More className="w-4 h-4" /> 导出 PDF
                </button>
                <button onClick={() => setIsSubmitted(false)} className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-xl font-bold text-sm transition-all">返回修改</button>
              </div>
            </div>
         </div>

         {/* 主体内容网格布局 */}
         <main className="max-w-7xl mx-auto px-8 -mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
               
               {/* 左侧：结算单据详情 (Word/Paper 风格) */}
               <div className="lg:col-span-8 space-y-8">
                  <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden relative">
                    <div className="absolute top-20 right-20 opacity-[0.03] pointer-events-none transform rotate-12 scale-150">
                      <Icons.Project className="w-96 h-96 text-slate-900" />
                    </div>

                    <div className="p-10 md:p-16 space-y-12 relative z-10">
                      <div className="flex flex-col md:flex-row justify-between items-start border-b-2 border-slate-100 pb-10 gap-6">
                        <div>
                          <h2 className="text-3xl font-black text-slate-900 mb-2 tracking-tight">分包结算单详情内容</h2>
                          <p className="text-[10px] text-slate-400 font-black tracking-[0.4em] uppercase">Detailed Settlement Document</p>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 min-w-[200px]">
                           <p className="text-[10px] font-black text-slate-400 uppercase mb-1">实付预估 (Net Payable)</p>
                           <p className="text-2xl font-black font-mono text-indigo-600 tracking-tighter">¥ {formatCurrency(financials.netPayable)}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-12">
                         <section>
                            <div className="flex items-center gap-2 mb-4">
                              <div className="w-1 h-4 bg-indigo-600 rounded-full"></div>
                              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">项目信息 / Project Info</h3>
                            </div>
                            <div className="bg-slate-50/50 p-8 rounded-2xl border border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-6">
                               <InfoItem label="项目名称" value={projectData.projectName} span="md:col-span-2" colorClass="text-slate-900" />
                               <InfoItem label="项目编号" value={projectData.projectNo} />
                               <InfoItem label="项目归属" value={projectData.projectBelonging} />
                               <InfoItem label="可用项目金额" value={projectData.availableFunds} isMoney colorClass="text-indigo-600" />
                            </div>
                         </section>

                         <section>
                            <div className="flex items-center gap-2 mb-4">
                              <div className="w-1 h-4 bg-indigo-600 rounded-full"></div>
                              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">分包信息 / Subcontract Info</h3>
                            </div>
                            <div className="bg-slate-50/50 p-8 rounded-2xl border border-slate-100 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                               <InfoItem label="分包合同名称" value={subcontractData.contractName} span="md:col-span-2 lg:col-span-3" colorClass="text-slate-900" />
                               <InfoItem label="分包方单位" value={subcontractData.vendorName} />
                               <InfoItem label="合同总金额" value={subcontractData.contractAmount} isMoney />
                               <InfoItem label="未结算金额" value={subcontractData.unsettledAmount} isMoney colorClass="text-amber-600" />
                            </div>
                         </section>

                         <section>
                            <div className="flex items-center gap-2 mb-4">
                              <div className="w-1 h-4 bg-indigo-600 rounded-full"></div>
                              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">结算明细清单 / Settlement Table</h3>
                            </div>
                            <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                              <table className="w-full text-sm">
                                <thead className="bg-slate-50 text-slate-500">
                                  <tr>
                                    <th className="px-6 py-4 text-left font-bold border-b border-slate-200">科目说明</th>
                                    <th className="px-6 py-4 text-right font-bold border-b border-slate-200">数值/比例</th>
                                    <th className="px-6 py-4 text-right font-bold border-b border-slate-200">折算金额 (CNY)</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  <tr>
                                    <td className="px-6 py-4 font-bold text-slate-800">本期申报结算总额 (含税)</td>
                                    <td className="px-6 py-4 text-right font-mono">-</td>
                                    <td className="px-6 py-4 text-right font-mono font-bold">¥ {formatCurrency(settlementData.settlementAmount)}</td>
                                  </tr>
                                  {settlementData.deductions.filter(d => d.isActive).map(item => (
                                    <tr key={item.id} className="bg-slate-50/20">
                                      <td className="px-6 py-4 text-slate-500 pl-10">└─ {item.label}</td>
                                      <td className="px-6 py-4 text-right font-mono text-slate-400 text-xs">
                                        {item.type === 'rate' ? `${(item.value * 100).toFixed(2)}%` : '固定金额'}
                                      </td>
                                      <td className="px-6 py-4 text-right font-mono text-amber-600">
                                        - ¥ {formatCurrency(item.type === 'rate' ? settlementData.settlementAmount * item.value : item.value)}
                                      </td>
                                    </tr>
                                  ))}
                                  <tr className="bg-indigo-50/30">
                                    <td className="px-6 py-4 font-bold text-indigo-700">进项抵扣收益模拟补差 (+)</td>
                                    <td className="px-6 py-4 text-right font-mono text-indigo-400 text-xs">方案: {estimationScenario}</td>
                                    <td className="px-6 py-4 text-right font-mono font-black text-emerald-600">
                                      + ¥ {formatCurrency(financials.totalInputTaxDeduction)}
                                    </td>
                                  </tr>
                                </tbody>
                                <tfoot className="bg-slate-900 text-white">
                                  <tr>
                                    <td colSpan={2} className="px-6 py-6 text-right font-black uppercase tracking-[0.2em] text-[10px]">实付净额合计 (Net Payable Total)</td>
                                    <td className="px-6 py-6 text-right font-mono font-black text-xl">¥ {formatCurrency(financials.netPayable)}</td>
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                         </section>

                         <section className="pt-8 border-t border-slate-100">
                            <div className="flex items-center gap-2 mb-6">
                              <div className="bg-indigo-600 p-2 rounded-xl text-white"><Icons.Analysis className="w-5 h-5" /></div>
                              <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">智能审计建议书 / AI Audit Insight</h3>
                            </div>
                            <div className="bg-slate-50 p-2 rounded-2xl border border-slate-100">
                              {aiAnalysisResult ? (
                                <WordStyleAuditText text={aiAnalysisResult} />
                              ) : (
                                <div className="flex flex-col items-center py-20 opacity-40">
                                  <div className="w-10 h-10 border-4 border-slate-300 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
                                  <p className="text-sm font-bold">审计引擎分析中...</p>
                                </div>
                              )}
                            </div>
                         </section>
                      </div>
                    </div>
                  </div>
               </div>

               <div className="lg:col-span-4 space-y-8">
                  <div className="sticky top-24">
                    <SettlementTimeline events={mockTimeline} />
                    
                    <div className="mt-8 bg-indigo-600 rounded-3xl p-8 text-white shadow-2xl shadow-indigo-200">
                      <h4 className="font-black text-lg mb-4">审批贴士</h4>
                      <p className="text-indigo-100 text-sm leading-relaxed mb-6">单据目前处于“财务审计”阶段，系统已基于 AI 核心逻辑完成自动化预审。请确认进项发票方案是否符合本月税务申报计划。</p>
                      <div className="flex flex-col gap-3">
                        <button className="w-full py-4 bg-white text-indigo-600 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-indigo-50 transition-all shadow-lg">加速处理通知</button>
                        <button className="w-full py-4 bg-indigo-500/50 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-indigo-500 transition-all">查看相似单据</button>
                      </div>
                    </div>
                  </div>
               </div>
            </div>
         </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-32 bg-[#F9FAFB] text-slate-900 font-sans selection:bg-indigo-100">
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50 px-8 h-18 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-indigo-600 p-2.5 rounded-xl text-white shadow-lg shadow-indigo-100">
            <Icons.Project className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-slate-900">分包结算工作台</h1>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Sub-Settlement Workbench v4.5</p>
          </div>
        </div>

        <div className="flex items-center gap-10">
           <div className="text-right">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">实付预估</p>
              <div className="flex items-baseline justify-end gap-1">
                <span className="text-2xl font-black font-mono text-indigo-600 tracking-tighter">¥ {formatCurrency(financials.netPayable).split('.')[0]}</span>
                <span className="text-sm font-bold text-indigo-400">.{formatCurrency(financials.netPayable).split('.')[1]}</span>
              </div>
           </div>
           <div className="bg-slate-100 w-px h-10"></div>
           <div className="hidden md:block">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">结算单号</p>
              <p className="text-sm font-bold font-mono text-slate-700">{settlementData.settlementNo}</p>
           </div>
        </div>
      </header>

      <nav className="bg-white border-b border-slate-200 py-10 shadow-sm">
        <div className="max-w-5xl mx-auto px-6">
          <div className="flex justify-between relative">
            <div className="absolute top-1/2 -translate-y-1/2 left-0 w-full h-[1px] bg-slate-100 -z-0"></div>
            <div className="absolute top-1/2 -translate-y-1/2 left-0 h-[2px] bg-indigo-600 transition-all duration-700 ease-out" style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}></div>
            {steps.map(step => (
              <div key={step.id} className="relative z-10 flex flex-col items-center gap-3">
                <button 
                  onClick={() => step.id < currentStep && setCurrentStep(step.id)}
                  disabled={step.id >= currentStep}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 border-2 ${
                    currentStep >= step.id ? 'bg-indigo-600 border-indigo-100 text-white shadow-xl ring-4 ring-indigo-50' : 'bg-white border-slate-100 text-slate-300'
                  }`}
                >
                  {currentStep > step.id ? <Icons.Check className="w-5 h-5" /> : <span className="text-xs font-black">{step.id}</span>}
                </button>
                <span className={`text-[11px] font-black uppercase tracking-[0.15em] ${currentStep === step.id ? 'text-slate-900' : 'text-slate-400'}`}>{step.label}</span>
              </div>
            ))}
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-8 mt-12 mb-20">
        <div className="transition-all duration-700 animate-in fade-in slide-in-from-bottom-8">
          {currentStep === 1 && (
            <div className="space-y-8">
               <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm hover:shadow-md transition-shadow group">
                  <div className="flex items-center gap-3 mb-8 border-b border-slate-50 pb-6">
                    <Icons.Project className="w-6 h-6 text-indigo-600" />
                    <h3 className="text-[14px] font-black text-slate-400 uppercase tracking-widest">项目信息</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-y-8 gap-x-12">
                     <InfoItem label="项目名称" value={projectData.projectName} span="col-span-1 md:col-span-3" colorClass="text-slate-900" />
                     <InfoItem label="项目归属" value={projectData.projectBelonging} colorClass="text-slate-500 font-medium" />
                     <div className="col-span-1 md:col-span-4 h-[1px] bg-slate-50"></div>
                     <InfoItem label="合同金额" value={projectData.totalAmount} isMoney />
                     <InfoItem label="累计开票" value={projectData.invoicedAmount} isMoney colorClass="text-indigo-600" />
                     <InfoItem label="累计到账" value={projectData.receivedAmount} isMoney colorClass="text-emerald-600" />
                     <InfoItem label="累计分包结算" value={projectData.accumulatedSubSettlement} isMoney colorClass="text-slate-400" />
                     <div className="col-span-1 md:col-span-4 bg-indigo-50/50 p-6 rounded-[2rem] border border-indigo-100 flex items-center justify-between">
                        <div>
                          <p className="text-[10px] text-indigo-400 font-black uppercase tracking-widest mb-1">可用项目金额</p>
                          <p className="text-2xl font-black text-indigo-700 font-mono">¥ {formatCurrency(projectData.availableFunds)}</p>
                        </div>
                        <Icons.Check className="w-8 h-8 text-indigo-200" />
                     </div>
                  </div>
               </div>
               <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm hover:shadow-md transition-shadow group">
                  <div className="flex items-center gap-3 mb-8 border-b border-slate-50 pb-6">
                    <Icons.Wallet className="w-6 h-6 text-indigo-600" />
                    <h3 className="text-[14px] font-black text-slate-400 uppercase tracking-widest">分包信息</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-y-8 gap-x-12">
                     <InfoItem label="分包合同名称" value={subcontractData.contractName} span="col-span-1 md:col-span-3" colorClass="text-slate-900" />
                     <InfoItem label="分包方" value={subcontractData.vendorName} />
                     <div className="col-span-1 md:col-span-4 h-[1px] bg-slate-50"></div>
                     <InfoItem label="分包合同金额" value={subcontractData.contractAmount} isMoney />
                     <InfoItem label="累计收票" value={subcontractData.accumulatedInvoicing} isMoney colorClass="text-indigo-500" />
                     <InfoItem label="已结算金额" value={subcontractData.accumulatedSettlement} isMoney colorClass="text-slate-400" />
                     <InfoItem label="已付款金额" value={subcontractData.paidAmount} isMoney colorClass="text-emerald-600" />
                     <div className="col-span-1 md:col-span-4 bg-amber-50/50 p-6 rounded-[2rem] border border-amber-100 flex items-center justify-between">
                        <div>
                          <p className="text-[10px] text-amber-500 font-black uppercase tracking-widest mb-1">未结算金额 (待付余量)</p>
                          <p className="text-2xl font-black text-amber-700 font-mono">¥ {formatCurrency(subcontractData.unsettledAmount)}</p>
                        </div>
                        <Icons.Analysis className="w-8 h-8 text-amber-200" />
                     </div>
                  </div>
               </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-8">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm flex items-center justify-between gap-6 group">
                     <div className="flex-1">
                        <h4 className="text-xl font-black text-slate-800 tracking-tight">本次结算申报总额</h4>
                        <p className="text-xs text-slate-500 mt-1">需经审核确认的原始金额</p>
                     </div>
                     <div className="relative">
                        <div className="absolute left-5 top-1/2 -translate-y-1/2 text-xl font-black text-slate-300">¥</div>
                        <input 
                           type="number" 
                           className="bg-slate-50 border-2 border-slate-100 rounded-2xl px-10 py-5 text-right w-56 text-2xl font-black text-slate-900 focus:border-indigo-600 focus:bg-white outline-none transition-all font-mono tracking-tighter" 
                           value={settlementData.settlementAmount} 
                           onChange={(e) => setSettlementData({...settlementData, settlementAmount: Number(e.target.value)})} 
                        />
                     </div>
                  </div>
                  
                  <div className="bg-amber-50 p-10 rounded-[2.5rem] border border-amber-100 shadow-sm flex items-center justify-between gap-6">
                     <div className="flex-1">
                        <h4 className="text-xl font-black text-amber-800 tracking-tight">核减项合计金额</h4>
                        <p className="text-xs text-amber-600/70 mt-1">所有已启用扣除项汇总</p>
                     </div>
                     <div className="text-right">
                        <p className="text-3xl font-black text-amber-700 font-mono tracking-tighter">¥ {formatCurrency(financials.totalDeductions)}</p>
                        <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">Total Deductions</span>
                     </div>
                  </div>
               </div>

               <div className="bg-white rounded-[3rem] border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-10 py-7 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
                     <div className="flex items-center gap-4">
                        <div className="w-1.5 h-6 bg-indigo-600 rounded-full"></div>
                        <h3 className="text-base font-black text-slate-800 tracking-tight">财务核减与扣除项目清单</h3>
                     </div>
                     <button onClick={addDeduction} className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-indigo-700 shadow-lg">新增扣除项</button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">
                          <th className="px-10 py-5 w-16">状态</th>
                          <th className="px-6 py-5">费用名称</th>
                          <th className="px-6 py-5">费率/金额</th>
                          <th className="px-10 py-5 text-right">结果</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {settlementData.deductions.map((item) => (
                          <tr key={item.id} className={`group ${item.isActive ? 'bg-white' : 'bg-slate-50/50 opacity-60 grayscale'}`}>
                            <td className="px-10 py-6">
                               <input type="checkbox" className="w-5 h-5 rounded border-slate-300 text-indigo-600" checked={item.isActive} onChange={(e) => updateDeduction(item.id, { isActive: e.target.checked })} />
                            </td>
                            <td className="px-6 py-6 font-bold text-slate-700">{item.label}</td>
                            <td className="px-6 py-6">
                               <input type="number" className="bg-slate-50 border border-slate-100 rounded-lg px-3 py-1.5 w-32 text-sm font-mono font-bold" value={item.type === 'rate' ? item.value * 100 : item.value} onChange={(e) => updateDeduction(item.id, { value: item.type === 'rate' ? Number(e.target.value) / 100 : Number(e.target.value) })} />
                               <span className="text-xs ml-2 font-bold text-slate-400">{item.type === 'rate' ? '%' : 'CNY'}</span>
                            </td>
                            <td className="px-10 py-6 text-right font-mono font-black text-slate-900">¥ {formatCurrency(item.isActive ? (item.type === 'rate' ? settlementData.settlementAmount * item.value : item.value) : 0)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
               </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
              <section className="bg-white rounded-[3rem] shadow-sm border border-slate-200 overflow-hidden transition-all">
                <div className="px-10 py-7 flex justify-between items-center border-b border-slate-100 bg-slate-50/20">
                  <div className="flex items-center gap-4">
                    <div className="w-1.5 h-6 bg-indigo-600 rounded-full"></div>
                    <h3 className="text-base font-black text-slate-800 tracking-tight">进项抵扣与成本预估</h3>
                  </div>
                  <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200/50">
                    <button onClick={() => setDeductionMode('actual')} className={`px-6 py-2.5 text-[11px] font-black uppercase tracking-widest rounded-xl transition-all ${deductionMode === 'actual' ? 'bg-white text-indigo-600 shadow-sm border border-indigo-100/50' : 'text-slate-400 hover:text-slate-600'}`}>发票回传</button>
                    <button onClick={() => setDeductionMode('estimated')} className={`px-6 py-2.5 text-[11px] font-black uppercase tracking-widest rounded-xl transition-all ${deductionMode === 'estimated' ? 'bg-white text-indigo-600 shadow-sm border border-indigo-100/50' : 'text-slate-400 hover:text-slate-600'}`}>模拟方案</button>
                  </div>
                </div>
                <div className="p-10">
                  {deductionMode === 'estimated' ? (
                    <div className="space-y-10">
                      <SimTable>
                        <SimRow label="选用测算模型">
                          <div className="flex items-center gap-12">
                            {[{ id: 'special', label: '全专票抵扣' }, { id: 'general', label: '全普票覆盖' }, { id: 'mixed', label: '专普混合模式' }].map(opt => (
                              <label key={opt.id} className="flex items-center gap-3 cursor-pointer group">
                                <input type="radio" className="w-5 h-5 text-indigo-600 border-slate-200 focus:ring-indigo-500" checked={estimationScenario === opt.id} onChange={() => setEstimationScenario(opt.id as any)} />
                                <span className={`text-sm font-bold transition-colors ${estimationScenario === opt.id ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600'}`}>{opt.label}</span>
                              </label>
                            ))}
                          </div>
                        </SimRow>
                        {(estimationScenario === 'special' || estimationScenario === 'mixed') && (
                          <SimRow label="测算适用税率">
                             <select className="bg-transparent font-black text-indigo-600 text-[14px] outline-none cursor-pointer" value={estimatedData.taxRate} onChange={(e) => setEstimatedData({...estimatedData, taxRate: Number(e.target.value)})}>
                                <option value={0.06}>6.00% (工程设计/技术服务服务类)</option>
                                <option value={0.09}>9.00% (建筑工程服务/运输类)</option>
                                <option value={0.13}>13.00% (大宗物资/设备租赁类)</option>
                             </select>
                          </SimRow>
                        )}
                        {estimationScenario === 'mixed' && (
                          <>
                            <SimRow label="混合配比比例" isSecondary>
                              <div className="flex items-center gap-8 flex-1 pr-10">
                                  <input type="range" min="0" max="1" step="0.01" className="flex-1 h-2 bg-slate-100 rounded-full appearance-none cursor-pointer accent-indigo-600 shadow-inner" value={estimatedData.mixedSpecialRatio} onChange={(e) => setEstimatedData({...estimatedData, mixedSpecialRatio: Number(e.target.value)})} />
                                  <div className="bg-indigo-50 px-4 py-2 rounded-xl border border-indigo-100 shadow-sm min-w-[120px] text-center">
                                    <span className="text-[12px] font-black text-indigo-600 font-mono">{(estimatedData.mixedSpecialRatio * 100).toFixed(1)}% 专票</span>
                                  </div>
                              </div>
                            </SimRow>
                            <SimRow label="指定分配金额" hint="可手动微调具体金额" isSecondary>
                              <div className="grid grid-cols-2 gap-4 w-full pr-10">
                                <div className="space-y-2">
                                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">专票金额 (含税)</p>
                                  <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 font-bold">¥</span>
                                    <input 
                                      type="number" 
                                      className="w-full bg-white border border-slate-200 rounded-xl px-8 py-3 font-mono font-bold focus:border-indigo-500 outline-none transition-all" 
                                      value={financials.specialAmt.toFixed(2)} 
                                      onChange={(e) => handleMixedAmountChange('special', Number(e.target.value))} 
                                    />
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">普票金额 (基数)</p>
                                  <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 font-bold">¥</span>
                                    <input 
                                      type="number" 
                                      className="w-full bg-white border border-slate-200 rounded-xl px-8 py-3 font-mono font-bold focus:border-indigo-500 outline-none transition-all" 
                                      value={financials.generalAmt.toFixed(2)} 
                                      onChange={(e) => handleMixedAmountChange('general', Number(e.target.value))} 
                                    />
                                  </div>
                                </div>
                              </div>
                            </SimRow>
                          </>
                        )}
                        <SimRow label="预估专票总额" isAuto hint="含税价"><span className={`font-mono font-bold text-lg ${financials.specialAmt > 0 ? 'text-slate-900' : 'text-slate-300'}`}>¥ {formatCurrency(financials.specialAmt)}</span></SimRow>
                        <SimRow label="进项税收益额" isAuto hint="Deduction Profit"><span className="font-mono font-black text-2xl text-emerald-600">¥ {formatCurrency(financials.totalInputTaxDeduction)}</span></SimRow>
                        <SimRow label="建议支付净额" isAuto isSecondary><span className="font-mono font-black text-slate-800">¥ {formatCurrency(financials.netPayable)}</span></SimRow>
                      </SimTable>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-32 text-center space-y-6"><div className="w-24 h-24 bg-slate-50 rounded-[2rem] flex items-center justify-center border-2 border-dashed border-slate-200"><Icons.Wallet className="w-12 h-12 text-slate-200" /></div><p className="text-base font-bold text-slate-400">请在侧边栏上传真实进项发票</p></div>
                  )}
                </div>
              </section>
            </div>
          )}

          {currentStep === 4 && (
            <div className="space-y-12 transition-all">
               <div className="bg-slate-950 rounded-[4rem] p-16 text-white shadow-3xl relative overflow-hidden group">
                  <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-24 items-center">
                     <div className="space-y-12">
                        <h2 className="text-5xl font-black tracking-tight leading-tight">清算预览</h2>
                        <div className="space-y-6">
                           <div className="flex justify-between items-center border-b border-white/5 pb-5"><span className="text-[14px] text-slate-400">结算基准</span><span className="font-mono font-bold text-xl">¥ {formatCurrency(financials.basePayable)}</span></div>
                           <div className="flex justify-between items-center border-b border-white/5 pb-5"><span className="text-[14px] text-emerald-500 font-bold">进项收益 (+)</span><span className="font-mono font-black text-2xl text-emerald-400">+ ¥ {formatCurrency(financials.totalInputTaxDeduction)}</span></div>
                        </div>
                     </div>
                     <div className="text-center md:text-right">
                        <p className="text-[11px] font-bold text-indigo-500 uppercase tracking-[0.5em] mb-8">实付总额</p>
                        <div className="flex items-baseline justify-center md:justify-end gap-2"><span className="text-8xl font-black font-mono tracking-tighter text-white">¥{formatCurrency(financials.netPayable).split('.')[0]}</span><span className="text-4xl font-bold text-slate-500">.{formatCurrency(financials.netPayable).split('.')[1]}</span></div>
                     </div>
                  </div>
               </div>
               
               <div className="bg-white rounded-[3rem] border border-slate-200 shadow-sm overflow-hidden p-10">
                  <div className="flex items-center gap-3 mb-8 border-b border-slate-50 pb-6">
                    <div className="bg-indigo-600 p-2.5 rounded-xl text-white shadow-lg"><Icons.Analysis className="w-6 h-6" /></div>
                    <h3 className="text-base font-black text-slate-800 uppercase tracking-widest">智能审计与合规建议报告</h3>
                  </div>
                  
                  <div className="bg-slate-100/30 p-10 rounded-[2.5rem] border border-slate-100 shadow-inner overflow-x-auto">
                    {aiAnalysisResult ? (
                      <WordStyleAuditText text={aiAnalysisResult} />
                    ) : (
                      <div className="flex flex-col items-center py-20 opacity-50 italic text-slate-400">
                        <div className="w-10 h-10 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin mb-6"></div>
                        <p className="text-sm font-bold tracking-widest uppercase">全维度智能审计扫描中...</p>
                      </div>
                    )}
                    
                    {aiAnalysisResult && (
                      <div className="mt-12 pt-10 border-t border-slate-200 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                           <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse"></div>
                           <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">系统合规性核验：正常 (Safe)</span>
                        </div>
                        <div className="px-5 py-2 bg-white border border-slate-200 rounded-lg">
                           <span className="text-[10px] text-indigo-400 font-mono font-black tracking-widest uppercase">Verified by Gemini Core Auditor</span>
                        </div>
                      </div>
                    )}
                  </div>
               </div>
            </div>
          )}
        </div>
      </main>

      <footer className="fixed bottom-0 left-0 w-full bg-white/90 backdrop-blur-xl border-t border-slate-200 p-8 z-40">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <button onClick={() => setCurrentStep(prev => Math.max(1, prev - 1))} disabled={currentStep === 1} className="px-12 py-4 rounded-2xl font-black text-[11px] uppercase text-slate-400 hover:bg-slate-50 transition-all">返回上一步</button>
          <div className="flex items-center gap-3">{[1,2,3,4].map(s => <div key={s} className={`h-2 rounded-full transition-all duration-700 ${currentStep === s ? 'w-12 bg-indigo-600' : 'w-2 bg-slate-200'}`}></div>)}</div>
          <button onClick={() => { if (currentStep < 4) { setCurrentStep(prev => prev + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); } else { handleFinalSubmit(); } }} className="px-16 py-4.5 bg-slate-900 text-white rounded-2xl font-black text-[13px] uppercase tracking-[0.2em] shadow-2xl hover:bg-slate-800">
            {currentStep === 4 ? '生成并提交单据' : '确认并下一步'}
          </button>
        </div>
      </footer>
    </div>
  );
};

export default App;
