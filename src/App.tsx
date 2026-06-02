import { useState, useEffect, useRef } from "react";
import { 
  Sparkles, 
  Trash2, 
  Copy, 
  Download, 
  Share2, 
  Lightbulb, 
  Moon, 
  Sun, 
  ArrowRight, 
  Clock, 
  User as UserIcon, 
  LogOut, 
  Save, 
  Check, 
  BookOpen, 
  HelpCircle, 
  ChevronRight, 
  X, 
  Layers, 
  Briefcase, 
  Activity, 
  Heart,
  Edit2,
  FileText,
  AlertTriangle
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  Timestamp 
} from "firebase/firestore";
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged, 
  User 
} from "firebase/auth";
import { db, auth } from "./firebase";
import DashboardView from "./components/DashboardView";

// PRD Document Interface
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

// Industry Samples for Instant Binding (PM을 위한 세심한 가이드라인)
const SAMPLES = [
  {
    company: "배민클론 푸드테크(주)",
    jobTitle: "모바일 고도화 PM",
    jobLevel: "과장 (7년차)",
    issue: "배달 라이더 배정 알고리즘 매칭 도중 피크시간대 지연이 가중되어 실시간 고객 이탈율이 15% 상승함. 타겟 도착 예정 시간의 정확도를 높이고 가상의 라이더 서포트 알림 허브 앱을 신설하고 싶음."
  },
  {
    company: "네오헬스 케어테크",
    jobTitle: "시니어 헬스케어 기획자",
    jobLevel: "차장 (12년차)",
    issue: "독거노인을 위한 온/오프라인 맞춤 약복용 IoT 알림 연동 플랫폼 기획. 고령 사용자들이 앱 글자 크기가 작아 보지 못하고 수면 중 사운드를 놓치는 경우가 잦음. 보호자 연동 및 대형 시각 알람, 에지 비상벨 기능 구현 필요."
  },
  {
    company: "스타트업 인큐베이터",
    jobTitle: "인사 기획/운영자",
    jobLevel: "사원 (2년차)",
    issue: "사내 신규 입사자의 온보딩 과정을 디지털 게임화하고 미션 수행 시 리워드를 지급하는 웹 서비스. 오프라인 교육 매칭, 각 부서별 미션 연동 및 수습 기간 3개월 달성도를 대시보드로 시각화해 피드백하는 도출 기획."
  },
  {
    company: "동네가게 소상공인 마케팅",
    jobTitle: "플랫폼 기획 PM",
    jobLevel: "대리 (4년차)",
    issue: "골목길 카페 및 음식점 사장님이 한 개의 광고 템플릿만 입력하면 지역 기반 당근마켓/인스타그램 숏폼 광고를 자동 생성하고 집행 효과를 소액(1만 원 단위)으로 모니터링할 수 있는 초간편 통합 광고 중개 대시보드."
  }
];

// 기획서(PRD) 평가 일관성 및 정밀 분석을 위한 지표 난수 해시 발생기 (안정적 보존 데이터화)
export const calculatePRDMetrics = (prd: PRDData) => {
  let hash = 0;
  const str = prd.id || "test";
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const business = 84 + (Math.abs(hash) % 14); // 84% ~ 97%
  const technical = 80 + (Math.abs(hash >> 2) % 16); // 80% ~ 95%
  const edgeCase = 82 + (Math.abs(hash >> 4) % 16); // 82% ~ 97%
  const wordCount = prd.markdown ? prd.markdown.length : 0;
  const wordDensity = Math.min(100, Math.round(wordCount / 15)); // 0~100 Density level
  const sentencesCount = prd.markdown ? prd.markdown.split("\n").filter(l => l.trim().length > 0).length : 0;

  return {
    business,
    technical,
    edgeCase,
    average: Math.round((business + technical + edgeCase) / 3),
    wordCount,
    wordDensity,
    sentencesCount
  };
};

export default function App() {
  // Theme State
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    return localStorage.getItem("prd_spark_theme") === "dark";
  });

  // User Authentication State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const isAdmin = currentUser?.email === "rescuemyself@gmail.com";

  // Google Drive Integration States
  const [driveAccessToken, setDriveAccessToken] = useState<string | null>(null);
  const [driveSyncStatus, setDriveSyncStatus] = useState<"idle" | "syncing" | "success" | "error">("idle");
  
  // App Navigation & Admin Analytics States
  const [activeTab, setActiveTab] = useState<"builder" | "dashboard">("builder");
  const [dashSearchQuery, setDashSearchQuery] = useState("");
  const [dashSortType, setDashSortType] = useState<"newest" | "title" | "company">("newest");
  
  // App States
  const [company, setCompany] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [jobLevel, setJobLevel] = useState("");
  const [issue, setIssue] = useState("");
  
  // AI Generation States
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamedText, setStreamedText] = useState("");
  const [generatedTitle, setGeneratedTitle] = useState("");
  
  // Current Selected PRD Doc
  const [selectedPRD, setSelectedPRD] = useState<PRDData | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedMarkdown, setEditedMarkdown] = useState("");

  // History & Storage States
  const [prdHistory, setPrdHistory] = useState<PRDData[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Tutorial / Dialog States
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [showDriveErrorModal, setShowDriveErrorModal] = useState(false);
  const [oauthErrorMessage, setOauthErrorMessage] = useState("");

  // Clipboard & Copied Feedback State
  const [showCopiedAlert, setShowCopiedAlert] = useState(false);

  // Shared Link Only Mode (공유 ID로 직접 열어보는 상태)
  const [isSharedViewOnly, setIsSharedViewOnly] = useState(false);

  // Synchronize Theme Variable
  useEffect(() => {
    if (darkMode) {
      document.body.classList.add("dark");
      localStorage.setItem("prd_spark_theme", "dark");
    } else {
      document.body.classList.remove("dark");
      localStorage.setItem("prd_spark_theme", "light");
    }
  }, [darkMode]);

  // Auth Observer
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return unsubscribe;
  }, []);

  // Redirect non-admins trying to access admin-only dashboard tab
  useEffect(() => {
    if (activeTab === "dashboard" && !isAdmin) {
      setActiveTab("builder");
    }
  }, [activeTab, currentUser, isAdmin]);

  // Check Local Storage and URL for Share Mode or History on Start
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const prdIdParam = params.get("id");

    if (prdIdParam) {
      loadSpecificPRD(prdIdParam);
    } else {
      // Check first-time visit tutorial
      const visited = localStorage.getItem("prd_spark_visited");
      if (!visited) {
        setShowTutorial(true);
      }
      loadPRDHistory();
    }
  }, [currentUser]);

  // Load a Specific Shared PRD directly from Firestore or Local Cache
  const loadSpecificPRD = async (prdId: string) => {
    setIsGenerating(true);
    try {
      const docRef = doc(db, "prds", prdId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        const prdItem: PRDData = {
          id: docSnap.id,
          company: data.company,
          jobTitle: data.jobTitle,
          jobLevel: data.jobLevel,
          issue: data.issue,
          title: data.title,
          markdown: data.markdown,
          createdBy: data.createdBy,
          createdAt: data.createdAt,
          isPublic: data.isPublic
        };
        setSelectedPRD(prdItem);
        setEditedMarkdown(prdItem.markdown);
        setIsSharedViewOnly(true);
      } else {
        // Fallback or Alert
        alert("요청하신 공유 기획서를 클라우드에서 찾을 수 없습니다.");
      }
    } catch (err) {
      console.error("공유 문서 조회 오류:", err);
    } finally {
      setIsGenerating(false);
    }
  };

  // Load History Lists (Combine LocalStorage and User Account Cloud Documents)
  const loadPRDHistory = async () => {
    setIsLoadingHistory(true);
    let localHistory: PRDData[] = [];
    try {
      const cached = localStorage.getItem("prd_spark_local_history");
      if (cached) {
        localHistory = JSON.parse(cached);
      }
    } catch (e) {
      console.error(e);
    }

    if (currentUser && currentUser.email) {
      try {
        const q = query(
          collection(db, "prds"),
          where("createdBy", "==", currentUser.email),
          orderBy("createdAt", "desc")
        );
        const querySnapshot = await getDocs(q);
        const cloudHistory: PRDData[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          cloudHistory.push({
            id: doc.id,
            company: data.company,
            jobTitle: data.jobTitle,
            jobLevel: data.jobLevel,
            issue: data.issue,
            title: data.title,
            markdown: data.markdown,
            createdBy: data.createdBy,
            createdAt: data.createdAt,
            isPublic: data.isPublic
          });
        });

        // Merge and remove duplicates by id, cloud takes priority
        const mergedMap = new Map<string, PRDData>();
        localHistory.forEach(item => mergedMap.set(item.id, item));
        cloudHistory.forEach(item => mergedMap.set(item.id, item));
        
        const sortedMerged = Array.from(mergedMap.values()).sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        setPrdHistory(sortedMerged);
        localStorage.setItem("prd_spark_local_history", JSON.stringify(sortedMerged));
      } catch (err) {
        console.error("Firestore 이력 조회 에러:", err);
        setPrdHistory(localHistory);
      }
    } else {
      setPrdHistory(localHistory);
    }
    setIsLoadingHistory(false);
  };

  // Google Provider Authentication Login (일반 로그인: Firestore DB 저장 및 조회 전용)
  // 이 로그인에서는 대드라이브(drive.file) 같은 민감한 스코프를 요청하지 않으므로, 
  // OAuth Consent Screen이 'Testing' 상태여도 사용자가 일반 Google SSO(식별용 프로필/이메일 정보)로 완전히 에러 없이 안전하게 로그인할 수 있습니다.
  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      setDriveSyncStatus("idle");
      await signInWithPopup(auth, provider);
      alert("구글 로그인이 완료되었습니다! 기획서 이력이 실시간 안전하게 전용 클라우드 DB(Firestore)에 동기화 및 보관됩니다.");
    } catch (error: any) {
      console.error("일반 Google 로그인 연동 오류:", error);
      alert(`구글 로그인 실패: ${error?.message || "다시 시도해 주세요."}`);
    }
  };

  // 구글 드라이브(Drive) 전용 연동 권한 추가 승인 (이 부분은 민감 스코프로 인해 구글 인증 과정 중 403 에러가 발생할 수 있습니다.)
  const handleGoogleDriveAuth = async () => {
    const provider = new GoogleAuthProvider();
    provider.addScope('https://www.googleapis.com/auth/drive.file');
    try {
      setDriveSyncStatus("syncing");
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        setDriveAccessToken(credential.accessToken);
        setDriveSyncStatus("success");
        alert("구글 드라이브(Drive) 기획서 동기화 권한 승인 및 로그인이 완료되었습니다!");
      } else {
        throw new Error("AccessToken을 획득할 수 없습니다.");
      }
    } catch (error: any) {
      console.error("구글 드라이브 동기화 승인 중 에러:", error);
      setDriveSyncStatus("error");
      
      // 403 access_denied 등 구글 OAuth 테스팅 앱 차단 오류 처리
      setOauthErrorMessage(error?.message || "Google OAuth API 권한 승인이 거부되었습니다.");
      setShowDriveErrorModal(true);
    }
  };

  // Logout from App
  const handleLogout = async () => {
    try {
      await signOut(auth);
      setSelectedPRD(null);
      setPrdHistory([]);
      setDriveAccessToken(null);
      setDriveSyncStatus("idle");
      localStorage.removeItem("prd_spark_local_history");
      alert("로그아웃 되었습니다. 게스트 상태로 전환합니다.");
    } catch (error) {
      console.error("로그아웃 오류:", error);
    }
  };

  // Google Drive 파일 저장 백업 기능 (1FsAmHDYUvGBEABkJjCjb443rpgL2aAXh 폴더 전용)
  const uploadToGoogleDrive = async (prd: PRDData, accessToken: string) => {
    try {
      setDriveSyncStatus("syncing");
      const folderId = "1FsAmHDYUvGBEABkJjCjb443rpgL2aAXh";
      const filename = `${prd.company || "Company"}_${prd.title.replace(/\s+/g, "_") || "PRD"}.md`;
      
      const metadata = {
        name: filename,
        mimeType: "text/markdown",
        parents: [folderId]
      };
      
      const boundary = "314159265358979323846";
      const delimiter = `\r\n--${boundary}\r\n`;
      const closeDelimiter = `\r\n--${boundary}--`;

      // 사용자가 등록한 4대 정보(회사명, 직무, 직급, 핵심 이슈)와 동기화 메타데이터를 마크다운 상단에 수려한 테이블로 주입
      const formattedMetadataHeader = `# 🚀 PRD Spark - 핵심 기획 원천 조건 및 정보

> **본 문서는 Demian 임정훈 기획 혁신 파트너십을 통해 생성되어 구글 드라이브에 안전하게 동기화 보관된 실무 산출물입니다.**

| 분류 항목 | 작성 및 등록 사항 |
| :--- | :--- |
| **🏢 기업/회사명** | ${prd.company || "미지정"} |
| **💼 담당 직무** | ${prd.jobTitle || "미지정"} |
| **🎖️ 현재 직급** | ${prd.jobLevel || "미지정"} |
| **💡 당면 핵심 이슈** | ${prd.issue || "미지정"} |
| **✍️ 기획 작성자** | ${prd.createdBy || "Guest (게스트)"} |
| **📅 동기화 일시** | ${new Date(prd.createdAt).toLocaleString("ko-KR")} |

---

# 📝 실무 기획 완성본 (PRD Output)

`;

      const fullMarkdownWithMeta = formattedMetadataHeader + prd.markdown;
      
      const body = 
        delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        'Content-Type: text/markdown; charset=UTF-8\r\n\r\n' +
        fullMarkdownWithMeta +
        closeDelimiter;

      const response = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": `multipart/related; boundary=${boundary}`
        },
        body: body
      });

      if (!response.ok) {
        if (response.status === 401) {
          setDriveAccessToken(null);
          setDriveSyncStatus("error");
          throw new Error("token_expired");
        }
        const errText = await response.text();
        throw new Error(errText || "Google Drive Sync-up Failed");
      }

      await response.json();
      setDriveSyncStatus("success");
      console.log("Drive auto backup success.");
    } catch (err: any) {
      setDriveSyncStatus("error");
      console.error("Failed to sync with Google Drive:", err);
      if (err.message === "token_expired") {
        alert("구글 드라이브(Drive) 보안 인증이 만료되었습니다. 로그인을 다시 실행하시면 구글 공식 드라이브 폴더에 백업이 즉시 재가동됩니다.");
      }
    }
  };

  // Auto Bind the Pre-defined Samples
  const bindSample = (idx: number) => {
    const sample = SAMPLES[idx];
    setCompany(sample.company);
    setJobTitle(sample.jobTitle);
    setJobLevel(sample.jobLevel);
    setIssue(sample.issue);
  };

  // Reset Input Forms
  const handleResetInputs = () => {
    setCompany("");
    setJobTitle("");
    setJobLevel("");
    setIssue("");
  };

  // PRD Real-time Stream Generator (SSE Client calling server.ts proxy)
  const handleGeneratePRD = async () => {
    if (!company.trim() || !jobTitle.trim() || !jobLevel.trim() || !issue.trim()) {
      alert("모든 4대 정보(회사명, 직무, 직급, 핵심 이슈)를 성실히 채워주세요!");
      return;
    }

    setIsGenerating(true);
    setSelectedPRD(null);
    setStreamedText("");
    setIsEditMode(false);

    // Create Temporary Dynamic Title
    const tempTitle = `[PRD] ${company} - ${jobTitle}의 혁신 솔루션`;
    setGeneratedTitle(tempTitle);

    try {
      const response = await fetch("/api/generate-prd", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          company,
          jobTitle,
          jobLevel,
          issue
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || "PRD 생성 요청 중 에러가 발생했습니다.");
      }

      // Read SSE stream
      const reader = response.body?.getReader();
      const decoder = new TextDecoder("utf-8");
      let fullText = "";

      if (reader) {
        let isDone = false;
        while (!isDone) {
          const { value, done } = await reader.read();
          if (done) {
            isDone = true;
            break;
          }

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");
          
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const cleaned = line.replace("data: ", "").trim();
              if (cleaned === "[DONE]") {
                isDone = true;
                break;
              }
              try {
                const parsed = JSON.parse(cleaned);
                if (parsed.text) {
                  fullText += parsed.text;
                  setStreamedText(fullText);
                }
              } catch (e) {
                // Ignore parse errors from fragmentary lines
              }
            }
          }
        }
      }

      // Extraction of actual title from generated text
      let finalTitle = tempTitle;
      const titleMatch = fullText.match(/### \[0\] 개요 및 제품 비젼[\s\S]*?- \*\*제안 프로젝트 명\*\*: ([^\n]+)/);
      if (titleMatch && titleMatch[1]) {
        finalTitle = titleMatch[1].replace(/[*`_]/g, "").trim();
      }

      // Construct final PRD Item
      const prdId = "prd_" + Math.random().toString(36).substr(2, 9) + "_" + Date.now();
      const finalPRD: PRDData = {
        id: prdId,
        company,
        jobTitle,
        jobLevel,
        issue,
        title: finalTitle.substring(0, 100),
        markdown: fullText,
        createdBy: currentUser ? currentUser.email : "guest",
        createdAt: new Date().toISOString(),
        isPublic: true
      };

      setSelectedPRD(finalPRD);
      setEditedMarkdown(fullText);

      // Save to History (LocalStorage / Firestore Cloud Saving)
      await savePRDtoStore(finalPRD);

    } catch (err: any) {
      console.error(err);
      alert(err.message || "서버와 연결할 수 없거나 API 호출 제한에 도달했습니다. 잠시 후 감사하겠습니다.");
    } finally {
      setIsGenerating(false);
    }
  };

  // Save PRD securely to LocalStorage & Firestore
  const savePRDtoStore = async (prd: PRDData) => {
    // 1. Save to Local Cache anyway
    let currentHistoryList: PRDData[] = [];
    try {
      const cached = localStorage.getItem("prd_spark_local_history");
      if (cached) {
        currentHistoryList = JSON.parse(cached);
      }
    } catch(e) {}

    const updatedLocalStorageList = [prd, ...currentHistoryList.filter(item => item.id !== prd.id)];
    setPrdHistory(updatedLocalStorageList);
    localStorage.setItem("prd_spark_local_history", JSON.stringify(updatedLocalStorageList));

    // 2. Save to Firestore DB Persistent Storage if rules/DB configured
    try {
      await setDoc(doc(db, "prds", prd.id), prd);
      // Fresh refresh
      loadPRDHistory();
    } catch (fireErr) {
      console.warn("Firestore 저장 건너뜀 (로컬 데이터 보존 유지):", fireErr);
    }

    // 3. Save to Google Drive Parent Folder (1FsAmHDYUvGBEABkJjCjb443rpgL2aAXh) if Token exists
    if (driveAccessToken) {
      await uploadToGoogleDrive(prd, driveAccessToken);
    }
  };

  // Modify Saved PRD of current selected state
  const handleUpdatePRD = async () => {
    if (!selectedPRD) return;

    const updatedObject: PRDData = {
      ...selectedPRD,
      markdown: editedMarkdown,
      createdAt: new Date().toISOString() // update timestamp
    };

    setSelectedPRD(updatedObject);
    setIsEditMode(false);
    
    // Save to storage
    await savePRDtoStore(updatedObject);
    alert("편집한 기획서가 무사히 클라우드에 업데이트되었습니다.");
  };

  // Delete Specific PRD From List
  const handleDeletePRD = async (prdId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    if (!confirm("정말로 이 기획서를 비워내거나 삭제하시겠습니까? 복구할 수 없습니다.")) {
      return;
    }

    try {
      // Filter out local history
      const filtered = prdHistory.filter(item => item.id !== prdId);
      setPrdHistory(filtered);
      localStorage.setItem("prd_spark_local_history", JSON.stringify(filtered));

      // Remove from Firestore if online/user owns
      try {
        const { deleteDoc } = await import("firebase/firestore");
        await deleteDoc(doc(db, "prds", prdId));
      } catch (err) {}

      if (selectedPRD?.id === prdId) {
        setSelectedPRD(null);
      }
      alert("성공적으로 기획서가 삭제되었습니다.");
    } catch (error) {
      console.error("삭제 시도 에러:", error);
    }
  };

  // Copy Markdown text to clipboard
  const handleCopyToClipboard = () => {
    const text2Copy = selectedPRD ? selectedPRD.markdown : streamedText;
    if (!text2Copy) return;

    navigator.clipboard.writeText(text2Copy);
    setShowCopiedAlert(true);
    setTimeout(() => {
      setShowCopiedAlert(false);
    }, 2000);
  };

  // Download styled dynamic Single HTML file
  const handleDownloadHTML = (overridePRD?: PRDData) => {
    const activePRD = overridePRD || selectedPRD;
    if (!activePRD) return;

    const sanitizeHTMLContent = (md: string) => {
      // simple pseudo Markdown rendering converter for Static HTML file
      let html = md
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        // Headings
        .replace(/^### (.*$)/gim, '<h3 class="text-xl font-bold text-gray-800 mt-6 mb-3 border-b pb-1">$1</h3>')
        .replace(/^## (.*$)/gim, '<h2 class="text-2xl font-bold text-indigo-700 mt-8 mb-4 border-l-4 border-indigo-500 pl-3">$1</h2>')
        .replace(/^# (.*$)/gim, '<h1 class="text-3xl font-black text-indigo-900 mt-10 mb-6">$1</h1>')
        // Bold
        .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
        // Inline code / quote
        .replace(/`(.*?)`/gim, '<code class="bg-gray-100 text-pink-500 px-1.5 py-0.5 rounded text-sm font-mono">$1</code>')
        // List items
        .replace(/^\- (.*$)/gim, '<li class="ml-5 list-disc text-gray-600 my-1">$1</li>')
        // Tables
        .replace(/\| (.*?)$/gim, (match) => {
          const cells = match.split('|').map(c => c.trim()).filter(Boolean);
          if (cells.length === 0) return '';
          return '<tr class="border-b border-gray-100 hover:bg-gray-50">' + cells.map(cell => `<td class="px-3 py-2 text-sm text-gray-600 border">${cell}</td>`).join('') + '</tr>';
        });

      // Wrap list elements
      html = html.replace(/(<li.*<\/li>)/gim, '<ul class="my-3 font-sans">$1</ul>');
      return html;
    };

    const parsedHTMLMarkup = sanitizeHTMLContent(activePRD.markdown);

    const fullHTMLDocString = `
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${activePRD.title} - PRD 기획 보고서</title>
    <!-- Tailwind CSS for rich styled preview -->
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        body { font-family: 'Inter', sans-serif; }
        h1, h2, h3 { font-family: 'Space Grotesk', 'Inter', sans-serif; }
    </style>
</head>
<body class="bg-slate-50 text-slate-800 py-12 px-4 sm:px-6">
    <div class="max-w-4xl mx-auto bg-white shadow-xl border border-slate-100 rounded-3xl overflow-hidden">
        <!-- Pastel Accent Banner -->
        <div class="bg-gradient-to-r from-sky-100 via-purple-100 to-pink-100 p-8 sm:p-12 border-b border-slate-100">
            <div class="flex items-center gap-3 text-indigo-600 mb-4 font-semibold text-sm tracking-wide">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-sparkles"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275Z"/><path d="m5 3 1 2.5L8.5 6 6 7 5 9.5 4 7 1.5 6 4 5Z"/><path d="m19 17 1 2.5 2.5.5-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1Z"/></svg>
                PRD SPARK PLATFORM
            </div>
            <h1 class="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight leading-none mb-3">
                ${activePRD.title}
            </h1>
            <p class="text-slate-600 text-sm sm:text-base max-w-2xl font-medium">
                회사명: ${activePRD.company} | 기획 PM 정보: ${activePRD.jobTitle} (${activePRD.jobLevel})
            </p>
            <div class="mt-4 text-xs text-slate-400 font-mono">
                생성일시: ${new Date(activePRD.createdAt).toLocaleString()} | Developed by Demian 임정훈
            </div>
        </div>

        <!-- Issue Metadata Overview -->
        <div class="p-8 sm:p-12 bg-slate-50 border-b border-slate-100">
            <h4 class="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">당면한 오리지널 이슈 파악</h4>
            <blockquote class="border-l-4 border-sky-400 pl-4 py-1.5 italic text-slate-600 text-sm whitespace-pre-wrap font-medium">
                "${activePRD.issue}"
            </blockquote>
        </div>

        <!-- PRD Main Content Area -->
        <div class="p-8 sm:p-12 prose max-w-none">
            ${parsedHTMLMarkup}
        </div>

        <!-- Footer -->
        <div class="bg-slate-950 text-slate-500 py-6 px-8 text-center text-xs border-t font-mono">
            본 문서는 <span class="text-indigo-400 font-semibold">PRD Spark Engine</span>을 통해 자동 제작된 상용 기획 양식입니다. 
            <br/><span class="text-slate-200 font-bold">Developed by Demian 임정훈</span>
        </div>
    </div>
</body>
</html>
    `;

    // Create a Blob and Download
    const blob = new Blob([fullHTMLDocString], { type: "text/html;charset=utf-8" });
    const blobURL = URL.createObjectURL(blob);
    const downloadAnchor = document.createElement("a");
    downloadAnchor.href = blobURL;
    downloadAnchor.download = `${activePRD.title.replace(/\s+/g, "_")}_PRD.html`;
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    document.body.removeChild(downloadAnchor);
    URL.revokeObjectURL(blobURL);
  };

  // Set state for tutorial close and store visit history
  const closeTutorial = () => {
    setShowTutorial(false);
    localStorage.setItem("prd_spark_visited", "true");
  };

  // Custom Markdown Highlighter and Structure Parser for client view
  const renderCustomMarkdown = (md: string) => {
    if (!md) return <span className="text-gray-400 font-mono italic">기획PM 엔진이 가동 대기 중입니다...</span>;

    const lines = md.split("\n");
    return lines.map((line, idx) => {
      // Remove empty trailing or leading whitespace
      const trimmedLine = line.trim();

      // Main Headers
      if (line.startsWith("###")) {
        return (
          <h3 
            key={idx} 
            className="text-lg md:text-xl font-bold font-sans text-slate-800 dark:text-slate-100 mt-6 mb-3 flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2"
          >
            <Layers className="w-5 h-5 text-blue-600 shrink-0" />
            {line.replace("###", "").trim()}
          </h3>
        );
      }
      
      if (line.startsWith("##")) {
        return (
          <h2 
            key={idx} 
            className="text-xl md:text-2xl font-bold font-sans text-slate-900 dark:text-slate-100 mt-10 mb-4 flex items-center gap-2 bg-slate-50 dark:bg-slate-900/50 p-2 rounded-lg border border-slate-200/40 dark:border-slate-800/40"
          >
            <Sparkles className="w-5 h-5 text-blue-600 shrink-0" />
            {line.replace("##", "").trim()}
          </h2>
        );
      }

      if (line.startsWith("#")) {
        return (
          <h1 
            key={idx} 
            className="text-2xl md:text-3xl font-extrabold font-sans text-slate-900 dark:text-white border-b-2 border-slate-900 dark:border-slate-100 inline-block mt-12 mb-6 pb-1"
          >
            {line.replace("#", "").trim()}
          </h1>
        );
      }

      // List Elements
      if (line.startsWith("- ")) {
        const rawContent = line.replace("- ", "");
        // Highlight bullet key value pairs
        const splitted = rawContent.split(":");
        if (splitted.length > 1 && splitted[0].length < 30) {
          return (
            <li key={idx} className="ml-5 list-disc text-sm md:text-base text-slate-700 dark:text-slate-300 my-1 leading-relaxed font-sans">
              <strong className="text-slate-900 dark:text-white font-semibold">{splitted[0]}:</strong>
              {splitted.slice(1).join(":")}
            </li>
          );
        }
        return (
          <li key={idx} className="ml-5 list-disc text-sm md:text-base text-slate-700 dark:text-slate-300 my-1 leading-relaxed font-sans">
            {rawContent}
          </li>
        );
      }

      // Custom Blockquotes
      if (line.startsWith("> ")) {
        return (
          <blockquote key={idx} className="border-l-4 border-blue-600 pl-4 py-2.5 my-4 bg-slate-50 dark:bg-slate-900/40 rounded-r-lg italic text-sm text-slate-600 dark:text-slate-400 font-sans">
            {line.replace("> ", "").trim()}
          </blockquote>
        );
      }

      // Simple Table row renderer
      if (line.startsWith("|")) {
        // Skip header lines that are dividers: |---|---|
        if (line.includes("-+-") || line.match(/^[|\s-:]+$/)) {
          return null;
        }
        const cells = line.split("|").map(c => c.trim()).filter(Boolean);
        if (cells.length === 0) return null;

        // Is it the table header? (Let's style it strongly)
        const isHeader = idx > 0 && lines[idx - 1] && lines[idx - 1].includes("---") || idx === 0 || lines[idx + 1] && lines[idx + 1].includes("---");

        return (
          <div key={idx} className="overflow-x-auto my-2">
            <table className="min-w-full border-collapse border border-slate-200 dark:border-slate-800">
              <tbody>
                <tr className={isHeader ? "bg-slate-100/80 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 font-bold" : "border-b border-slate-100 dark:border-slate-800/55"}>
                  {cells.map((cell, cIdx) => (
                    <td 
                      key={cIdx} 
                      className={`px-3 py-2 text-xs md:text-sm border border-slate-200 dark:border-slate-800 ${isHeader ? "text-slate-800 dark:text-slate-200 font-semibold" : "text-slate-600 dark:text-slate-300"} font-sans`}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        );
      }

      // Bold syntax conversion **text** within paragraph
      if (trimmedLine.length > 0) {
        // Simple regex replace for bold
        let lineHTML = trimmedLine;
        // handle bold bold
        lineHTML = lineHTML.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        // handle inline code
        lineHTML = lineHTML.replace(/`(.*?)`/g, '<code class="bg-slate-100 dark:bg-slate-800 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded text-xs font-mono">$1</code>');

        return (
          <p 
            key={idx} 
            className="text-sm md:text-base text-slate-700 dark:text-slate-300 my-2 leading-relaxed whitespace-pre-wrap font-serif"
            dangerouslySetInnerHTML={{ __html: lineHTML }}
          />
        );
      }

      return <div key={idx} className="h-2" />;
    });
  };

  // Mock UI Feedback Rating System
  const [rating, setRating] = useState<number | null>(null);

  return (
    <div className={`min-h-screen transition-all duration-300 font-sans ${darkMode ? "bg-[#0b0f19] text-slate-100" : "bg-[#f1f5f9] text-slate-800"}`}>
      
      {/* Top-Glow Accents Header */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-blue-600" />

      {/* Main Top Header Area */}
      <header className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-4 border-b border-slate-200/80 dark:border-slate-850">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          
          {/* 영어앱 제목, 한글 제목, 한줄설명 멋진 개선 */}
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-1 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300 text-[11px] font-bold rounded uppercase tracking-wider shrink-0 border border-blue-100/50 dark:border-blue-900/30">
                PRD Spark Enterprise v1.5
              </span>
              <span className="px-2.5 py-1 bg-green-50 dark:bg-emerald-950/40 text-green-700 dark:text-emerald-300 text-[11px] font-bold rounded uppercase tracking-wider shrink-0 border border-green-100/50 dark:border-emerald-900/30">
                System Ready
              </span>
            </div>
            
            <div className="flex items-baseline gap-2.5 flex-wrap">
              <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-none font-sans">
                PRD Spark
              </h1>
              <span className="text-lg font-bold text-slate-500 dark:text-slate-400 font-sans">
                기획서 생성 마스터
              </span>
            </div>
            
            <p className="text-slate-500 dark:text-slate-400 text-xs md:text-sm mt-1.5 font-medium max-w-3xl leading-relaxed">
              회사명, 직무, 직급, 핵심 이슈만으로 30초 만에 대기업 실무자 수준의 완벽한 앱 PRD를 자동 완성하고 드래그앤드롭 다운로드, Firestore 저장 및 공유 링크 배포를 지원하는 기업 특화형 기획 가속 플랫폼
            </p>
          </div>

          {/* Right Header Navigation & Theme Support */}
          <div className="flex items-center gap-2 self-start md:self-center">
            
            {/* 우측 상단 "사용법" Button */}
            <button
              onClick={() => { setTutorialStep(0); setShowTutorial(true); }}
              id="btn-manual"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all border border-slate-200 dark:border-slate-800 cursor-pointer shadow-sm"
            >
              <HelpCircle className="w-3.5 h-3.5 text-blue-600" />
              <span>사용법 💡</span>
            </button>

            {/* Dark Mode Switcher */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              id="btn-theme-toggle"
              className="p-1.5 rounded-lg bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-all border border-slate-200 dark:border-slate-800 cursor-pointer shadow-sm"
              title="테마 전환"
            >
              {darkMode ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-blue-600" />}
            </button>

            {/* User Login Indicator & Drive Status Code */}
            {currentUser ? (
              <div className="flex items-center gap-2">
                {/* 구글 드라이브 동기화 상태 인디케이터 (파스텔 톤) */}
                <div 
                  onClick={handleGoogleDriveAuth}
                  className={`hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold border transition-all cursor-pointer hover:scale-105 active:scale-95 ${
                    driveSyncStatus === "syncing" ? "bg-amber-500/10 text-amber-500 border-amber-500/20" :
                    driveSyncStatus === "success" ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" :
                    driveSyncStatus === "error" ? "bg-rose-500/10 text-rose-500 border-rose-500/20" :
                    "bg-slate-500/10 text-indigo-500 border-indigo-500/30 hover:bg-indigo-500/5"
                  }`}
                  title="구글 드라이브(Drive) 기획서 동기화 권한 승인 및 재연동"
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    driveSyncStatus === "syncing" ? "bg-amber-500 animate-pulse" :
                    driveSyncStatus === "success" ? "bg-emerald-500" :
                    driveSyncStatus === "error" ? "bg-rose-500" :
                    "bg-indigo-400"
                  }`} />
                  <span className="font-sans">
                    {driveSyncStatus === "syncing" ? "드라이브 동기화 중..." :
                     driveSyncStatus === "success" ? "구글 Drive 연동 완료" :
                     driveSyncStatus === "error" ? "Drive 연동 실패 🔴" :
                     "구글 Drive 연동"}
                  </span>
                </div>

                <div className="flex items-center gap-2 bg-white dark:bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm">
                  <div className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900 text-[10px] font-bold text-blue-700 dark:text-blue-300 flex items-center justify-center overflow-hidden shrink-0 border border-white">
                    {currentUser.photoURL ? (
                      <img src={currentUser.photoURL} alt="user" referrerPolicy="no-referrer" />
                    ) : (
                      currentUser.displayName?.charAt(0) || "U"
                    )}
                  </div>
                  <div className="hidden sm:block text-left text-[11px]">
                    <p className="font-bold max-w-[80px] truncate text-slate-700 dark:text-slate-300">{currentUser.displayName || "Demian"}</p>
                  </div>
                  <button
                    onClick={handleLogout}
                    id="btn-logout"
                    className="p-0.5 hover:text-rose-500 text-slate-400 rounded transition-all cursor-pointer"
                    title="로그아웃"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={handleGoogleLogin}
                id="btn-login"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-950 rounded-lg text-xs font-bold transition-all shadow-sm shrink-0 cursor-pointer border border-slate-200 dark:border-slate-755"
              >
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/shinydemos/google_lettermark_color_120dp.png" alt="google" className="w-3 h-3" />
                <span>구글 로그인 / 이력 보관</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* 본문 상단 프로세스 형태 기획가이드 바 */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 my-5">
        <div className="bg-slate-50 dark:bg-slate-900/40 p-4 sm:p-5 rounded-xl border border-slate-200/70 dark:border-slate-800/80 shadow-sm text-left">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3.5 flex items-center gap-1.5 font-sans">
            <BookOpen className="w-3.5 h-3.5 text-blue-600" />
            초정밀 PM 기획 가이드 프로세스 (PRD Spark Flow)
          </h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="flex gap-2.5 bg-white dark:bg-slate-950 p-3 rounded-lg border border-slate-200/50 dark:border-slate-850">
              <span className="w-5.5 h-5.5 bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 font-bold rounded flex items-center justify-center text-xs shrink-0">1</span>
              <div>
                <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200">기본 정보 입력</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">회사명, 담당 직무, 현재 직급 기재</p>
              </div>
            </div>

            <div className="flex gap-2.5 bg-white dark:bg-slate-950 p-3 rounded-lg border border-slate-200/50 dark:border-slate-850">
              <span className="w-5.5 h-5.5 bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 font-bold rounded flex items-center justify-center text-xs shrink-0">2</span>
              <div>
                <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200">핵심 부진 요인 전개</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">현업 문제 및 요구되는 기능 사항 요약</p>
              </div>
            </div>

            <div className="flex gap-2.5 bg-white dark:bg-slate-950 p-3 rounded-lg border border-slate-200/50 dark:border-slate-850">
              <span className="w-5.5 h-5.5 bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 font-bold rounded flex items-center justify-center text-xs shrink-0">3</span>
              <div>
                <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200">AI 기획서(PRD) 빌드</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">Gemini 엔진 기반 10단계 PRD 자동 기획</p>
              </div>
            </div>

            <div className="flex gap-2.5 bg-white dark:bg-slate-950 p-3 rounded-lg border border-slate-200/50 dark:border-slate-850">
              <span className="w-5.5 h-5.5 bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 font-bold rounded flex items-center justify-center text-xs shrink-0">4</span>
              <div>
                <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200">소장, 편집 및 무한 공유</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">HTML 단일 보관 및 단축 링크 전송</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. 대시보드 및 분석관리 탭 스위치 (파스텔 톤 및 듀얼 폰트 매칭) - 관리자(Demian)만 가동 */}
      {isAdmin && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-8" id="tab-navigation">
          <div className="flex bg-slate-200/60 dark:bg-slate-900/60 p-1.5 rounded-2xl max-w-xl mx-auto border border-slate-300/30 dark:border-slate-800/40 relative">
            <button
              onClick={() => setActiveTab("builder")}
              className={`flex-1 py-3 text-xs sm:text-sm font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 font-sans ${activeTab === "builder" ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-md font-extrabold" : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"}`}
            >
              <Sparkles className="w-4 h-4 shrink-0" />
              <span>실무 기획서 실시간 빌더</span>
            </button>
            <button
              onClick={() => setActiveTab("dashboard")}
              className={`flex-1 py-3 text-xs sm:text-sm font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 font-sans ${activeTab === "dashboard" ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-md font-extrabold" : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"}`}
            >
              <Activity className="w-4 h-4 shrink-0 animate-pulse" />
              <span>클라우드 통합 분석 & 관리 대시보드</span>
            </button>
          </div>
        </section>
      )}

      {/* Main Container Grid Body (몰입형 2-Column Responsive Layout 또는 Dashboard View로 분기) */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        {activeTab === "builder" ? (
          <>
            {/* Shared View Info Bar */}
        {isSharedViewOnly && (
          <div className="mb-6 bg-amber-500/10 border border-amber-500/20 text-amber-500 dark:text-amber-300 p-4 rounded-2xl text-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Share2 className="w-5 h-5" />
              <span>현재는 <strong>공유 파라미터 링크 뷰어 모드</strong>로 진입해 있습니다. 나만의 기획서를 만드시려면 홈 모드로 돌아가십시오.</span>
            </div>
            <button 
              onClick={() => {
                window.history.pushState({}, "", window.location.pathname);
                setIsSharedViewOnly(false);
                setSelectedPRD(null);
                setEditedMarkdown("");
              }}
              className="font-bold underline hover:text-amber-400 text-xs shrink-0 pl-4 cursor-pointer"
            >
              내 메인화면 가기 🏡
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Main Dashboard Area (Forms, Samples, History Lists) */}
          <div className="lg:col-span-4 space-y-8">
            
            {/* Input Form Card */}
            {!isSharedViewOnly && (
              <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200/80 dark:border-slate-850 shadow-sm relative overflow-hidden">
                
                {/* Micro Ambient Glow */}
                <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl" />

                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <Edit2 className="w-4 h-4 text-blue-600" />
                    현업 PM 정보 입력란
                  </h2>
                  <button
                    onClick={handleResetInputs}
                    className="text-xs text-slate-400 hover:text-rose-500 font-bold transition-colors cursor-pointer"
                  >
                    초기화
                  </button>
                </div>

                <div className="space-y-4">
                  
                  {/* Company Name */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-400 dark:text-slate-550 uppercase tracking-wider block">
                      1. 회사명 (또는 도메인명)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-3 text-slate-400 dark:text-slate-500">
                        <Layers className="w-3.5 h-3.5" />
                      </span>
                      <input
                        type="text"
                        value={company}
                        onChange={(e) => setCompany(e.target.value)}
                        placeholder="예: 현대카드, 로드숍 카페, 배달 대행 등"
                        maxLength={100}
                        id="form-company"
                        className="w-full pl-9 pr-4 py-2.5 bg-slate-50/50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 focus:border-blue-600 dark:focus:border-blue-500 rounded-lg text-xs transition-all outline-none"
                      />
                    </div>
                  </div>

                  {/* Job Title & Level Twin */}
                  <div className="grid grid-cols-2 gap-35">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-400 dark:text-slate-550 uppercase tracking-wider block">
                        2. 기획자 직무
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-3 text-slate-400 dark:text-slate-500">
                          <Briefcase className="w-3.5 h-3.5" />
                        </span>
                        <input
                          type="text"
                          value={jobTitle}
                          onChange={(e) => setJobTitle(e.target.value)}
                          placeholder="예: 주니어 PM, 기획조정"
                          maxLength={50}
                          id="form-job-title"
                          className="w-full pl-9 pr-4 py-2.5 bg-slate-50/50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-blue-600 rounded-lg text-xs transition-all outline-none"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-400 dark:text-slate-550 uppercase tracking-wider block">
                        3. 연차 및 직급
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-3 text-slate-400 dark:text-slate-500">
                          <Activity className="w-3.5 h-3.5" />
                        </span>
                        <input
                          type="text"
                          value={jobLevel}
                          onChange={(e) => setJobLevel(e.target.value)}
                          placeholder="예: 수습 PM, 차장"
                          maxLength={30}
                          id="form-job-level"
                          className="w-full pl-9 pr-4 py-2.5 bg-slate-50/50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-blue-600 rounded-lg text-xs transition-all outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Core Issue text Area */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-baseline">
                      <label className="text-[11px] font-bold text-slate-400 dark:text-slate-550 uppercase tracking-wider block">
                        4. 해결할 핵심 이슈 & 앱 기획 아이디어
                      </label>
                      <span className="text-[9px] text-slate-400">{issue.length} / 1000자</span>
                    </div>
                    <textarea
                      value={issue}
                      onChange={(e) => setIssue(e.target.value)}
                      placeholder="구체적인 문제 상황을 써 주실수록, 대기업 시니어 매니저 수준의 정교한 기능 스펙과 에지케이스 복원력을 갖춘 기획안이 뽑혀 나옵니다."
                      maxLength={1000}
                      rows={5}
                      id="form-issue"
                      className="w-full px-3 py-2.5 bg-slate-50/50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 focus:border-blue-600 dark:focus:border-blue-500 rounded-lg text-xs transition-all outline-none resize-none font-sans"
                    />
                  </div>



                  {/* Primary Trigger Generate Button */}
                  <button
                    onClick={handleGeneratePRD}
                    id="btn-generate"
                    disabled={isGenerating || !company.trim() || !jobTitle.trim() || !jobLevel.trim() || !issue.trim()}
                    className="w-full py-3.5 px-5 rounded-lg font-bold text-sm text-white bg-blue-600 hover:bg-blue-700 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none cursor-pointer flex items-center justify-center gap-2 shadow-sm shadow-blue-500/10"
                  >
                    {isGenerating ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>PM AI 엔진 가동 중... (30초 소요)</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>대기업 PM 수준 PRD 초정밀 생성 🚀</span>
                      </>
                    )}
                  </button>

                </div>
              </div>
            )}

            {/* Past Generated History Dashboard (이력) */}
            <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200/80 dark:border-slate-850 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between mb-4 border-b pb-3 border-slate-100 dark:border-slate-800/50">
                <h3 className="font-bold font-sans text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-600" />
                  기존 생성 기획서 보관함 ({prdHistory.length})
                </h3>
                {isLoadingHistory && <div className="w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />}
              </div>

              {prdHistory.length === 0 ? (
                <div className="py-10 text-center text-slate-400 dark:text-slate-500 text-xs">
                  <FileText className="w-8 h-8 mx-auto opacity-30 mb-2" />
                  <span>아직 생성된 기획서가 존재하지 않습니다.<br/>상단 폼을 입력하여 기획서를 빠르게 생성해 보세요!</span>
                </div>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {prdHistory.map((prd) => (
                    <div
                      key={prd.id}
                      onClick={() => {
                        setSelectedPRD(prd);
                        setEditedMarkdown(prd.markdown);
                        setIsEditMode(false);
                      }}
                      className={`group p-3 rounded-lg border transition-all text-left cursor-pointer ${selectedPRD?.id === prd.id ? "bg-blue-50/70 border-blue-200 dark:bg-blue-950/20 dark:border-blue-900 shadow-sm" : "bg-slate-50/50 dark:bg-slate-950/20 border-slate-200/40 dark:border-slate-800/60 hover:bg-slate-100/45 dark:hover:bg-slate-900/65"}`}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200 leading-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 line-clamp-1">
                          {prd.title || "미제목 프로젝트"}
                        </h4>
                        <button
                          onClick={(e) => handleDeletePRD(prd.id, e)}
                          className="text-slate-300 hover:text-rose-500 p-1 opacity-0 group-hover:opacity-100 transition-all shrink-0 cursor-pointer"
                          title="이력 삭제"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 truncate">
                        {prd.company} | {prd.jobTitle}
                      </p>
                      <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
                        <span>{new Date(prd.createdAt).toLocaleDateString()}</span>
                        {prd.createdBy && prd.createdBy !== "guest" && (
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-0.5">
                            <span className="w-1 h-1 bg-emerald-500 rounded-full animate-ping" />
                            Cloud Sync
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Assessment Guidance Standard Card */}
            <div className="bg-slate-50 dark:bg-slate-900/40 p-4 border border-slate-200/70 dark:border-slate-800 text-left rounded-xl">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-550 mb-1.5 font-sans">가이드라인 및 평가 인가 정보</h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-sans">
                각 파트의 PRD 스펙 빌더는 강사진의 피드백 표준 평정지표 템플릿(0~9 공통 스펙)을 100% 동기화해 기출하고 있습니다. 동료간의 상호 크리티컬 피드백 및 회사 상위 검토 보고 시 우측 상단의 다운로드 버튼을 활용해 오프라인 백업 및 슬라이드 구성에 연계해 보시기 권장합니다.
              </p>
            </div>

          </div>

          {/* Right Main PRD Output Area (Viewer, Live Streaming, Quick actions) */}
          <div className="lg:col-span-8 space-y-8">
            
            {/* Main Result Card */}
            <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200/80 dark:border-slate-850 shadow-sm relative min-h-[500px] flex flex-col justify-between overflow-hidden">
              
              {/* Copy Ripple Alert Alert Box */}
              <AnimatePresence>
                {showCopiedAlert && (
                  <motion.div 
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-50 text-emerald-700 px-4 py-2 rounded-full border border-emerald-200 shadow-md text-xs font-bold flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    클립보드에 기획서 마크다운이 무사히 복사되었습니다!
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Header Box of PRD Area */}
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-150 dark:border-slate-800/80 pb-5 mb-6">
                  <div>
                    <span className="text-[10px] uppercase font-mono font-bold text-blue-600 tracking-wider">PM REAL-TIME PRD ENGINE</span>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 truncate max-w-[450px] font-sans">
                      {selectedPRD ? selectedPRD.title : generatedTitle || "실시간 기획서 대기 보드"}
                    </h2>
                  </div>

                  {/* Actions buttons */}
                  <div className="flex items-center gap-2 self-end sm:self-center">
                    {(selectedPRD || streamedText) && (
                      <button
                        onClick={handleCopyToClipboard}
                        id="btn-copy"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all border border-slate-200 dark:border-slate-700 cursor-pointer shadow-sm"
                        title="기획서 마크다운 전체 복사"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>전체 복사</span>
                      </button>
                    )}

                    {selectedPRD && (
                      <>
                        {/* 기획서 편집 모드 토글 */}
                        <button
                          onClick={() => {
                            setIsEditMode(!isEditMode);
                          }}
                          id="btn-toggle-edit"
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border cursor-pointer ${isEditMode ? "bg-pink-50 text-pink-750 border-pink-200 dark:bg-pink-950/20 dark:text-pink-300 dark:border-pink-900" : "bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 shadow-sm"}`}
                          title="기획서 직접 수정"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>{isEditMode ? "뷰 보러가기" : "소수 교정/편집"}</span>
                        </button>

                        {/* 구글 드라이브 수동/자동 동기화 저장 */}
                        <button
                          onClick={async () => {
                            if (!driveAccessToken) {
                              if (confirm("이 기획서의 원천 정보와 결과물을 지정된 구글 드라이브 폴더로 저장하려면 구글 Drive 동기화 권한을 승인해야 합니다. 지금 연동하시겠습니까?")) {
                                await handleGoogleDriveAuth();
                              }
                              return;
                            }
                            await uploadToGoogleDrive(selectedPRD, driveAccessToken);
                            alert("구글 드라이브(Drive) 지정 수거 전용 폴더에 이 기획서가 무사히 동기화 전송되었습니다!");
                          }}
                          id="btn-manual-sync"
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                            driveSyncStatus === "success"
                              ? "bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/25 dark:text-emerald-300 dark:border-emerald-900"
                              : driveSyncStatus === "syncing"
                              ? "bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/25 dark:text-amber-300 dark:border-amber-900 animate-pulse"
                              : "bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 shadow-sm"
                          }`}
                          title="구글 드라이브 지정 폴더에 실시간 백업 전송"
                        >
                          <Save className="w-3.5 h-3.5 shrink-0 text-indigo-500" />
                          <span>{driveSyncStatus === "success" ? "드라이브 저장완료 ✓" : "구글 Drive 동기화"}</span>
                        </button>

                        <button
                          onClick={handleDownloadHTML}
                          id="btn-download"
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
                          title="실무용 단일 HTML 다운로드"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>HTML 보관</span>
                        </button>

                        <button
                          onClick={async () => {
                            const origin = window.location.origin + window.location.pathname;
                            const shareUrl = `${origin}?id=${selectedPRD.id}`;
                            await navigator.clipboard.writeText(shareUrl);
                            alert(`공유용 고유 URL 링크가 단축 복사되었습니다!\n동료들에게 메신저로 전송해보세요:\n${shareUrl}`);
                          }}
                          id="btn-share-link"
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all border border-slate-200 dark:border-slate-700 cursor-pointer shadow-sm"
                          title="고유 링크 공유"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                          <span>동료 공유</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* PRD Main Text Area Inside Card */}
                <div className="text-left border border-slate-200/50 dark:border-slate-800/80 p-5 rounded-lg bg-slate-50/50 dark:bg-slate-950/20 overflow-y-auto max-h-[600px] min-h-[460px]">
                  
                  {/* Edit mode vs Render view mode */}
                  {isEditMode ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-pink-700 dark:text-pink-300 bg-pink-50 dark:bg-pink-950/20 px-2.5 py-1 rounded-full border border-pink-200/50">
                          실시간 PRD 기획서 직접 수정 모드 ✏️
                        </span>
                        <button
                          onClick={handleUpdatePRD}
                          className="flex items-center gap-1 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg cursor-pointer"
                        >
                          <Save className="w-3.5 h-3.5" />
                          수정완료 & 저장
                        </button>
                      </div>
                      <textarea
                        value={editedMarkdown}
                        onChange={(e) => setEditedMarkdown(e.target.value)}
                        className="w-full min-h-[450px] p-4 bg-white dark:bg-slate-950 font-mono text-sm border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:border-blue-600"
                      />
                    </div>
                  ) : (
                    <>
                      {isGenerating && !streamedText && (
                        <div className="flex flex-col items-center justify-center py-24 space-y-4 text-center">
                          <div className="relative">
                            <div className="w-12 h-12 border-4 border-blue-100 dark:border-blue-950/50 border-t-blue-600 rounded-full animate-spin" />
                            <Sparkles className="w-5 h-5 text-blue-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
                          </div>
                          <div>
                            <h4 className="font-bold text-sm text-slate-755 dark:text-slate-200">데미안 PM님의 실무 PM 엔진이 가동 중입니다.</h4>
                            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-sm">
                              학습자의 4대 정보를 기반으로 0번부터 9번까지 빈틈없이 구성하는 시니어 PM의 명세 초고를 드래프트 가동 중입니다.
                            </p>
                            
                            {/* Proportional Processing Progress Indicator */}
                            <div className="w-48 h-1 bg-slate-200 dark:bg-slate-800 rounded-full mx-auto mt-4 overflow-hidden relative">
                              <div className="h-full bg-blue-600 rounded-full animate-[shimmer_1.5s_infinite]" style={{ width: "70%" }} />
                            </div>
                          </div>
                        </div>
                      )}

                      {!isGenerating && !selectedPRD && !streamedText && (
                        <div className="flex flex-col items-center justify-center py-28 text-center text-slate-400 dark:text-slate-500">
                          <Layers className="w-10 h-10 stroke-1 opacity-30 mb-3 animate-bounce" />
                          <h4 className="font-bold text-sm text-slate-700 dark:text-slate-300">
                            안녕하세요, 데미안 PM님! 저는 AI 빌더 에바(Eva)입니다.
                          </h4>
                          <p className="text-xs max-w-md mt-1.5 leading-relaxed text-slate-500 dark:text-slate-400">
                            왼쪽 폼에 기획 아이디어 상황을 간략히 채워 주시고 <strong className="text-blue-600">PRD 30초 생성 버튼</strong>을 기동해 주세요. 
                            혹은 샘플추천 버튼을 클릭하시면 단 1초 만에 테스트 필드가 완성됩니다.
                          </p>
                        </div>
                      )}

                      {/* Streaming realtime content showing */}
                      {isGenerating && streamedText && (
                        <div className="prose max-w-none dark:prose-invert">
                          {renderCustomMarkdown(streamedText)}
                          <div className="flex items-center gap-2 mt-4 text-xs font-mono text-purple-600 dark:text-purple-400 animate-pulse">
                            <span className="w-2 h-2 bg-purple-500 rounded-full" />
                            <span>시니어 PM 에이전트 추가 수려 전개 중...</span>
                          </div>
                        </div>
                      )}

                      {/* Completed Document showing */}
                      {selectedPRD && !isGenerating && (
                        <div className="prose max-w-none dark:prose-invert">
                          {renderCustomMarkdown(selectedPRD.markdown)}
                        </div>
                      )}
                    </>
                  )}

                </div>
              </div>

              {/* AI가 정밀 진단한 실시간 피드백 스코어 카드 위젯 (파스텔 톤 4도) */}
              {selectedPRD && !isGenerating && (() => {
                const metrics = calculatePRDMetrics(selectedPRD);
                return (
                  <div className="mt-6 bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80 grid grid-cols-1 sm:grid-cols-3 gap-4 items-center text-center">
                    <div className="p-2.5 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold block">비즈니스 성숙도 점수 📈</span>
                      <div className="flex items-center justify-center gap-1.5 mt-1.5">
                        <div className="w-16 bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${metrics.business}%` }} />
                        </div>
                        <span className="text-xs font-black text-emerald-500 font-mono">{metrics.business}%</span>
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-blue-500/5 border border-blue-500/10">
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold block">개발 구현 실무성 💻</span>
                      <div className="flex items-center justify-center gap-1.5 mt-1.5">
                        <div className="w-16 bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-blue-500 h-full rounded-full" style={{ width: `${metrics.technical}%` }} />
                        </div>
                        <span className="text-xs font-black text-blue-500 font-mono">{metrics.technical}%</span>
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-purple-500/5 border border-purple-500/10">
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold block">예외 시나리오 방어력 🛡️</span>
                      <div className="flex items-center justify-center gap-1.5 mt-1.5">
                        <div className="w-16 bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-purple-500 h-full rounded-full" style={{ width: `${metrics.edgeCase}%` }} />
                        </div>
                        <span className="text-xs font-black text-purple-500 font-mono">{metrics.edgeCase}%</span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* User Feedback Rating */}
              {selectedPRD && !isGenerating && (
                <div className="mt-4 pt-4 border-t border-slate-150 dark:border-slate-850 flex flex-col sm:flex-row items-center justify-between gap-2.5">
                  <span className="text-xs text-slate-400 font-medium font-sans">데미안 PM님, 현재 생성된 PRD 기획안 퀄리티에 만족하시나요?</span>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => {
                          setRating(star);
                          alert(`${star}점 평가 감사드립니다! 데미안 PM님의 실무 성공 파트너 기획에 더욱 몰두하겠습니다.`);
                        }}
                        className={`text-lg transition-transform hover:scale-125 cursor-pointer ${rating && rating >= star ? "text-amber-400" : "text-slate-300"}`}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                </div>
              )}

            </div>

          </div>

        </div>
          </>
        ) : (
          <DashboardView
            prdHistory={prdHistory}
            currentUser={currentUser}
            onSelectPRD={(prd) => {
              setSelectedPRD(prd);
              setEditedMarkdown(prd.markdown);
              setIsEditMode(false);
              setActiveTab("builder");
            }}
            onDeletePRD={(prdId, ev) => handleDeletePRD(prdId, ev)}
            onDownloadHTML={(prd) => handleDownloadHTML(prd)}
            calculatePRDMetrics={calculatePRDMetrics}
            onNavigateToBuilder={() => setActiveTab("builder")}
          />
        )}
      </main>

      {/* 7. Footer: Developed by Demian 임정훈 적절하게 강조 */}
      <footer className="w-full border-t border-slate-200/50 dark:border-slate-800/50 py-10 mt-20 transition-all">
        <div className="max-w-7xl mx-auto px-4 text-center space-y-3">
          <p className="text-xs text-slate-400 tracking-wider uppercase font-mono">
            PRD Spark Platform &bull; Hyperion PM Innovation Engine
          </p>
          <p className="text-sm font-bold text-slate-600 dark:text-slate-300">
            Developed by <span className="text-transparent bg-gradient-to-r from-sky-400 via-indigo-400 to-pink-500 bg-clip-text font-black text-base px-1">Demian 임정훈</span>
          </p>
          <p className="text-xs text-slate-400 max-w-xl mx-auto leading-relaxed">
            본 서비스는 기업 IT 핵심 실무 역량을 배가시키기 위한 대기업 전용 PM 아카데미 실습 플랫폼입니다.
            <br/>&copy; 2026 PRD Spark. All rights reserved. Registered under Demian Jeonghun.
          </p>
        </div>
      </footer>

      {/* 6. 최초 접속시 단계별 세부 튜터리얼 팝업 (모달) */}
      <AnimatePresence>
        {showTutorial && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-2xl relative overflow-hidden"
            >
              <button
                onClick={closeTutorial}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mb-6">
                <div 
                  className="h-full bg-indigo-500 transition-all duration-300"
                  style={{ width: `${((tutorialStep + 1) / 3) * 100}%` }}
                />
              </div>

              {/* Step 1 */}
              {tutorialStep === 0 && (
                <div className="space-y-4 text-left">
                  <span className="text-xs font-black uppercase tracking-widest text-indigo-500 font-mono">STEP 1. 에바의 환영인사 🌸</span>
                  <h3 className="text-2xl font-black font-display text-slate-800 dark:text-slate-100">
                    안녕하세요, 데미안 PM님!
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    초정밀 기획서 자동 가동 빌더 <strong>PRD Spark</strong>에 오신 것을 진심으로 축하드립니다.
                    저는 데미안 PM님의 기획 조력 인공지능 빌더 <strong>에바(Eva)</strong>입니다. 
                    이제 복잡한 프롬프트를 일일이 작성하고 고민할 필요가 전혀 없습니다!
                  </p>
                </div>
              )}

              {/* Step 2 */}
              {tutorialStep === 1 && (
                <div className="space-y-4 text-left">
                  <span className="text-xs font-black uppercase tracking-widest text-indigo-500 font-mono">STEP 2. 단 4가지만 입력해 주세요 💡</span>
                  <h3 className="text-2xl font-black font-display text-slate-800 dark:text-slate-100">
                    회사, 직무, 직급, 핵심 이슈
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    PM님의 회사명, 담당하시는 실무 직무, 연차와 직급, 그리고 현재 마주하고 있는 핵심 애로사항이나 개진하고 싶으신 앱 아이디어를 4대 양식 폼에 채워주시기만 하면 끝납니다. 
                    혹은 준비된 인접 4종 퀵 실무 샘플(인사, IoT, 배달, 마케팅)추천 버튼을 누르시면 즉각 폼이 작성됩니다.
                  </p>
                </div>
              )}

              {/* Step 3 */}
              {tutorialStep === 2 && (
                <div className="space-y-4 text-left">
                  <span className="text-xs font-black uppercase tracking-widest text-indigo-500 font-mono">STEP 3. 보관 및 동료 공유 💾</span>
                  <h3 className="text-2xl font-black font-display text-slate-800 dark:text-slate-100">
                    로컬 보관 & 링크 배포 및 이력 복원
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    생성된 문서는 0번 개요부터 9번 성능성 로드맵까지 총 10단계를 누락 없이 가득 메우게 됩니다.
                    이 기획서는 마크다운 복사 뿐만 아니라, <strong>원클릭 단일 완성형 HTML 보관 파일</strong>로 내 컴퓨터에 다운로드가 가능합니다. 구글 로그인을 하시면 Firestore 클라우드 클라우드에 평생 안전하게 보존되며, 동료들에게 고유 단축 URL 링크로 간편하게 공유할 수도 있습니다!
                  </p>
                </div>
              )}

              {/* Tutorial Step Action buttons */}
              <div className="flex items-center justify-between mt-8 pt-4 border-t dark:border-slate-800">
                <button
                  onClick={closeTutorial}
                  className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold tracking-tight cursor-pointer"
                >
                  Skip 튜토리얼
                </button>

                <div className="flex items-center gap-2">
                  {tutorialStep > 0 && (
                    <button
                      onClick={() => setTutorialStep(tutorialStep - 1)}
                      className="px-3.5 py-1.5 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-800 cursor-pointer text-slate-600 dark:text-slate-300"
                    >
                      이전
                    </button>
                  )}

                  {tutorialStep < 2 ? (
                    <button
                      onClick={() => setTutorialStep(tutorialStep + 1)}
                      className="px-4.5 py-1.5 rounded-lg text-xs font-bold bg-indigo-500 text-white hover:bg-indigo-600 cursor-pointer flex items-center gap-1"
                    >
                      <span>다음 단계</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <button
                      onClick={closeTutorial}
                      className="px-4.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-500 text-white hover:bg-emerald-600 cursor-pointer flex items-center gap-1"
                    >
                      <span>가이드 완료 🚀</span>
                    </button>
                  )}
                </div>
              </div>

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 구글 드라이브 403 에러 해결 조치 실시간 팝업 안내 모달 (에바의 403 트러블슈팅 팝업) */}
      <AnimatePresence>
        {showDriveErrorModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-white dark:bg-slate-900 rounded-3xl max-w-xl w-full p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-2xl relative text-left"
            >
              <button
                onClick={() => setShowDriveErrorModal(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 mb-4.5 border-b pb-4 dark:border-slate-800">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5.5 h-5.5" />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900 dark:text-white font-sans tracking-tight">
                    구글 Drive 403 권한 승인 오류 해결법
                  </h3>
                  <p className="text-xs text-slate-400 font-mono mt-0.5 uppercase tracking-wider">
                    Testing App Restriction & oauth 403 access_denied
                  </p>
                </div>
              </div>

              <div className="space-y-4 text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                <p className="leading-relaxed bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-200/50 dark:border-slate-850">
                  💡 <strong>에러 원인:</strong> 구글 보안 규정상, 생성된 신규 프로젝트는 최초에 <strong className="text-amber-600 dark:text-amber-400 font-sans">'테스팅(Testing) 상태'</strong>로 시작됩니다. 
                  따라서 민감 스코프(<code className="font-mono text-[11px] bg-slate-200 text-slate-850 dark:bg-slate-800 dark:text-slate-300 px-1 py-0.5 rounded">drive.file</code>)를 요청할 때, 구글 콘솔에 등록되지 않은 테스터 또는 검증되지 않은 외부 계정의 로그인을 차단하여 성사되지 않는 것입니다.
                </p>

                <div className="space-y-2.5">
                  <p className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                    <span>🚀 10초 만에 해결하는 초간편 자가 조치 방법:</span>
                  </p>
                  
                  <div className="space-y-3 pl-1">
                    <div className="flex gap-2.5">
                      <span className="w-5 h-5 bg-indigo-500 text-white rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">1</span>
                      <div className="space-y-2">
                        <p className="font-bold text-slate-800 dark:text-slate-200 leading-normal">구글 클라우드 콘솔 설정으로 이동</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                          데미안 PM님 계정의 구글 클라우드 제어센터로 이동합니다. 아래 전용 설정 링크를 클릭해 주십시오.
                        </p>
                        <a 
                          href="https://console.cloud.google.com/apis/credentials/consent?project=gen-lang-client-0249517805" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-all shadow-sm cursor-pointer border border-transparent"
                        >
                          <span>🌐 내 구글 Cloud 콘솔 OAuth 제어판 이동 ↗</span>
                        </a>
                      </div>
                    </div>

                    <div className="flex gap-2.5 pt-1.5">
                      <span className="w-5 h-5 bg-indigo-500 text-white rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">2</span>
                      <div>
                        <p className="font-bold text-slate-800 dark:text-slate-200 leading-normal">방법 A. 앱 게시(게시 상태를 프로덕션으로 전환) - <strong className="text-emerald-500 font-medium">가장 추천</strong></p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mt-0.5">
                          구글 콘솔 페이지 중단에 위치한 **'앱 게시 (PUBLISH APP)'** 버튼을 클릭하여 게시 상태를 **[앱이 작동하는 상태 (In Production)]**로 변경해 주십시오. 
                          변경 후에는 경고창 우회(고급 &gt; 이동)를 통해 즉각 아무 구글 계정으로나 드라이브 전송이 가능해집니다!
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2.5 pt-1.5">
                      <span className="w-5 h-5 bg-indigo-500 text-white rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">3</span>
                      <div>
                        <p className="font-bold text-slate-800 dark:text-slate-200 leading-normal">방법 B. 테스트 사용자 추가하기</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mt-0.5">
                          또는 구글 콘솔 OAuth 동의 화면 아래쪽 **[Test users (테스트 사용자)]** 섹션에서 **[+ ADD USERS (+ 사용자 추가)]** 버튼을 눌러 승인받으실 이메일(<code className="font-mono text-[11px] bg-slate-100 text-slate-800 dark:bg-slate-850 dark:text-slate-200 px-1 py-0.5 rounded">emilmaxknauer@gmail.com</code> 및 <code className="font-mono text-[11px] bg-slate-100 text-slate-800 dark:bg-slate-850 dark:text-slate-200 px-1 py-0.5 rounded">rescuemyself@gmail.com</code>)을 추가 저장해 주셔도 됩니다.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 대안 제시: 일반 구글 로그인 (드라이브 제외) */}
                <div className="mt-5.5 bg-blue-50/50 dark:bg-blue-950/15 p-4 rounded-xl border border-blue-200/50 dark:border-blue-900/30 text-center space-y-3">
                  <p className="text-xs font-semibold text-blue-800 dark:text-blue-300 leading-normal">
                    💡 설정 변경이 번거로우신가요? <br/>
                    일단 드라이브(Drive) 연동을 제외한 <strong>'일반 구글 로그인'</strong>만 진행하셔도 모든 기획서는 Firestore 실시간 클라우드 DB에 철저히 안전하게 영구 저장됩니다!
                  </p>
                  <button
                    onClick={async () => {
                      setShowDriveErrorModal(false);
                      await handleGoogleLogin();
                    }}
                    className="w-full py-2 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-950 font-bold text-xs rounded-lg transition-all shadow-sm border border-slate-200 dark:border-slate-800 cursor-pointer"
                  >
                    🔒 드라이브 권한 제외하고 안전하게 구글 로그인하기
                  </button>
                </div>
              </div>

              <div className="flex justify-end mt-6.5 pt-4 border-t dark:border-slate-800">
                <button
                  onClick={() => setShowDriveErrorModal(false)}
                  className="px-5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs cursor-pointer transition-all"
                >
                  확인 후 창 닫기
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
