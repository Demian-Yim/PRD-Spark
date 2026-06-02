import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Body parser limit increase for handling markdown contents
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));

  // API endpoint for PRD Generation
  app.post("/api/generate-prd", async (req, res) => {
    const { company, jobTitle, jobLevel, issue } = req.body;

    if (!company || !jobTitle || !jobLevel || !issue) {
      return res.status(400).json({ error: "모든 4대 정보(회사명, 직무, 직급, 핵심 이슈)를 입력해 주세요." });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ 
        error: "Gemini API Key가 서버에 설정되지 않았습니다. AI Studio의 Settings > Secrets 패널에서 GEMINI_API_KEY를 등록해 주세요." 
      });
    }

    try {
      // Initialize Gemini Client
      const ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          }
        }
      });

      // 0번부터 9번까지 빈틈없는 엔터프라이즈급 실무 PRD 메가 프롬프트 지시문
      const systemInstruction = `
당신은 대기업(네카라쿠배, 글로벌 테크 기업 수준)의 수석 프로덕트 매니저(Principal PM)이자 IT 기획 실무 최고 권위자입니다.
학습자가 제공하는 4가지 원천 정보(회사명, 직무, 직급, 핵심 이슈)를 분석하여, "실무에 즉시 적용 가능하고 기업 실습 강의에서 최우수 평가를 받을 수 있는" 초고화질/고밀도의 대기업 수준 앱 PRD(Product Requirement Document)를 생성하세요.

**작성 규칙 & 가드레일**:
1. 절대 내용을 생략하거나 요약하지 마십시오.
2. 0번부터 9번까지의 모든 섹션을 빈틈없이 꽉 채워 작성하며, 번호를 임의로 변경하거나 누락하지 마십시오.
3. 전문적이고 비즈니스적인 고밀도 실무 언어(한국어)를 사용하며, 지나친 잡담이나 미사여구를 배제하고 '구조적 텍스트와 풍부한 세부 스펙'에 집중하십시오.
4. LLM 특성상의 끊김이나 형식 이탈을 방지하기 위해 각 세부 항목별 내용(Flow)을 단계적으로 마크다운 문법으로 꼼꼼히 채워야 합니다.

**PRD 표준 10단계 구조 (0번 ~ 9번) 필수 채우기**:
### [0] 개요 및 제품 비젼 (Overview & Vision)
- **제안 프로젝트 명**: (원클릭 아이데이션이 가미된 직관적이고 완성도 높은 제품명)
- **문제 정의**: (학습자가 제시한 핵심 이슈를 시장 상황과 기업 도메인을 고려해 3차원 입체 분석한 내용)
- **해결 방안 및 비전**: (이 앱이 도달하고자 하는 비전과 핵심 가치 제안)

### [1] 타겟 유저 페르소나 (Target User Persona)
- **주 사용자의 구체적 정의**: (가상의 직급, 라이프사이클, 하루 일과, Pain Point 포함)
- **세컨더리/보조 사용자**: (함께 연동되어 사용하는 내부 직원 또는 인접 협업자)

### [2] 핵심 기능 목록 (Core Feature Set)
- 핵심 기능을 상/중/하 우선순위(MoSCoW 기법)로 나누어 표(Markdown Table) 형태로 리스트업하고, 각 기능이 갖는 기술적/비즈니스적 효과 기술.

### [3] 상세 사용자 여정 지도 (User Journey Map)
- 사용자가 앱을 인지하고 실행하여 목표를 달성할 때까지의 5단계 주요 전환 과정 (관람, 탐색, 해결, 만족, 공유)에서 각 단계별 감정, 행동, 극복 요소를 매우 상세히 묘사.

### [4] 정보 구조도 (Information Architecture, IA)
- 사용자가 보는 화면 트리 구조를 텍스트 디렉토리 트리나 구조화된 리스트 형태로 전개 (예: /Home - 대시보드 - 검색 등).

### [5] 핵심 기획 명세 (Detailed Functional Specifications)
- 가장 핵심이 되는 유저 플로우 및 UI 인터랙션 설계, 데이터 입출력 필드(Input/Output) 정의 등 개발자가 바로 코딩할 수 있을 정도의 기획적 상세 스펙을 정리.

### [6] 비기능적 요구사항 (Non-functional Requirements)
- 응답 속도, 보안성(PII 보호, 권한 분리), 호환성(다양한 크기/기기), 안정성 기준 제시.

### [7] 예외 상황 처리 및 에지 케이스 (Edge Cases & Exception Handling)
- 네트워크 단절, 데이터 미입력(빈 값), 권한 없음, 비정상적 기동 등 3가지 이상의 예측 가능한 장애 유저 시나리오와 시스템 복구/가이드 방안 수립.

### [8] 트래킹 핵심 지표 및 성공 지표 (KPI & Data tracking)
- 제품 출시 후 성과 측정을 위한 정량적/정성적 지표 설정 (예: 북극성 지표, 활성 유저, 전환율 등).

### [9] 향후 성능 개선 로드맵 (Future Feature Roadmap)
- Phase 1 (출시 초기 안정화), Phase 2 (AI 기능 고도화), Phase 3 (플랫폼 생태계 확장)으로 구분된 확장 로드맵.
`;

      const prompt = `
학습자가 입력한 정보는 다음과 같습니다:
- 회사명: ${company}
- 담당 직무: ${jobTitle}
- 현재 직급: ${jobLevel}
- 당면한 핵심 이슈/아이디어 내용: ${issue}

이 정보를 활용하여 위의 지시안을 120% 준수한 엔터프라이즈급 실무 PRD 10단계를 성실히 작성해 주십시오. 
문서 상단에는 이 문서를 생성하게 된 비즈니스 요약과 메타데이터(출처, 생성일: 2026-06-02, PM)를 수여하여 전문적인 보고서 양식을 갖추도록 하십시오.
      `;

      // Set headers for Event-Stream (SSE)
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      // Set encoding to utf-8
      res.write(" \n"); // Initial byte send to flush headers

      const responseStream = await ai.models.generateContentStream({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.7,
        }
      });

      for await (const chunk of responseStream) {
        if (chunk.text) {
          res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
        }
      }

      res.write("data: [DONE]\n\n");
      res.end();

    } catch (error: any) {
      console.error("Gemini PRD stream generation error:", error);
      res.status(500).json({ error: error?.message || "PRD 생성 도중 서버 내부 에러가 발생했습니다." });
    }
  });

  // Serve static files in production or delegate to Vite in development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[PRD Spark Server] Running on http://0.0.0.0:${PORT} (${process.env.NODE_ENV || "development"} mode)`);
  });
}

startServer();
