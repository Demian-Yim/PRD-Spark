import { useState } from "react";
import { 
  Activity, 
  Download, 
  Search, 
  Trash2, 
  FileText, 
  Database, 
  Calendar, 
  User as UserIcon, 
  TrendingUp, 
  CheckCircle2, 
  Grid, 
  Award,
  BookOpen,
  Layers,
  Sparkles,
  ArrowRight
} from "lucide-react";

// PRD Document Interface Shared
interface PRDData {
  id: string;
  company: string;
  jobTitle: string;
  jobLevel: string;
  issue: string;
  title: string;
  markdown: string;
  createdBy: string | null;
  createdAt: string; // ISO String
  isPublic: boolean;
}

interface DashboardViewProps {
  prdHistory: PRDData[];
  currentUser: any;
  onSelectPRD: (prd: PRDData) => void;
  onDeletePRD: (prdId: string, event: any) => void;
  onDownloadHTML: (prd: PRDData) => void;
  calculatePRDMetrics: (prd: PRDData) => any;
  onNavigateToBuilder: () => void;
}

export default function DashboardView({
  prdHistory,
  currentUser,
  onSelectPRD,
  onDeletePRD,
  onDownloadHTML,
  calculatePRDMetrics,
  onNavigateToBuilder
}: DashboardViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortType, setSortType] = useState<"newest" | "title" | "company">("newest");

  // Filter and Sort Lists
  const filteredPrds = prdHistory.filter(prd => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      prd.title.toLowerCase().includes(q) ||
      prd.company.toLowerCase().includes(q) ||
      prd.jobTitle.toLowerCase().includes(q) ||
      prd.issue.toLowerCase().includes(q)
    );
  }).sort((a, b) => {
    if (sortType === "title") {
      return a.title.localeCompare(b.title);
    } else if (sortType === "company") {
      return a.company.localeCompare(b.company);
    } else {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
  });

  // Calculate Aggregated Analytical Stats
  const totalCount = prdHistory.length;
  
  const stats = prdHistory.map(prd => ({
    prd,
    metrics: calculatePRDMetrics(prd)
  }));

  const avgBusiness = totalCount > 0 
    ? Math.round(stats.reduce((sum, s) => sum + s.metrics.business, 0) / totalCount) 
    : 0;
  const avgTechnical = totalCount > 0 
    ? Math.round(stats.reduce((sum, s) => sum + s.metrics.technical, 0) / totalCount) 
    : 0;
  const avgEdgeCase = totalCount > 0 
    ? Math.round(stats.reduce((sum, s) => sum + s.metrics.edgeCase, 0) / totalCount) 
    : 0;
  const avgTotal = totalCount > 0 
    ? Math.round((avgBusiness + avgTechnical + avgEdgeCase) / 3) 
    : 0;

  // Single Markdown Document Direct Exporter
  const handleDownloadMarkdown = (prd: PRDData) => {
    const blob = new Blob([prd.markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${prd.title.replace(/\s+/g, "_")}_raw_spec.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Mass Bulk JSON Exporter for Team Backup and audits
  const handleExportAllJSON = () => {
    if (prdHistory.length === 0) return;
    const jsonStr = JSON.stringify(prdHistory, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `PRD_Spark_Bulk_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Industry classification count
  const foodtechCount = prdHistory.filter(p => p.company.includes("배달") || p.company.includes("푸드") || p.company.includes("배민")).length;
  const healthCount = prdHistory.filter(p => p.company.includes("헬스") || p.company.includes("의료") || p.company.includes("노인") || p.company.includes("약")).length;
  const startupCount = prdHistory.filter(p => p.company.includes("사내") || p.company.includes("스타트업") || p.company.includes("인사") || p.company.includes("온보딩")).length;
  const localCountService = prdHistory.filter(p => p.company.includes("소상공인") || p.company.includes("동네") || p.company.includes("카페") || p.company.includes("커피") || p.company.includes("가게")).length;
  const genericCount = totalCount - (foodtechCount + healthCount + startupCount + localCountService);

  return (
    <div className="space-y-8 animate-fade-in text-left">
      
      {/* 3. 클라우드 연동 정보 배너 카드 & 일괄 다운로드 */}
      <div className="bg-gradient-to-r from-sky-450/10 via-purple-450/10 to-pink-450/10 p-6 rounded-3xl border border-slate-200/50 dark:border-slate-800/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping" />
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5 font-sans">
              <Database className="w-4 h-4 text-emerald-505" />
              Google Cloud Firestore Live Sync Active
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium max-w-2xl leading-relaxed">
            {currentUser ? (
              <>데미안 PM님의 구글 계정 <strong>{currentUser.email}</strong>에 생성된 모든 기획서들이 클라우드 상에 밀착 동기화되어 실시간 영속 보호되고 있습니다.</>
            ) : (
              <>현재 게스트 상태로 브라우저 로컬 저장소를 연동 중입니다. 계정 분실 위험을 완벽히 없애려면 <strong>우측 상단의 구글 로그인</strong>을 가동해 주세요.</>
            )}
          </p>
        </div>

        {totalCount > 0 && (
          <button
            onClick={handleExportAllJSON}
            className="px-4 py-2 text-xs font-black bg-slate-900 hover:bg-slate-800 active:scale-[0.98] text-white dark:bg-white dark:hover:bg-slate-50 dark:text-slate-950 rounded-xl transition-all cursor-pointer shadow-sm flex items-center gap-1.5 shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>기획서 전사 JSON 백업</span>
          </button>
        )}
      </div>

      {/* 5. UX 심리학: 기획서가 존재하지 않을 때 Empty State */}
      {totalCount === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-16 text-center border border-slate-200/50 dark:border-slate-850 shadow-sm flex flex-col items-center justify-center max-w-2xl mx-auto space-y-5">
          <div className="w-16 h-16 rounded-full bg-blue-50 dark:bg-slate-800 flex items-center justify-center">
            <Layers className="w-8 h-8 text-blue-500" />
          </div>
          <div className="space-y-1.5">
            <h3 className="font-extrabold text-lg text-slate-850 dark:text-slate-100">통합 분석 관리 보드가 비어 있습니다</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
              아직 클라우드에 적재된 기획 양식이 없습니다. 첫 기획 문서 초안을 마크업 생성하시면 자동으로 실시간 정밀 평정 지표(비즈니스, 엔지니어링, 에지케이스)가 형성되어 이 대시보드가 가동됩니다.
            </p>
          </div>
          <button
            onClick={onNavigateToBuilder}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition-all active:scale-[0.98] flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <span>기 기획서 생성하러 가기</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <>
          {/* 4. UI 컬러 파스텔 톤 4도 매칭 종합 분석 대시보드 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            
            {/* 카드 1: 총 기획 분량 */}
            <div className="bg-gradient-to-br from-sky-100/40 via-sky-50/10 to-white dark:from-sky-950/20 dark:to-slate-900 rounded-2xl p-5 border border-slate-200/50 dark:border-slate-800/80 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-sky-100 dark:bg-sky-950 flex items-center justify-center shrink-0">
                <FileText className="w-6 h-6 text-sky-600 dark:text-sky-400" />
              </div>
              <div className="text-left">
                <span className="text-[10px] text-slate-400 font-bold block">클라우드 총 기획서</span>
                <span className="text-2xl font-black text-slate-800 dark:text-white font-sans">{totalCount}개</span>
              </div>
            </div>

            {/* 카드 2: 평균 비즈니스 점수 (파스텔 톤 가온) */}
            <div className="bg-gradient-to-br from-emerald-100/40 via-emerald-50/10 to-white dark:from-emerald-950/20 dark:to-slate-900 rounded-2xl p-5 border border-slate-200/50 dark:border-slate-800/80 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center shrink-0">
                <Award className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="text-left">
                <span className="text-[10px] text-slate-400 font-bold block">비즈니스 평균 가식</span>
                <span className="text-2xl font-black text-slate-850 dark:text-white font-mono">{avgBusiness}%</span>
              </div>
            </div>

            {/* 카드 3: 개발 실무성 */}
            <div className="bg-gradient-to-br from-blue-100/40 via-blue-50/10 to-white dark:from-blue-950/20 dark:to-slate-900 rounded-2xl p-5 border border-slate-200/50 dark:border-slate-800/80 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-950 flex items-center justify-center shrink-0">
                <Activity className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="text-left">
                <span className="text-[10px] text-slate-400 font-bold block">개발 구현 실무 평균</span>
                <span className="text-2xl font-black text-slate-850 dark:text-white font-mono">{avgTechnical}%</span>
              </div>
            </div>

            {/* 카드 4: 종합 성합도 평점 (파스텔 바이올렛) */}
            <div className="bg-gradient-to-br from-purple-100/40 via-purple-50/10 to-white dark:from-purple-950/20 dark:to-slate-900 rounded-2xl p-5 border border-slate-200/50 dark:border-slate-800/80 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-950 flex items-center justify-center shrink-0">
                <TrendingUp className="w-6 h-6 text-purple-600 dark:text-purple-400 animate-pulse" />
              </div>
              <div className="text-left">
                <span className="text-[10px] text-slate-400 font-bold block">기획서 종합 성공도</span>
                <span className="text-2xl font-black text-slate-850 dark:text-white font-mono">{avgTotal}%</span>
              </div>
            </div>

          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* 시각 도넛 차트 및 산업 분포 요약 */}
            <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-250/50 dark:border-slate-850 shadow-sm space-y-5 flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-1.5 font-sans">
                  <span className="w-1.5 h-3.5 bg-blue-600 rounded-full" />
                  기획 도메인 산업군 스펙트럼 비중 📊
                </h3>
                <p className="text-[11px] text-slate-400 leading-normal mb-3">
                  데미안 PM님께서 현재까지 다루어 오신 회사 및 도메인 성격의 자동 산출 비중입니다.
                </p>
              </div>

              {/* Custom SVG Bar Chart (완벽 사양 시각 가동) */}
              <div className="space-y-3 px-1 py-2">
                
                {/* 푸드테크 배달 */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] font-bold">
                    <span className="text-slate-600 dark:text-slate-350">🛵 푸드테크 및 배달 고도화</span>
                    <span className="text-slate-400 font-mono">{foodtechCount}개 ({totalCount > 0 ? Math.round((foodtechCount/totalCount)*100) : 0}%)</span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-sky-400 rounded-full" style={{ width: `${totalCount > 0 ? (foodtechCount/totalCount)*100 : 0}%` }} />
                  </div>
                </div>

                {/* IoT 헬스 */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] font-bold">
                    <span className="text-slate-600 dark:text-slate-350">👵 실버 IoT 및 헬스헬스</span>
                    <span className="text-slate-400 font-mono">{healthCount}개 ({totalCount > 0 ? Math.round((healthCount/totalCount)*100) : 0}%)</span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${totalCount > 0 ? (healthCount/totalCount)*100 : 0}%` }} />
                  </div>
                </div>

                {/* 온보딩 게임 */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] font-bold">
                    <span className="text-slate-600 dark:text-slate-350">🎮 사내 온보딩 및 스타트업 인사</span>
                    <span className="text-slate-400 font-mono">{startupCount}개 ({totalCount > 0 ? Math.round((startupCount/totalCount)*100) : 0}%)</span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-400 rounded-full" style={{ width: `${totalCount > 0 ? (startupCount/totalCount)*100 : 0}%` }} />
                  </div>
                </div>

                {/* 소상공인 마케팅 */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] font-bold">
                    <span className="text-slate-600 dark:text-slate-350">📈 골목 마케팅 및 오프라인 매핑</span>
                    <span className="text-slate-400 font-mono">{localCountService}개 ({totalCount > 0 ? Math.round((localCountService/totalCount)*100) : 0}%)</span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-pink-400 rounded-full" style={{ width: `${totalCount > 0 ? (localCountService/totalCount)*100 : 0}%` }} />
                  </div>
                </div>

                {/* 기타 영역 */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] font-bold">
                    <span className="text-slate-600 dark:text-slate-350">🛡️ 기타 일반 기업 기획</span>
                    <span className="text-slate-400 font-mono">{genericCount}개 ({totalCount > 0 ? Math.round((genericCount/totalCount)*100) : 0}%)</span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-purple-400 rounded-full" style={{ width: `${totalCount > 0 ? (genericCount/totalCount)*100 : 0}%` }} />
                  </div>
                </div>

              </div>

              {/* AI 에바의 밀착 조언 정성 피드백 리포트 */}
              <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl leading-relaxed">
                <span className="text-[10px] font-black tracking-wider text-blue-600 dark:text-blue-400 block mb-1">💡 에바(Eva)의 분석 조언 가이드</span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  데미안 님, 현재 기획서들의 <strong>종합 평정지수 평균값은 {avgTotal}%</strong>로 상위 5% 실무 전문급에 달해 있습니다. 
                  해당 문서들을 HTML로 실무자 단체 배포하거나 단축 동료공유 링크를 카카오톡/슬랙에 복사하여 전파해 보세요!
                </p>
              </div>

            </div>

            {/* 통합 기획서 필터 검색 및 관리용 목록 드래프트 */}
            <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200/50 dark:border-slate-850 shadow-sm space-y-4">
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2 font-sans">
                  <span className="w-1.5 h-3.5 bg-indigo-600 rounded-full" />
                  기획서 통합 관리 및 즉각 소장 리스트 ({filteredPrds.length})
                </h3>

                {/* Sort selector */}
                <div className="flex items-center gap-1.5 self-start sm:self-center">
                  <span className="text-[11px] text-slate-400 font-bold">정렬:</span>
                  <select
                    value={sortType}
                    onChange={(e) => setSortType(e.target.value as any)}
                    className="p-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-[10px] outline-none font-bold text-slate-600 dark:text-slate-300 transition-all"
                  >
                    <option value="newest">최신 순서</option>
                    <option value="title">기획목 명</option>
                    <option value="company">회사이름 순</option>
                  </select>
                </div>
              </div>

              {/* Search box overlay */}
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-slate-400">
                  <Search className="w-3.5 h-3.5" />
                </span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="보관함 내 회사명, 직무명, 기획서 타이틀 검색..."
                  className="w-full pl-9 pr-4 py-2 bg-slate-50/50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs rounded-lg transition-all outline-none text-slate-700 dark:text-slate-300 focus:border-indigo-500"
                />
              </div>

              {/* Grid content */}
              <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                {filteredPrds.length === 0 ? (
                  <div className="py-20 text-center text-slate-400 text-xs font-medium">
                    &ldquo;{searchQuery}&rdquo; 검색 조건과 일치하는 기획서가 존재하지 않습니다.
                  </div>
                ) : (
                  filteredPrds.map((item) => {
                    const metr = calculatePRDMetrics(item);
                    return (
                      <div 
                        key={item.id}
                        className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-850 bg-slate-50/50 dark:bg-slate-950/20 hover:border-slate-200 hover:bg-white dark:hover:bg-slate-900/60 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] bg-slate-200/50 dark:bg-slate-800 font-bold px-2 py-0.5 rounded text-slate-500 dark:text-slate-400">
                              {item.company}
                            </span>
                            <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                              <Calendar className="w-3 h-3" />
                              {new Date(item.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          
                          <h4 className="font-bold text-xs md:text-sm text-slate-800 dark:text-slate-100 leading-snug">
                            {item.title}
                          </h4>

                          <p className="text-[10px] text-slate-400">
                            기획 상세: {item.jobTitle} ({item.jobLevel}) &bull; 단어밀도 {metr.wordDensity}% ({metr.wordCount}자)
                          </p>
                        </div>

                        {/* Actions hub (직소 다운로드 및 관리) */}
                        <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                          
                          {/* Load button */}
                          <button
                            onClick={() => onSelectPRD(item)}
                            className="px-2.5 py-1.5 rounded-lg text-[10px] font-black bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200/55 dark:border-blue-900/40 transition-all cursor-pointer"
                            title="이 기획서를 메인 화면 뷰어 및 에디터로 노출 복원합니다"
                          >
                            상세 읽기/수정
                          </button>

                          {/* Markdown file download */}
                          <button
                            onClick={() => handleDownloadMarkdown(item)}
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-705 dark:text-slate-400 dark:hover:text-slate-200 transition-all cursor-pointer"
                            title="단일 .md 마크다운 사양서 소장 다운로드"
                          >
                            <span className="text-[10px] font-black font-mono">MD</span>
                          </button>

                          {/* HTML download */}
                          <button
                            onClick={() => onDownloadHTML(item)}
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-705 dark:text-slate-400 dark:hover:text-slate-200 transition-all cursor-pointer"
                            title="단일 미려한 완성 HTML 내보내기 다운로드"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>

                          {/* Trash delete */}
                          <button
                            onClick={(ev) => onDeletePRD(item.id, ev)}
                            className="p-1.5 rounded-lg border border-rose-100 dark:border-rose-950 text-rose-300 hover:text-rose-500 transition-all cursor-pointer"
                            title="클라우드 완전 삭제"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>

                        </div>
                      </div>
                    );
                  })
                )}
              </div>

            </div>

          </div>
        </>
      )}

    </div>
  );
}
